"""
AI router — teacher assistant chat, context-aware prompts.

Phase 8:  /ai/chat           — class-aware free-form teacher assistant
Phase 9:  /ai/generate-task  — structured task generation (added next phase)
Phase 10: /ai/evaluate-answer — short-answer scoring (added Phase 10)
Phase 11: /ai/recommend      — personalised learning path (added Phase 11)
Phase 12: /ai/suggest-remedial— intervention task suggestion (added Phase 12)
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Class, Enrollment, User, Task, TaskSubmission,
    Assessment, AssessmentResult, Attendance, Performance, Recommendation
)
from auth import require_teacher, get_current_user
from ai.granite import generate, is_available

router = APIRouter(prefix="/ai", tags=["ai"])


# ── Context builder ────────────────────────────────────────────────────────────

def _build_class_context(class_id: int, db: Session) -> str:
    """
    Build a compact text summary of a class to inject into every prompt.
    Keeps token usage low by only including what matters.
    """
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        return ""

    enrollments = db.query(Enrollment).filter(
        Enrollment.class_id == class_id, Enrollment.status == "active"
    ).all()
    student_ids = [e.student_id for e in enrollments]
    n = len(student_ids)

    # Average assessment score
    all_scores = []
    for sid in student_ids:
        for r in db.query(AssessmentResult).filter(AssessmentResult.student_id == sid).all():
            if r.max_score > 0:
                all_scores.append(round(r.score / r.max_score * 100, 1))
    avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else None

    # Average attendance
    att_pcts = []
    for sid in student_ids:
        recs = db.query(Attendance).filter(
            Attendance.student_id == sid, Attendance.class_id == class_id
        ).all()
        if recs:
            att_pcts.append(sum(1 for r in recs if r.status == "present") / len(recs) * 100)
    avg_att = round(sum(att_pcts) / len(att_pcts), 1) if att_pcts else None

    # Topic performance
    topic_data: dict = {}
    for sid in student_ids:
        for p in db.query(Performance).filter(
            Performance.student_id == sid, Performance.class_id == class_id
        ).all():
            topic_data.setdefault(p.topic, []).append(p.avg_score)
    topic_avgs = {t: round(sum(v) / len(v), 1) for t, v in topic_data.items()}

    weak_topics   = sorted([(t, v) for t, v in topic_avgs.items() if v < 60], key=lambda x: x[1])
    strong_topics = sorted([(t, v) for t, v in topic_avgs.items() if v >= 70], key=lambda x: -x[1])

    # At-risk count
    at_risk = 0
    for sid in student_ids:
        s_scores = [r.score / r.max_score * 100 for r in
                    db.query(AssessmentResult).filter(AssessmentResult.student_id == sid).all()
                    if r.max_score > 0]
        s_avg = round(sum(s_scores) / len(s_scores), 1) if s_scores else 0
        if s_avg < 55:
            at_risk += 1

    lines = [
        f"Class: {cls.name} | Subject: {cls.subject} | Students: {n}",
    ]
    if avg_score is not None:
        lines.append(f"Class average score: {avg_score}%")
    if avg_att is not None:
        lines.append(f"Average attendance: {avg_att}%")
    if weak_topics:
        wt = ", ".join(f"{t} ({v}%)" for t, v in weak_topics[:3])
        lines.append(f"Weak topics: {wt}")
    if strong_topics:
        st = ", ".join(f"{t} ({v}%)" for t, v in strong_topics[:2])
        lines.append(f"Strong topics: {st}")
    if at_risk:
        lines.append(f"Students needing attention: {at_risk}")

    return "\n".join(lines)


def _build_student_context(student_id: int, class_id: int, db: Session) -> str:
    """Compact student context for recommendation / remedial prompts."""
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        return ""

    results = db.query(AssessmentResult).filter(
        AssessmentResult.student_id == student_id
    ).order_by(AssessmentResult.submitted_at.desc()).limit(5).all()
    scores = [round(r.score / r.max_score * 100, 1) for r in results if r.max_score > 0]
    avg = round(sum(scores) / len(scores), 1) if scores else None

    perfs = db.query(Performance).filter(
        Performance.student_id == student_id,
        Performance.class_id == class_id,
    ).order_by(Performance.avg_score.asc()).all()
    weak   = [p.topic for p in perfs if p.avg_score < 60]
    strong = [p.topic for p in perfs if p.avg_score >= 70]

    tasks = db.query(Task).filter(
        Task.class_id == class_id, Task.approved == True
    ).all()
    done = db.query(TaskSubmission).filter(
        TaskSubmission.student_id == student_id,
        TaskSubmission.task_id.in_([t.id for t in tasks]),
    ).count() if tasks else 0
    task_pct = round(done / len(tasks) * 100, 1) if tasks else 0

    lines = [f"Student: {student.name}"]
    if avg is not None:
        lines.append(f"Average score: {avg}%")
    lines.append(f"Task completion: {task_pct}%")
    if weak:
        lines.append(f"Weak topics: {', '.join(weak[:4])}")
    if strong:
        lines.append(f"Strong topics: {', '.join(strong[:3])}")
    return "\n".join(lines)


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    class_id: Optional[int] = None
    history: Optional[list[dict]] = None   # [{"role":"user","content":"..."}]


class ChatResponse(BaseModel):
    reply: str
    class_context_used: bool


# ── POST /ai/chat ──────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def teacher_chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    if not is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured. Set IBM_API_KEY and IBM_PROJECT_ID in your .env file.",
        )

    class_context = ""
    used_context  = False
    if payload.class_id:
        # Verify ownership
        cls = db.query(Class).filter(
            Class.id == payload.class_id, Class.teacher_id == teacher.id
        ).first()
        if cls:
            class_context = _build_class_context(payload.class_id, db)
            used_context  = bool(class_context)

    # Build conversation history string (last 6 turns max to save tokens)
    history_text = ""
    if payload.history:
        for turn in payload.history[-6:]:
            role    = turn.get("role", "user")
            content = turn.get("content", "")
            prefix  = "Teacher" if role == "user" else "Assistant"
            history_text += f"{prefix}: {content}\n"

    # Build prompt
    system = (
        "You are ShikshaFlow AI, an intelligent teaching assistant. "
        "You help teachers improve student learning outcomes. "
        "Be concise, practical, and educationally sound. "
        "Respond in plain text — no markdown, no bullet symbols unless asked."
    )

    context_block = f"\n\nClass context:\n{class_context}\n" if class_context else ""
    history_block = f"\n{history_text}" if history_text else ""

    prompt = (
        f"{system}"
        f"{context_block}"
        f"{history_block}"
        f"Teacher: {payload.message}\n"
        f"Assistant:"
    )

    try:
        reply = generate(prompt, max_tokens=512)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return ChatResponse(reply=reply, class_context_used=used_context)



# ── POST /ai/generate-task ────────────────────────────────────────────────────

class GenerateTaskRequest(BaseModel):
    class_id: int
    subject: str
    topic: str
    difficulty: str = "medium"       # easy | medium | hard
    num_questions: int = 5
    question_types: str = "mcq"      # mcq | mixed | truefalse
    target: str = "all"              # all | weak  (weak = students scoring <60%)


@router.post("/generate-task")
def generate_task(
    payload: GenerateTaskRequest,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    """
    Generate a task draft using IBM Granite.
    Saved as approved=False — teacher must approve before students see it.
    """
    if not is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured. Set IBM_API_KEY and IBM_PROJECT_ID in .env",
        )

    cls = db.query(Class).filter(
        Class.id == payload.class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        raise HTTPException(status_code=403, detail="Class not found or not yours")

    # Build class context snippet
    class_ctx = _build_class_context(payload.class_id, db)

    # Determine question format instruction
    if payload.question_types == "mcq":
        fmt = 'Each question: type "mcq", with 4 options (A-D) and one correct answer.'
    elif payload.question_types == "truefalse":
        fmt = 'Each question: type "truefalse", answer is "true" or "false".'
    else:
        fmt = 'Mix of "mcq" (with 4 options) and "short" (open-ended) questions.'

    target_note = (
        "Focus on students who are struggling (scoring below 60%)."
        if payload.target == "weak" else
        "Suitable for the whole class."
    )

    prompt = f"""You are ShikshaFlow AI, a curriculum expert creating educational assessments.

