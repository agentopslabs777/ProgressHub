from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import Enrollment, User, Program, LearningDay, DayProgress, Notification
from backend.app.schemas.schemas import (
    EnrollmentCreate, EnrollmentResponse, AssignEmployeeInput,
    ManualUnlockInput, ManualLockInput
)
from backend.app.permissions.permissions import get_current_user, require_admin, require_employee, log_audit
from backend.app.services.learning_engine import (
    calculate_enrollment_progress, manual_unlock_day, manual_lock_day
)

router = APIRouter(prefix="/enrollments", tags=["Enrollments"])

@router.get("", response_model=List[dict])
def list_enrollments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Enrollment)

    if current_user.role == "student":
        query = query.filter(Enrollment.student_id == current_user.id, Enrollment.status == "active")
    elif current_user.role == "employee":
        query = query.filter(Enrollment.employee_id == current_user.id, Enrollment.status == "active")

    enrollments = query.order_by(Enrollment.enrolled_at.desc()).all()
    results = []
    for e in enrollments:
        progress = calculate_enrollment_progress(db, e)
        results.append({
            "id": e.id,
            "student_id": e.student_id,
            "studentId": e.student_id,
            "student_name": e.student.full_name if e.student else "Unknown",
            "studentName": e.student.full_name if e.student else "Unknown",
            "student_email": e.student.email if e.student else "",
            "studentEmail": e.student.email if e.student else "",
            "program_id": e.program_id,
            "programId": e.program_id,
            "program_name": e.program.name if e.program else "Unknown",
            "programName": e.program.name if e.program else "Unknown",
            "program_code": e.program.code if e.program else "",
            "programCode": e.program.code if e.program else "",
            "employee_id": e.employee_id,
            "employeeId": e.employee_id,
            "employee_name": e.employee.full_name if e.employee else "Unassigned",
            "employeeName": e.employee.full_name if e.employee else "Unassigned",
            "status": e.status,
            "enrolled_at": e.enrolled_at,
            "enrolledAt": e.enrolled_at,
            "revoked_at": e.revoked_at,
            "progress": progress
        })
    return results

@router.post("", response_model=dict)
def create_enrollment(
    data: EnrollmentCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == data.student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    program = db.query(Program).filter(Program.id == data.program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    if not data.employee_id:
        raise HTTPException(
            status_code=400,
            detail="Assigning a supporting teacher (employee) is compulsory for enrollment."
        )

    emp = db.query(User).filter(User.id == data.employee_id, User.role == "employee").first()
    if not emp:
        raise HTTPException(status_code=404, detail="Assigned supporting teacher (employee) not found")

    existing = db.query(Enrollment).filter(
        Enrollment.student_id == data.student_id,
        Enrollment.program_id == data.program_id
    ).first()

    if existing:
        if existing.status == "active":
            raise HTTPException(status_code=400, detail="Student is already actively enrolled in this program")
        else:
            existing.status = "active"
            existing.employee_id = data.employee_id
            existing.revoked_at = None
            db.commit()
            db.refresh(existing)
            enrollment = existing
    else:
        enrollment = Enrollment(
            student_id=data.student_id,
            program_id=data.program_id,
            employee_id=data.employee_id,
            status="active"
        )
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)

    # Notify student
    notif = Notification(
        user_id=student.id,
        title="New Program Assigned",
        message=f"You have been granted access to program: {program.name}",
        link="/my-programs"
    )
    db.add(notif)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="GRANT_PROGRAM_ACCESS",
        target_type="enrollment",
        target_id=enrollment.id,
        details=f"Enrolled {student.full_name} in {program.name}"
    )

    return {
        "id": enrollment.id,
        "student_id": enrollment.student_id,
        "program_id": enrollment.program_id,
        "employee_id": enrollment.employee_id,
        "status": enrollment.status,
        "enrolled_at": enrollment.enrolled_at
    }

@router.post("/{enrollment_id}/revoke")
def revoke_enrollment(
    enrollment_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    enrollment.status = "revoked"
    enrollment.revoked_at = datetime.utcnow()
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="REVOKE_PROGRAM_ACCESS",
        target_type="enrollment",
        target_id=enrollment.id,
        details=f"Revoked enrollment {enrollment_id} for student {enrollment.student_id}"
    )

    return {"message": "Enrollment access revoked successfully"}

@router.post("/{enrollment_id}/assign-employee")
def assign_employee_to_enrollment(
    enrollment_id: str,
    data: AssignEmployeeInput,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if not data.employee_id:
        raise HTTPException(
            status_code=400,
            detail="Assigning a supporting teacher (employee) is compulsory for enrollment."
        )

    emp = db.query(User).filter(User.id == data.employee_id, User.role == "employee").first()
    if not emp:
        raise HTTPException(status_code=404, detail="Assigned supporting teacher (employee) not found")
        enrollment.employee_id = emp.id
    else:
        enrollment.employee_id = None

    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="ASSIGN_EMPLOYEE",
        target_type="enrollment",
        target_id=enrollment.id,
        details=f"Assigned employee {data.employee_id} to enrollment {enrollment_id}"
    )

    return {"message": "Supporting employee updated successfully"}

@router.post("/students/{student_id}/assign-employee")
def assign_employee_to_student(
    student_id: str,
    data: AssignEmployeeInput,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == student_id,
        Enrollment.status == "active"
    ).all()

    if not enrollments:
        raise HTTPException(status_code=400, detail="Student has no active enrollments to assign")

    for e in enrollments:
        e.employee_id = data.employee_id

    db.commit()
    return {"message": f"Updated assigned employee across {len(enrollments)} active enrollment(s)"}

# Manual Unlock and Lock System (Section 3)
@router.post("/{enrollment_id}/days/{day_id}/unlock")
def unlock_day_manually(
    enrollment_id: str,
    day_id: str,
    data: ManualUnlockInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Only teachers or administrators can manually unlock days")

    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if current_user.role == "employee" and enrollment.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only manage your assigned students")

    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    reason = data.reason or f"Manually unlocked by {current_user.full_name}"
    progress = manual_unlock_day(db, enrollment, day, current_user, reason)

    return {
        "message": f"Day {day.day_number} unlocked successfully",
        "day_id": day.id,
        "enrollment_id": enrollment.id,
        "is_manually_unlocked": progress.is_manually_unlocked,
        "unlocked_at": progress.unlocked_at,
        "unlock_reason": progress.unlock_reason
    }

@router.post("/{enrollment_id}/days/{day_id}/lock")
def lock_day_manually(
    enrollment_id: str,
    day_id: str,
    data: ManualLockInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Only teachers or administrators can manually lock days")

    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if current_user.role == "employee" and enrollment.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only manage your assigned students")

    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    reason = data.reason or f"Manually locked by {current_user.full_name}"
    progress = manual_lock_day(db, enrollment, day, current_user, reason)

    return {
        "message": f"Day {day.day_number} locked successfully",
        "day_id": day.id,
        "enrollment_id": enrollment.id,
        "is_manually_unlocked": progress.is_manually_unlocked,
        "unlock_reason": progress.unlock_reason
    }
