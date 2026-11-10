from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
import json
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models.models import (
    Enrollment, LearningTrack, LearningDay, DayProgress, 
    ChecklistTemplateItem, ChecklistCompletion, DailyTask, TaskSubmission,
    GoogleDriveSubmission, Notification, User
)
from backend.app.permissions.permissions import log_audit

def get_track_days_status(db: Session, enrollment: Enrollment, track: LearningTrack) -> List[Dict[str, Any]]:
    """
    Computes sequential status ('available', 'completed', 'locked', 'pending_review')
    for all days in a track, taking into account:
    - Sequential completion
    - Configurable waiting period (e.g. 24-hour rule) after completing the previous day
    - Manual unlocks / locks by authorized employees or admin
    - Automatic unlock countdown
    """
    days = db.query(LearningDay).filter(
        LearningDay.track_id == track.id
    ).order_by(LearningDay.day_number.asc()).all()

    # Load all DayProgress records for this enrollment and track
    progress_records = db.query(DayProgress).filter(
        DayProgress.enrollment_id == enrollment.id
    ).all()
    progress_by_day = {p.day_id: p for p in progress_records}

    now = datetime.utcnow()
    days_status = []
    prev_day_completed = True
    prev_completion_time: Optional[datetime] = None

    for idx, day in enumerate(days):
        prog = progress_by_day.get(day.id)
        is_completed = bool(prog and prog.is_completed)
        is_manually_unlocked = bool(prog and prog.is_manually_unlocked)
        
        # Determine unlock mode & delay (default 24.0 hours)
        delay_hours = day.unlock_delay_hours if day.unlock_delay_hours is not None else 24.0
        unlock_mode = day.unlock_mode or "both"

        next_unlock_time: Optional[datetime] = None
        remaining_seconds = 0
        is_unlocked = False

        if idx == 0:
            # First day of the track is unlocked by default upon enrollment
            is_unlocked = True
        else:
            if is_manually_unlocked:
                is_unlocked = True
            elif prev_day_completed:
                # When previous day is completed, the next day opens immediately without 24-hour delay
                is_unlocked = True
                remaining_seconds = 0
            else:
                is_unlocked = False

        # Determine status
        if is_completed:
            day_status = "completed"
        elif is_unlocked:
            # Check if student submitted work that is currently awaiting review
            has_pending_review = False
            # Check google drive submission
            latest_drive = db.query(GoogleDriveSubmission).filter(
                GoogleDriveSubmission.enrollment_id == enrollment.id,
                GoogleDriveSubmission.day_id == day.id,
                GoogleDriveSubmission.is_latest == True
            ).first()
            if latest_drive and latest_drive.status in ("submitted", "under_review"):
                has_pending_review = True
            
            # Check task submission
            task_ids = [t.id for t in db.query(DailyTask.id).filter(DailyTask.day_id == day.id).all()]
            if task_ids:
                pending_task = db.query(TaskSubmission).filter(
                    TaskSubmission.enrollment_id == enrollment.id,
                    TaskSubmission.task_id.in_(task_ids),
                    TaskSubmission.status.in_(["submitted", "under_review"])
                ).first()
                if pending_task:
                    has_pending_review = True

            day_status = "pending_review" if has_pending_review else "available"
        else:
            day_status = "locked"

        # Check pending completion reasons for UI transparency
        _, pending_reasons = evaluate_day_completion(db, enrollment, day)

        unlocked_by_user = None
        if prog and prog.unlocked_by_id:
            u = db.query(User).filter(User.id == prog.unlocked_by_id).first()
            if u:
                unlocked_by_user = u.full_name

        days_status.append({
            "day": day,
            "status": day_status,
            "is_completed": is_completed,
            "completed_at": prog.completed_at.isoformat() if (prog and prog.completed_at) else None,
            "is_unlocked": is_unlocked,
            "next_unlock_time": next_unlock_time.isoformat() if next_unlock_time else None,
            "remaining_seconds": remaining_seconds,
            "unlock_delay_hours": delay_hours,
            "unlock_mode": unlock_mode,
            "is_manually_unlocked": is_manually_unlocked,
            "unlocked_by_name": unlocked_by_user,
            "unlock_reason": prog.unlock_reason if prog else None,
            "pending_reasons": pending_reasons,
            "progress": {
                "summary_viewed": prog.summary_viewed if prog else False,
                "telugu_summary_viewed": prog.telugu_summary_viewed if prog else False,
                "english_summary_viewed": prog.english_summary_viewed if prog else False,
                "video_watched": prog.video_watched if prog else False,
                "flashcards_completed": prog.flashcards_completed if prog else False,
            }
        })

        # Update previous completion state for sequential logic
        prev_day_completed = is_completed
        prev_completion_time = prog.completed_at if (prog and prog.completed_at) else None

    return days_status

