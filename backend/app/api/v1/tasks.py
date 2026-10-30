from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import (
    DailyTask, TaskSubmission, LearningDay, Enrollment, 
    UploadedFile, User, Notification
)
from backend.app.schemas.schemas import (
    DailyTaskCreate, DailyTaskUpdate, DailyTaskResponse,
    TaskSubmissionCreate, TaskSubmissionReview, TaskSubmissionResponse
)
from backend.app.permissions.permissions import get_current_user, require_admin, require_employee, log_audit
from backend.app.services.learning_engine import (
    verify_student_day_access, check_and_update_day_progress, calculate_enrollment_progress
)

router = APIRouter(tags=["Tasks & Submissions"])

@router.post("/days/{day_id}/tasks", response_model=DailyTaskResponse)
def create_daily_task(
    day_id: str,
    data: DailyTaskCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    task = DailyTask(
        day_id=day_id,
        title=data.title.strip(),
        instructions=data.instructions,
        submission_type=data.submission_type,
        is_required=data.is_required,
        max_file_size_mb=data.max_file_size_mb,
        allowed_extensions=data.allowed_extensions
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    log_audit(
        db=db,
        actor=current_user,
        action="CREATE_TASK",
        target_type="daily_task",
        target_id=task.id,
        details=f"Task '{task.title}' added to Day {day.day_number}"
    )

    return DailyTaskResponse.model_validate(task)

@router.get("/tasks/{task_id}", response_model=DailyTaskResponse)
def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(DailyTask).filter(DailyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return DailyTaskResponse.model_validate(task)

# Student Submissions
@router.post("/tasks/{task_id}/submit", response_model=dict)
def submit_task(
    task_id: str,
    data: TaskSubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can submit tasks")

    task = db.query(DailyTask).filter(DailyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    day = db.query(LearningDay).filter(LearningDay.id == task.day_id).first()
    enrollment, _ = verify_student_day_access(db, current_user.id, day.id)

    # Validate file if provided
    if data.file_id:
        file_record = db.query(UploadedFile).filter(
            UploadedFile.id == data.file_id,
            UploadedFile.uploaded_by_id == current_user.id
        ).first()
        if not file_record:
            raise HTTPException(status_code=400, detail="Invalid uploaded file")

    submission = TaskSubmission(
        enrollment_id=enrollment.id,
        task_id=task.id,
        submission_text=data.submission_text,
        file_id=data.file_id,
        status="submitted",
        submitted_at=datetime.utcnow()
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Notify teacher if assigned
    if enrollment.employee_id:
        notif = Notification(
            user_id=enrollment.employee_id,
            title="New Task Submission",
            message=f"{current_user.full_name} submitted task: {task.title}",
            link="/submissions"
        )
        db.add(notif)
        db.commit()

    # If day does not require approval, check if day can be auto-completed
    is_day_completed = check_and_update_day_progress(db, enrollment, day, current_user)
    updated_progress = calculate_enrollment_progress(db, enrollment)

    return {
        "submission_id": submission.id,
        "status": submission.status,
        "submitted_at": submission.submitted_at,
        "is_day_completed": is_day_completed,
        "progress": updated_progress
    }

# Submissions List & Reviews
@router.get("/submissions", response_model=List[dict])
def list_submissions(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(TaskSubmission).join(Enrollment)

    if current_user.role == "student":
        query = query.filter(Enrollment.student_id == current_user.id)
    elif current_user.role == "employee":
        query = query.filter(Enrollment.employee_id == current_user.id)

    if status_filter:
        query = query.filter(TaskSubmission.status == status_filter)

    submissions = query.order_by(TaskSubmission.submitted_at.desc()).all()
    results = []
    for s in submissions:
        file_info = db.query(UploadedFile).filter(UploadedFile.id == s.file_id).first() if s.file_id else None
        results.append({
            "id": s.id,
            "enrollment_id": s.enrollment_id,
            "task_id": s.task_id,
            "task_title": s.task.title if s.task else "Untitled Task",
            "taskTitle": s.task.title if s.task else "Untitled Task",
            "student_id": s.enrollment.student_id if s.enrollment else None,
            "student_name": s.enrollment.student.full_name if s.enrollment and s.enrollment.student else "Unknown",
            "studentName": s.enrollment.student.full_name if s.enrollment and s.enrollment.student else "Unknown",
            "program_name": s.enrollment.program.name if s.enrollment and s.enrollment.program else "",
            "programName": s.enrollment.program.name if s.enrollment and s.enrollment.program else "",
            "submission_text": s.submission_text,
            "submissionText": s.submission_text,
            "file_id": s.file_id,
            "fileId": s.file_id,
            "file_name": file_info.original_name if file_info else None,
            "fileName": file_info.original_name if file_info else None,
            "status": s.status,
            "feedback": s.feedback,
            "reviewer_name": s.reviewer.full_name if s.reviewer else None,
            "reviewerName": s.reviewer.full_name if s.reviewer else None,
            "submitted_at": s.submitted_at,
            "submittedAt": s.submitted_at,
            "reviewed_at": s.reviewed_at,
            "reviewedAt": s.reviewed_at
        })
    return results

@router.post("/submissions/{submission_id}/review")
def review_submission(
    submission_id: str,
    data: TaskSubmissionReview,
    current_user: User = Depends(require_employee),
    db: Session = Depends(get_db)
):
    submission = db.query(TaskSubmission).filter(TaskSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    enrollment = db.query(Enrollment).filter(Enrollment.id == submission.enrollment_id).first()
    if current_user.role == "employee" and enrollment.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only review submissions for your assigned students")

    submission.status = data.status
    submission.feedback = data.feedback
    submission.reviewer_id = current_user.id
    submission.reviewed_at = datetime.utcnow()
    db.commit()

    # Notify student
    student = db.query(User).filter(User.id == enrollment.student_id).first()
    if student:
        notif = Notification(
            user_id=student.id,
            title=f"Submission {data.status.replace('_', ' ').capitalize()}",
            message=f"Your task submission '{submission.task.title if submission.task else ''}' was marked as {data.status}.",
            link="/my-submissions"
        )
        db.add(notif)
        db.commit()

    # Re-evaluate day completion for student! If accepted, it may unlock next day!
    day = db.query(LearningDay).filter(LearningDay.id == submission.task.day_id).first()
    is_day_completed = check_and_update_day_progress(db, enrollment, day, current_user)

    log_audit(
        db=db,
        actor=current_user,
        action="REVIEW_SUBMISSION",
        target_type="task_submission",
        target_id=submission.id,
        details=f"Submission {submission.id} marked as {data.status}"
    )

    return {
        "submission_id": submission.id,
        "status": submission.status,
        "is_day_completed": is_day_completed
    }
