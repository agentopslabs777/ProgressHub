import random
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.app.db.session import get_db
from backend.app.core.security import get_password_hash
from backend.app.models.models import (
    User, Enrollment, DayProgress, TaskSubmission, ChecklistCompletion,
    StudentApplication, Program, GoogleDriveSubmission, AttendanceRecord,
    RewardTransaction, RewardWallet, ProgramPurchase, RefreshToken, Notification, ChatMessage
)
from pydantic import BaseModel
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

    # Automatically block expired students
    now = datetime.utcnow()
    has_status_changed = False
    for st in students:
        if st.access_expires_at and st.access_expires_at <= now and st.status != "blocked":
            st.status = "blocked"
            has_status_changed = True
    if has_status_changed:
        db.commit()

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

        days_left = None
        if st.access_expires_at:
            delta = (st.access_expires_at - now).total_seconds()
            days_left = max(0, int(delta // 86400) + (1 if delta % 86400 > 0 else 0))

        results.append({
            "id": st.id,
            "full_name": st.full_name,
            "fullName": st.full_name,  # for frontend compat
            "email": st.email,
            "role": st.role,
            "status": st.status,
            "identifier": st.identifier,
            "contact_number": st.contact_number,
            "access_duration": st.access_duration or "lifetime",
            "accessDuration": st.access_duration or "lifetime",
            "access_expires_at": st.access_expires_at.isoformat() if st.access_expires_at else None,
            "accessExpiresAt": st.access_expires_at.isoformat() if st.access_expires_at else None,
            "days_left": days_left,
            "daysLeft": days_left,
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

    # Calculate access validity duration
    raw_duration = (data.access_duration or "lifetime").lower().strip()
    access_expires_at = None
    if raw_duration == "1_month":
        access_expires_at = datetime.utcnow() + timedelta(days=30)
        access_duration = "1_month"
    elif raw_duration == "6_months":
        access_expires_at = datetime.utcnow() + timedelta(days=180)
        access_duration = "6_months"
    elif raw_duration == "1_year":
        access_expires_at = datetime.utcnow() + timedelta(days=365)
        access_duration = "1_year"
    else:
        access_duration = "lifetime"
        access_expires_at = None

    student = User(
        email=clean_email,
        full_name=data.full_name.strip(),
        password_hash=get_password_hash(data.password),
        role="student",
        status="active",
        identifier=identifier,
        contact_number=data.contact_number,
        access_duration=access_duration,
        access_expires_at=access_expires_at
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
        details=f"Student {student.full_name} ({student.identifier}) created with access duration {access_duration}"
    )

    resp = UserResponse.model_validate(student)
    if student.access_expires_at:
        delta = (student.access_expires_at - datetime.utcnow()).total_seconds()
        resp.days_left = max(0, int(delta // 86400) + (1 if delta % 86400 > 0 else 0))
    return resp


# =====================================================================
# PUBLIC STUDENT REGISTRATION FORM & ADMIN APPROVAL AUTOMATION
# =====================================================================

class StudentRegisterForm(BaseModel):
    full_name: str
    contact_number: Optional[str] = None
    email: str
    password: str
    payment_id: Optional[str] = None
    program_id: Optional[str] = None
    notes: Optional[str] = None


class ApplicationApproveRequest(BaseModel):
    program_id: Optional[str] = None
    employee_id: Optional[str] = None
    access_duration: Optional[str] = "lifetime"


class ApplicationRejectRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/register")
def public_student_register(
    data: StudentRegisterForm,
    db: Session = Depends(get_db)
):
    clean_email = data.email.strip().lower()
    
    # 1. Check if an active student account already exists
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please log in directly."
        )

    # 2. Check if a pending application already exists for this email
    existing_app = db.query(StudentApplication).filter(
        StudentApplication.email == clean_email,
        StudentApplication.status == "pending"
    ).first()

    if existing_app:
        # Update existing pending application with latest details & payment ID
        existing_app.full_name = data.full_name.strip()
        existing_app.contact_number = data.contact_number.strip() if data.contact_number else None
        existing_app.password_hash = get_password_hash(data.password)
        existing_app.payment_id = data.payment_id.strip() if data.payment_id else existing_app.payment_id
        if data.program_id:
            existing_app.program_id = data.program_id
        if data.notes:
            existing_app.notes = data.notes.strip()
        existing_app.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_app)
        return {
            "success": True,
            "application_id": existing_app.id,
            "status": "pending",
            "message": "Your registration details and payment ID have been updated. Waiting for admin approval."
        }

    # 3. Create new StudentApplication
    app_record = StudentApplication(
        full_name=data.full_name.strip(),
        contact_number=data.contact_number.strip() if data.contact_number else None,
        email=clean_email,
        password_hash=get_password_hash(data.password),
        payment_id=data.payment_id.strip() if data.payment_id else None,
        program_id=data.program_id if data.program_id else None,
        notes=data.notes.strip() if data.notes else None,
        status="pending"
    )
    db.add(app_record)
    db.commit()
    db.refresh(app_record)

    return {
        "success": True,
        "application_id": app_record.id,
        "status": "pending",
        "message": "Application submitted successfully! Your account and course access will be activated upon administrator approval."
    }


@router.get("/applications")
def list_student_applications(
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(StudentApplication)
    if status_filter:
        query = query.filter(StudentApplication.status == status_filter)
    
    applications = query.order_by(StudentApplication.created_at.desc()).all()
    results = []
    for app in applications:
        prog = db.query(Program).filter(Program.id == app.program_id).first() if app.program_id else None
        reviewer = db.query(User).filter(User.id == app.reviewed_by).first() if app.reviewed_by else None
        results.append({
            "id": app.id,
            "full_name": app.full_name,
            "contact_number": app.contact_number,
            "email": app.email,
            "payment_id": app.payment_id,
            "program_id": app.program_id,
            "program_name": f"{prog.name} ({prog.code})" if prog else "None Selected",
            "status": app.status,
            "notes": app.notes,
            "rejection_reason": app.rejection_reason,
            "reviewed_by": reviewer.full_name if reviewer else None,
            "reviewed_at": app.reviewed_at.isoformat() if app.reviewed_at else None,
            "created_student_id": app.created_student_id,
            "created_enrollment_id": app.created_enrollment_id,
            "created_at": app.created_at.isoformat() if app.created_at else None
        })
    return results


@router.post("/applications/{application_id}/approve")
def approve_student_application(
    application_id: str,
    data: ApplicationApproveRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    app = db.query(StudentApplication).filter(StudentApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Student application not found")
    
    if app.status == "approved" and app.created_student_id:
        return {
            "success": True,
            "message": "This application has already been approved.",
            "student_id": app.created_student_id,
            "enrollment_id": app.created_enrollment_id
        }

    # 1. Resolve target Program ID
    chosen_program_id = data.program_id or app.program_id
    if not chosen_program_id:
        # Default to first available program if none specified
        first_prog = db.query(Program).order_by(Program.created_at.asc()).first()
        if not first_prog:
            raise HTTPException(status_code=400, detail="No program available to enroll the student.")
        chosen_program_id = first_prog.id

    program = db.query(Program).filter(Program.id == chosen_program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Selected program does not exist.")

    # Calculate access validity duration
    raw_duration = (data.access_duration or "lifetime").lower().strip()
    access_expires_at = None
    if raw_duration == "1_month":
        access_expires_at = datetime.utcnow() + timedelta(days=30)
        access_duration = "1_month"
    elif raw_duration == "6_months":
        access_expires_at = datetime.utcnow() + timedelta(days=180)
        access_duration = "6_months"
    elif raw_duration == "1_year":
        access_expires_at = datetime.utcnow() + timedelta(days=365)
        access_duration = "1_year"
    else:
        access_duration = "lifetime"
        access_expires_at = None

    # 2. Check or create User
    student = db.query(User).filter(User.email == app.email.lower().strip()).first()
    if not student:
        identifier = generate_student_identifier(db)
        student = User(
            email=app.email.lower().strip(),
            full_name=app.full_name.strip(),
            password_hash=app.password_hash,
            role="student",
            status="active",
            identifier=identifier,
            contact_number=app.contact_number,
            access_duration=access_duration,
            access_expires_at=access_expires_at
        )
        db.add(student)
        db.flush()
    else:
        # Reactivate and update access duration
        student.status = "active"
        student.access_duration = access_duration
        student.access_expires_at = access_expires_at
        if not student.contact_number and app.contact_number:
            student.contact_number = app.contact_number

    # 3. Check or create Enrollment & assign faculty
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == student.id,
        Enrollment.program_id == chosen_program_id
    ).first()

    assigned_emp_id = data.employee_id.strip() if data.employee_id else None

    if not enrollment:
        enrollment = Enrollment(
            student_id=student.id,
            program_id=chosen_program_id,
            employee_id=assigned_emp_id,
            status="active"
        )
        db.add(enrollment)
        db.flush()
    else:
        enrollment.status = "active"
        if assigned_emp_id:
            enrollment.employee_id = assigned_emp_id

    # 4. Mark application approved
    app.status = "approved"
    app.program_id = chosen_program_id
    app.reviewed_by = current_user.id
    app.reviewed_at = datetime.utcnow()
    app.created_student_id = student.id
    app.created_enrollment_id = enrollment.id

    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="APPROVE_STUDENT_APPLICATION",
        target_type="student_application",
        target_id=app.id,
        details=f"Approved application for {student.full_name} ({student.email}) into {program.name}. Faculty: {assigned_emp_id or 'Unassigned'}"
    )

    return {
        "success": True,
        "message": f"Successfully approved {student.full_name}! Account created, enrolled in {program.name}, and faculty assigned.",
        "student_id": student.id,
        "enrollment_id": enrollment.id
    }


@router.post("/applications/{application_id}/reject")
def reject_student_application(
    application_id: str,
    data: ApplicationRejectRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    app = db.query(StudentApplication).filter(StudentApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Student application not found")

    app.status = "rejected"
    app.rejection_reason = data.reason.strip() if data.reason else "Application declined by administrator"
    app.reviewed_by = current_user.id
    app.reviewed_at = datetime.utcnow()
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="REJECT_STUDENT_APPLICATION",
        target_type="student_application",
        target_id=app.id,
        details=f"Rejected application for {app.full_name} ({app.email}). Reason: {app.rejection_reason}"
    )

    return {
        "success": True,
        "message": f"Application for {app.full_name} has been rejected."
    }


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

    resp_student = UserResponse.model_validate(student)
    if student.access_expires_at:
        delta = (student.access_expires_at - datetime.utcnow()).total_seconds()
        resp_student.days_left = max(0, int(delta // 86400) + (1 if delta % 86400 > 0 else 0))

    return {
        "student": resp_student,
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

    if data.access_duration is not None:
        raw_dur = data.access_duration.lower().strip()
        if raw_dur == "1_month":
            student.access_duration = "1_month"
            student.access_expires_at = datetime.utcnow() + timedelta(days=30)
            student.status = "active"  # Extending/setting access automatically activates!
        elif raw_dur == "6_months":
            student.access_duration = "6_months"
            student.access_expires_at = datetime.utcnow() + timedelta(days=180)
            student.status = "active"
        elif raw_dur == "1_year":
            student.access_duration = "1_year"
            student.access_expires_at = datetime.utcnow() + timedelta(days=365)
            student.status = "active"
        elif raw_dur == "lifetime":
            student.access_duration = "lifetime"
            student.access_expires_at = None
            student.status = "active"

    if data.access_expires_at is not None:
        student.access_expires_at = data.access_expires_at

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

    resp = UserResponse.model_validate(student)
    if student.access_expires_at:
        delta = (student.access_expires_at - datetime.utcnow()).total_seconds()
        resp.days_left = max(0, int(delta // 86400) + (1 if delta % 86400 > 0 else 0))
    return resp

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


@router.delete("/{student_id}")
def delete_student(
    student_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student_name = student.full_name
    student_email = student.email

    # 1. Gather all student enrollment IDs
    enrs = db.query(Enrollment).filter(Enrollment.student_id == student_id).all()
    enr_ids = [e.id for e in enrs]

    if enr_ids:
        # Delete dependent enrollment records
        db.query(DayProgress).filter(DayProgress.enrollment_id.in_(enr_ids)).delete(synchronize_session=False)
        db.query(ChecklistCompletion).filter(ChecklistCompletion.enrollment_id.in_(enr_ids)).delete(synchronize_session=False)
        db.query(TaskSubmission).filter(TaskSubmission.enrollment_id.in_(enr_ids)).delete(synchronize_session=False)
        db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.enrollment_id.in_(enr_ids)).delete(synchronize_session=False)
        
        # Unlink any student applications pointing to these enrollments
        apps = db.query(StudentApplication).filter(StudentApplication.created_enrollment_id.in_(enr_ids)).all()
        for a in apps:
            a.created_enrollment_id = None

        # Delete enrollments
        db.query(Enrollment).filter(Enrollment.id.in_(enr_ids)).delete(synchronize_session=False)

    # 2. Delete user-specific records
    db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student_id).delete(synchronize_session=False)
    db.query(RewardTransaction).filter(RewardTransaction.user_id == student_id).delete(synchronize_session=False)
    db.query(RewardWallet).filter(RewardWallet.user_id == student_id).delete(synchronize_session=False)
    db.query(ProgramPurchase).filter(ProgramPurchase.student_id == student_id).delete(synchronize_session=False)
    db.query(RefreshToken).filter(RefreshToken.user_id == student_id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == student_id).delete(synchronize_session=False)
    db.query(ChatMessage).filter(ChatMessage.sender_id == student_id).delete(synchronize_session=False)

    # Unlink applications pointing to this student
    student_apps = db.query(StudentApplication).filter(StudentApplication.created_student_id == student_id).all()
    for sa in student_apps:
        sa.created_student_id = None

    # 3. Delete the student User record
    db.delete(student)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="DELETE_STUDENT",
        target_type="student",
        target_id=student_id,
        details=f"Student {student_name} ({student_email}) was permanently deleted"
    )

    return {"success": True, "message": f"Student {student_name} has been permanently deleted."}



