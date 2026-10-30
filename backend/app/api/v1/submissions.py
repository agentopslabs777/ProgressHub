import re
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import (
    GoogleDriveSubmission, Enrollment, LearningDay, LearningTrack,
    Program, User, Notification
)
from backend.app.schemas.schemas import (
    GoogleDriveSubmissionCreate, GoogleDriveSubmissionReview, GoogleDriveSubmissionResponse
)
from backend.app.permissions.permissions import get_current_user, require_admin, require_employee, log_audit
from backend.app.services.learning_engine import (
    verify_student_day_access, check_and_update_day_progress, calculate_enrollment_progress
)
from backend.app.services.reward_service import (
    get_or_create_reward_config, credit_reward_points
)

router = APIRouter(prefix="/submissions", tags=["Submissions & Reviews"])

def validate_google_drive_url(url: str) -> bool:
    """
    Validates that the provided URL points to Google Drive, Docs, Sheets, Slides, or Forms.
    """
    if not url:
        return False
    clean_url = url.strip()
    pattern = r"^https?:\/\/(drive|docs)\.google\.com\/[^\s]+$"
    return bool(re.match(pattern, clean_url, re.IGNORECASE))

@router.post("/google-drive", response_model=dict)
def submit_google_drive_evidence(
    data: GoogleDriveSubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can submit assignments")

    clean_url = data.google_drive_url.strip()
    if not validate_google_drive_url(clean_url):
        raise HTTPException(
            status_code=400,
            detail="Invalid Google Drive link. Please provide a valid URL starting with https://drive.google.com/ or https://docs.google.com/ (and ensure sharing permissions are set to 'Anyone with the link can view')."
        )

    enrollment, day = verify_student_day_access(db, current_user.id, data.day_id)

    # Count prior attempts and mark them not latest
    prior_subs = db.query(GoogleDriveSubmission).filter(
        GoogleDriveSubmission.enrollment_id == enrollment.id,
        GoogleDriveSubmission.day_id == day.id
    ).order_by(GoogleDriveSubmission.attempt_number.desc()).all()

    attempt_number = 1
    if prior_subs:
        attempt_number = prior_subs[0].attempt_number + 1
        for ps in prior_subs:
            ps.is_latest = False

    submission = GoogleDriveSubmission(
        enrollment_id=enrollment.id,
        day_id=day.id,
        google_drive_url=clean_url,
        notes=data.notes,
        attempt_number=attempt_number,
        is_latest=True,
        status="submitted",
        submitted_at=datetime.utcnow()
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Award base points immediately if configured for immediate award
    reward_config = get_or_create_reward_config(db)
    base_points = float(getattr(day, "base_reward_points", None) or reward_config.default_submission_points)
    if reward_config.award_timing == "immediate":
        try:
            credit_reward_points(
                db=db,
                user_id=current_user.id,
                points=base_points,
                transaction_type="submission_base",
                reason=f"Day {day.day_number} ({day.title}) assignment submission reward",
                related_entity_type="google_drive_submission",
                related_entity_id=submission.id
            )
            submission.base_reward_points = base_points
            submission.reward_awarded = True
            db.commit()
        except Exception:
            pass

    # Check and update day progress (if approval is not required, submitting may complete it)
    check_and_update_day_progress(db, enrollment, day, current_user)

    log_audit(
        db=db,
        actor=current_user,
        action="SUBMIT_GOOGLE_DRIVE",
        target_type="google_drive_submission",
        target_id=submission.id,
        details=f"Attempt {attempt_number} for Day {day.day_number}: '{day.title}'"
    )

    # Notify assigned employee
    if enrollment.employee_id:
        notif = Notification(
            user_id=enrollment.employee_id,
            title="New Google Drive Submission",
            message=f"{current_user.full_name} submitted Google Drive assignment for Day {day.day_number} (Attempt #{attempt_number})",
            link=f"/daily-classes"
        )
        db.add(notif)
        db.commit()

    return {
        "id": submission.id,
        "attempt_number": submission.attempt_number,
        "status": submission.status,
        "submitted_at": submission.submitted_at,
        "message": "Google Drive assignment submitted successfully for review"
    }

@router.get("/google-drive", response_model=List[dict])
def list_google_drive_submissions(
    status_filter: Optional[str] = None,
    program_id: Optional[str] = None,
    day_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(GoogleDriveSubmission)

    if current_user.role == "student":
        student_enrollments = db.query(Enrollment.id).filter(
            Enrollment.student_id == current_user.id
        ).all()
        e_ids = [e[0] for e in student_enrollments]
        query = query.filter(GoogleDriveSubmission.enrollment_id.in_(e_ids))
    elif current_user.role == "employee":
        emp_enrollments = db.query(Enrollment.id).filter(
            Enrollment.employee_id == current_user.id
        ).all()
        e_ids = [e[0] for e in emp_enrollments]
        query = query.filter(GoogleDriveSubmission.enrollment_id.in_(e_ids))

    if status_filter:
        query = query.filter(GoogleDriveSubmission.status == status_filter)
    if day_id:
        query = query.filter(GoogleDriveSubmission.day_id == day_id)

    submissions = query.order_by(GoogleDriveSubmission.submitted_at.desc()).all()
    results = []
    for s in submissions:
        enr = s.enrollment
        d = s.day
        prog = enr.program if enr else None
        stu = enr.student if enr else None
        rev = s.reviewer

        if program_id and prog and prog.id != program_id:
            continue

        results.append({
            "id": s.id,
            "enrollment_id": s.enrollment_id,
            "day_id": s.day_id,
            "day_number": d.day_number if d else None,
            "day_title": d.title if d else None,
            "student_id": stu.id if stu else None,
            "student_name": stu.full_name if stu else "Unknown",
            "student_email": stu.email if stu else "",
            "program_name": prog.name if prog else "Unknown",
            "google_drive_url": s.google_drive_url,
            "notes": s.notes,
            "attempt_number": s.attempt_number,
            "is_latest": s.is_latest,
            "status": s.status,
            "reviewer_id": s.reviewer_id,
            "reviewer_name": rev.full_name if rev else None,
            "review_comments": s.review_comments,
            "rating": s.rating,
            "improvement_suggestions": s.improvement_suggestions,
            "submitted_at": s.submitted_at,
            "reviewed_at": s.reviewed_at
        })

    return results

@router.get("/google-drive/{submission_id}", response_model=dict)
def get_google_drive_submission(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    enr = sub.enrollment
    if current_user.role == "student" and enr.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == "employee" and enr.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "id": sub.id,
        "enrollment_id": sub.enrollment_id,
        "day_id": sub.day_id,
        "day_number": sub.day.day_number if sub.day else None,
        "day_title": sub.day.title if sub.day else None,
        "student_name": enr.student.full_name if enr and enr.student else "Unknown",
        "student_email": enr.student.email if enr and enr.student else "",
        "program_name": enr.program.name if enr and enr.program else "Unknown",
        "google_drive_url": sub.google_drive_url,
        "notes": sub.notes,
        "attempt_number": sub.attempt_number,
        "is_latest": sub.is_latest,
        "status": sub.status,
        "reviewer_id": sub.reviewer_id,
        "reviewer_name": sub.reviewer.full_name if sub.reviewer else None,
        "review_comments": sub.review_comments,
        "rating": sub.rating,
        "improvement_suggestions": sub.improvement_suggestions,
        "submitted_at": sub.submitted_at,
        "reviewed_at": sub.reviewed_at
    }

@router.post("/google-drive/{submission_id}/review", response_model=dict)
def review_google_drive_submission(
    submission_id: str,
    data: GoogleDriveSubmissionReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Only teachers or administrators can review submissions")

    sub = db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    enr = sub.enrollment
    if current_user.role == "employee" and enr.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only review submissions for your assigned students")

    valid_statuses = ["approved", "changes_requested", "rejected", "under_review"]
    status_to_set = data.status if (data.status and data.status in valid_statuses) else (sub.status or "approved")

    sub.status = status_to_set
    if data.review_comments is not None:
        sub.review_comments = data.review_comments
    if data.rating is not None:
        sub.rating = data.rating
    if data.improvement_suggestions is not None:
        sub.improvement_suggestions = data.improvement_suggestions
    sub.reviewer_id = current_user.id
    sub.reviewed_at = datetime.utcnow()

    # Process reward points
    reward_config = get_or_create_reward_config(db)
    day = sub.day

    # Base reward if on_approval
    base_points = float(getattr(day, "base_reward_points", None) or reward_config.default_submission_points)
    if status_to_set == "approved" and not getattr(sub, "reward_awarded", False):
        try:
            credit_reward_points(
                db=db,
                user_id=enr.student_id,
                points=base_points,
                transaction_type="submission_base",
                reason=f"Day {day.day_number} ({day.title}) approved assignment reward",
                related_entity_type="google_drive_submission",
                related_entity_id=sub.id,
                created_by_id=current_user.id
            )
            sub.base_reward_points = base_points
            sub.reward_awarded = True
        except Exception:
            pass

    # Additional employee reward points
    awarded_extra = 0.0
    if data.additional_reward_points is not None and data.additional_reward_points > 0:
        max_allowed = reward_config.max_employee_points_per_review
        extra_to_give = min(data.additional_reward_points, max_allowed)
        prev_extra = float(getattr(sub, "additional_reward_points", 0.0) or 0.0)
        diff = extra_to_give - prev_extra

        if diff > 0:
            credit_reward_points(
                db=db,
                user_id=enr.student_id,
                points=diff,
                transaction_type="employee_review",
                reason=f"Instructor review reward for Day {day.day_number}: {sub.review_comments or 'Great submission'}",
                related_entity_type="google_drive_submission",
                related_entity_id=sub.id,
                created_by_id=current_user.id
            )
            awarded_extra = diff
        sub.additional_reward_points = extra_to_give

    db.commit()
    db.refresh(sub)

    # Recalculate day progress for student
    day_completed = check_and_update_day_progress(db, enr, day, current_user)

    log_audit(
        db=db,
        actor=current_user,
        action="REVIEW_GOOGLE_DRIVE",
        target_type="google_drive_submission",
        target_id=sub.id,
        details=f"Verdict '{sub.status}' with rating {sub.rating}, extra pts {data.additional_reward_points} for student {enr.student_id}"
    )

    # Notify student with actual points awarded (per requirements Section 10)
    status_label = "Approved" if sub.status == "approved" else ("Revision Requested" if sub.status == "changes_requested" else "Review Update")
    extra_msg = f" You received {data.additional_reward_points:.0f} additional reward points." if (data.additional_reward_points and data.additional_reward_points > 0) else ""
    notif = Notification(
        user_id=enr.student_id,
        title=f"Submission {status_label}",
        message=f"Your Day {day.day_number} assignment has been reviewed.{extra_msg} Feedback: {sub.review_comments or 'No remarks provided'}",
        link=f"/learning-days/{day.id}"
    )
    db.add(notif)
    db.commit()

    return {
        "id": sub.id,
        "status": sub.status,
        "rating": sub.rating,
        "review_comments": sub.review_comments,
        "improvement_suggestions": sub.improvement_suggestions,
        "base_reward_points": getattr(sub, "base_reward_points", 0.0),
        "additional_reward_points": getattr(sub, "additional_reward_points", 0.0),
        "reviewed_at": sub.reviewed_at,
        "day_is_completed": day_completed,
        "message": f"Submission successfully marked as {sub.status}"
    }

@router.get("/student-course-days", response_model=List[dict])
def get_student_course_days(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all enrolled courses for the logged in student, along with all curriculum days
    (e.g. 7 days) and the student's submission status, drive link, and comments from faculty.
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can view their submission days")

    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.status == "active"
    ).all()

    results = []
    for enr in enrollments:
        prog = enr.program
        if not prog:
            continue

        tracks = db.query(LearningTrack).filter(
            LearningTrack.program_id == prog.id,
            LearningTrack.active == True
        ).order_by(LearningTrack.position.asc()).all()

        days_data = []
        for t in tracks:
            days = db.query(LearningDay).filter(
                LearningDay.track_id == t.id
            ).order_by(LearningDay.day_number.asc()).all()

            for d in days:
                latest_sub = db.query(GoogleDriveSubmission).filter(
                    GoogleDriveSubmission.enrollment_id == enr.id,
                    GoogleDriveSubmission.day_id == d.id,
                    GoogleDriveSubmission.is_latest == True
                ).first()

                sub_dict = None
                if latest_sub:
                    rev = latest_sub.reviewer
                    sub_dict = {
                        "id": latest_sub.id,
                        "google_drive_url": latest_sub.google_drive_url,
                        "notes": latest_sub.notes,
                        "attempt_number": latest_sub.attempt_number,
                        "status": latest_sub.status,
                        "rating": latest_sub.rating,
                        "review_comments": latest_sub.review_comments,
                        "improvement_suggestions": latest_sub.improvement_suggestions,
                        "reviewer_name": rev.full_name if rev else "Faculty Instructor",
                        "submitted_at": latest_sub.submitted_at,
                        "reviewed_at": latest_sub.reviewed_at
                    }

                days_data.append({
                    "day_id": d.id,
                    "day_number": d.day_number,
                    "title": d.title,
                    "description": d.description,
                    "track_name": t.name,
                    "require_google_drive_submission": d.require_google_drive_submission,
                    "latest_submission": sub_dict
                })

        results.append({
            "enrollment_id": enr.id,
            "program_id": prog.id,
            "program_name": prog.name,
            "program_code": prog.code,
            "total_days": len(days_data),
            "days": days_data
        })

    return results
