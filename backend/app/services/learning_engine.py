from collections import defaultdict
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
import json
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.app.models.models import (
    Enrollment, LearningTrack, LearningDay, DayProgress, 
    ChecklistTemplateItem, ChecklistCompletion, DailyTask, TaskSubmission,
    GoogleDriveSubmission, Notification, User
)
from backend.app.permissions.permissions import log_audit


def evaluate_day_completion_data(
    day: LearningDay,
    required_items: List[ChecklistTemplateItem],
    completed_item_ids: set,
    tasks: List[DailyTask],
    task_subs_by_task: Dict[str, TaskSubmission],
    latest_drive: Optional[GoogleDriveSubmission],
    day_progress: Optional[DayProgress],
) -> Tuple[bool, List[str]]:
    """Evaluates whether all mandatory completion requirements for a day are satisfied using preloaded records."""
    pending_reasons = []

    custom_reqs = []
    if day.completion_requirements:
        try:
            custom_reqs = json.loads(day.completion_requirements)
        except Exception:
            custom_reqs = []

    # 1. Checklist Requirements
    should_check_checklist = ("checklist" in custom_reqs) or not custom_reqs
    if should_check_checklist and required_items:
        required_ids = [item.id for item in required_items]
        completed_count = sum(1 for iid in required_ids if iid in completed_item_ids)
        missing = len(required_ids) - completed_count
        if missing > 0:
            pending_reasons.append(f"{missing} required checklist item(s) pending")

    # 2. Task Submission Requirements
    has_required_task = bool(day.require_task_submission or ("task" in custom_reqs))
    if has_required_task and tasks:
        task_ids = [t.id for t in tasks if t.is_required or day.require_task_submission]
        for tid in task_ids:
            sub = task_subs_by_task.get(tid)
            if not sub:
                pending_reasons.append("Task assignment submission required")
            elif day.require_approval and sub.status != "accepted":
                pending_reasons.append(f"Task submission review status is '{sub.status}' (approval required)")

    # 3. Google Drive Evidence Submission Requirements
    requires_drive = day.require_google_drive_submission or ("google_drive" in custom_reqs)
    if requires_drive:
        if not latest_drive:
            pending_reasons.append("Google Drive submission link required")
        elif latest_drive.status == "rejected":
            pending_reasons.append("Google Drive submission was rejected; new submission required")

    # 4. Explicit teacher/admin approval requirement
    if day.require_approval or ("approval" in custom_reqs):
        if not day_progress or not day_progress.approved_at:
            if not has_required_task and not requires_drive:
                pending_reasons.append("Teacher/Admin sign-off approval required")

    return (len(pending_reasons) == 0, pending_reasons)


