from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, DateTime, Date, ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    unique_id = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "TEACHER" or "STUDENT"
    created_at = Column(DateTime, default=datetime.utcnow)

    taught_classes = relationship("Class", back_populates="teacher")
    enrollments = relationship("Enrollment", back_populates="student", foreign_keys="Enrollment.student_id")
    task_submissions = relationship("TaskSubmission", back_populates="student")
    assessment_results = relationship("AssessmentResult", back_populates="student")
    attendances = relationship("Attendance", back_populates="student")
    performances = relationship("Performance", back_populates="student")
    recommendations = relationship("Recommendation", back_populates="student")


class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    join_code = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User", back_populates="taught_classes")
    enrollments = relationship("Enrollment", back_populates="class_")
    tasks = relationship("Task", back_populates="class_")
    assessments = relationship("Assessment", back_populates="class_")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="active")

    student = relationship("User", back_populates="enrollments", foreign_keys=[student_id])
    class_ = relationship("Class", back_populates="enrollments")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    due_date = Column(DateTime, nullable=False)
    marks = Column(Integer, nullable=False)
    ai_generated = Column(Boolean, default=False)
    approved = Column(Boolean, default=True)
    questions = Column(Text)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)

    class_ = relationship("Class", back_populates="tasks")
    submissions = relationship("TaskSubmission", back_populates="task")


class TaskSubmission(Base):
    __tablename__ = "task_submissions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    answers = Column(Text)  # JSON string
    score = Column(Float, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    feedback = Column(Text, nullable=True)

    task = relationship("Task", back_populates="submissions")
    student = relationship("User", back_populates="task_submissions")


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    type = Column(String, nullable=False)  # "MCQ" or "MIXED"
    questions = Column(Text)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)

    class_ = relationship("Class", back_populates="assessments")
    results = relationship("AssessmentResult", back_populates="assessment")


class AssessmentResult(Base):
    __tablename__ = "assessment_results"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    topic_scores = Column(Text)  # JSON string e.g. {"Fractions": 40, "Geometry": 70}
    feedback = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", back_populates="assessment_results")
    assessment = relationship("Assessment", back_populates="results")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, nullable=False)  # "present" or "absent"

    student = relationship("User", back_populates="attendances")


class Performance(Base):
    __tablename__ = "performance"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    subject = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    avg_score = Column(Float, nullable=False)
    task_completion = Column(Float, nullable=False)  # percentage 0–100
    updated_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", back_populates="performances")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    content = Column(Text)  # JSON string, list of recommendation steps
    generated_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="active")

    student = relationship("User", back_populates="recommendations")