Class information:
{class_ctx}

Task to create:
- Subject: {payload.subject}
- Topic: {payload.topic}
- Difficulty: {payload.difficulty}
- Number of questions: {payload.num_questions}
- Question format: {fmt}
- Target: {target_note}

IMPORTANT: Return ONLY the JSON object.
Do NOT use Markdown.
Do NOT use ```json fences.
Do NOT explain anything.
Do NOT add text before or after the JSON.
The first character of your response MUST be {{ and the last character MUST be }}.

Use exactly this JSON structure:
{{
  "title": "descriptive task title",
  "subject": "{payload.subject}",
  "topic": "{payload.topic}",
  "questions": [
    {{
      "id": 1,
      "type": "mcq",
      "text": "question text",
      "options": ["A", "B", "C", "D"],
      "answer": "correct option text",
      "topic": "{payload.topic}"
    }}
  ]
}}

For truefalse questions omit "options".
For short questions omit "options" and set "answer" to the expected answer.
Generate exactly {payload.num_questions} questions.
"""

    try:
        raw = generate(prompt, max_tokens=3000)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


    # Parse the JSON from Granite's response
    # Granite sometimes wraps output in ```json ... ``` — strip that
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    text = text.strip()

    try:
        draft = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON from within the response
        import re
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                draft = json.loads(match.group())
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=422,
                    detail="AI returned malformed JSON. Try again or reduce question count.",
                )
        else:
            raise HTTPException(
                status_code=422,
                detail="AI did not return valid JSON. Try again.",
            )

    # Validate minimal structure
    if "questions" not in draft or not isinstance(draft["questions"], list):
        raise HTTPException(status_code=422, detail="AI response missing 'questions' array.")

    # Ensure question IDs are sequential integers
    for i, q in enumerate(draft["questions"], 1):
        q["id"] = i
        if "topic" not in q:
            q["topic"] = payload.topic

    # Save as a draft task (approved=False)
    from datetime import datetime, timedelta
    from models import Task as TaskModel
    due = datetime.utcnow() + timedelta(days=7)

    task = TaskModel(
        title=draft.get("title", f"{payload.topic} — AI Generated"),
        subject=draft.get("subject", payload.subject),
        topic=payload.topic,
        class_id=payload.class_id,
        due_date=due,
        marks=len(draft["questions"]),
        questions=json.dumps(draft["questions"]),
        ai_generated=True,
        approved=False,   # ← must be approved by teacher before students see it
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "task_id":   task.id,
        "title":     task.title,
        "subject":   task.subject,
        "topic":     task.topic,
        "marks":     task.marks,
        "questions": draft["questions"],
        "approved":  task.approved,
        "ai_generated": True,
        "message": "Draft created. Review and approve before assigning to students.",
    }



# ── GET /ai/status ─────────────────────────────────────────────────────────────

@router.get("/status")
def ai_status():
    """Check whether the AI service is configured and ready."""
    return {
        "available":   is_available(),
        "model":       __import__("os").getenv("IBM_MODEL_ID", "not set"),
        "sdk_installed": True,  # if import failed, this module wouldn't load cleanly
    }


# ── POST /ai/evaluate-answer ──────────────────────────────────────────────────

class EvaluateAnswerRequest(BaseModel):
    submission_id: int          # TaskSubmission.id
    question_id: str            # question's "id" field within the questions JSON
    student_answer: str
    expected_answer: str
    question_text: str
    topic: str = "General"
    subject: str = "General"


class EvaluateAnswerResponse(BaseModel):
    score: float                # 0.0–1.0 (fraction of full marks for this question)
    feedback: str               # plain-text explanation for the student
    is_correct: bool


@router.post("/evaluate-answer", response_model=EvaluateAnswerResponse)
def evaluate_answer(
    payload: EvaluateAnswerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evaluate a student's short-answer response using IBM Granite.
    Called after task submission for questions with type='short'.
    Updates TaskSubmission.score and .feedback in-place.
    """
    if not is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured.",
        )

    # Load the submission and verify ownership
    sub = db.query(__import__("models", fromlist=["TaskSubmission"]).TaskSubmission).filter(
        __import__("models", fromlist=["TaskSubmission"]).TaskSubmission.id == payload.submission_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Only the student who submitted OR their class teacher may request evaluation
    if current_user.role == "STUDENT" and current_user.id != sub.student_id:
        raise HTTPException(status_code=403, detail="Not your submission")

    prompt = f"""You are an educational assessment evaluator.

Subject: {payload.subject}
Topic: {payload.topic}
Question: {payload.question_text}

Expected answer: {payload.expected_answer}
Student's answer: {payload.student_answer}

Evaluate the student's answer and respond with a JSON object only (no extra text):
{{
  "score": <float 0.0 to 1.0 — 1.0 = fully correct, 0.5 = partially correct, 0.0 = incorrect>,
  "is_correct": <true if score >= 0.7>,
  "feedback": "<one to two sentences in simple language: what was right, what was wrong, what to review>"
}}

Be fair and educationally helpful. Partial credit for partially correct answers.
Output only the JSON object."""

    try:
        raw = generate(prompt, max_tokens=256)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Parse Granite's response
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    text = text.strip()

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        import re
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group())
            except json.JSONDecodeError:
                # Fallback — can't parse, return neutral feedback
                result = {"score": 0.5, "is_correct": False,
                          "feedback": "Your answer has been recorded. Full evaluation pending."}
        else:
            result = {"score": 0.5, "is_correct": False,
                      "feedback": "Your answer has been recorded. Full evaluation pending."}

    score      = float(result.get("score", 0.5))
    score      = max(0.0, min(1.0, score))   # clamp
    is_correct = bool(result.get("is_correct", score >= 0.7))
    feedback   = str(result.get("feedback", ""))

    # Update the submission: add to existing score (short answers start at None)
    task_marks = sub.task.marks
    # Each short-answer question contributes proportionally
    questions  = json.loads(sub.task.questions or "[]")
    short_qs   = [q for q in questions if q.get("type") == "short"]
    per_q_marks = task_marks / len(questions) if questions else 0
    earned      = round(score * per_q_marks, 2)

    if sub.score is None:
        sub.score = earned
    else:
        sub.score = round(sub.score + earned, 2)

    # Append feedback to submission
    existing_fb = sub.feedback or ""
    new_fb = f"Q{payload.question_id}: {feedback}"
    sub.feedback = (existing_fb + "\n" + new_fb).strip()

    db.commit()

    return EvaluateAnswerResponse(score=score, feedback=feedback, is_correct=is_correct)


# ── POST /ai/evaluate-submission ──────────────────────────────────────────────

class EvaluateSubmissionRequest(BaseModel):
    submission_id: int    # evaluate ALL short-answer questions in one call


@router.post("/evaluate-submission")
def evaluate_full_submission(
    payload: EvaluateSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evaluate all short-answer questions in a TaskSubmission in one pass.
    Returns updated score and per-question feedback list.
    """
    if not is_available():
        raise HTTPException(status_code=503, detail="AI service not configured.")

    from models import TaskSubmission as TS
    sub = db.query(TS).filter(TS.id == payload.submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if current_user.role == "STUDENT" and current_user.id != sub.student_id:
        raise HTTPException(status_code=403, detail="Not your submission")

    task      = sub.task
    questions = json.loads(task.questions or "[]")
    answers   = json.loads(sub.answers or "{}")
    subject   = task.subject
    topic     = task.topic

    short_qs  = [q for q in questions if q.get("type") == "short"]
    if not short_qs:
        return {"message": "No short-answer questions to evaluate", "score": sub.score}

    per_q_weight = task.marks / len(questions) if questions else 0
    total_earned = sub.score or 0.0
    feedbacks    = []

    for q in short_qs:
        qid           = str(q.get("id", ""))
        student_ans   = str(answers.get(qid, "")).strip()
        expected_ans  = str(q.get("answer", "")).strip()
        q_text        = q.get("text", "")
        q_topic       = q.get("topic", topic)

        if not student_ans:
            feedbacks.append({"question_id": qid, "feedback": "No answer provided.", "score": 0.0})
            continue

        prompt = f"""Subject: {subject}, Topic: {q_topic}
Question: {q_text}
Expected answer: {expected_ans}
Student answer: {student_ans}

Reply with JSON only:
{{"score": <0.0-1.0>, "is_correct": <bool>, "feedback": "<1-2 sentences>"}}"""

        try:
            raw    = generate(prompt, max_tokens=200)
            text   = raw.strip()
            if text.startswith("```"):
                parts = text.split("\n")
                text  = "\n".join(parts[1:-1] if parts[-1].strip() == "```" else parts[1:])
            res    = json.loads(text.strip())
        except Exception:
            import re as _re
            match  = _re.search(r'\{.*\}', raw, _re.DOTALL) if 'raw' in dir() else None
            res    = json.loads(match.group()) if match else {"score": 0.5, "is_correct": False, "feedback": "Evaluation pending."}

        q_score   = max(0.0, min(1.0, float(res.get("score", 0.5))))
        q_earned  = round(q_score * per_q_weight, 2)
        total_earned = round(total_earned + q_earned, 2)
        fb_text   = str(res.get("feedback", ""))
        feedbacks.append({"question_id": qid, "feedback": fb_text, "score": q_score})

    # Update submission
    sub.score    = round(total_earned, 2)
    sub.feedback = "\n".join(f"Q{f['question_id']}: {f['feedback']}" for f in feedbacks)
    db.commit()

    return {
        "submission_id": sub.id,
        "score":         sub.score,
        "max_score":     task.marks,
        "feedbacks":     feedbacks,
    }


