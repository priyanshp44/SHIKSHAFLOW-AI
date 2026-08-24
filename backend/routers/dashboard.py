"""
Dashboard router — aggregated stats for teacher and student dashboards.
All data computed from existing DB records (tasks, submissions, assessments,
attendance, performance, recommendations).
"""
import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Class, Enrollment, Task, TaskSubmission,
    Assessment, AssessmentResult, Attendance, Performance, Recommendation, User
)
from auth import require_teacher, require_student

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _calc_streak(student_id: int, db: Session) -> int:
    """Count consecutive days with present attendance up to today."""
    records = (
        db.query(Attendance)
        .filter(Attendance.student_id == student_id, Attendance.status == "present")
        .order_by(Attendance.date.desc())
        .all()
    )
    if not records:
        return 0
    dates = sorted({r.date for r in records}, reverse=True)
    streak = 0
    expected = date.today()
    for d in dates:
        if d == expected or d == expected - timedelta(days=1):
            streak += 1
            expected = d - timedelta(days=1)
        else:
            break
    return streak


def _student_summary(student_id: int, class_id: int, db: Session) -> dict:
    """Per-student stats used by both teacher and student dashboards."""
    # Tasks
    tasks = db.query(Task).filter(Task.class_id == class_id, Task.approved == True).all()
    task_ids = [t.id for t in tasks]
    submissions = (
        db.query(TaskSubmission)
        .filter(TaskSubmission.student_id == student_id,
                TaskSubmission.task_id.in_(task_ids))
        .all()
    ) if task_ids else []
    tasks_done = len(submissions)
    tasks_total = len(tasks)
    task_completion_pct = round((tasks_done / tasks_total * 100) if tasks_total else 0, 1)

    # Assessment scores
    results = db.query(AssessmentResult).filter(
        AssessmentResult.student_id == student_id
    ).all()
    avg_score = 0.0
    if results:
        pcts = [r.score / r.max_score * 100 for r in results if r.max_score > 0]
        avg_score = round(sum(pcts) / len(pcts), 1) if pcts else 0.0

    # Attendance
    att_records = db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.class_id == class_id,
    ).all()
    present = sum(1 for a in att_records if a.status == "present")
    att_pct = round((present / len(att_records) * 100) if att_records else 0, 1)

    # Weak topics (avg_score < 60)
    perfs = db.query(Performance).filter(
        Performance.student_id == student_id,
        Performance.class_id == class_id,
    ).all()
    weak_topics = [p.topic for p in perfs if p.avg_score < 60]

    # Streak
    streak = _calc_streak(student_id, db)

    return {
        "avg_score": avg_score,
        "attendance_pct": att_pct,
        "tasks_done": tasks_done,
        "tasks_total": tasks_total,
        "task_completion_pct": task_completion_pct,
        "streak": streak,
        "weak_topics": weak_topics,
    }


# ── Teacher dashboard ──────────────────────────────────────────────────────────

