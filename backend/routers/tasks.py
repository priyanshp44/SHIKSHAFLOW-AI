"""
Tasks router — CRUD for tasks and submissions.

Question JSON format stored in Task.questions:
[
  {
    "id": 1,
    "type": "mcq",           // "mcq" | "truefalse" | "short"
    "text": "What is 2+2?",
    "options": ["2","3","4","5"],   // only for mcq
    "answer": "4"                   // correct answer (or "True"/"False")
  },
  ...
]
"""
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Class, Task, TaskSubmission, Enrollment, User
from schemas import TaskCreate, TaskOut, TaskSubmissionCreate, TaskSubmissionOut
from auth import require_teacher, require_student, get_current_user

router = APIRouter(prefix="/tasks", tags=["tasks"])


# ── Teacher: create task ───────────────────────────────────────────────────────

@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    cls = db.query(Class).filter(
        Class.id == payload.class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        raise HTTPException(status_code=403, detail="Class not found or not yours")

    task = Task(
        title=payload.title,
        subject=payload.subject,
        topic=payload.topic,
        class_id=payload.class_id,
        due_date=payload.due_date,
        marks=payload.marks,
        questions=payload.questions or "[]",
        ai_generated=payload.ai_generated,
        approved=True,  # manual tasks are auto-approved
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


# ── Teacher: list tasks for a class ───────────────────────────────────────────

@router.get("/class/{class_id}", response_model=list[TaskOut])
def list_class_tasks(
    class_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    cls = db.query(Class).filter(
        Class.id == class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        raise HTTPException(status_code=403, detail="Class not found or not yours")

    return db.query(Task).filter(Task.class_id == class_id).order_by(Task.created_at.desc()).all()


# ── Teacher: get task with submission summary ──────────────────────────────────

@router.get("/{task_id}/summary")
def task_summary(
    task_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.class_.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not your task")

    # Count enrolled students
    enrolled = db.query(Enrollment).filter(
        Enrollment.class_id == task.class_id, Enrollment.status == "active"
    ).count()

    submissions = db.query(TaskSubmission).filter(TaskSubmission.task_id == task_id).all()
    submitted = len(submissions)
    scores = [s.score for s in submissions if s.score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else None

    # Per-student submission details
    student_submissions = []
    for sub in submissions:
        student_submissions.append({
            "student_id": sub.student_id,
            "student_name": sub.student.name,
            "student_unique_id": sub.student.unique_id,
            "score": sub.score,
            "submitted_at": sub.submitted_at,
            "feedback": sub.feedback,
        })

    return {
        "task": {
            "id": task.id,
            "title": task.title,
            "subject": task.subject,
            "topic": task.topic,
            "marks": task.marks,
            "due_date": task.due_date,
            "ai_generated": task.ai_generated,
            "approved": task.approved,
            "questions": json.loads(task.questions or "[]"),
        },
        "enrolled": enrolled,
        "submitted": submitted,
        "pending": max(enrolled - submitted, 0),
        "avg_score": avg_score,
        "submissions": student_submissions,
    }


# ── Teacher: approve AI-generated task ────────────────────────────────────────

@router.post("/{task_id}/approve", response_model=TaskOut)
def approve_task(
    task_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.class_.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not your task")
    task.approved = True
    db.commit()
    db.refresh(task)
    return task


# ── Teacher: reject (delete) AI-generated draft ────────────────────────────────

@router.delete("/{task_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_task(
    task_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.class_.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not your task")
    if not task.ai_generated:
        raise HTTPException(status_code=400, detail="Only AI-generated drafts can be rejected this way")
    db.delete(task)
    db.commit()


# ── Teacher: list pending drafts (ai_generated, not approved) ─────────────────

@router.get("/drafts/pending")
def list_pending_drafts(
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    from models import Class as ClassModel
    teacher_class_ids = [
        c.id for c in db.query(ClassModel)
        .filter(ClassModel.teacher_id == teacher.id).all()
    ]
    drafts = db.query(Task).filter(
        Task.class_id.in_(teacher_class_ids),
        Task.ai_generated == True,
        Task.approved == False,
    ).order_by(Task.created_at.desc()).all()

    return [
        {
            "id":          t.id,
            "title":       t.title,
            "subject":     t.subject,
            "topic":       t.topic,
            "marks":       t.marks,
            "class_id":    t.class_id,
            "class_name":  t.class_.name,
            "questions":   json.loads(t.questions or "[]"),
            "created_at":  t.created_at,
        }
        for t in drafts
    ]


# ── Teacher: delete task ───────────────────────────────────────────────────────

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.class_.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not your task")
    db.delete(task)
    db.commit()


# ── Student: list my tasks ─────────────────────────────────────────────────────

@router.get("/mine")
def list_student_tasks(
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == student.id, Enrollment.status == "active"
    ).all()

    result = []
    for e in enrollments:
        tasks = db.query(Task).filter(
            Task.class_id == e.class_id, Task.approved == True
        ).order_by(Task.due_date.asc()).all()

        for t in tasks:
            sub = db.query(TaskSubmission).filter(
                TaskSubmission.task_id == t.id,
                TaskSubmission.student_id == student.id,
            ).first()
            result.append({
                "id": t.id,
                "title": t.title,
                "subject": t.subject,
                "topic": t.topic,
                "due_date": t.due_date,
                "marks": t.marks,
                "class_name": e.class_.name,
                "class_id": e.class_id,
                "questions": json.loads(t.questions or "[]"),
                "status": "completed" if sub else "pending",
                "score": sub.score if sub else None,
                "feedback": sub.feedback if sub else None,
                "submission_id": sub.id if sub else None,
            })

    # Sort: pending first, then by due_date
    result.sort(key=lambda x: (x["status"] == "completed", x["due_date"] or datetime.max))
    return result


# ── Student: submit task ───────────────────────────────────────────────────────

@router.post("/{task_id}/submit", response_model=TaskSubmissionOut)
def submit_task(
    task_id: int,
    payload: TaskSubmissionCreate,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    task = db.query(Task).filter(Task.id == task_id, Task.approved == True).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Verify student is enrolled
    enrolled = db.query(Enrollment).filter(
        Enrollment.student_id == student.id,
        Enrollment.class_id == task.class_id,
        Enrollment.status == "active",
    ).first()
    if not enrolled:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    # Prevent duplicate submission
    existing = db.query(TaskSubmission).filter(
        TaskSubmission.task_id == task_id,
        TaskSubmission.student_id == student.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already submitted")

    # Auto-score MCQ and true/false questions
    questions = json.loads(task.questions or "[]")
    try:
        answers = json.loads(payload.answers)
    except Exception:
        answers = {}

    earned = 0
    total_auto = 0
    has_short = False

    for q in questions:
        qid = str(q.get("id", ""))
        qtype = q.get("type", "mcq")
        if qtype in ("mcq", "truefalse"):
            total_auto += 1
            correct = str(q.get("answer", "")).strip().lower()
            given = str(answers.get(qid, "")).strip().lower()
            if given == correct:
                earned += 1
        elif qtype == "short":
            has_short = True

    # Score as percentage of auto-scored questions
    # Short answers get full marks pending AI review (Phase 10)
    short_count = sum(1 for q in questions if q.get("type") == "short")
    auto_count = len(questions) - short_count
    if auto_count > 0:
        score = round((earned / auto_count) * task.marks, 2)
    elif short_count > 0:
        score = None  # deferred to AI evaluation
    else:
        score = 0

    sub = TaskSubmission(
        task_id=task_id,
        student_id=student.id,
        answers=payload.answers,
        score=score,
        feedback="Short answer questions will be evaluated shortly." if has_short and auto_count == 0 else None,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


# ── Student: get my submission for a task ─────────────────────────────────────

@router.get("/{task_id}/my-submission")
def get_my_submission(
    task_id: int,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    sub = db.query(TaskSubmission).filter(
        TaskSubmission.task_id == task_id,
        TaskSubmission.student_id == student.id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="No submission found")

    task = sub.task
    questions = json.loads(task.questions or "[]")
    answers = json.loads(sub.answers or "{}")

    # Build question-by-question result
    question_results = []
    for q in questions:
        qid = str(q.get("id", ""))
        qtype = q.get("type", "mcq")
        given = answers.get(qid, "")
        correct = q.get("answer", "")
        is_correct = None
        if qtype in ("mcq", "truefalse"):
            is_correct = str(given).strip().lower() == str(correct).strip().lower()
        question_results.append({
            "id": qid,
            "text": q.get("text", ""),
            "type": qtype,
            "your_answer": given,
            "correct_answer": correct if qtype != "short" else None,
            "is_correct": is_correct,
        })

    return {
        "submission_id": sub.id,
        "task_id": task_id,
        "task_title": task.title,
        "marks": task.marks,
        "score": sub.score,
        "feedback": sub.feedback,
        "submitted_at": sub.submitted_at,
        "question_results": question_results,
    }
