from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models import Base
from routers import health
from routers import auth
from routers import classes
from routers import dashboard
from routers import tasks
from routers import assessments
from routers.analytics import attendance_router, analytics_router
from routers import ai as ai_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ShikshaFlow AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api")
app.include_router(classes.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(assessments.router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(ai_router.router, prefix="/api")
