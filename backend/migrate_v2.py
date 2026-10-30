import os
import sys
import secrets
from sqlalchemy import text, inspect
from backend.app.db.session import engine, Base
import backend.app.models.models as models

def run_migration():
    print("Beginning database schema upgrade (preserving all existing records)...")
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    print(f"Existing tables in database: {existing_tables}")

    with engine.connect() as conn:
        # 1. Update 'users' table: check for referral_code
        if "users" in existing_tables:
            user_cols = [c["name"] for c in inspector.get_columns("users")]
            if "referral_code" not in user_cols:
                print("Adding 'referral_code' column to 'users' table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN referral_code VARCHAR(50);"))
                conn.commit()

        # 2. Update 'learning_days' table
        if "learning_days" in existing_tables:
            day_cols = [c["name"] for c in inspector.get_columns("learning_days")]
            new_day_cols = {
                "summary_main": "TEXT",
                "summary_telugu": "TEXT",
                "summary_english": "TEXT",
                "summary_video_url": "VARCHAR(500)",
                "unlock_delay_hours": "FLOAT DEFAULT 24.0",
                "unlock_mode": "VARCHAR(50) DEFAULT 'both'",
                "require_google_drive_submission": "BOOLEAN DEFAULT 0",
                "completion_requirements": "TEXT"
            }
            for col_name, col_type in new_day_cols.items():
                if col_name not in day_cols:
                    print(f"Adding '{col_name}' column to 'learning_days' table...")
                    conn.execute(text(f"ALTER TABLE learning_days ADD COLUMN {col_name} {col_type};"))
                    conn.commit()

        # 3. Update 'day_progress' table
        if "day_progress" in existing_tables:
            prog_cols = [c["name"] for c in inspector.get_columns("day_progress")]
            new_prog_cols = {
                "unlocked_at": "DATETIME",
                "is_manually_unlocked": "BOOLEAN DEFAULT 0",
                "unlocked_by_id": "VARCHAR(36)",
                "unlock_reason": "TEXT",
                "summary_viewed": "BOOLEAN DEFAULT 0",
                "telugu_summary_viewed": "BOOLEAN DEFAULT 0",
                "english_summary_viewed": "BOOLEAN DEFAULT 0",
                "video_watched": "BOOLEAN DEFAULT 0",
                "flashcards_completed": "BOOLEAN DEFAULT 0"
            }
            for col_name, col_type in new_prog_cols.items():
                if col_name not in prog_cols:
                    print(f"Adding '{col_name}' column to 'day_progress' table...")
                    conn.execute(text(f"ALTER TABLE day_progress ADD COLUMN {col_name} {col_type};"))
                    conn.commit()

    # 4. Create any newly defined tables
    print("Creating new tables from metadata (if not already existing)...")
    Base.metadata.create_all(bind=engine)

    # 5. Ensure existing students have unique referral codes
    from backend.app.db.session import SessionLocal
    db = SessionLocal()
    try:
        students_without_code = db.query(models.User).filter(
            models.User.role == "student",
            (models.User.referral_code == None) | (models.User.referral_code == "")
        ).all()
        for s in students_without_code:
            clean_name = "".join(filter(str.isalnum, s.full_name))[:6].upper()
            code = f"{clean_name}-{secrets.token_hex(2).upper()}"
            s.referral_code = code
            print(f"Assigned referral code {code} to student {s.email}")
        
        # Check if default referral campaign exists; if not, create one
        existing_campaign = db.query(models.ReferralCampaign).first()
        if not existing_campaign:
            default_campaign = models.ReferralCampaign(
                name="Special VIP Referral Campaign",
                headline="INVITE AND EARN",
                currency="₹",
                base_reward_amount=999.0,
                tier_reward_amount=799.20,
                vip_price=999.0,
                instructions="Share your unique referral link or WhatsApp invite with friends. When they claim or enroll, you earn direct cash bonuses!",
                rungs_config='[{"count": 1, "title": "Door opener", "reward": 999}, {"count": 3, "title": "Table of three", "reward": 2597.4}, {"count": 5, "title": "Full table", "reward": 4195.8}, {"count": 8, "title": "Room filler", "reward": 6594.4}, {"count": 10, "title": "Founder of the room", "reward": 8193.0}]',
                is_active=True
            )
            db.add(default_campaign)
            print("Created default Referral Campaign configuration.")

        db.commit()
    finally:
        db.close()

    print("Database migration completed successfully!")

if __name__ == "__main__":
    run_migration()
