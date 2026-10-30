import random
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.app.db.session import get_db
from backend.app.core.security import get_password_hash
from backend.app.models.models import User, Enrollment, DayProgress, TaskSubmission, ChecklistCompletion
from backend.app.schemas.schemas import UserCreate, UserUpdate, UserResponse
from backend.app.permissions.permissions import get_current_user, require_admin, require_employee, log_audit
from backend.app.services.learning_engine import calculate_enrollment_progress

router = APIRouter(prefix="/students", tags=["Students"])

def generate_student_identifier(db: Session) -> str:
    while True:
        num = random.randint(1000, 9999)
        ident = f"STU-{num}"
        exists = db.query(User).filter(User.identifier == ident).first()
        if not exists:
            return ident

@router.get("", response_model=List[dict])
def list_students(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(require_employee),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.role == "student")

    # If employee, restrict to assigned students
    if current_user.role == "employee":
        assigned_student_ids = db.query(Enrollment.student_id).filter(
            Enrollment.employee_id == current_user.id,
            Enrollment.status == "active"
        ).distinct().all()
        sids = [s[0] for s in assigned_student_ids]
        query = query.filter(User.id.in_(sids))

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(s),
                User.email.ilike(s),
                User.identifier.ilike(s)
            )
        )

    if status_filter:
        query = query.filter(User.status == status_filter)

    students = query.order_by(User.created_at.desc()).all()

    results = []
    for st in students:
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == st.id,
            Enrollment.status == "active"
        ).all()
        
        # Calculate avg progress
        progs = [calculate_enrollment_progress(db, e) for e in enrollments]
        avg_progress = int(sum(progs) / len(progs)) if progs else 0

        
        pending_sub = db.query(TaskSubmission).join(Enrollment).filter(
            Enrollment.student_id == st.id,
            TaskSubmission.status.in_(["submitted", "under_review"])
        ).count()

        results.append({
            "id": st.id,
            "full_name": st.full_name,
            "fullName": st.full_name,  # for frontend compat
            "email": st.email,
            "role": st.role,
            "status": st.status,
            "identifier": st.identifier,
            "contact_number": st.contact_number,
            "enrollmentCount": len(enrollments),
            "progress": avg_progress,
            "pendingSubmissions": pending_sub,
            "created_at": st.created_at,
            "createdAt": st.created_at
        })

    return results

@router.post("", response_model=UserResponse)
def create_student(
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

    identifier = data.identifier.strip() if data.identifier else generate_student_identifier(db)
    if data.identifier:
        ident_exists = db.query(User).filter(User.identifier == identifier).first()
        if ident_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this identifier already exists"
            )

    student = User(
        email=clean_email,
        full_name=data.full_name.strip(),
        password_hash=get_password_hash(data.password),
        role="student",
        status="active",
        identifier=identifier,
        contact_number=data.contact_number
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    log_audit(
        db=db,
        actor=current_user,
        action="CREATE_STUDENT",
        target_type="student",
        target_id=student.id,
        details=f"Student {student.full_name} ({student.identifier}) created"
    )

    return UserResponse.model_validate(student)

@router.get("/{student_id}")
def get_student_details(
    student_id: str,
    current_user: User = Depends(require_employee),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # If employee, check that this student is assigned to them
    if current_user.role == "employee":
        is_assigned = db.query(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.employee_id == current_user.id,
            Enrollment.status == "active"
        ).first()
        if not is_assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to view this student profile"
            )

    enrollments = db.query(Enrollment).filter(Enrollment.student_id == student_id).all()
    enrollment_list = []
    for e in enrollments:
        enrollment_list.append({
            "id": e.id,
            "program_id": e.program_id,
            "program_name": e.program.name if e.program else "Unknown",
            "program_code": e.program.code if e.program else "",
            "employee_id": e.employee_id,
            "employee_name": e.employee.full_name if e.employee else None,
            "status": e.status,
            "enrolled_at": e.enrolled_at,
            "progress": calculate_enrollment_progress(db, e)
        })

    attendance_records = []

    submissions = db.query(TaskSubmission).join(Enrollment).filter(
        Enrollment.student_id == student_id
    ).order_by(TaskSubmission.submitted_at.desc()).all()

    # Build complete checklist tracking report across all student enrolled tracks
    checklist_report = []
    for e in enrollments:
        if not e.program:
            continue
        for track in e.program.tracks:
            for day in track.days:
                dp = db.query(DayProgress).filter(
                    DayProgress.enrollment_id == e.id,
                    DayProgress.day_id == day.id
                ).first()
                
                day_items = []
                for item in day.checklist_items:
                    completion = db.query(ChecklistCompletion).filter(
                        ChecklistCompletion.enrollment_id == e.id,
                        ChecklistCompletion.item_id == item.id
                    ).first()
                    day_items.append({
                        "id": item.id,
                        "title": item.title,
                        "is_required": item.is_required,
                        "completed": bool(completion and completion.completed),
                        "completed_at": completion.completed_at if completion else None
                    })
                
                checklist_report.append({
                    "enrollment_id": e.id,
                    "program_name": e.program.name,
                    "track_name": track.name,
                    "day_id": day.id,
                    "day_number": day.day_number,
                    "day_title": day.title,
                    "is_day_completed": bool(dp and dp.is_completed),
                    "completed_at": dp.completed_at if dp else None,
                    "items": day_items,
                    "total_items": len(day_items),
                    "completed_items": sum(1 for it in day_items if it["completed"])
                })

    return {
        "student": UserResponse.model_validate(student),
        "enrollments": enrollment_list,
        "checklist_report": checklist_report,
        
        "submissions": [{
            "id": sub.id,
            "task_id": sub.task_id,
            "task_title": sub.task.title if sub.task else "",
            "status": sub.status,
            "feedback": sub.feedback,
            "submitted_at": sub.submitted_at,
            "file_id": sub.file_id
        } for sub in submissions]
    }

@router.patch("/{student_id}", response_model=UserResponse)
def update_student(
    student_id: str,
    data: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if data.email:
        clean_email = data.email.strip().lower()
        conflict = db.query(User).filter(User.email == clean_email, User.id != student_id).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Email already in use")
        student.email = clean_email

    if data.full_name:
        student.full_name = data.full_name.strip()
    if data.password:
        student.password_hash = get_password_hash(data.password)
    if data.contact_number is not None:
        student.contact_number = data.contact_number
    if data.status:
        student.status = data.status

    db.commit()
    db.refresh(student)

    log_audit(
        db=db,
        actor=current_user,
        action="UPDATE_STUDENT",
        target_type="student",
        target_id=student.id,
        details=f"Student {student.full_name} updated"
    )

    return UserResponse.model_validate(student)

@router.post("/{student_id}/block")
def block_student(
    student_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.status = "blocked"
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="BLOCK_STUDENT",
        target_type="student",
        target_id=student.id,
        details=f"Student {student.full_name} blocked"
    )

    return {"message": f"Student {student.full_name} has been blocked."}

@router.post("/{student_id}/unblock")
def unblock_student(
    student_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.status = "active"
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="UNBLOCK_STUDENT",
        target_type="student",
        target_id=student.id,
        details=f"Student {student.full_name} unblocked"
    )

    return {"message": f"Student {student.full_name} has been unblocked."}
