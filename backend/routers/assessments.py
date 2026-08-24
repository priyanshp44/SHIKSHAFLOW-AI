"""
Assessments router — create, list, take, score, results.

Question format (same as tasks):
[
  { "id": 1, "type": "mcq"|"truefalse"|"short",
    "text": "...", "options": [...], "answer": "...", "topic": "Fractions" }
]

Scoring rules:
  - MCQ / True-False  → deterministic, scored instantly
  - Short answer      → stored, score=None until Phase 10 AI evaluation
  - topic_scores      → {"Fractions": 72.5, "Geometry": 60.0}  (pct per topic)
"""
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Assessment, AssessmentResult, Class, Enrollment, Performance, User
from schemas import AssessmentCreate, AssessmentOut, AssessmentResultOut
from auth import require_teacher, require_student

router = APIRouter(prefix="/assessments", tags=["assessments"])


# ── Scoring helper ─────────────────────────────────────────────────────────────

def _score_submission(questions: list, answers: dict) -> tuple[float, float, dict]:
    """
    Returns (earned_score, max_score, topic_scores_pct_dict).
    Short answers counted as 0 pending AI eval.
    """
    topic_correct: dict[str, int] = {}
    topic_total:   dict[str, int] = {}
    earned = 0
    max_q = 0

    for q in questions:
        qid   = str(q.get("id", ""))
        qtype = q.get("type", "mcq")
        topic = q.get("topic", "General")

        topic_total[topic] = topic_total.get(topic, 0) + 1

        if qtype in ("mcq", "truefalse"):
            max_q += 1
            correct = str(q.get("answer", "")).strip().lower()
            given   = str(answers.get(qid, "")).strip().lower()
            if given == correct:
                earned += 1
                topic_correct[topic] = topic_correct.get(topic, 0) + 1
            else:
                topic_correct.setdefault(topic, 0)
        else:
            # short answer — not auto-scored
            topic_correct.setdefault(topic, 0)

    # Per-topic percentage
    topic_scores_pct = {
        t: round(topic_correct.get(t, 0) / topic_total[t] * 100, 1)
        for t in topic_total
    }

    return float(earned), float(max_q), topic_scores_pct


# ── Teacher: create assessment ─────────────────────────────────────────────────

