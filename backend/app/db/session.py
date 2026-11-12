import ssl
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from backend.app.core.config import settings, is_serverless

is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if is_sqlite:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True
    )
elif "pg8000" in settings.DATABASE_URL:
    # Pure-Python pg8000 driver with SSL context for Neon PostgreSQL
    ssl_context = ssl.create_default_context()
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"ssl_context": ssl_context},
        poolclass=NullPool,
        pool_pre_ping=True
    )
elif is_serverless:
    # Serverless (Vercel/Lambda): use NullPool to avoid idle connection exhaustion
    engine = create_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        pool_pre_ping=True
    )
else:
    # Neon PostgreSQL connection pooling for transaction pooler / PgBouncer
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_recycle=180,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
