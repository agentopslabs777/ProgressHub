from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import (
    Enrollment, Program, LearningTrack, LearningDay, DayProgress,
    ChecklistTemplateItem, ChecklistCompletion, DailyTask, TaskSubmission,
    LearningResource, Flashcard, GoogleDriveSubmission, User
)
from backend.app.schemas.schemas import (
    ChecklistItemResponse, DailyTaskResponse, LearningResourceResponse, FlashcardResponse
)
from backend.app.permissions.permissions import get_current_user
from backend.app.services.learning_engine import (
    get_track_days_status, verify_student_day_access, 
    check_and_update_day_progress, calculate_enrollment_progress, evaluate_day_completion
)

router = APIRouter(prefix="/student", tags=["Student Learning"])

class ActivityUpdateInput(BaseModel):
    activity: str  # 'summary_viewed', 'telugu_summary_viewed', 'english_summary_viewed', 'video_watched', 'flashcards_completed'
    value: bool = True

@router.get("/programs", response_model=List[dict])
def get_student_programs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "student":
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.status == "active"
        ).all()
    elif current_user.role == "employee":
        enrollments = db.query(Enrollment).filter(
            Enrollment.employee_id == current_user.id,
            Enrollment.status == "active"
        ).all()
    else:  # admin
        enrollments = db.query(Enrollment).filter(Enrollment.status == "active").all()

    # Deduplicate by program
    seen_programs = set()
    results = []
    for e in enrollments:
        p = e.program
        if not p or p.id in seen_programs:
            continue
        seen_programs.add(p.id)

        track_count = db.query(LearningTrack).filter(
            LearningTrack.program_id == p.id,
            LearningTrack.active == True
        ).count()
        progress = calculate_enrollment_progress(db, e)

        results.append({
            "id": p.id,
            "enrollment_id": e.id,
            "name": p.name,
            "code": p.code,
            "description": p.description,
            "price": p.price,
            "tracks": track_count,
            "trackCount": track_count,
            "progress": progress,
            "status": e.status,
            "enrolledAt": e.enrolled_at,
            "enrolled_at": e.enrolled_at,
            "employeeName": e.employee.full_name if e.employee else "Unassigned"
        })
    return results