# ── POST /ai/recommend ─────────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    student_id: int
    class_id: int


@router.post("/recommend")
def generate_recommendation(
    payload: RecommendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a personalised learning path for a student using IBM Granite.
    Saves result to the Recommendation table and returns the path.
    Callable by the student themselves or their class teacher.
    """
    # Verify access — student can only request their own, teacher must own the class
    if current_user.role == "STUDENT" and current_user.id != payload.student_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Cannot request another student's recommendation")
    if current_user.role == "TEACHER":
        cls = db.query(Class).filter(
            Class.id == payload.class_id, Class.teacher_id == current_user.id
        ).first()
        if not cls:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Class not found or not yours")

    student_ctx = _build_student_context(payload.student_id, payload.class_id, db)

    if not is_available():
        # Fallback: rule-based recommendation when AI is unavailable
        perfs = db.query(Performance).filter(
            Performance.student_id == payload.student_id,
            Performance.class_id == payload.class_id,
        ).order_by(Performance.avg_score.asc()).all()
        steps = []
        for p in perfs[:4]:
            if p.avg_score < 60:
                steps.append(f"{p.topic} — Basics")
                steps.append(f"{p.topic} — Practice Quiz")
            elif p.avg_score < 75:
                steps.append(f"{p.topic} — Intermediate Practice")
        if not steps:
            steps = ["Continue revising class topics", "Attempt all assigned tasks"]
        path = [{"step": i + 1, "topic": s, "type": "practice"} for i, s in enumerate(steps[:6])]
    else:
        prompt = f"""You are ShikshaFlow AI, an adaptive learning path generator.

Student profile:
{student_ctx}

Generate a personalised learning path with 4–6 steps to help this student improve.
Each step should address a weak topic with a specific activity.

Respond with a JSON array only (no extra text):
[
  {{"step": 1, "topic": "string", "activity": "string — specific practice or concept to review", "type": "concept|practice|quiz|revision"}},
  ...
]

Keep activities specific, actionable, and grade-appropriate. Output only the JSON array."""

        try:
            raw = generate(prompt, max_tokens=600)
        except RuntimeError as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=503, detail=str(e))

        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        text = text.strip()

        import re as _re
        # Extract the JSON array
        if not text.startswith("["):
            match = _re.search(r'\[.*\]', text, _re.DOTALL)
            text = match.group() if match else "[]"
        try:
            path = json.loads(text)
        except json.JSONDecodeError:
            path = [{"step": 1, "topic": "General Review", "activity": "Review class notes and attempt practice questions.", "type": "revision"}]

        # Ensure sequential steps
        for i, s in enumerate(path):
            s["step"] = i + 1

    # Save to Recommendation table (mark old ones inactive)
    db.query(Recommendation).filter(
        Recommendation.student_id == payload.student_id,
        Recommendation.class_id == payload.class_id,
        Recommendation.status == "active",
    ).update({"status": "archived"})

    rec = Recommendation(
        student_id=payload.student_id,
        class_id=payload.class_id,
        content=json.dumps(path),
        status="active",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {
        "recommendation_id": rec.id,
        "student_id": payload.student_id,
        "class_id": payload.class_id,
        "path": path,
        "generated_at": rec.generated_at,
    }


# ── POST /ai/suggest-remedial ─────────────────────────────────────────────────

class SuggestRemedialRequest(BaseModel):
    class_id: int
    topic: str                      # weak topic to address
    target: str = "weak"            # "weak" = students below 60%, "all" = full class


@router.post("/suggest-remedial")
def suggest_remedial_task(
    payload: SuggestRemedialRequest,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    """
    Suggest a remedial task plan for a weak topic in the class.
    Returns a suggestion — teacher chooses whether to generate a full task.
    Does NOT auto-create or auto-assign anything.
    """
    cls = db.query(Class).filter(
        Class.id == payload.class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Class not found or not yours")

    # Count students weak in this topic
    enrollments = db.query(Enrollment).filter(
        Enrollment.class_id == payload.class_id, Enrollment.status == "active"
    ).all()
    student_ids = [e.student_id for e in enrollments]

    weak_students = []
    for sid in student_ids:
        p = db.query(Performance).filter(
            Performance.student_id == sid,
            Performance.class_id == payload.class_id,
            Performance.topic == payload.topic,
        ).first()
        if p and p.avg_score < 60:
            student = db.query(User).filter(User.id == sid).first()
            if student:
                weak_students.append({"name": student.name, "score": round(p.avg_score, 1)})

    total = len(student_ids)
    weak_count = len(weak_students)

    if not is_available():
        suggestion = {
            "topic": payload.topic,
            "weak_count": weak_count,
            "total_students": total,
            "weak_students": weak_students,
            "suggested_title": f"{payload.topic} — Remedial Practice",
            "suggested_difficulty": "easy",
            "suggested_types": "mcq",
            "suggested_num_questions": 8,
            "rationale": f"{weak_count} out of {total} students scored below 60% in {payload.topic}.",
            "ai_available": False,
        }
        return suggestion

    class_ctx = _build_class_context(payload.class_id, db)
    prompt = f"""You are ShikshaFlow AI, a curriculum specialist.

Class: {cls.name} | Subject: {cls.subject}
Weak topic: {payload.topic}
{weak_count} out of {total} students scored below 60% in this topic.

Class performance summary:
{class_ctx}

Suggest a remedial task strategy. Reply with a JSON object only:
{{
  "suggested_title": "string — descriptive task title",
  "suggested_difficulty": "easy|medium",
  "suggested_types": "mcq|mixed|truefalse",
  "suggested_num_questions": <integer 5-10>,
  "rationale": "string — 1-2 sentences explaining why this approach will help",
  "focus_areas": ["string", ...]
}}

Output only the JSON object."""

    try:
        raw = generate(prompt, max_tokens=400)
    except RuntimeError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=str(e))

    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    text = text.strip()

    import re as _re2
    try:
        suggestion_ai = json.loads(text)
    except json.JSONDecodeError:
        match = _re2.search(r'\{.*\}', text, _re2.DOTALL)
        suggestion_ai = json.loads(match.group()) if match else {}

    return {
        "topic": payload.topic,
        "weak_count": weak_count,
        "total_students": total,
        "weak_students": weak_students[:10],  # cap to avoid large payload
        "ai_available": True,
        **suggestion_ai,
    }
