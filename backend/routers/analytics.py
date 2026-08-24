"""
Attendance router — mark presence, bulk mark, list records, streak.
Analytics router — per-student and per-class topic performance summaries.
Both live in this file since they're tightly related.
"""
import json
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Attendance, Class, Enrollment, User,
    AssessmentResult, TaskSubmission, Task, Performance
)
from auth import require_teacher, require_student, get_current_user

router = APIRouter(tags=["attendance-analytics"])


# ── Pydantic payloads ──────────────────────────────────────────────────────────

class AttendanceMark(BaseModel):
    student_id: int
    class_id: int
    date: date
    status: str  # "present" | "absent"


class BulkAttendanceMark(BaseModel):
    class_id: int
    date: date
    records: list[dict]  # [{"student_id": int, "status": "present"|"absent"}]


# ── Streak helper (duplicated here so analytics router is self-contained) ──────

def _streak(student_id: int, db: Session) -> int:
    records = (
        db.query(Attendance)
        .filter(Attendance.student_id == student_id, Attendance.status == "present")
        .order_by(Attendance.date.desc())
        .all()
    )
    if not records:
        return 0
    dates = sorted({r.date for r in records}, reverse=True)
    streak, expected = 0, date.today()
    for d in dates:
        if d == expected or d == expected - timedelta(days=1):
            streak += 1
            expected = d - timedelta(days=1)
        else:
            break
    return streak


# ══════════════════════════════════════════════════════════════════════════════
# ATTENDANCE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

attendance_router = APIRouter(prefix="/attendance", tags=["attendance"])


