from datetime import datetime, date
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.db.session import get_db
from backend.app.models.models import (
    User, Program, Enrollment, TaskSubmission, DayProgress, 
    LearningTrack, LearningDay, AuditLog, Notification,
    GoogleDriveSubmission, ChecklistCompletion, SystemSetting
)
from backend.app.permissions.permissions import get_current_user, require_admin, log_audit
from backend.app.services.learning_engine import calculate_enrollment_progress
from backend.app.services.reward_service import get_or_create_wallet, get_or_create_reward_config

router = APIRouter(tags=["Dashboard"])

@router.get("/dashboard", response_model=dict)
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    help_setting = db.query(SystemSetting).filter(SystemSetting.key == "help_link").first()
    help_url = help_setting.value if help_setting and help_setting.value else None

    if current_user.role == "admin":
        total_students = db.query(User).filter(User.role == "student").count()
        active_students = db.query(User).filter(User.role == "student", User.status == "active").count()
        blocked_students = db.query(User).filter(User.role == "student", User.status == "blocked").count()

        total_employees = db.query(User).filter(User.role == "employee").count()
        active_employees = db.query(User).filter(User.role == "employee", User.status == "active").count()
        blocked_employees = db.query(User).filter(User.role == "employee", User.status == "blocked").count()

        total_programs = db.query(Program).count()
        enrollments = db.query(Enrollment).filter(Enrollment.status == "active").all()
        total_enrollments = len(enrollments)

        pending_subs = db.query(TaskSubmission).filter(
            TaskSubmission.status.in_(["submitted", "under_review"])
        ).count()
        pending_drive_subs = db.query(GoogleDriveSubmission).filter(
            GoogleDriveSubmission.status.in_(["submitted", "under_review"])
        ).count()

        progs = [calculate_enrollment_progress(db, e) for e in enrollments]
        avg_prog = int(sum(progs) / len(progs)) if progs else 0

        # Charts data calculated from real DB records
        programs = db.query(Program).all()
        enrollment_chart = []
        for p in programs:
            cnt = db.query(Enrollment).filter(Enrollment.program_id == p.id, Enrollment.status == "active").count()
            enrollment_chart.append({"name": p.code or p.name[:10], "students": cnt})

        submission_stats = [
            {"status": "Submitted", "count": db.query(TaskSubmission).filter(TaskSubmission.status == "submitted").count() + db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.status == "submitted").count()},
            {"status": "Under Review", "count": db.query(TaskSubmission).filter(TaskSubmission.status == "under_review").count() + db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.status == "under_review").count()},
            {"status": "Accepted", "count": db.query(TaskSubmission).filter(TaskSubmission.status == "accepted").count() + db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.status == "approved").count()},
            {"status": "Revision Requested", "count": db.query(TaskSubmission).filter(TaskSubmission.status == "revision_requested").count() + db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.status == "changes_requested").count()}
        ]

        return {
            "students": total_students,
            "activeStudents": active_students,
            "blockedStudents": blocked_students,
            "employees": total_employees,
            "activeEmployees": active_employees,
            "blockedEmployees": blocked_employees,
            "programs": total_programs,
            "enrollments": total_enrollments,
            "pendingSubmissions": pending_subs + pending_drive_subs,
            "averageProgress": avg_prog,
            "enrollmentChart": enrollment_chart,
            "submissionChart": submission_stats,
            "help_url": help_url
        }

    elif current_user.role == "employee":
        assigned_enrollments = db.query(Enrollment).filter(
            Enrollment.employee_id == current_user.id,
            Enrollment.status == "active"
        ).all()

        student_count = len(assigned_enrollments)
        pending_reviews = db.query(TaskSubmission).join(Enrollment).filter(
            Enrollment.employee_id == current_user.id,
            TaskSubmission.status.in_(["submitted", "under_review"])
        ).count()
        pending_drive_reviews = db.query(GoogleDriveSubmission).join(Enrollment).filter(
            Enrollment.employee_id == current_user.id,
            GoogleDriveSubmission.status.in_(["submitted", "under_review"])
        ).count()

        progs = [calculate_enrollment_progress(db, e) for e in assigned_enrollments]
        avg_prog = int(sum(progs) / len(progs)) if progs else 0

        unique_programs = len({e.program_id for e in assigned_enrollments})

        return {
            "assignedStudents": student_count,
            "pendingSubmissions": pending_reviews + pending_drive_reviews,
            "assignedPrograms": unique_programs,
            "averageProgress": avg_prog,
            "overdueTasks": 0,
            "help_url": help_url
        }

    else:  # student
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.status == "active"
        ).all()

        progs = [calculate_enrollment_progress(db, e) for e in enrollments]
        avg_prog = int(sum(progs) / len(progs)) if progs else 0

        completed_days = db.query(DayProgress).join(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            DayProgress.is_completed == True
        ).count()

        pids = [e.program_id for e in enrollments]
        total_days = db.query(LearningDay).join(LearningTrack, LearningDay.track_id == LearningTrack.id).filter(
            LearningTrack.program_id.in_(pids)
        ).count() if pids else 0

        wallet = get_or_create_wallet(db, current_user.id)
        config = get_or_create_reward_config(db)

        pending_tasks = db.query(TaskSubmission).join(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            TaskSubmission.status == "revision_requested"
        ).count()
        pending_drive_changes = db.query(GoogleDriveSubmission).join(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            GoogleDriveSubmission.status == "changes_requested"
        ).count()

        days_left = None
        if current_user.access_expires_at:
            delta = (current_user.access_expires_at - datetime.utcnow()).total_seconds()
            days_left = max(0, int(delta // 86400) + (1 if delta % 86400 > 0 else 0))

        return {
            "assignedPrograms": len(enrollments),
            "completedDays": completed_days,
            "totalDays": total_days,
            "averageProgress": avg_prog,
            "overallProgress": avg_prog,
            "pendingTasks": pending_tasks + pending_drive_changes,
            "walletBalance": wallet.balance,
            "walletValueInr": round(wallet.balance * config.point_to_rupee_ratio, 2),
            "help_url": help_url,
            "access_duration": current_user.access_duration or "lifetime",
            "accessDuration": current_user.access_duration or "lifetime",
            "access_expires_at": current_user.access_expires_at.isoformat() if current_user.access_expires_at else None,
            "accessExpiresAt": current_user.access_expires_at.isoformat() if current_user.access_expires_at else None,
            "days_left": days_left,
            "daysLeft": days_left
        }

class HelpLinkInput(BaseModel):
    help_url: Optional[str] = None


@router.get("/help-link", response_model=dict)
@router.get("/dashboard/help-link", response_model=dict)
def get_help_link(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    setting = db.query(SystemSetting).filter(SystemSetting.key == "help_link").first()
    return {"help_url": setting.value if setting and setting.value else None}


@router.post("/help-link", response_model=dict)
@router.post("/dashboard/help-link", response_model=dict)
def update_help_link(
    data: HelpLinkInput,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    url = (data.help_url or "").strip()
    setting = db.query(SystemSetting).filter(SystemSetting.key == "help_link").first()
    if not setting:
        setting = SystemSetting(key="help_link", value=url or None)
        db.add(setting)
    else:
        setting.value = url or None
        setting.updated_at = datetime.utcnow()
    db.commit()
    log_audit(
        db=db,
        actor=current_user,
        action="UPDATE_HELP_LINK",
        target_type="system_setting",
        target_id=setting.id,
        details=f"Admin set help link to: {url or 'None'}"
    )
    return {"help_url": setting.value, "message": "Help link saved successfully"}


@router.delete("/help-link", response_model=dict)
@router.delete("/dashboard/help-link", response_model=dict)
def delete_help_link(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    setting = db.query(SystemSetting).filter(SystemSetting.key == "help_link").first()
    if setting:
        setting.value = None
        setting.updated_at = datetime.utcnow()
        db.commit()
        log_audit(
            db=db,
            actor=current_user,
            action="DELETE_HELP_LINK",
            target_type="system_setting",
            target_id=setting.id,
            details="Admin removed help link"
        )
    return {"help_url": None, "message": "Help link deleted successfully"}

@router.get("/activity", response_model=List[dict])
def get_recent_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if current_user.role == "student":
        query = query.filter(AuditLog.actor_id == current_user.id)
    elif current_user.role == "employee":
        query = query.filter(AuditLog.actor_id == current_user.id)

    logs = query.order_by(AuditLog.created_at.desc()).limit(20).all()
    results = []
    for l in logs:
        action_text = l.action.replace("_", " ").lower()
        results.append({
            "id": l.id,
            "actor": l.actor_name,
            "action": action_text,
            "target": l.target_type.replace("_", " "),
            "createdAt": l.created_at,
            "created_at": l.created_at
        })
    return results
