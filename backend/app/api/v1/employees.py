import random
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.app.db.session import get_db
from backend.app.core.security import get_password_hash
from backend.app.models.models import User, Enrollment, TeamMembership, Team, TaskSubmission, Notification
from backend.app.schemas.schemas import UserCreate, UserUpdate, UserResponse
from backend.app.permissions.permissions import get_current_user, require_admin, log_audit

router = APIRouter(prefix="/employees", tags=["Employees"])

def generate_employee_identifier(db: Session) -> str:
    while True:
        num = random.randint(1000, 9999)
        ident = f"EMP-{num}"
        exists = db.query(User).filter(User.identifier == ident).first()
        if not exists:
            return ident

@router.get("", response_model=List[dict])
def list_employees(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.role == "employee")

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(s),
                User.email.ilike(s),
                User.identifier.ilike(s),
                User.designation.ilike(s)
            )
        )

    if status_filter:
        query = query.filter(User.status == status_filter)

    employees = query.order_by(User.created_at.desc()).all()

    results = []
    for emp in employees:
        assigned_students = db.query(Enrollment).filter(
            Enrollment.employee_id == emp.id,
            Enrollment.status == "active"
        ).count()

        teams = db.query(Team).join(TeamMembership).filter(
            TeamMembership.employee_id == emp.id
        ).all()

        pending_reviews = db.query(TaskSubmission).join(Enrollment).filter(
            Enrollment.employee_id == emp.id,
            TaskSubmission.status.in_(["submitted", "under_review"])
        ).count()

        results.append({
            "id": emp.id,
            "full_name": emp.full_name,
            "fullName": emp.full_name,
            "email": emp.email,
            "role": emp.role,
            "status": emp.status,
            "identifier": emp.identifier,
            "contact_number": emp.contact_number,
            "designation": emp.designation,
            "studentCount": assigned_students,
            "pendingReviews": pending_reviews,
            "teams": [{"id": t.id, "name": t.name} for t in teams],
            "created_at": emp.created_at,
            "createdAt": emp.created_at
        })

    return results

@router.post("", response_model=UserResponse)
def create_employee(
    data: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    clean_email = data.email.strip().lower()
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )

    identifier = data.identifier.strip() if data.identifier else generate_employee_identifier(db)
    if data.identifier:
        ident_exists = db.query(User).filter(User.identifier == identifier).first()
        if ident_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this identifier already exists"
            )

    emp = User(
        email=clean_email,
        full_name=data.full_name.strip(),
        password_hash=get_password_hash(data.password),
        role="employee",
        status="active",
        identifier=identifier,
        contact_number=data.contact_number,
        designation=data.designation or "Trainer"
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)

    log_audit(
        db=db,
        actor=current_user,
        action="CREATE_EMPLOYEE",
        target_type="employee",
        target_id=emp.id,
        details=f"Employee {emp.full_name} ({emp.identifier}) created"
    )

    return UserResponse.model_validate(emp)

@router.get("/{employee_id}")
def get_employee_details(
    employee_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    emp = db.query(User).filter(User.id == employee_id, User.role == "employee").first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    enrollments = db.query(Enrollment).filter(
        Enrollment.employee_id == employee_id,
        Enrollment.status == "active"
    ).all()

    teams = db.query(Team).join(TeamMembership).filter(
        TeamMembership.employee_id == employee_id
    ).all()

    return {
        "employee": UserResponse.model_validate(emp),
        "assigned_students": [{
            "enrollment_id": e.id,
            "student_id": e.student_id,
            "student_name": e.student.full_name if e.student else "Unknown",
            "student_email": e.student.email if e.student else "",
            "program_name": e.program.name if e.program else "Unknown"
        } for e in enrollments],
        "teams": [{"id": t.id, "name": t.name, "description": t.description} for t in teams]
    }

@router.patch("/{employee_id}", response_model=UserResponse)
def update_employee(
    employee_id: str,
    data: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    emp = db.query(User).filter(User.id == employee_id, User.role == "employee").first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if data.email:
        clean_email = data.email.strip().lower()
        conflict = db.query(User).filter(User.email == clean_email, User.id != employee_id).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Email already in use")
        emp.email = clean_email

    if data.full_name:
        emp.full_name = data.full_name.strip()
    if data.password:
        if len(data.password.strip()) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        emp.password_hash = get_password_hash(data.password)
    if data.contact_number is not None:
        emp.contact_number = data.contact_number
    if data.designation is not None:
        emp.designation = data.designation
    if data.status:
        emp.status = data.status

    db.commit()
    db.refresh(emp)

    log_audit(
        db=db,
        actor=current_user,
        action="UPDATE_EMPLOYEE",
        target_type="employee",
        target_id=emp.id,
        details=f"Employee {emp.full_name} updated" + (" (password changed)" if data.password else "")
    )

    return UserResponse.model_validate(emp)

@router.post("/{employee_id}/block")
def block_employee(
    employee_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    emp = db.query(User).filter(User.id == employee_id, User.role == "employee").first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp.status = "blocked"
    db.commit()

    # Check if student reassignment may be needed
    active_enrollments = db.query(Enrollment).filter(
        Enrollment.employee_id == employee_id,
        Enrollment.status == "active"
    ).count()

    if active_enrollments > 0:
        admin_notif = Notification(
            user_id=current_user.id,
            title="Employee Blocked - Reassignment Required",
            message=f"Employee {emp.full_name} has {active_enrollments} assigned students who may need reassignment.",
            link="/enrollments"
        )
        db.add(admin_notif)
        db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="BLOCK_EMPLOYEE",
        target_type="employee",
        target_id=emp.id,
        details=f"Employee {emp.full_name} blocked"
    )

    return {"message": f"Employee {emp.full_name} has been blocked."}

@router.post("/{employee_id}/unblock")
def unblock_employee(
    employee_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    emp = db.query(User).filter(User.id == employee_id, User.role == "employee").first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp.status = "active"
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="UNBLOCK_EMPLOYEE",
        target_type="employee",
        target_id=emp.id,
        details=f"Employee {emp.full_name} unblocked"
    )

    return {"message": f"Employee {emp.full_name} has been unblocked."}