@attendance_router.post("", status_code=status.HTTP_201_CREATED)
def mark_attendance(
    payload: AttendanceMark,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    """Mark or update a single student's attendance for a date."""
    cls = db.query(Class).filter(
        Class.id == payload.class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        raise HTTPException(status_code=403, detail="Class not found or not yours")
    if payload.status not in ("present", "absent"):
        raise HTTPException(status_code=400, detail="status must be 'present' or 'absent'")

    existing = db.query(Attendance).filter(
        Attendance.student_id == payload.student_id,
        Attendance.class_id == payload.class_id,
        Attendance.date == payload.date,
    ).first()
    if existing:
        existing.status = payload.status
    else:
        db.add(Attendance(
            student_id=payload.student_id,
            class_id=payload.class_id,
            date=payload.date,
            status=payload.status,
        ))
    db.commit()
    return {"message": "Attendance recorded"}


@attendance_router.post("/bulk", status_code=status.HTTP_201_CREATED)
def bulk_mark_attendance(
    payload: BulkAttendanceMark,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    """Mark attendance for all students in a class for a given date."""
    cls = db.query(Class).filter(
        Class.id == payload.class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        raise HTTPException(status_code=403, detail="Class not found or not yours")

    for rec in payload.records:
        sid = rec.get("student_id")
        st  = rec.get("status", "present")
        if st not in ("present", "absent"):
            continue
        existing = db.query(Attendance).filter(
            Attendance.student_id == sid,
            Attendance.class_id == payload.class_id,
            Attendance.date == payload.date,
        ).first()
        if existing:
            existing.status = st
        else:
            db.add(Attendance(
                student_id=sid,
                class_id=payload.class_id,
                date=payload.date,
                status=st,
            ))
    db.commit()
    return {"message": f"Attendance marked for {len(payload.records)} students"}


@attendance_router.get("/class/{class_id}")
def get_class_attendance(
    class_id: int,
    start_date: Optional[date] = None,
    end_date:   Optional[date] = None,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    """Return attendance records for a class, optionally filtered by date range."""
    cls = db.query(Class).filter(
        Class.id == class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        raise HTTPException(status_code=403, detail="Class not found or not yours")

    q = db.query(Attendance).filter(Attendance.class_id == class_id)
    if start_date:
        q = q.filter(Attendance.date >= start_date)
    if end_date:
        q = q.filter(Attendance.date <= end_date)
    records = q.order_by(Attendance.date.desc()).all()

    # Group by date for easy rendering
    by_date: dict = {}
    for r in records:
        d = str(r.date)
        by_date.setdefault(d, []).append({
            "student_id": r.student_id,
            "student_name": r.student.name,
            "status": r.status,
        })

    # Per-student summary
    enrollments = db.query(Enrollment).filter(
        Enrollment.class_id == class_id, Enrollment.status == "active"
    ).all()
    student_summary = []
    for e in enrollments:
        all_rec = db.query(Attendance).filter(
            Attendance.student_id == e.student_id,
            Attendance.class_id == class_id,
        ).all()
        total   = len(all_rec)
        present = sum(1 for a in all_rec if a.status == "present")
        student_summary.append({
            "student_id":   e.student_id,
            "student_name": e.student.name,
            "unique_id":    e.student.unique_id,
            "total_days":   total,
            "present":      present,
            "absent":       total - present,
            "attendance_pct": round(present / total * 100, 1) if total else 0,
            "streak":       _streak(e.student_id, db),
        })

    return {
        "class_id":  class_id,
        "class_name": cls.name,
        "by_date":   by_date,
        "students":  sorted(student_summary, key=lambda x: x["attendance_pct"]),
    }


@attendance_router.get("/student/me")
def my_attendance(
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    """Student sees their own attendance across all enrolled classes."""
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == student.id, Enrollment.status == "active"
    ).all()

    result = []
    for e in enrollments:
        records = db.query(Attendance).filter(
            Attendance.student_id == student.id,
            Attendance.class_id == e.class_id,
        ).order_by(Attendance.date.desc()).all()
        total   = len(records)
        present = sum(1 for r in records if r.status == "present")
        result.append({
            "class_id":       e.class_id,
            "class_name":     e.class_.name,
            "total_days":     total,
            "present":        present,
            "absent":         total - present,
            "attendance_pct": round(present / total * 100, 1) if total else 0,
            "streak":         _streak(student.id, db),
            "recent": [
                {"date": str(r.date), "status": r.status}
                for r in records[:14]  # last 14 days
            ],
        })
    return result


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

analytics_router = APIRouter(prefix="/analytics", tags=["analytics"])


def _task_completion_pct(student_id: int, class_id: int, db: Session) -> float:
    tasks = db.query(Task).filter(
        Task.class_id == class_id, Task.approved == True
    ).all()
    if not tasks:
        return 0.0
    done = db.query(TaskSubmission).filter(
        TaskSubmission.student_id == student_id,
        TaskSubmission.task_id.in_([t.id for t in tasks]),
    ).count()
    return round(done / len(tasks) * 100, 1)


@analytics_router.get("/student/{student_id}/class/{class_id}")
def student_analytics(
    student_id: int,
    class_id:   int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full analytics for one student in one class.
    Accessible by the student themselves or their class teacher."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    # Authorization: teacher must own the class, student must be themselves
    if current_user.role == "TEACHER" and cls.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your class")
    if current_user.role == "STUDENT" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Cannot view another student's analytics")

    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Attendance
    att_records = db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.class_id   == class_id,
    ).all()
    total_att   = len(att_records)
    present_att = sum(1 for a in att_records if a.status == "present")
    att_pct     = round(present_att / total_att * 100, 1) if total_att else 0

    # Streak
    streak = _streak(student_id, db)

    # Task completion
    task_pct = _task_completion_pct(student_id, class_id, db)

    # Assessment results
    results = db.query(AssessmentResult).filter(
        AssessmentResult.student_id == student_id
    ).order_by(AssessmentResult.submitted_at.asc()).all()

    score_history = []
    for r in results:
        pct = round(r.score / r.max_score * 100, 1) if r.max_score > 0 else 0
        score_history.append({
            "assessment_title": r.assessment.title,
            "score_pct": pct,
            "submitted_at": r.submitted_at,
        })

    overall_avg = round(
        sum(s["score_pct"] for s in score_history) / len(score_history), 1
    ) if score_history else 0

    # Topic performance from Performance table
    perfs = db.query(Performance).filter(
        Performance.student_id == student_id,
        Performance.class_id   == class_id,
    ).order_by(Performance.avg_score.asc()).all()

    topic_performance = [
        {
            "topic":          p.topic,
            "subject":        p.subject,
            "avg_score":      p.avg_score,
            "task_completion": p.task_completion,
            "updated_at":     p.updated_at,
            "status": "weak"     if p.avg_score < 50
                      else "needs_work" if p.avg_score < 70
                      else "strong",
        }
        for p in perfs
    ]

    weak_topics   = [t["topic"] for t in topic_performance if t["status"] == "weak"]
    strong_topics = [t["topic"] for t in topic_performance if t["status"] == "strong"]

    # Recent task submissions with scores
    tasks = db.query(Task).filter(
        Task.class_id == class_id, Task.approved == True
    ).all()
    task_history = []
    for t in tasks:
        sub = db.query(TaskSubmission).filter(
            TaskSubmission.task_id == t.id,
            TaskSubmission.student_id == student_id,
        ).first()
        task_history.append({
            "task_id":    t.id,
            "title":      t.title,
            "topic":      t.topic,
            "marks":      t.marks,
            "score":      sub.score if sub else None,
            "status":     "completed" if sub else "pending",
            "due_date":   t.due_date,
        })

    return {
        "student": {
            "id":        student.id,
            "unique_id": student.unique_id,
            "name":      student.name,
        },
        "class": {
            "id":      cls.id,
            "name":    cls.name,
            "subject": cls.subject,
        },
        "attendance_pct":   att_pct,
        "streak":           streak,
        "task_completion_pct": task_pct,
        "overall_avg":      overall_avg,
        "weak_topics":      weak_topics,
        "strong_topics":    strong_topics,
        "topic_performance": topic_performance,
        "score_history":    score_history,
        "task_history":     task_history,
    }


@analytics_router.get("/class/{class_id}")
def class_analytics(
    class_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    """Class-level analytics — topic averages, distribution, at-risk count."""
    cls = db.query(Class).filter(
        Class.id == class_id, Class.teacher_id == teacher.id
    ).first()
    if not cls:
        raise HTTPException(status_code=403, detail="Class not found or not yours")

    enrollments = db.query(Enrollment).filter(
        Enrollment.class_id == class_id, Enrollment.status == "active"
    ).all()
    student_ids = [e.student_id for e in enrollments]

    # Overall score averages
    all_scores = []
    for sid in student_ids:
        results = db.query(AssessmentResult).filter(
            AssessmentResult.student_id == sid
        ).all()
        for r in results:
            if r.max_score > 0:
                all_scores.append(r.score / r.max_score * 100)

    class_avg = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0

    # Distribution
    strong  = sum(1 for s in all_scores if s >= 70)
    average = sum(1 for s in all_scores if 50 <= s < 70)
    needs   = sum(1 for s in all_scores if s < 50)

    # Topic averages across class
    topic_data: dict[str, list] = {}
    for sid in student_ids:
        perfs = db.query(Performance).filter(
            Performance.student_id == sid,
            Performance.class_id   == class_id,
        ).all()
        for p in perfs:
            topic_data.setdefault(p.topic, []).append(p.avg_score)

    topic_avgs = {
        t: round(sum(v) / len(v), 1)
        for t, v in topic_data.items()
    }
    sorted_topics = sorted(topic_avgs.items(), key=lambda x: x[1])
    weak_topic   = sorted_topics[0][0]  if sorted_topics else None
    strong_topic = sorted_topics[-1][0] if sorted_topics else None

    # Attendance
    att_data = []
    for sid in student_ids:
        recs  = db.query(Attendance).filter(
            Attendance.student_id == sid, Attendance.class_id == class_id
        ).all()
        total   = len(recs)
        present = sum(1 for r in recs if r.status == "present")
        att_data.append(round(present / total * 100, 1) if total else 0)
    avg_att = round(sum(att_data) / len(att_data), 1) if att_data else 0

    # Task completion
    tasks = db.query(Task).filter(
        Task.class_id == class_id, Task.approved == True
    ).all()
    task_pcts = []
    for sid in student_ids:
        done = db.query(TaskSubmission).filter(
            TaskSubmission.student_id == sid,
            TaskSubmission.task_id.in_([t.id for t in tasks]),
        ).count()
        task_pcts.append(round(done / len(tasks) * 100, 1) if tasks else 0)
    avg_task_completion = round(sum(task_pcts) / len(task_pcts), 1) if task_pcts else 0

    # At-risk students
    at_risk = []
    for e in enrollments:
        sid      = e.student_id
        s_scores = [r.score / r.max_score * 100 for r in
                    db.query(AssessmentResult).filter(AssessmentResult.student_id == sid).all()
                    if r.max_score > 0]
        s_avg    = round(sum(s_scores) / len(s_scores), 1) if s_scores else 0
        s_att    = att_data[student_ids.index(sid)] if sid in student_ids else 0
        s_task   = task_pcts[student_ids.index(sid)] if sid in student_ids else 0
        s_streak = _streak(sid, db)

        if s_avg < 55 or s_task < 60 or s_att < 80:
            level = "high" if (s_avg < 40 or s_att < 60) else "medium"
            at_risk.append({
                "student_id":   sid,
                "student_name": e.student.name,
                "unique_id":    e.student.unique_id,
                "avg_score":    s_avg,
                "attendance_pct": s_att,
                "task_completion_pct": s_task,
                "streak":       s_streak,
                "risk_level":   level,
                "reasons": [
                    *(["Low score"] if s_avg < 55 else []),
                    *(["Poor attendance"] if s_att < 80 else []),
                    *(["Incomplete tasks"] if s_task < 60 else []),
                ],
            })

    at_risk.sort(key=lambda x: (x["risk_level"] == "medium", x["avg_score"]))

    return {
        "class": {"id": cls.id, "name": cls.name, "subject": cls.subject},
        "student_count":   len(student_ids),
        "class_avg":       class_avg,
        "avg_attendance":  avg_att,
        "avg_task_completion": avg_task_completion,
        "strong":  strong,
        "average": average,
        "needs_support": needs,
        "weak_topic":   weak_topic,
        "strong_topic": strong_topic,
        "topic_avgs":   topic_avgs,
        "at_risk_count": len(at_risk),
        "at_risk":       at_risk,
    }


# Export both sub-routers — main.py registers them separately
