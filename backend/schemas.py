from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


# ── User ──────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    name: str
    email: str
    role: str  # "TEACHER" or "STUDENT"


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: int
    unique_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Auth / Token ───────────────────────────────────────────────────────────────

class TokenUserOut(BaseModel):
    id: int
    unique_id: str
    name: str
    email: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str
    user: TokenUserOut


# ── Class ─────────────────────────────────────────────────────────────────────

class ClassBase(BaseModel):
    name: str
    subject: str


class ClassCreate(ClassBase):
    pass


class ClassOut(ClassBase):
    id: int
    class_id: str
    teacher_id: int
    join_code: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Enrollment ────────────────────────────────────────────────────────────────

class EnrollmentOut(BaseModel):
    id: int
    student_id: int
    class_id: int
    joined_at: datetime
    status: str

    model_config = {"from_attributes": True}


# ── Task ──────────────────────────────────────────────────────────────────────

class TaskBase(BaseModel):
    title: str
    subject: str
    topic: str
    due_date: datetime
    marks: int


class TaskCreate(TaskBase):
    class_id: int
    questions: Optional[str] = None  # JSON string
    ai_generated: bool = False


class TaskOut(TaskBase):
    id: int
    class_id: int
    ai_generated: bool
    approved: bool
    questions: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── TaskSubmission ────────────────────────────────────────────────────────────

class TaskSubmissionCreate(BaseModel):
    task_id: int
    answers: str  # JSON string


class TaskSubmissionOut(BaseModel):
    id: int
    task_id: int
    student_id: int
    answers: str
    score: Optional[float] = None
    submitted_at: datetime
    feedback: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Assessment ────────────────────────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    title: str
    class_id: int
    type: str  # "MCQ" or "MIXED"
    questions: str  # JSON string


class AssessmentOut(BaseModel):
    id: int
    title: str
    class_id: int
    type: str
    questions: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── AssessmentResult ──────────────────────────────────────────────────────────

class AssessmentResultOut(BaseModel):
    id: int
    student_id: int
    assessment_id: int
    score: float
    max_score: float
    topic_scores: Optional[str] = None
    feedback: Optional[str] = None
    submitted_at: datetime

    model_config = {"from_attributes": True}


# ── Attendance ────────────────────────────────────────────────────────────────

class AttendanceCreate(BaseModel):
    student_id: int
    class_id: int
    date: date
    status: str  # "present" or "absent"


class AttendanceOut(BaseModel):
    id: int
    student_id: int
    class_id: int
    date: date
    status: str

    model_config = {"from_attributes": True}


# ── Performance ───────────────────────────────────────────────────────────────

class PerformanceOut(BaseModel):
    id: int
    student_id: int
    class_id: int
    subject: str
    topic: str
    avg_score: float
    task_completion: float
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Recommendation ────────────────────────────────────────────────────────────

class RecommendationOut(BaseModel):
    id: int
    student_id: int
    class_id: int
    content: str  # JSON string
    generated_at: datetime
    status: str

    model_config = {"from_attributes": True}