@router.post("", response_model=AssessmentOut, status_code=status.HTTP_201_CREATED)
def create_assessment(
    payload: AssessmentCreate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    cls = db.query(Class).filter(
        Class.id == payload.class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        raise HTTPException(status_code=403, detail="Class not found or not yours")

    assessment = Assessment(
        title=payload.title,
        class_id=payload.class_id,
        type=payload.type,
        questions=payload.questions,
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


# ── Teacher: list assessments for a class ─────────────────────────────────────

@router.get("/class/{class_id}")
def list_class_assessments(
    class_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    cls = db.query(Class).filter(
        Class.id == class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        raise HTTPException(status_code=403, detail="Class not found or not yours")

    assessments = (
        db.query(Assessment)
        .filter(Assessment.class_id == class_id)
        .order_by(Assessment.created_at.desc())
        .all()
    )

    result = []
    for a in assessments:
        results = db.query(AssessmentResult).filter(
            AssessmentResult.assessment_id == a.id
        ).all()
        enrolled = db.query(Enrollment).filter(
            Enrollment.class_id == class_id, Enrollment.status == "active"
        ).count()
        scores = [r.score / r.max_score * 100 for r in results if r.max_score > 0]
        avg = round(sum(scores) / len(scores), 1) if scores else None
        result.append({
            "id": a.id,
            "title": a.title,
            "type": a.type,
            "questions": json.loads(a.questions or "[]"),
            "created_at": a.created_at,
            "submitted": len(results),
            "enrolled": enrolled,
            "avg_score_pct": avg,
        })
    return result


# ── Teacher: class-level result analysis for an assessment ────────────────────

@router.get("/{assessment_id}/analysis")
def assessment_analysis(
    assessment_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.class_.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not your assessment")

    results = (
        db.query(AssessmentResult)
        .filter(AssessmentResult.assessment_id == assessment_id)
        .all()
    )
    enrolled = db.query(Enrollment).filter(
        Enrollment.class_id == assessment.class_id, Enrollment.status == "active"
    ).count()

    scores_pct = [r.score / r.max_score * 100 for r in results if r.max_score > 0]
    avg = round(sum(scores_pct) / len(scores_pct), 1) if scores_pct else None

    # Score distribution buckets
    strong   = sum(1 for s in scores_pct if s >= 70)
    average  = sum(1 for s in scores_pct if 50 <= s < 70)
    needs    = sum(1 for s in scores_pct if s < 50)

    # Per-topic class averages
    topic_data: dict[str, list] = {}
    for r in results:
        ts = json.loads(r.topic_scores or "{}")
        for topic, pct in ts.items():
            topic_data.setdefault(topic, []).append(pct)
    topic_avgs = {t: round(sum(v) / len(v), 1) for t, v in topic_data.items()}

    # Per-student summary
    student_rows = []
    for r in results:
        pct = round(r.score / r.max_score * 100, 1) if r.max_score > 0 else 0
        student_rows.append({
            "student_id":     r.student_id,
            "student_name":   r.student.name,
            "student_uid":    r.student.unique_id,
            "score":          r.score,
            "max_score":      r.max_score,
            "score_pct":      pct,
            "topic_scores":   json.loads(r.topic_scores or "{}"),
            "submitted_at":   r.submitted_at,
        })
    student_rows.sort(key=lambda x: x["score_pct"])

    return {
        "assessment": {
            "id": assessment.id,
            "title": assessment.title,
            "type": assessment.type,
            "class_name": assessment.class_.name,
        },
        "enrolled":    enrolled,
        "submitted":   len(results),
        "avg_score_pct": avg,
        "strong":  strong,
        "average": average,
        "needs_support": needs,
        "topic_avgs": topic_avgs,
        "students": student_rows,
    }


# ── Student: list available assessments ───────────────────────────────────────

@router.get("/mine")
def list_student_assessments(
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == student.id, Enrollment.status == "active"
    ).all()

    result = []
    for e in enrollments:
        assessments = (
            db.query(Assessment)
            .filter(Assessment.class_id == e.class_id)
            .order_by(Assessment.created_at.desc())
            .all()
        )
        for a in assessments:
            existing = db.query(AssessmentResult).filter(
                AssessmentResult.assessment_id == a.id,
                AssessmentResult.student_id == student.id,
            ).first()
            questions = json.loads(a.questions or "[]")
            result.append({
                "id":           a.id,
                "title":        a.title,
                "type":         a.type,
                "class_name":   e.class_.name,
                "class_id":     e.class_id,
                "question_count": len(questions),
                "questions":    questions,
                "status":       "completed" if existing else "pending",
                "score":        existing.score if existing else None,
                "max_score":    existing.max_score if existing else None,
                "score_pct":    round(existing.score / existing.max_score * 100, 1)
                                if existing and existing.max_score > 0 else None,
                "submitted_at": existing.submitted_at if existing else None,
            })

    result.sort(key=lambda x: (x["status"] == "completed", x["id"]))
    return result


# ── Student: submit assessment ─────────────────────────────────────────────────

@router.post("/{assessment_id}/submit", response_model=AssessmentResultOut)
def submit_assessment(
    assessment_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Verify enrollment
    enrolled = db.query(Enrollment).filter(
        Enrollment.student_id == student.id,
        Enrollment.class_id == assessment.class_id,
        Enrollment.status == "active",
    ).first()
    if not enrolled:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    # Prevent re-submission
    if db.query(AssessmentResult).filter(
        AssessmentResult.assessment_id == assessment_id,
        AssessmentResult.student_id == student.id,
    ).first():
        raise HTTPException(status_code=409, detail="Already submitted")

    questions = json.loads(assessment.questions or "[]")
    try:
        answers = payload.get("answers", {})
        if isinstance(answers, str):
            answers = json.loads(answers)
    except Exception:
        answers = {}

    score, max_score, topic_scores_pct = _score_submission(questions, answers)

    result = AssessmentResult(
        student_id=student.id,
        assessment_id=assessment_id,
        score=score,
        max_score=max_score,
        topic_scores=json.dumps(topic_scores_pct),
    )
    db.add(result)

    # Update Performance table for every topic scored
    for topic, pct in topic_scores_pct.items():
        perf = db.query(Performance).filter(
            Performance.student_id == student.id,
            Performance.class_id == assessment.class_id,
            Performance.topic == topic,
        ).first()
        if perf:
            # Rolling average
            perf.avg_score = round((perf.avg_score + pct) / 2, 1)
            from datetime import datetime
            perf.updated_at = datetime.utcnow()
        else:
            db.add(Performance(
                student_id=student.id,
                class_id=assessment.class_id,
                subject=assessment.class_.subject,
                topic=topic,
                avg_score=pct,
                task_completion=0.0,
            ))

    db.commit()
    db.refresh(result)
    return result


# ── Student: get my result ─────────────────────────────────────────────────────

@router.get("/{assessment_id}/my-result")
def my_result(
    assessment_id: int,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    result = db.query(AssessmentResult).filter(
        AssessmentResult.assessment_id == assessment_id,
        AssessmentResult.student_id == student.id,
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="No result found")

    assessment = result.assessment
    questions  = json.loads(assessment.questions or "[]")
    topic_scores = json.loads(result.topic_scores or "{}")
    score_pct = round(result.score / result.max_score * 100, 1) if result.max_score > 0 else 0

    return {
        "assessment_id":   assessment_id,
        "assessment_title": assessment.title,
        "score":           result.score,
        "max_score":       result.max_score,
        "score_pct":       score_pct,
        "topic_scores":    topic_scores,
        "feedback":        result.feedback,
        "submitted_at":    result.submitted_at,
        "question_count":  len(questions),
    }
