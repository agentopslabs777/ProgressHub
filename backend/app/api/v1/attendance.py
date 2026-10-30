from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import (
    AttendanceSession, AttendanceRecord, Program, Enrollment, User,
    GoogleDriveSubmission, ChecklistCompletion, TaskSubmission, DayProgress
)
from backend.app.schemas.schemas import (
    AttendanceSessionCreate, AttendanceBatchUpdate, AttendanceRecordResponse
)
from backend.app.permissions.permissions import get_current_user, require_employee, log_audit
from backend.app.services.learning_engine import record_student_activity_attendance

router = APIRouter(prefix="/attendance", tags=["Attendance"])

@router.get("", response_model=List[dict])
def list_attendance_sessions(
    program_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(AttendanceSession)
    if program_id:
        query = query.filter(AttendanceSession.program_id == program_id)

    sessions = query.order_by(AttendanceSession.session_date.desc()).all()
    results = []
    for s in sessions:
        records_query = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id)
        if current_user.role == "student":
            records_query = records_query.filter(AttendanceRecord.student_id == current_user.id)
        elif current_user.role == "employee":
            assigned_sids = db.query(Enrollment.student_id).filter(
                Enrollment.employee_id == current_user.id,
                Enrollment.status == "active"
            ).all()
            sids = [x[0] for x in assigned_sids]
            records_query = records_query.filter(AttendanceRecord.student_id.in_(sids))

        records = records_query.all()
        present = sum(1 for r in records if r.status in ["present", "late"])
        results.append({
            "id": s.id,
            "program_id": s.program_id,
            "programId": s.program_id,
            "program_name": s.program.name if s.program else "",
            "programName": s.program.name if s.program else "",
            "session_date": s.session_date,
            "sessionDate": s.session_date,
            "title": s.title,
            "total_students": len(records),
            "totalStudents": len(records),
            "present_count": present,
            "presentCount": present,
            "records": [{
                "id": r.id,
                "session_id": r.session_id,
                "sessionId": r.session_id,
                "student_id": r.student_id,
                "studentId": r.student_id,
                "student_name": r.student.full_name if r.student else "Unknown",
                "studentName": r.student.full_name if r.student else "Unknown",
                "student_email": r.student.email if r.student else "",
                "studentEmail": r.student.email if r.student else "",
                "status": r.status,
                "notes": r.notes,
                "updated_at": r.updated_at
            } for r in records]
        })
    return results

@router.post("/sessions", response_model=dict)
def create_attendance_session(
    data: AttendanceSessionCreate,
    current_user: User = Depends(require_employee),
    db: Session = Depends(get_db)
):
    program = db.query(Program).filter(Program.id == data.program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    session = AttendanceSession(
        program_id=data.program_id,
        session_date=data.session_date,
        title=data.title.strip(),
        created_by_id=current_user.id
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Automatically initialize records for all active students in this program
    enrollments = db.query(Enrollment).filter(
        Enrollment.program_id == data.program_id,
        Enrollment.status == "active"
    ).all()

    for e in enrollments:
        rec = AttendanceRecord(
            session_id=session.id,
            student_id=e.student_id,
            status="present",
            recorded_by_id=current_user.id
        )
        db.add(rec)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="CREATE_ATTENDANCE_SESSION",
        target_type="attendance_session",
        target_id=session.id,
        details=f"Session '{session.title}' created for program '{program.name}'"
    )

    return {
        "id": session.id,
        "title": session.title,
        "session_date": session.session_date,
        "total_enrolled": len(enrollments)
    }

@router.post("/records/batch")
def update_attendance_records(
    data: AttendanceBatchUpdate,
    current_user: User = Depends(require_employee),
    db: Session = Depends(get_db)
):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == data.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")

    for item in data.records:
        rec = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session.id,
            AttendanceRecord.student_id == item.student_id
        ).first()

        if rec:
            rec.status = item.status
            rec.notes = item.notes
            rec.recorded_by_id = current_user.id
            rec.updated_at = datetime.utcnow()
        else:
            rec = AttendanceRecord(
                session_id=session.id,
                student_id=item.student_id,
                status=item.status,
                notes=item.notes,
                recorded_by_id=current_user.id
            )
            db.add(rec)

    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="UPDATE_ATTENDANCE",
        target_type="attendance_session",
        target_id=session.id,
        details=f"Updated {len(data.records)} attendance records for session '{session.title}'"
    )

    return {"message": "Attendance records updated successfully"}

@router.get("/my-attendance")
def get_my_attendance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if student completed at least one task/activity today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    drive_count = db.query(GoogleDriveSubmission).join(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        GoogleDriveSubmission.submitted_at >= today_start
    ).count()

    checklist_count = db.query(ChecklistCompletion).join(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        ChecklistCompletion.completed == True,
        ChecklistCompletion.completed_at >= today_start
    ).count()

    task_count = db.query(TaskSubmission).join(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        TaskSubmission.submitted_at >= today_start
    ).count()

    day_count = db.query(DayProgress).join(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        DayProgress.completed_at >= today_start
    ).count()

    today_tasks_count = drive_count + checklist_count + task_count + day_count
    if today_tasks_count > 0:
        record_student_activity_attendance(db, current_user.id)

    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == current_user.id
    ).join(AttendanceSession).order_by(AttendanceSession.session_date.desc()).all()

    total = len(records)
    present = sum(1 for r in records if r.status in ["present", "late"])
    attendance_rate = int((present / total) * 100) if total > 0 else 0

    # Today's attendance status
    today = date.today()
    today_rec = next((r for r in records if r.session and (
        (isinstance(r.session.session_date, datetime) and r.session.session_date.date() == today) or
        (isinstance(r.session.session_date, date) and r.session.session_date == today)
    )), None)

    is_today_attended = bool(today_rec and today_rec.status in ["present", "late"])

    return {
        "total_sessions": total,
        "present_sessions": present,
        "attendance_rate": attendance_rate,
        "today_attended": is_today_attended,
        "today_tasks_completed": today_tasks_count,
        "today_attendance_status": "present" if is_today_attended else "pending",
        "records": [{
            "id": r.id,
            "session_title": r.session.title if r.session else "Daily Class",
            "program_name": r.session.program.name if r.session and r.session.program else "",
            "date": r.session.session_date if r.session else None,
            "status": r.status,
            "notes": r.notes
        } for r in records]
    }