def get_program_tracks_days_status(
    db: Session,
    enrollment: Enrollment,
    tracks: List[LearningTrack],
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Batches queries across all given tracks to compute sequential day status without N+1 round trips.
    """
    if not tracks:
        return {}

    track_ids = [t.id for t in tracks]
    all_days = (
        db.query(LearningDay)
        .filter(LearningDay.track_id.in_(track_ids))
        .order_by(LearningDay.day_number.asc())
        .all()
    )
    days_by_track: Dict[str, List[LearningDay]] = defaultdict(list)
    for d in all_days:
        days_by_track[d.track_id].append(d)

    day_ids = [d.id for d in all_days]
    progress_records = db.query(DayProgress).filter(
        DayProgress.enrollment_id == enrollment.id
    ).all()
    progress_by_day = {p.day_id: p for p in progress_records}

    required_items_by_day: Dict[str, List[ChecklistTemplateItem]] = defaultdict(list)
    completed_item_ids: set = set()
    tasks_by_day: Dict[str, List[DailyTask]] = defaultdict(list)
    task_subs_by_task: Dict[str, TaskSubmission] = {}
    latest_drive_by_day: Dict[str, GoogleDriveSubmission] = {}
    user_names_by_id: Dict[str, str] = {}

    if day_ids:
        req_items = (
            db.query(ChecklistTemplateItem)
            .filter(
                ChecklistTemplateItem.day_id.in_(day_ids),
                ChecklistTemplateItem.is_required == True,
                ChecklistTemplateItem.active == True,
            )
            .all()
        )
        req_item_ids = [item.id for item in req_items]
        for item in req_items:
            required_items_by_day[item.day_id].append(item)

        if req_item_ids:
            completed_item_ids = {
                c.item_id
                for c in db.query(ChecklistCompletion)
                .filter(
                    ChecklistCompletion.enrollment_id == enrollment.id,
                    ChecklistCompletion.item_id.in_(req_item_ids),
                    ChecklistCompletion.completed == True,
                )
                .all()
            }

        all_tasks = db.query(DailyTask).filter(DailyTask.day_id.in_(day_ids)).all()
        all_task_ids = [t.id for t in all_tasks]
        for t in all_tasks:
            tasks_by_day[t.day_id].append(t)

        if all_task_ids:
            for sub in (
                db.query(TaskSubmission)
                .filter(
                    TaskSubmission.enrollment_id == enrollment.id,
                    TaskSubmission.task_id.in_(all_task_ids),
                )
                .all()
            ):
                task_subs_by_task[sub.task_id] = sub

        for drive in (
            db.query(GoogleDriveSubmission)
            .filter(
                GoogleDriveSubmission.enrollment_id == enrollment.id,
                GoogleDriveSubmission.day_id.in_(day_ids),
                GoogleDriveSubmission.is_latest == True,
            )
            .all()
        ):
            latest_drive_by_day[drive.day_id] = drive

        unlocked_by_ids = {p.unlocked_by_id for p in progress_records if p.unlocked_by_id}
        if unlocked_by_ids:
            for u in db.query(User).filter(User.id.in_(unlocked_by_ids)).all():
                user_names_by_id[u.id] = u.full_name

    result_by_track: Dict[str, List[Dict[str, Any]]] = {}
    for track in tracks:
        days_status = []
        prev_day_completed = True
        for idx, day in enumerate(days_by_track.get(track.id, [])):
            prog = progress_by_day.get(day.id)
            is_completed = bool(prog and prog.is_completed)
            is_manually_unlocked = bool(prog and prog.is_manually_unlocked)

            delay_hours = day.unlock_delay_hours if day.unlock_delay_hours is not None else 24.0
            unlock_mode = day.unlock_mode or "both"

            next_unlock_time: Optional[datetime] = None
            remaining_seconds = 0
            if idx == 0:
                is_unlocked = True
            elif is_manually_unlocked or prev_day_completed:
                is_unlocked = True
            else:
                is_unlocked = False

            latest_drive = latest_drive_by_day.get(day.id)
            day_tasks = tasks_by_day.get(day.id, [])

            if is_completed:
                day_status = "completed"
            elif is_unlocked:
                has_pending_review = bool(
                    latest_drive and latest_drive.status in ("submitted", "under_review")
                )
                if not has_pending_review and day_tasks:
                    for t in day_tasks:
                        sub = task_subs_by_task.get(t.id)
                        if sub and sub.status in ("submitted", "under_review"):
                            has_pending_review = True
                            break
                day_status = "pending_review" if has_pending_review else "available"
            else:
                day_status = "locked"

            _, pending_reasons = evaluate_day_completion_data(
                day=day,
                required_items=required_items_by_day.get(day.id, []),
                completed_item_ids=completed_item_ids,
                tasks=day_tasks,
                task_subs_by_task=task_subs_by_task,
                latest_drive=latest_drive,
                day_progress=prog,
            )

            unlocked_by_user = user_names_by_id.get(prog.unlocked_by_id) if (prog and prog.unlocked_by_id) else None

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
                    "summary_viewed": getattr(prog, "summary_viewed", False) if prog else False,
                    "telugu_summary_viewed": getattr(prog, "telugu_summary_viewed", False) if prog else False,
                    "english_summary_viewed": getattr(prog, "english_summary_viewed", False) if prog else False,
                    "video_watched": getattr(prog, "video_watched", False) if prog else False,
                    "flashcards_completed": getattr(prog, "flashcards_completed", False) if prog else False,
                    "quiz_completed": getattr(prog, "quiz_completed", False) if prog else False,
                    "quiz_score": getattr(prog, "quiz_score", None) if prog else None,
                    "assignment_completed": getattr(prog, "assignment_completed", False) if prog else False,
                }
            })

            prev_day_completed = is_completed

        result_by_track[track.id] = days_status

    return result_by_track


def get_track_days_status(db: Session, enrollment: Enrollment, track: LearningTrack) -> List[Dict[str, Any]]:
    """Computes sequential day status for all days in a single track."""
    return get_program_tracks_days_status(db, enrollment, [track]).get(track.id, [])


def evaluate_day_completion(
    db: Session,
    enrollment: Enrollment,
    day: LearningDay,
    known_latest_drive: Optional[GoogleDriveSubmission] = None,
    known_day_progress: Optional[DayProgress] = None,
) -> Tuple[bool, List[str]]:
    """Evaluates whether all mandatory completion requirements for a single day are satisfied."""
    required_items = db.query(ChecklistTemplateItem).filter(
        ChecklistTemplateItem.day_id == day.id,
        ChecklistTemplateItem.is_required == True,
        ChecklistTemplateItem.active == True,
    ).all()
    completed_item_ids: set = set()
    if required_items:
        required_ids = [item.id for item in required_items]
        completed_item_ids = {
            c.item_id
            for c in db.query(ChecklistCompletion).filter(
                ChecklistCompletion.enrollment_id == enrollment.id,
                ChecklistCompletion.item_id.in_(required_ids),
                ChecklistCompletion.completed == True,
            ).all()
        }

    tasks = db.query(DailyTask).filter(DailyTask.day_id == day.id).all()
    task_subs_by_task: Dict[str, TaskSubmission] = {}
    if tasks:
        task_ids = [t.id for t in tasks]
        for s in db.query(TaskSubmission).filter(
            TaskSubmission.enrollment_id == enrollment.id,
            TaskSubmission.task_id.in_(task_ids),
        ).all():
            task_subs_by_task[s.task_id] = s

    latest_drive = known_latest_drive if known_latest_drive is not None else db.query(GoogleDriveSubmission).filter(
        GoogleDriveSubmission.enrollment_id == enrollment.id,
        GoogleDriveSubmission.day_id == day.id,
        GoogleDriveSubmission.is_latest == True,
    ).first()

    day_progress = known_day_progress if known_day_progress is not None else db.query(DayProgress).filter(
        DayProgress.enrollment_id == enrollment.id,
        DayProgress.day_id == day.id,
    ).first()

    return evaluate_day_completion_data(
        day=day,
        required_items=required_items,
        completed_item_ids=completed_item_ids,
        tasks=tasks,
        task_subs_by_task=task_subs_by_task,
        latest_drive=latest_drive,
        day_progress=day_progress,
    )

def check_and_update_day_progress(
    db: Session,
    enrollment: Enrollment,
    day: LearningDay,
    actor: User,
    commit: bool = True,
    known_latest_drive: Optional[GoogleDriveSubmission] = None,
) -> bool:
    """
    Checks if day is eligible for completion, updates DayProgress in a transaction,
    and returns whether the day is now completed.
    """
    progress = db.query(DayProgress).filter(
        DayProgress.enrollment_id == enrollment.id,
        DayProgress.day_id == day.id
    ).first()

    # Fast path: if already completed and latest drive was not rejected, completion stays True
    if (
        progress
        and progress.is_completed
        and known_latest_drive is not None
        and known_latest_drive.status != "rejected"
    ):
        return True

    is_satisfied, _reasons = evaluate_day_completion(
        db,
        enrollment,
        day,
        known_latest_drive=known_latest_drive,
        known_day_progress=progress,
    )

    if is_satisfied:
        was_completed = bool(progress and progress.is_completed)
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

        if not was_completed:
            log_audit(
                db=db,
                actor=actor,
                action="DAY_COMPLETED",
                target_type="learning_day",
                target_id=day.id,
                details=f"Day {day.day_number}: {day.title} completed by student {enrollment.student_id}",
                commit=False
            )

            if enrollment.employee_id:
                emp_notif = Notification(
                    user_id=enrollment.employee_id,
                    title="Student Day Completed",
                    message=f"Student completed Day {day.day_number}: {day.title}",
                    link="/my-students"
                )
                db.add(emp_notif)

        if commit and not was_completed:
            db.commit()

        return True
    else:
        # If requirements are no longer satisfied, revert completion
        if progress and progress.is_completed:
            progress.is_completed = False
            progress.completed_at = None
            if commit:
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
        enrollment = Enrollment(
            student_id=student_id,
            program_id=track.program_id,
            status="active"
        )
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)

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

def calculate_enrollments_progress_map(db: Session, enrollments: List[Enrollment]) -> Dict[str, int]:
    """Calculates completion percentage for a batch of enrollments without per-track query loops."""
    if not enrollments:
        return {}

    program_ids = list({e.program_id for e in enrollments})
    enrollment_ids = [e.id for e in enrollments]

    track_rows = db.query(LearningTrack.id, LearningTrack.program_id).filter(
        LearningTrack.program_id.in_(program_ids),
        LearningTrack.active == True,
    ).all()
    track_to_prog = {t_id: p_id for t_id, p_id in track_rows}
    track_ids = list(track_to_prog.keys())

    total_days_by_program: Dict[str, int] = defaultdict(int)
    if track_ids:
        day_counts = (
            db.query(LearningDay.track_id, func.count(LearningDay.id))
            .filter(LearningDay.track_id.in_(track_ids))
            .group_by(LearningDay.track_id)
            .all()
        )
        for t_id, cnt in day_counts:
            p_id = track_to_prog.get(t_id)
            if p_id:
                total_days_by_program[p_id] += cnt

    completed_by_enrollment = dict(
        db.query(DayProgress.enrollment_id, func.count(DayProgress.id))
        .filter(
            DayProgress.enrollment_id.in_(enrollment_ids),
            DayProgress.is_completed == True,
        )
        .group_by(DayProgress.enrollment_id)
        .all()
    )

    progress_map: Dict[str, int] = {}
    for e in enrollments:
        total_days = total_days_by_program.get(e.program_id, 0)
        if total_days == 0:
            progress_map[e.id] = 0
        else:
            completed_days = completed_by_enrollment.get(e.id, 0)
            progress_map[e.id] = min(100, int((completed_days / total_days) * 100))
    return progress_map


def calculate_enrollment_progress(db: Session, enrollment: Enrollment) -> int:
    """Calculates overall enrollment completion percentage based on total days across all active tracks."""
    return calculate_enrollments_progress_map(db, [enrollment]).get(enrollment.id, 0)

def record_student_activity_attendance(db: Session, student_id: str, program_id: Optional[str] = None):
    """
    Deprecated: Attendance has been completely removed from LMS.
    Retained as safe no-op for any legacy caller.
    """
    return