def evaluate_day_completion(db: Session, enrollment: Enrollment, day: LearningDay) -> Tuple[bool, List[str]]:
    """
    Evaluates whether all mandatory completion requirements for a day are satisfied:
    1. All required checklist items completed
    2. If require_task_submission or task is required: task submission exists (and accepted if approval required)
    3. If require_google_drive_submission: valid drive link submitted (and approved if require_approval)
    4. If require_approval: teacher or admin approval must be given
    5. Configurable completion_requirements JSON
    Returns (is_satisfied, list_of_pending_reasons)
    """
    pending_reasons = []

    # Parse configurable requirements if set
    custom_reqs = []
    if day.completion_requirements:
        try:
            custom_reqs = json.loads(day.completion_requirements)
        except Exception:
            custom_reqs = []

    # 1. Checklist Requirements
    should_check_checklist = ("checklist" in custom_reqs) or not custom_reqs
    if should_check_checklist:
        required_items = db.query(ChecklistTemplateItem).filter(
            ChecklistTemplateItem.day_id == day.id,
            ChecklistTemplateItem.is_required == True,
            ChecklistTemplateItem.active == True
        ).all()

        if required_items:
            required_ids = [item.id for item in required_items]
            completed_completions = db.query(ChecklistCompletion).filter(
                ChecklistCompletion.enrollment_id == enrollment.id,
                ChecklistCompletion.item_id.in_(required_ids),
                ChecklistCompletion.completed == True
            ).all()
            completed_ids = {c.item_id for c in completed_completions}
            
            missing = len(required_ids) - len(completed_ids)
            if missing > 0:
                pending_reasons.append(f"{missing} required checklist item(s) pending")

    # 2. Task Submission Requirements
    tasks = db.query(DailyTask).filter(DailyTask.day_id == day.id).all()
    has_required_task = bool(day.require_task_submission or ("task" in custom_reqs))

    if has_required_task and tasks:
        task_ids = [t.id for t in tasks if t.is_required or day.require_task_submission]
        submissions = db.query(TaskSubmission).filter(
            TaskSubmission.enrollment_id == enrollment.id,
            TaskSubmission.task_id.in_(task_ids)
        ).all()
        
        sub_by_task = {s.task_id: s for s in submissions}
        for tid in task_ids:
            sub = sub_by_task.get(tid)
            if not sub:
                pending_reasons.append("Task assignment submission required")
            elif day.require_approval and sub.status != "accepted":
                pending_reasons.append(f"Task submission review status is '{sub.status}' (approval required)")

    # 3. Google Drive Evidence Submission Requirements
    requires_drive = day.require_google_drive_submission or ("google_drive" in custom_reqs)
    if requires_drive:
        latest_drive = db.query(GoogleDriveSubmission).filter(
            GoogleDriveSubmission.enrollment_id == enrollment.id,
            GoogleDriveSubmission.day_id == day.id,
            GoogleDriveSubmission.is_latest == True
        ).first()

        if not latest_drive:
            pending_reasons.append("Google Drive submission link required")
        elif latest_drive.status == "rejected":
            pending_reasons.append("Google Drive submission was rejected; new submission required")

    # 4. Explicit teacher/admin approval requirement
    if day.require_approval or ("approval" in custom_reqs):
        progress = db.query(DayProgress).filter(
            DayProgress.enrollment_id == enrollment.id,
            DayProgress.day_id == day.id
        ).first()
        if not progress or not progress.approved_at:
            # If neither task nor drive covered approval
            if not has_required_task and not requires_drive:
                pending_reasons.append("Teacher/Admin sign-off approval required")

    return (len(pending_reasons) == 0, pending_reasons)

def check_and_update_day_progress(db: Session, enrollment: Enrollment, day: LearningDay, actor: User) -> bool:
    """
    Checks if day is eligible for completion, updates DayProgress in a transaction,
    and returns whether the day was just marked completed.
    """
    is_satisfied, reasons = evaluate_day_completion(db, enrollment, day)
    
    progress = db.query(DayProgress).filter(
        DayProgress.enrollment_id == enrollment.id,
        DayProgress.day_id == day.id
    ).first()

    if is_satisfied:
        if not progress:
            progress = DayProgress(
                enrollment_id=enrollment.id,
                day_id=day.id,
                is_completed=True,
                completed_at=datetime.utcnow()
            )
            db.add(progress)
        elif not progress.is_completed:
            progress.is_completed = True
            progress.completed_at = datetime.utcnow()
        
        db.commit()

        # Log audit
        log_audit(
            db=db,
            actor=actor,
            action="DAY_COMPLETED",
            target_type="learning_day",
            target_id=day.id,
            details=f"Day {day.day_number}: {day.title} completed by student {enrollment.student_id}"
        )

        # Notify assigned employee if student finished
        if enrollment.employee_id:
            emp_notif = Notification(
                user_id=enrollment.employee_id,
                title="Student Day Completed",
                message=f"Student completed Day {day.day_number}: {day.title}",
                link=f"/my-students"
            )
            db.add(emp_notif)
            db.commit()

        return True
    else:
        # If requirements are no longer satisfied, revert completion
        if progress and progress.is_completed:
            progress.is_completed = False
            progress.completed_at = None
            db.commit()
        return False

