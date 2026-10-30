import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BASE_DIR.parent

# In serverless environments like Vercel / AWS Lambda, the root filesystem is read-only.
# Only /tmp is writable.
is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
if is_serverless:
    STORAGE_DIR = Path("/tmp/uploads")
else:
    STORAGE_DIR = PROJECT_ROOT / "storage" / "uploads"

try:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

# Load environment variables from .env if present
env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=False)

# Neon cloud database connection string
DEFAULT_CLOUD_DB = "postgresql://neondb_owner:npg_QgDs49BVXvyU@ep-floral-queen-b561u7iu-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Training Management and Learning Progress Platform"
    API_V1_PREFIX: str = "/api/v1"
    
    # Database - uses DATABASE_URL if set, falls back to Neon cloud db
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        DEFAULT_CLOUD_DB
    )
    
    # JWT Auth
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "super-secret-dev-key-change-in-production-training-hub-2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    
    # Storage
    UPLOAD_DIR: Path = STORAGE_DIR
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "25"))
    
    # CORS
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Razorpay Payment Gateway
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    
    class Config:
        case_sensitive = True

settings = Settings()

# Normalize database URL for psycopg2
if settings.DATABASE_URL.startswith("postgres://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif settings.DATABASE_URL.startswith("postgresql://") and not settings.DATABASE_URL.startswith("postgresql+"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# Clean channel_binding for psycopg2 / Linux compatibility
for cb_param in ["&channel_binding=require", "channel_binding=require&", "channel_binding=require", "channel_binding=prefer"]:
    settings.DATABASE_URL = settings.DATABASE_URL.replace(cb_param, "")
