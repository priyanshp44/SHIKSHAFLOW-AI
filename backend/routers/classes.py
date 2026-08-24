"""
Classes router — create class, list, get detail, remove student.
Enrollment router — join by code, list my classes (student).
"""
import random
import string

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Class, Enrollment, User
from schemas import ClassCreate, ClassOut, EnrollmentOut
from auth import require_teacher, require_student, get_current_user


class JoinClassPayload(BaseModel):
    join_code: str

router = APIRouter(prefix="/classes", tags=["classes"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _generate_class_id(db: Session) -> str:
    count = db.query(Class).count()
    candidate = f"CLS-{1001 + count}"
    while db.query(Class).filter(Class.class_id == candidate).first():
        count += 1
        candidate = f"CLS-{1001 + count}"
    return candidate


def _generate_join_code(subject: str, db: Session) -> str:
    """e.g. SCI7A24 — first 3 letters of subject + 4 random alphanumeric chars."""
    prefix = (subject[:3]).upper()
    while True:
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        code = f"{prefix}{suffix}"
        if not db.query(Class).filter(Class.join_code == code).first():
            return code


# ── Teacher: create class ──────────────────────────────────────────────────────

@router.post("", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
def create_class(
    payload: ClassCreate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    cls = Class(
        class_id=_generate_class_id(db),
        name=payload.name,
        subject=payload.subject,
        teacher_id=teacher.id,
        join_code=_generate_join_code(payload.subject, db),
    )
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return cls


# ── Teacher: list own classes ──────────────────────────────────────────────────

@router.get("/mine", response_model=list[ClassOut])
def list_my_classes(
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    return db.query(Class).filter(Class.teacher_id == teacher.id).all()


# ── Teacher: get class detail + student list ───────────────────────────────────

@router.get("/{class_id}/students")
def get_class_students(
    class_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    if cls.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not your class")

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id, Enrollment.status == "active")
        .all()
    )
    students = [
        {
            "id": e.student.id,
            "unique_id": e.student.unique_id,
            "name": e.student.name,
            "email": e.student.email,
            "joined_at": e.joined_at,
        }
        for e in enrollments
    ]
    return {
        "class": {
            "id": cls.id,
            "class_id": cls.class_id,
            "name": cls.name,
            "subject": cls.subject,
            "join_code": cls.join_code,
            "teacher_id": cls.teacher_id,
            "created_at": cls.created_at,
        },
        "students": students,
        "student_count": len(students),
    }


# ── Teacher: remove student from class ────────────────────────────────────────

@router.delete("/{class_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_student(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    if cls.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not your class")

    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id, Enrollment.student_id == student_id)
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Student not enrolled in this class")

    enrollment.status = "removed"
    db.commit()


# ── Student: join class by code ────────────────────────────────────────────────

@router.post("/join", status_code=status.HTTP_201_CREATED)
def join_class(
    payload: JoinClassPayload,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    code = payload.join_code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="join_code is required")

    cls = db.query(Class).filter(Class.join_code == code).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Invalid join code")

    existing = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == student.id, Enrollment.class_id == cls.id)
        .first()
    )
    if existing:
        if existing.status == "active":
            raise HTTPException(status_code=409, detail="Already enrolled in this class")
        # Re-activate if previously removed
        existing.status = "active"
        db.commit()
        db.refresh(existing)
        return {"message": "Rejoined class", "class_id": cls.id, "class_name": cls.name}

    enrollment = Enrollment(student_id=student.id, class_id=cls.id)
    db.add(enrollment)
    db.commit()
    return {"message": "Joined class successfully", "class_id": cls.id, "class_name": cls.name}


# ── Student: list enrolled classes ────────────────────────────────────────────

@router.get("/enrolled", response_model=list)
def list_enrolled_classes(
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == student.id, Enrollment.status == "active")
        .all()
    )
    return [
        {
            "id": e.class_.id,
            "class_id": e.class_.class_id,
            "name": e.class_.name,
            "subject": e.class_.subject,
            "join_code": e.class_.join_code,
            "teacher_name": e.class_.teacher.name,
            "teacher_unique_id": e.class_.teacher.unique_id,
            "joined_at": e.joined_at,
        }
        for e in enrollments
    ]
