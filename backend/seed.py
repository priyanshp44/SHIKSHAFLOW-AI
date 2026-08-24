"""
Seed script — run once to populate initial demo data for ShikshaFlow AI.

Usage:
    cd backend
    python seed.py

Creates:
  - Teacher: Priya Shah (priya@school.com / teacher123)
  - 4 Students (password: student123 for all)
  - Class: Grade 7-A Science (join code: SCI7A24)
  - Tasks, assessments, results, attendance, and performance records
"""
import sys
import os
import json
from datetime import date, datetime, timedelta
import random

sys.path.insert(0, os.path.dirname(__file__))

from passlib.context import CryptContext
from database import SessionLocal, engine
from models import (
    Base, User, Class, Enrollment,
    Task, TaskSubmission,
    Assessment, AssessmentResult,
    Attendance, Performance, Recommendation
)

Base.metadata.create_all(bind=engine)

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
db = SessionLocal()
random.seed(42)

try:
    # ── Teacher ────────────────────────────────────────────────────────────────
    teacher = User(
        unique_id="TCH-1001",
        name="Priya Shah",
        email="priya@school.com",
        password_hash=pwd_ctx.hash("teacher123"),
        role="TEACHER",
    )
    db.add(teacher)
    db.flush()

    # ── Students ───────────────────────────────────────────────────────────────
    student_data = [
        ("STD-2001", "Rahul Mehta",  "rahul@school.com",   "strong"),    # performing well
        ("STD-2002", "Meena Patel",  "meena@school.com",   "strong"),    # top performer
        ("STD-2003", "Arjun Singh",  "arjun@school.com",   "at_risk"),   # struggling
        ("STD-2004", "Kiran Rao",    "kiran@school.com",   "average"),   # average
    ]

    students = []
    for uid, name, email, _ in student_data:
        s = User(
            unique_id=uid,
            name=name,
            email=email,
            password_hash=pwd_ctx.hash("student123"),
            role="STUDENT",
        )
        db.add(s)
        students.append(s)

    db.flush()

    # ── Class ──────────────────────────────────────────────────────────────────
    cls = Class(
        class_id="CLS-1001",
        name="Grade 7-A",
        subject="Science",
        teacher_id=teacher.id,
        join_code="SCI7A24",
    )
    db.add(cls)
    db.flush()

    # ── Enrollments ────────────────────────────────────────────────────────────
    for s in students:
        db.add(Enrollment(student_id=s.id, class_id=cls.id))
    db.flush()

    # ── Attendance (last 20 days) ──────────────────────────────────────────────
    # present_rates: Rahul=94%, Meena=100%, Arjun=80%, Kiran=90%
    present_rates = [0.94, 1.0, 0.80, 0.90]
    for i, s in enumerate(students):
        for day_offset in range(20):
            d = date.today() - timedelta(days=19 - day_offset)
            if d.weekday() >= 5:
                continue  # skip weekends
            present = random.random() < present_rates[i]
            db.add(Attendance(
                student_id=s.id,
                class_id=cls.id,
                date=d,
                status="present" if present else "absent",
            ))
    db.flush()

    # ── Assessment 1 — Fractions ───────────────────────────────────────────────
    fractions_questions = json.dumps([
        {"id": 1, "type": "mcq", "text": "What is 1/2 + 1/4?", "options": ["1/2", "3/4", "2/4", "1/6"], "answer": "3/4", "topic": "Fractions"},
        {"id": 2, "type": "mcq", "text": "Which fraction is equivalent to 2/4?", "options": ["1/2", "1/3", "3/4", "2/3"], "answer": "1/2", "topic": "Fractions"},
        {"id": 3, "type": "truefalse", "text": "3/6 and 1/2 are equivalent fractions.", "answer": "true", "topic": "Fractions"},
        {"id": 4, "type": "mcq", "text": "What is 3/4 - 1/4?", "options": ["1/4", "2/4", "1/2", "3/8"], "answer": "1/2", "topic": "Fractions"},
        {"id": 5, "type": "mcq", "text": "Which is the largest fraction?", "options": ["1/2", "1/3", "1/4", "1/5"], "answer": "1/2", "topic": "Fractions"},
    ])
    assessment1 = Assessment(
        title="Fractions Quiz",
        class_id=cls.id,
        type="MCQ",
        questions=fractions_questions,
        created_at=datetime.utcnow() - timedelta(days=10),
    )
    db.add(assessment1)
    db.flush()

    # Scores: Rahul=72%, Meena=88%, Arjun=40%, Kiran=60%
    a1_scores = [
        (students[0], 3.6, 5.0, {"Fractions": 72}),
        (students[1], 4.4, 5.0, {"Fractions": 88}),
        (students[2], 2.0, 5.0, {"Fractions": 40}),
        (students[3], 3.0, 5.0, {"Fractions": 60}),
    ]
    for s, score, max_s, ts in a1_scores:
        db.add(AssessmentResult(
            student_id=s.id,
            assessment_id=assessment1.id,
            score=score,
            max_score=max_s,
            topic_scores=json.dumps(ts),
            submitted_at=datetime.utcnow() - timedelta(days=9),
        ))
    db.flush()

    # ── Assessment 2 — Photosynthesis ─────────────────────────────────────────
    photo_questions = json.dumps([
        {"id": 1, "type": "mcq", "text": "Which gas do plants absorb during photosynthesis?", "options": ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"], "answer": "Carbon Dioxide", "topic": "Photosynthesis"},
        {"id": 2, "type": "mcq", "text": "Which part of the plant is the primary site of photosynthesis?", "options": ["Root", "Stem", "Leaf", "Flower"], "answer": "Leaf", "topic": "Photosynthesis"},
        {"id": 3, "type": "truefalse", "text": "Chlorophyll gives leaves their green colour.", "answer": "true", "topic": "Photosynthesis"},
        {"id": 4, "type": "mcq", "text": "What energy source does photosynthesis use?", "options": ["Wind", "Sunlight", "Water", "Soil"], "answer": "Sunlight", "topic": "Photosynthesis"},
        {"id": 5, "type": "truefalse", "text": "Plants release carbon dioxide during photosynthesis.", "answer": "false", "topic": "Photosynthesis"},
    ])
    assessment2 = Assessment(
        title="Photosynthesis Quiz",
        class_id=cls.id,
        type="MCQ",
        questions=photo_questions,
        created_at=datetime.utcnow() - timedelta(days=5),
    )
    db.add(assessment2)
    db.flush()

    # Scores: Rahul=80%, Meena=96%, Arjun=56%, Kiran=72%
    a2_scores = [
        (students[0], 4.0, 5.0, {"Photosynthesis": 80}),
        (students[1], 4.8, 5.0, {"Photosynthesis": 96}),
        (students[2], 2.8, 5.0, {"Photosynthesis": 56}),
        (students[3], 3.6, 5.0, {"Photosynthesis": 72}),
    ]
    for s, score, max_s, ts in a2_scores:
        db.add(AssessmentResult(
            student_id=s.id,
            assessment_id=assessment2.id,
            score=score,
            max_score=max_s,
            topic_scores=json.dumps(ts),
            submitted_at=datetime.utcnow() - timedelta(days=4),
        ))
    db.flush()

    # ── Performance records (aggregated from assessments above) ───────────────
    perf_data = [
        # (student, subject, topic, avg_score, task_completion)
        (students[0], "Science", "Fractions",      72.0, 80.0),
        (students[0], "Science", "Photosynthesis",  80.0, 90.0),
        (students[1], "Science", "Fractions",      88.0, 100.0),
        (students[1], "Science", "Photosynthesis",  96.0, 100.0),
        (students[2], "Science", "Fractions",      40.0, 50.0),  # ← at risk
        (students[2], "Science", "Photosynthesis",  56.0, 60.0),  # ← at risk
        (students[3], "Science", "Fractions",      60.0, 70.0),
        (students[3], "Science", "Photosynthesis",  72.0, 80.0),
    ]
    for s, subj, topic, avg, tc in perf_data:
        db.add(Performance(
            student_id=s.id,
            class_id=cls.id,
            subject=subj,
            topic=topic,
            avg_score=avg,
            task_completion=tc,
        ))
    db.flush()

    # ── Task — Fractions Practice (approved) ──────────────────────────────────
    task_questions = json.dumps([
        {"id": 1, "type": "mcq", "text": "Simplify 6/8.", "options": ["2/4", "3/4", "1/2", "4/6"], "answer": "3/4", "topic": "Fractions"},
        {"id": 2, "type": "mcq", "text": "Which is greater: 2/3 or 3/4?", "options": ["2/3", "3/4", "They are equal", "Cannot compare"], "answer": "3/4", "topic": "Fractions"},
        {"id": 3, "type": "truefalse", "text": "4/8 is equivalent to 1/2.", "answer": "true", "topic": "Fractions"},
        {"id": 4, "type": "mcq", "text": "What is 1/3 + 1/6?", "options": ["1/2", "2/9", "3/9", "1/4"], "answer": "1/2", "topic": "Fractions"},
    ])
    task1 = Task(
        title="Fractions Practice",
        subject="Science",
        topic="Fractions",
        class_id=cls.id,
        due_date=datetime.utcnow() + timedelta(days=3),
        marks=10,
        questions=task_questions,
        approved=True,
        ai_generated=False,
    )
    db.add(task1)
    db.flush()

    # Rahul and Meena have submitted; Arjun and Kiran have not
    for s, score in [(students[0], 7.5), (students[1], 9.0)]:
        db.add(TaskSubmission(
            task_id=task1.id,
            student_id=s.id,
            answers=json.dumps({"1": "3/4", "2": "3/4", "3": "true", "4": "1/2"}),
            score=score,
            submitted_at=datetime.utcnow() - timedelta(days=2),
            feedback=None,
        ))
    db.flush()

    db.commit()

    print("✅ Seed complete — ShikshaFlow AI demo data")
    print()
    print("  Credentials")
    print("  ──────────────────────────────────────────")
    print(f"  Teacher : {teacher.email} / teacher123  ({teacher.unique_id})")
    for s, _, _, profile in zip(students, student_data, student_data, [x[3] for x in student_data]):
        print(f"  Student : {s.email} / student123  ({s.unique_id}) [{profile}]")
    print()
    print(f"  Class   : {cls.name}  join_code={cls.join_code}")
    print()
    print("  Demo storyline")
    print("  ──────────────────────────────────────────")
    print("  1. Login as Priya Shah (teacher)")
    print("  2. See Grade 7-A with 4 students + at-risk banner")
    print("  3. Go to Analytics → see Fractions at 65% class avg")
    print("  4. Go to Intervention → select Fractions → get AI suggestion")
    print("  5. Generate remedial task → approve it in Tasks → Drafts")
    print("  6. Login as Arjun Singh (student) → see Fractions task assigned")
    print("  7. Submit task → see AI feedback (if IBM_API_KEY set)")
    print("  8. Learning Path → generate personalised path via Granite")

except Exception as exc:
    db.rollback()
    print(f"❌ Seed failed: {exc}")
    import traceback
    traceback.print_exc()
    raise
finally:
    db.close()