@router.get("/programs/{program_id}/assigned-students", response_model=List[dict])
def get_program_assigned_students(
    program_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    For employees and admin: lists students enrolled in the program.
    Employees see students assigned to them; Admins see all students enrolled.
    """
    query = db.query(Enrollment).filter(
        Enrollment.program_id == program_id,
        Enrollment.status == "active"
    )
    if current_user.role == "employee":
        query = query.filter(Enrollment.employee_id == current_user.id)
    elif current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    enrollments = query.all()
    results = []
    for e in enrollments:
        if not e.student:
            continue
        progress = calculate_enrollment_progress(db, e)
        # Check latest submission across this enrollment
        latest_drive = db.query(GoogleDriveSubmission).filter(
            GoogleDriveSubmission.enrollment_id == e.id
        ).order_by(GoogleDriveSubmission.submitted_at.desc()).first()

        results.append({
            "student_id": e.student.id,
            "enrollment_id": e.id,
            "full_name": e.student.full_name,
            "email": e.student.email,
            "identifier": e.student.identifier,
            "progress": progress,
            "assigned_employee_name": e.employee.full_name if e.employee else "Unassigned",
            "latest_submission_status": latest_drive.status if latest_drive else "not_submitted",
            "latest_submission_date": latest_drive.submitted_at if latest_drive else None
        })
    return results

@router.get("/programs/{program_id}/progress", response_model=List[dict])
def get_student_program_progress(
    program_id: str,
    student_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_student_id = current_user.id
    if student_id and current_user.role in ["employee", "admin"]:
        target_student_id = student_id

    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == target_student_id,
        Enrollment.program_id == program_id,
        Enrollment.status == "active"
    ).first()

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active enrollment not found for this program and student"
        )

    # Permission check for employee
    if current_user.role == "employee" and enrollment.employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this student's progress"
        )

    tracks = db.query(LearningTrack).filter(
        LearningTrack.program_id == program_id,
        LearningTrack.active == True
    ).order_by(LearningTrack.position.asc()).all()

    results = []
    for track in tracks:
        days_status = get_track_days_status(db, enrollment, track)
        total_days = len(days_status)
        completed_days = sum(1 for d in days_status if d["is_completed"])
        track_progress = int((completed_days / total_days) * 100) if total_days > 0 else 0

        results.append({
            "trackId": track.id,
            "track_id": track.id,
            "name": track.name,
            "description": track.description,
            "position": track.position,
            "totalDays": total_days,
            "total_days": total_days,
            "completedDays": completed_days,
            "completed_days": completed_days,
            "progress": track_progress,
            "days": [{
                "id": d["day"].id,
                "dayNumber": d["day"].day_number,
                "day_number": d["day"].day_number,
                "title": d["day"].title,
                "description": d["day"].description,
                "video_url": d["day"].video_url,
                "videoUrl": d["day"].video_url,
                "summary_url": d["day"].summary_url,
                "summaryUrl": d["day"].summary_url,
                "quiz_url": d["day"].quiz_url,
                "quizUrl": d["day"].quiz_url,
                "assignment_url": d["day"].assignment_url,
                "assignmentUrl": d["day"].assignment_url,
                "status": d["status"],  # 'available', 'completed', 'locked', 'pending_review'
                "completed": d["is_completed"],
                "completed_at": d["completed_at"],
                "is_unlocked": d["is_unlocked"],
                "next_unlock_time": d["next_unlock_time"],
                "remaining_seconds": d["remaining_seconds"],
                "unlock_delay_hours": d["unlock_delay_hours"],
                "unlock_mode": d["unlock_mode"],
                "is_manually_unlocked": d["is_manually_unlocked"],
                "unlocked_by_name": d["unlocked_by_name"],
                "unlock_reason": d["unlock_reason"],
                "pending_reasons": d["pending_reasons"],
                "activity_progress": d["progress"]
            } for d in days_status]
        })
    return results

@router.get("/days/{day_id}", response_model=dict)
def get_student_day_details(
    day_id: str,
    student_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_student_id = current_user.id
    if student_id and current_user.role in ["employee", "admin"]:
        target_student_id = student_id

    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    track = db.query(LearningTrack).filter(LearningTrack.id == day.track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Learning track not found")

    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == target_student_id,
        Enrollment.program_id == track.program_id,
        Enrollment.status == "active"
    ).first()

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student is not actively enrolled in this program"
        )

    # Permission check for employee
    if current_user.role == "employee" and enrollment.employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this student's learning session"
        )

    # Fetch checklist items with student completion state
    items = db.query(ChecklistTemplateItem).filter(
        ChecklistTemplateItem.day_id == day.id,
        ChecklistTemplateItem.active == True
    ).order_by(ChecklistTemplateItem.display_order.asc()).all()

    completions = db.query(ChecklistCompletion).filter(
        ChecklistCompletion.enrollment_id == enrollment.id,
        ChecklistCompletion.completed == True
    ).all()
    completed_ids = {c.item_id for c in completions}

    checklist_data = [{
        "id": it.id,
        "title": it.title,
        "description": it.description,
        "display_order": it.display_order,
        "is_required": it.is_required,
        "isRequired": it.is_required,
        "completed": it.id in completed_ids
    } for it in items]

    # Fetch daily tasks with student submissions
    tasks = db.query(DailyTask).filter(DailyTask.day_id == day.id).all()
    tasks_data = []
    for t in tasks:
        sub = db.query(TaskSubmission).filter(
            TaskSubmission.enrollment_id == enrollment.id,
            TaskSubmission.task_id == t.id
        ).order_by(TaskSubmission.submitted_at.desc()).first()

        tasks_data.append({
            "id": t.id,
            "title": t.title,
            "instructions": t.instructions,
            "submission_type": t.submission_type,
            "submissionType": t.submission_type,
            "is_required": t.is_required,
            "isRequired": t.is_required,
            "submission": {
                "id": sub.id,
                "status": sub.status,
                "submission_text": sub.submission_text,
                "file_id": sub.file_id,
                "feedback": sub.feedback,
                "submitted_at": sub.submitted_at
            } if sub else None
        })

    # Fetch multi-resources
    resources = db.query(LearningResource).filter(
        LearningResource.day_id == day.id,
        LearningResource.active == True
    ).order_by(LearningResource.display_order.asc()).all()

    flashcards = db.query(Flashcard).filter(
        Flashcard.day_id == day.id,
        Flashcard.active == True
    ).order_by(Flashcard.display_order.asc()).all()

    # Fetch student's latest Google Drive submission & history
    drive_subs = db.query(GoogleDriveSubmission).filter(
        GoogleDriveSubmission.enrollment_id == enrollment.id,
        GoogleDriveSubmission.day_id == day.id
    ).order_by(GoogleDriveSubmission.attempt_number.desc()).all()

    latest_drive = drive_subs[0] if drive_subs else None
    drive_history = [{
        "id": s.id,
        "google_drive_url": s.google_drive_url,
        "drive_url": s.google_drive_url,
        "notes": s.notes,
        "attempt_number": s.attempt_number,
        "status": s.status,
        "review_comments": s.review_comments,
        "rating": s.rating,
        "improvement_suggestions": s.improvement_suggestions,
        "base_reward_points": s.base_reward_points,
        "additional_reward_points": s.additional_reward_points,
        "reward_awarded": s.reward_awarded,
        "submitted_at": s.submitted_at,
        "reviewed_at": s.reviewed_at
    } for s in drive_subs]

    # Day completion & activity progress
    progress = db.query(DayProgress).filter(
        DayProgress.enrollment_id == enrollment.id,
        DayProgress.day_id == day.id
    ).first()

    # Automatically evaluate day completion if not already marked completed
    if not progress or not progress.is_completed:
        check_and_update_day_progress(db, enrollment, day, current_user)
        progress = db.query(DayProgress).filter(
            DayProgress.enrollment_id == enrollment.id,
            DayProgress.day_id == day.id
        ).first()

    _, pending_reasons = evaluate_day_completion(db, enrollment, day)

    target_user = db.query(User).filter(User.id == target_student_id).first()

    # Look up next day and previous day in this track
    prev_day = db.query(LearningDay).filter(
        LearningDay.track_id == day.track_id,
        LearningDay.day_number < day.day_number
    ).order_by(LearningDay.day_number.desc()).first()

    next_day = db.query(LearningDay).filter(
        LearningDay.track_id == day.track_id,
        LearningDay.day_number > day.day_number
    ).order_by(LearningDay.day_number.asc()).first()

    return {
        "id": day.id,
        "track_id": day.track_id,
        "day_number": day.day_number,
        "title": day.title,
        "prev_day": {
            "id": prev_day.id,
            "day_number": prev_day.day_number,
            "title": prev_day.title
        } if prev_day else None,
        "next_day": {
            "id": next_day.id,
            "day_number": next_day.day_number,
            "title": next_day.title
        } if next_day else None,
        "description": day.description,
        "content": day.content,
        "video_url": day.video_url,
        "summary_main": day.summary_main,
        "summary_telugu": day.summary_telugu,
        "summary_english": day.summary_english,
        "summary_video_url": day.summary_video_url,
        "summary_url": day.summary_url,
        "quiz_url": day.quiz_url,
        "assignment_url": day.assignment_url,
        "attachments": day.attachments,
        "require_approval": day.require_approval,
        "require_task_submission": day.require_task_submission,
        "require_google_drive_submission": bool(day.require_google_drive_submission),
        "base_reward_points": day.base_reward_points,
        "completion_requirements": day.completion_requirements,
        "unlock_delay_hours": day.unlock_delay_hours or 24.0,
        "unlock_mode": day.unlock_mode or "both",
        "is_completed": progress.is_completed if progress else False,
        "completed_at": progress.completed_at if progress else None,
        "checklist": checklist_data,
        "tasks": tasks_data,
        "resources": [LearningResourceResponse.model_validate(r).dict() for r in resources],
        "flashcards": [FlashcardResponse.model_validate(f).dict() for f in flashcards],
        "google_drive_submission": {
            "id": latest_drive.id,
            "google_drive_url": latest_drive.google_drive_url,
            "drive_url": latest_drive.google_drive_url,
            "notes": latest_drive.notes,
            "attempt_number": latest_drive.attempt_number,
            "status": latest_drive.status,
            "review_comments": latest_drive.review_comments,
            "rating": latest_drive.rating,
            "improvement_suggestions": latest_drive.improvement_suggestions,
            "base_reward_points": latest_drive.base_reward_points,
            "additional_reward_points": latest_drive.additional_reward_points,
            "reward_awarded": latest_drive.reward_awarded,
            "submitted_at": latest_drive.submitted_at,
            "reviewed_at": latest_drive.reviewed_at
        } if latest_drive else None,
        "google_drive_history": drive_history,
        "activity_progress": {
            "summary_viewed": progress.summary_viewed if progress else False,
            "telugu_summary_viewed": progress.telugu_summary_viewed if progress else False,
            "english_summary_viewed": progress.english_summary_viewed if progress else False,
            "video_watched": progress.video_watched if progress else False,
            "flashcards_completed": progress.flashcards_completed if progress else False
        },
        "pending_reasons": pending_reasons,
        "student_info": {
            "id": target_user.id if target_user else target_student_id,
            "full_name": target_user.full_name if target_user else "Student",
            "email": target_user.email if target_user else ""
        }
    }

@router.post("/days/{day_id}/activity", response_model=dict)
def update_activity_progress(
    day_id: str,
    data: ActivityUpdateInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enrollment, day = verify_student_day_access(db, current_user.id, day_id)

    progress = db.query(DayProgress).filter(
        DayProgress.enrollment_id == enrollment.id,
        DayProgress.day_id == day.id
    ).first()

    if not progress:
        progress = DayProgress(
            enrollment_id=enrollment.id,
            day_id=day.id,
            is_completed=False
        )
        db.add(progress)

    field_name = data.activity
    valid_fields = [
        "summary_viewed", "telugu_summary_viewed", "english_summary_viewed",
        "video_watched", "flashcards_completed"
    ]
    if field_name in valid_fields:
        setattr(progress, field_name, data.value)
        db.commit()

    return {"status": "ok", "activity": field_name, "value": data.value}

@router.post("/days/{day_id}/complete", response_model=dict)
def complete_learning_day(
    day_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enrollment, day = verify_student_day_access(db, current_user.id, day_id)
    is_completed = check_and_update_day_progress(db, enrollment, day, current_user)
    progress = calculate_enrollment_progress(db, enrollment)
    _, pending_reasons = evaluate_day_completion(db, enrollment, day)

    return {
        "day_id": day.id,
        "is_completed": is_completed,
        "progress": progress,
        "pending_reasons": pending_reasons
    }