def manual_unlock_day(db: Session, enrollment: Enrollment, day: LearningDay, actor: User, reason: str) -> DayProgress:
    """
    Allows admin or assigned teacher to manually unlock a day immediately.
    Logs audit trail with actor name, timestamp, and reason.
    """
    progress = db.query(DayProgress).filter(
        DayProgress.enrollment_id == enrollment.id,
        DayProgress.day_id == day.id
    ).first()

    if not progress:
        progress = DayProgress(
            enrollment_id=enrollment.id,
            day_id=day.id,
            is_completed=False,
            is_manually_unlocked=True,
            unlocked_at=datetime.utcnow(),
            unlocked_by_id=actor.id,
            unlock_reason=reason
        )
        db.add(progress)
    else:
        progress.is_manually_unlocked = True
        progress.unlocked_at = datetime.utcnow()
        progress.unlocked_by_id = actor.id
        progress.unlock_reason = reason

    db.commit()
    db.refresh(progress)

    log_audit(
        db=db,
        actor=actor,
        action="MANUAL_UNLOCK_DAY",
        target_type="day_progress",
        target_id=day.id,
        details=f"Day {day.day_number} manually unlocked for student {enrollment.student_id}. Reason: {reason}"
    )

    # Notify student
    notif = Notification(
        user_id=enrollment.student_id,
        title="Day Unlocked Early",
        message=f"Day {day.day_number}: '{day.title}' has been unlocked for you early by {actor.full_name}!",
        link=f"/learning-days/{day.id}"
    )
    db.add(notif)
    db.commit()

    return progress

def manual_lock_day(db: Session, enrollment: Enrollment, day: LearningDay, actor: User, reason: str) -> DayProgress:
    """
    Allows admin or assigned teacher to lock a previously unlocked day.
    """
    progress = db.query(DayProgress).filter(
        DayProgress.enrollment_id == enrollment.id,
        DayProgress.day_id == day.id
    ).first()

    if not progress:
        progress = DayProgress(
            enrollment_id=enrollment.id,
            day_id=day.id,
            is_completed=False,
            is_manually_unlocked=False,
            unlock_reason=f"Locked by {actor.full_name}: {reason}"
        )
        db.add(progress)
    else:
        progress.is_manually_unlocked = False
        progress.is_completed = False
        progress.completed_at = None
        progress.unlock_reason = f"Locked by {actor.full_name}: {reason}"

    db.commit()
    db.refresh(progress)

    log_audit(
        db=db,
        actor=actor,
        action="MANUAL_LOCK_DAY",
        target_type="day_progress",
        target_id=day.id,
        details=f"Day {day.day_number} manually locked for student {enrollment.student_id}. Reason: {reason}"
    )

    return progress

def verify_student_day_access(db: Session, student_id: str, day_id: str) -> Tuple[Enrollment, LearningDay]:
    """
    Verifies that:
    1. Student is active and enrolled in the program containing the day.
    2. The day is currently unlocked ('available' or 'completed').
    Raises 403 Forbidden with exact missing requirements and countdown if locked.
    """
    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    track = db.query(LearningTrack).filter(LearningTrack.id == day.track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == student_id,
        Enrollment.program_id == track.program_id,
        Enrollment.status == "active"
    ).first()

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not actively enrolled in this program"
        )

    # Check track days status
    days_status = get_track_days_status(db, enrollment, track)
    day_info = next((d for d in days_status if d["day"].id == day_id), None)

    if not day_info or day_info["status"] == "locked":
        rem = day_info.get("remaining_seconds", 0) if day_info else 0
        rem_hrs = rem // 3600
        rem_mins = (rem % 3600) // 60
        time_msg = f" (Unlocks automatically in {rem_hrs}h {rem_mins}m)" if rem > 0 else ""
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Day {day.day_number} is locked. You must complete the previous day in this track first.{time_msg}"
        )

    return (enrollment, day)

def calculate_enrollment_progress(db: Session, enrollment: Enrollment) -> int:
    """
    Calculates overall enrollment completion percentage based on total days across all active tracks.
    """
    tracks = db.query(LearningTrack).filter(
        LearningTrack.program_id == enrollment.program_id,
        LearningTrack.active == True
    ).all()

    total_days = 0
    for t in tracks:
        total_days += db.query(LearningDay).filter(LearningDay.track_id == t.id).count()

    if total_days == 0:
        return 0

    completed_days = db.query(DayProgress).filter(
        DayProgress.enrollment_id == enrollment.id,
        DayProgress.is_completed == True
    ).count()

    return min(100, int((completed_days / total_days) * 100))

def record_student_activity_attendance(db: Session, student_id: str, program_id: Optional[str] = None):
    """
    Deprecated: Attendance has been completely removed from LMS.
    Retained as safe no-op for any legacy caller.
    """
    return

