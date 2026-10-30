import os
import sys
import argparse
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.app.db.session import engine, SessionLocal, Base
from backend.app.models.models import User
from backend.app.core.security import get_password_hash

def init_db(admin_only: bool = False, create_dev: bool = False):
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check / Create Admin Account
        admin = db.query(User).filter(User.role == "admin").first()
        admin_email = os.getenv("ADMIN_EMAIL", "admin@training.local")
        admin_pass = os.getenv("ADMIN_PASSWORD", "AdminPass123!")

        if not admin:
            admin = User(
                email=admin_email,
                full_name="Platform Administrator",
                password_hash=get_password_hash(admin_pass),
                role="admin",
                status="active",
                identifier="ADMIN-001"
            )
            db.add(admin)
            db.commit()
            print(f"[OK] Initial Administrator account created: {admin_email} (Password: {admin_pass})")
        else:
            print(f"[INFO] Administrator account already exists: {admin.email}")

        if admin_only:
            print("[INFO] --admin-only specified. Skipping employee and student accounts.")
            return

        if create_dev:
            # Employee Test Account
            emp_email = os.getenv("EMPLOYEE_EMAIL", "employee@training.local")
            emp_pass = os.getenv("EMPLOYEE_PASSWORD", "EmployeePass123!")
            emp = db.query(User).filter(User.email == emp_email).first()
            if not emp:
                emp = User(
                    email=emp_email,
                    full_name="Sarah Trainer",
                    password_hash=get_password_hash(emp_pass),
                    role="employee",
                    status="active",
                    identifier="EMP-1001",
                    designation="Senior Instructor"
                )
                db.add(emp)
                db.commit()
                print(f"[OK] Demo Employee account created: {emp_email} (Password: {emp_pass})")
            else:
                print(f"[INFO] Employee account already exists: {emp.email}")

            # Student Test Account
            stu_email = os.getenv("STUDENT_EMAIL", "student@training.local")
            stu_pass = os.getenv("STUDENT_PASSWORD", "StudentPass123!")
            stu = db.query(User).filter(User.email == stu_email).first()
            if not stu:
                stu = User(
                    email=stu_email,
                    full_name="Alex Student",
                    password_hash=get_password_hash(stu_pass),
                    role="student",
                    status="active",
                    identifier="STU-2001"
                )
                db.add(stu)
                db.commit()
                print(f"[OK] Demo Student account created: {stu_email} (Password: {stu_pass})")
            else:
                print(f"[INFO] Student account already exists: {stu.email}")

        print("[SUCCESS] Database initialization completed. No fictional business records were created.")

    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Initialize Training Platform Database and Demo Accounts")
    parser.add_argument("--admin-only", action="store_true", help="Create only the administrator account")
    parser.add_argument("--dev-accounts", action="store_true", default=True, help="Create test accounts for the 3 roles")
    args = parser.parse_args()

    init_db(admin_only=args.admin_only, create_dev=args.dev_accounts)