@router.get("/teacher")
def teacher_dashboard(
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    classes = db.query(Class).filter(Class.teacher_id == teacher.id).all()

    total_students = 0
    all_scores = []
    all_att = []
    pending_tasks = 0
    needs_attention = 0

    classes_summary = []
    for cls in classes:
        enrollments = db.query(Enrollment).filter(
            Enrollment.class_id == cls.id, Enrollment.status == "active"
        ).all()
        student_ids = [e.student_id for e in enrollments]
        count = len(student_ids)
        total_students += count

        # Per-class aggregates
        cls_scores = []
        cls_att = []
        cls_needs_attention = 0
        for sid in student_ids:
            s = _student_summary(sid, cls.id, db)
            if s["avg_score"] > 0:
                cls_scores.append(s["avg_score"])
            if s["attendance_pct"] > 0:
                cls_att.append(s["attendance_pct"])
            # Needs attention: score < 55 OR task completion < 60 OR attendance < 80
            if s["avg_score"] < 55 or s["task_completion_pct"] < 60 or s["attendance_pct"] < 80:
                cls_needs_attention += 1
                needs_attention += 1

        cls_avg = round(sum(cls_scores) / len(cls_scores), 1) if cls_scores else 0
        cls_att_avg = round(sum(cls_att) / len(cls_att), 1) if cls_att else 0
        all_scores.extend(cls_scores)
        all_att.extend(cls_att)

        # Pending tasks (approved, due in future, with missing submissions)
        tasks = db.query(Task).filter(
            Task.class_id == cls.id, Task.approved == True
        ).all()
        cls_pending = 0
        for t in tasks:
            submitted = db.query(TaskSubmission).filter(
                TaskSubmission.task_id == t.id
            ).count()
            if submitted < count:
                cls_pending += count - submitted
        pending_tasks += cls_pending

        # Topic performance for this class
        topic_data = {}
        for sid in student_ids:
            perfs = db.query(Performance).filter(
                Performance.student_id == sid,
                Performance.class_id == cls.id,
            ).all()
            for p in perfs:
                if p.topic not in topic_data:
                    topic_data[p.topic] = []
                topic_data[p.topic].append(p.avg_score)

        topic_avgs = {t: round(sum(v)/len(v), 1) for t, v in topic_data.items() if v}
        strong_topic = max(topic_avgs, key=topic_avgs.get) if topic_avgs else None
        weak_topic = min(topic_avgs, key=topic_avgs.get) if topic_avgs else None

        classes_summary.append({
            "id": cls.id,
            "class_id": cls.class_id,
            "name": cls.name,
            "subject": cls.subject,
            "join_code": cls.join_code,
            "student_count": count,
            "avg_score": cls_avg,
            "attendance_pct": cls_att_avg,
            "pending_tasks": cls_pending,
            "needs_attention": cls_needs_attention,
            "strong_topic": strong_topic,
            "weak_topic": weak_topic,
            "topic_avgs": topic_avgs,
        })

    overall_avg = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0
    overall_att = round(sum(all_att) / len(all_att), 1) if all_att else 0

    return {
        "total_classes": len(classes),
        "total_students": total_students,
        "avg_score": overall_avg,
        "attendance_pct": overall_att,
        "pending_tasks": pending_tasks,
        "needs_attention": needs_attention,
        "classes": classes_summary,
    }


# ── Teacher: student profile ───────────────────────────────────────────────────

@router.get("/teacher/student/{student_id}/class/{class_id}")
def student_profile(
    student_id: int,
    class_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    # Verify teacher owns the class
    cls = db.query(Class).filter(
        Class.id == class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not your class")

    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Student not found")

    summary = _student_summary(student_id, class_id, db)

    # Subject-level scores from AssessmentResult
    results = db.query(AssessmentResult).filter(
        AssessmentResult.student_id == student_id
    ).all()
    subject_scores: dict = {}
    for r in results:
        subj = r.assessment.class_.subject if r.assessment else cls.subject
        if subj not in subject_scores:
            subject_scores[subj] = []
        pct = r.score / r.max_score * 100 if r.max_score > 0 else 0
        subject_scores[subj].append(pct)
    subject_avgs = {s: round(sum(v)/len(v), 1) for s, v in subject_scores.items()}

    # Topic-level performance
    perfs = db.query(Performance).filter(
        Performance.student_id == student_id,
        Performance.class_id == class_id,
    ).all()
    topic_scores = {p.topic: p.avg_score for p in perfs}

    # Recent assessments
    recent_results = (
        db.query(AssessmentResult)
        .filter(AssessmentResult.student_id == student_id)
        .order_by(AssessmentResult.submitted_at.desc())
        .limit(5)
        .all()
    )
    recent_assessments = [
        {
            "title": r.assessment.title,
            "score_pct": round(r.score / r.max_score * 100, 1) if r.max_score > 0 else 0,
            "submitted_at": r.submitted_at,
        }
        for r in recent_results
    ]

    # Latest recommendation
    rec = (
        db.query(Recommendation)
        .filter(Recommendation.student_id == student_id,
                Recommendation.class_id == class_id,
                Recommendation.status == "active")
        .order_by(Recommendation.generated_at.desc())
        .first()
    )
    recommendation = json.loads(rec.content) if rec and rec.content else []

    return {
        "student": {
            "id": student.id,
            "unique_id": student.unique_id,
            "name": student.name,
            "email": student.email,
        },
        "class": {"id": cls.id, "name": cls.name, "subject": cls.subject},
        **summary,
        "subject_scores": subject_avgs,
        "topic_scores": topic_scores,
        "recent_assessments": recent_assessments,
        "recommendation": recommendation,
    }


# ── Student dashboard ──────────────────────────────────────────────────────────

@router.get("/student")
def student_dashboard(
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == student.id, Enrollment.status == "active"
    ).all()

    classes_data = []
    all_scores = []
    all_weak_topics = []
    total_tasks_done = 0
    total_tasks = 0
    streak = _calc_streak(student.id, db)

    for e in enrollments:
        cls = e.class_
        s = _student_summary(student.id, cls.id, db)
        all_scores.append(s["avg_score"]) if s["avg_score"] > 0 else None
        all_weak_topics.extend(s["weak_topics"])
        total_tasks_done += s["tasks_done"]
        total_tasks += s["tasks_total"]

        # Today's tasks
        today_tasks = []
        tasks = db.query(Task).filter(
            Task.class_id == cls.id, Task.approved == True
        ).all()
        for t in tasks:
            sub = db.query(TaskSubmission).filter(
                TaskSubmission.task_id == t.id,
                TaskSubmission.student_id == student.id,
            ).first()
            today_tasks.append({
                "id": t.id,
                "title": t.title,
                "topic": t.topic,
                "due_date": t.due_date,
                "marks": t.marks,
                "status": "completed" if sub else "pending",
                "score": sub.score if sub else None,
            })

        classes_data.append({
            "id": cls.id,
            "class_id": cls.class_id,
            "name": cls.name,
            "subject": cls.subject,
            "teacher_name": cls.teacher.name,
            "teacher_unique_id": cls.teacher.unique_id,
            **s,
            "tasks": today_tasks,
        })

    overall_avg = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0
    # Deduplicate weak topics preserving order
    seen = set()
    unique_weak = []
    for t in all_weak_topics:
        if t not in seen:
            seen.add(t)
            unique_weak.append(t)

    # Latest recommendations across all classes
    recs = (
        db.query(Recommendation)
        .filter(Recommendation.student_id == student.id, Recommendation.status == "active")
        .order_by(Recommendation.generated_at.desc())
        .limit(1)
        .all()
    )
    recommendations = json.loads(recs[0].content) if recs and recs[0].content else []

    return {
        "student": {
            "id": student.id,
            "unique_id": student.unique_id,
            "name": student.name,
        },
        "streak": streak,
        "overall_avg": overall_avg,
        "tasks_done": total_tasks_done,
        "tasks_total": total_tasks,
        "weak_topics": unique_weak[:5],
        "classes": classes_data,
        "recommendations": recommendations,
    }
