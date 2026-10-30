from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.db.session import engine, Base
import backend.app.models.models  # Ensure all models are registered

# Import routers
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.students import router as students_router
from backend.app.api.v1.employees import router as employees_router
from backend.app.api.v1.teams import router as teams_router
from backend.app.api.v1.programs import router as programs_router
from backend.app.api.v1.checklists import router as checklists_router
from backend.app.api.v1.enrollments import router as enrollments_router
from backend.app.api.v1.tasks import router as tasks_router
from backend.app.api.v1.student_learning import router as student_learning_router
from backend.app.api.v1.dashboard import router as dashboard_router
from backend.app.api.v1.chat import router as chat_router
from backend.app.api.v1.files import router as files_router
from backend.app.api.v1.notifications import router as notifications_router
from backend.app.api.v1.audit_logs import router as audit_logs_router
from backend.app.api.v1.submissions import router as submissions_router
from backend.app.api.v1.referrals import router as referrals_router
from backend.app.api.v1.reviews import router as reviews_router
from backend.app.api.v1.rewards import router as rewards_router
from backend.app.api.v1.payments import router as payments_router

# Create tables
try:
    Base.metadata.create_all(bind=engine)
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    with engine.connect() as conn:
        # Check users table
        if "users" in insp.get_table_names():
            u_cols = [c["name"] for c in insp.get_columns("users")]
            if "referral_link" not in u_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN referral_link VARCHAR(500)"))
            if "referral_link_approved" not in u_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN referral_link_approved BOOLEAN DEFAULT 1"))

        # Check programs table
        if "programs" in insp.get_table_names():
            p_cols = [c["name"] for c in insp.get_columns("programs")]
            if "price" not in p_cols:
                conn.execute(text("ALTER TABLE programs ADD COLUMN price FLOAT DEFAULT 2000.0"))
            if "allow_redemption" not in p_cols:
                conn.execute(text("ALTER TABLE programs ADD COLUMN allow_redemption BOOLEAN DEFAULT 1"))
            if "max_redemption_percent" not in p_cols:
                conn.execute(text("ALTER TABLE programs ADD COLUMN max_redemption_percent FLOAT DEFAULT 100.0"))
            if "referral_bonus_points" not in p_cols:
                conn.execute(text("ALTER TABLE programs ADD COLUMN referral_bonus_points FLOAT DEFAULT 500.0"))
            if "eligible_for_referral" not in p_cols:
                conn.execute(text("ALTER TABLE programs ADD COLUMN eligible_for_referral BOOLEAN DEFAULT 1"))

        # Check learning_days table
        if "learning_days" in insp.get_table_names():
            ld_cols = [c["name"] for c in insp.get_columns("learning_days")]
            if "base_reward_points" not in ld_cols:
                conn.execute(text("ALTER TABLE learning_days ADD COLUMN base_reward_points FLOAT"))

        # Check google_drive_submissions table
        if "google_drive_submissions" in insp.get_table_names():
            gds_cols = [c["name"] for c in insp.get_columns("google_drive_submissions")]
            if "base_reward_points" not in gds_cols:
                conn.execute(text("ALTER TABLE google_drive_submissions ADD COLUMN base_reward_points FLOAT DEFAULT 0.0"))
            if "additional_reward_points" not in gds_cols:
                conn.execute(text("ALTER TABLE google_drive_submissions ADD COLUMN additional_reward_points FLOAT DEFAULT 0.0"))
            if "reward_awarded" not in gds_cols:
                conn.execute(text("ALTER TABLE google_drive_submissions ADD COLUMN reward_awarded BOOLEAN DEFAULT 0"))

        # Check conversations table
        if "conversations" in insp.get_table_names():
            c_cols = [c["name"] for c in insp.get_columns("conversations")]
            if "program_id" not in c_cols:
                conn.execute(text("ALTER TABLE conversations ADD COLUMN program_id VARCHAR(36)"))

        conn.commit()
except Exception as e:
    print("Database migration notice:", e)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for seamless local dev & https preview
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/", tags=["Health"])
@app.get("/healthz", tags=["Health"])
@app.get("/api", tags=["Health"])
@app.get("/api/healthz", tags=["Health"])
@app.get("/v1/healthz", tags=["Health"])
@app.get("/api/v1/healthz", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME}

# Routers list
_all_routers = [
    auth_router,
    students_router,
    employees_router,
    teams_router,
    programs_router,
    checklists_router,
    enrollments_router,
    tasks_router,
    student_learning_router,
    dashboard_router,
    chat_router,
    files_router,
    notifications_router,
    audit_logs_router,
    submissions_router,
    referrals_router,
    reviews_router,
    rewards_router,
    payments_router,
]

# Register API routers under all possible path variants to support direct server, proxy, and Vercel serverless rewrites
for r in _all_routers:
    app.include_router(r, prefix="/api/v1")
    app.include_router(r, prefix="/api")
    app.include_router(r, prefix="/v1")
    app.include_router(r)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
