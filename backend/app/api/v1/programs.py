import io
import csv
import re
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import (
    Program, LearningTrack, LearningDay, Enrollment, DayProgress,
    ChecklistTemplateItem, DailyTask, LearningResource, Flashcard, User,
    GoogleDriveSubmission
)
from backend.app.schemas.schemas import (
    ProgramCreate, ProgramUpdate, ProgramResponse,
    LearningTrackCreate, LearningTrackUpdate, LearningTrackResponse,
    LearningDayCreate, LearningDayUpdate, LearningDayResponse,
    ChecklistItemResponse, DailyTaskResponse,
    LearningResourceCreate, LearningResourceUpdate, LearningResourceResponse,
    FlashcardCreate, FlashcardUpdate, FlashcardResponse
)
from backend.app.permissions.permissions import get_current_user, require_admin, require_employee, log_audit

router = APIRouter(tags=["Programs"])

@router.get("/programs/public", response_model=List[dict])
def list_public_programs(
    db: Session = Depends(get_db)
):
    """Public program listing for student self-registration form."""
    programs = db.query(Program).order_by(Program.created_at.asc()).all()
    return [{
        "id": p.id,
        "name": p.name,
        "code": p.code,
        "description": p.description,
        "status": p.status,
        "price": p.price
    } for p in programs]

@router.get("/programs", response_model=List[dict])
def list_programs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Program)
    # If student, only show published programs or enrolled programs
    if current_user.role == "student":
        enrolled_pids = db.query(Enrollment.program_id).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.status == "active"
        ).distinct().all()
        pids = [p[0] for p in enrolled_pids]
        query = query.filter((Program.id.in_(pids)) | (func.lower(func.trim(Program.status)) == "published"))

    programs = query.order_by(Program.created_at.desc()).all()
    results = []
    for p in programs:
        t_count = db.query(LearningTrack).filter(LearningTrack.program_id == p.id, LearningTrack.active == True).count()
        e_count = db.query(Enrollment).filter(Enrollment.program_id == p.id, Enrollment.status == "active").count()
        results.append({
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "description": p.description,
            "status": p.status,
            "price": getattr(p, "price", 2000.0) or 2000.0,
            "allow_redemption": getattr(p, "allow_redemption", True),
            "max_redemption_percent": getattr(p, "max_redemption_percent", 100.0),
            "referral_bonus_points": getattr(p, "referral_bonus_points", 500.0) or 500.0,
            "eligible_for_referral": getattr(p, "eligible_for_referral", True),
            "created_at": p.created_at,
            "createdAt": p.created_at,
            "trackCount": t_count,
            "enrollmentCount": e_count
        })
    return results

@router.post("/programs", response_model=ProgramResponse)
def create_program(
    data: ProgramCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    clean_code = data.code.strip().upper()
    existing = db.query(Program).filter(Program.code == clean_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="A program with this code already exists")

    program = Program(
        name=data.name.strip(),
        code=clean_code,
        description=data.description,
        status=data.status or "published",
        price=data.price if data.price is not None else 2000.0,
        allow_redemption=data.allow_redemption if data.allow_redemption is not None else True,
        max_redemption_percent=data.max_redemption_percent if data.max_redemption_percent is not None else 100.0,
        referral_bonus_points=data.referral_bonus_points if data.referral_bonus_points is not None else 500.0,
        eligible_for_referral=data.eligible_for_referral if data.eligible_for_referral is not None else True
    )
    db.add(program)
    db.commit()
    db.refresh(program)

    log_audit(
        db=db,
        actor=current_user,
        action="CREATE_PROGRAM",
        target_type="program",
        target_id=program.id,
        details=f"Program '{program.name}' ({program.code}) created"
    )

    return ProgramResponse(
        id=program.id,
        name=program.name,
        code=program.code,
        description=program.description,
        status=program.status,
        created_at=program.created_at,
        updated_at=program.updated_at,
        track_count=0,
        enrollment_count=0,
        tracks=[]
    )

@router.get("/programs/{program_id}", response_model=dict)
def get_program_details(
    program_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    tracks = db.query(LearningTrack).filter(
        LearningTrack.program_id == program.id,
        LearningTrack.active == True
    ).order_by(LearningTrack.position.asc()).all()

    tracks_data = []
    for t in tracks:
        days = db.query(LearningDay).filter(
            LearningDay.track_id == t.id
        ).order_by(LearningDay.day_number.asc()).all()

        days_data = []
        for d in days:
            items = db.query(ChecklistTemplateItem).filter(
                ChecklistTemplateItem.day_id == d.id
            ).order_by(ChecklistTemplateItem.display_order.asc()).all()

            tasks = db.query(DailyTask).filter(DailyTask.day_id == d.id).all()
            resources = db.query(LearningResource).filter(
                LearningResource.day_id == d.id,
                LearningResource.active == True
            ).order_by(LearningResource.display_order.asc()).all()
            flashcards = db.query(Flashcard).filter(
                Flashcard.day_id == d.id,
                Flashcard.active == True
            ).order_by(Flashcard.display_order.asc()).all()

            days_data.append({
                "id": d.id,
                "track_id": d.track_id,
                "trackId": d.track_id,
                "day_number": d.day_number,
                "dayNumber": d.day_number,
                "title": d.title,
                "description": d.description,
                "content": d.content,
                "video_url": d.video_url,
                "videoUrl": d.video_url,
                "summary_main": d.summary_main,
                "summary_telugu": d.summary_telugu,
                "summary_english": d.summary_english,
                "summary_video_url": d.summary_video_url,
                "summary_url": d.summary_url,
                "summaryUrl": d.summary_url,
                "quiz_url": d.quiz_url,
                "quizUrl": d.quiz_url,
                "assignment_url": d.assignment_url,
                "assignmentUrl": d.assignment_url,
                "unlock_delay_hours": d.unlock_delay_hours or 24.0,
                "unlock_mode": d.unlock_mode or "both",
                "require_google_drive_submission": bool(d.require_google_drive_submission),
                "completion_requirements": d.completion_requirements,
                "attachments": d.attachments,
                "published": d.published,
                "require_approval": d.require_approval,
                "requireApproval": d.require_approval,
                "require_task_submission": d.require_task_submission,
                "requireTaskSubmission": d.require_task_submission,
                "created_at": d.created_at,
                "createdAt": d.created_at,
                "checklist_items": [ChecklistItemResponse.model_validate(i).dict() for i in items],
                "checklistItems": [ChecklistItemResponse.model_validate(i).dict() for i in items],
                "tasks": [DailyTaskResponse.model_validate(tsk).dict() for tsk in tasks],
                "resources": [LearningResourceResponse.model_validate(r).dict() for r in resources],
                "flashcards": [FlashcardResponse.model_validate(f).dict() for f in flashcards]
            })

        tracks_data.append({
            "id": t.id,
            "program_id": t.program_id,
            "programId": t.program_id,
            "name": t.name,
            "description": t.description,
            "position": t.position,
            "active": t.active,
            "created_at": t.created_at,
            "days": days_data,
            "dayCount": len(days_data)
        })

    enrollment_count = db.query(Enrollment).filter(
        Enrollment.program_id == program.id,
        Enrollment.status == "active"
    ).count()

    return {
        "id": program.id,
        "name": program.name,
        "code": program.code,
        "description": program.description,
        "status": program.status,
        "price": getattr(program, "price", 2000.0) or 2000.0,
        "allow_redemption": getattr(program, "allow_redemption", True),
        "max_redemption_percent": getattr(program, "max_redemption_percent", 100.0),
        "referral_bonus_points": getattr(program, "referral_bonus_points", 500.0) or 500.0,
        "eligible_for_referral": getattr(program, "eligible_for_referral", True),
        "created_at": program.created_at,
        "createdAt": program.created_at,
        "updated_at": program.updated_at,
        "trackCount": len(tracks_data),
        "enrollmentCount": enrollment_count,
        "tracks": tracks_data
    }

@router.patch("/programs/{program_id}", response_model=ProgramResponse)
def update_program(
    program_id: str,
    data: ProgramUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    if data.name:
        program.name = data.name.strip()
    if data.code:
        clean_code = data.code.strip().upper()
        conflict = db.query(Program).filter(Program.code == clean_code, Program.id != program_id).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Program code already in use")
        program.code = clean_code
    if data.description is not None:
        program.description = data.description
    if data.status:
        program.status = data.status
    if data.price is not None:
        program.price = data.price
    if data.allow_redemption is not None:
        program.allow_redemption = data.allow_redemption
    if data.max_redemption_percent is not None:
        program.max_redemption_percent = data.max_redemption_percent
    if data.referral_bonus_points is not None:
        program.referral_bonus_points = data.referral_bonus_points
    if data.eligible_for_referral is not None:
        program.eligible_for_referral = data.eligible_for_referral

    db.commit()
    db.refresh(program)

    log_audit(
        db=db,
        actor=current_user,
        action="UPDATE_PROGRAM",
        target_type="program",
        target_id=program.id,
        details=f"Program '{program.name}' updated"
    )

    t_count = db.query(LearningTrack).filter(LearningTrack.program_id == program.id).count()
    e_count = db.query(Enrollment).filter(Enrollment.program_id == program.id).count()

    return ProgramResponse(
        id=program.id,
        name=program.name,
        code=program.code,
        description=program.description,
        status=program.status,
        created_at=program.created_at,
        updated_at=program.updated_at,
        track_count=t_count,
        enrollment_count=e_count,
        tracks=[]
    )

@router.delete("/programs/{program_id}")
def delete_program(
    program_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    prog_name = program.name

    # 1. Clean up tracks and their days
    tracks = db.query(LearningTrack).filter(LearningTrack.program_id == program_id).all()
    for t in tracks:
        day_ids = [d.id for d in db.query(LearningDay.id).filter(LearningDay.track_id == t.id).all()]
        if day_ids:
            db.query(GoogleDriveSubmission).filter(GoogleDriveSubmission.day_id.in_(day_ids)).delete(synchronize_session=False)
            db.query(DailyTask).filter(DailyTask.day_id.in_(day_ids)).delete(synchronize_session=False)
            db.query(ChecklistTemplateItem).filter(ChecklistTemplateItem.day_id.in_(day_ids)).delete(synchronize_session=False)
            db.query(LearningResource).filter(LearningResource.day_id.in_(day_ids)).delete(synchronize_session=False)
            db.query(Flashcard).filter(Flashcard.day_id.in_(day_ids)).delete(synchronize_session=False)
            db.query(DayProgress).filter(DayProgress.day_id.in_(day_ids)).delete(synchronize_session=False)
            db.query(LearningDay).filter(LearningDay.id.in_(day_ids)).delete(synchronize_session=False)
        db.delete(t)

    # 2. Clean up enrollments
    db.query(Enrollment).filter(Enrollment.program_id == program_id).delete(synchronize_session=False)

    # 3. Delete program
    db.delete(program)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="DELETE_PROGRAM",
        target_type="program",
        target_id=program_id,
        details=f"Course Program '{prog_name}' deleted"
    )

    return {"message": f"Program '{prog_name}' deleted successfully", "id": program_id}

# Learning Tracks Endpoints
@router.post("/programs/{program_id}/tracks")
def add_track_to_program(
    program_id: str,
    data: LearningTrackCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    position = data.position or (db.query(LearningTrack).filter(LearningTrack.program_id == program_id).count() + 1)
    track = LearningTrack(
        program_id=program_id,
        name=data.name.strip(),
        description=data.description,
        position=position,
        active=data.active
    )
    db.add(track)
    db.commit()
    db.refresh(track)

    log_audit(
        db=db,
        actor=current_user,
        action="ADD_TRACK",
        target_type="learning_track",
        target_id=track.id,
        details=f"Track '{track.name}' added to program '{program.name}'"
    )

    return {"id": track.id, "name": track.name, "position": track.position, "program_id": track.program_id}

@router.patch("/tracks/{track_id}")
def update_track(
    track_id: str,
    data: LearningTrackUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    track = db.query(LearningTrack).filter(LearningTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    if data.name:
        track.name = data.name.strip()
    if data.description is not None:
        track.description = data.description
    if data.position is not None:
        track.position = data.position
    if data.active is not None:
        track.active = data.active

    db.commit()
    db.refresh(track)

    log_audit(
        db=db,
        actor=current_user,
        action="UPDATE_TRACK",
        target_type="learning_track",
        target_id=track.id,
        details=f"Track '{track.name}' updated"
    )

    return {"id": track.id, "name": track.name, "position": track.position, "active": track.active}

@router.delete("/tracks/{track_id}")
def delete_track(
    track_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    track = db.query(LearningTrack).filter(LearningTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    name = track.name
    day_ids = [d.id for d in db.query(LearningDay.id).filter(LearningDay.track_id == track_id).all()]
    if day_ids:
        db.query(DayProgress).filter(DayProgress.day_id.in_(day_ids)).delete(synchronize_session=False)
    db.delete(track)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="DELETE_TRACK",
        target_type="learning_track",
        target_id=track_id,
        details=f"Track '{name}' deleted"
    )
    return {"message": "Track deleted successfully"}

# Learning Days Endpoints
@router.post("/tracks/{track_id}/days")
def add_day_to_track(
    track_id: str,
    data: LearningDayCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    track = db.query(LearningTrack).filter(LearningTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    next_num = db.query(LearningDay).filter(LearningDay.track_id == track_id).count() + 1
    day_number = data.day_number if data.day_number is not None else next_num

    day = LearningDay(
        track_id=track_id,
        day_number=day_number,
        title=data.title.strip(),
        description=data.description,
        content=data.content,
        video_url=data.video_url or data.summary_video_url,
        summary_main=data.summary_main,
        summary_telugu=data.summary_telugu,
        summary_english=data.summary_english,
        summary_video_url=data.summary_video_url or data.video_url,
        summary_url=data.summary_url,
        quiz_url=data.quiz_url,
        assignment_url=data.assignment_url,
        unlock_delay_hours=data.unlock_delay_hours if data.unlock_delay_hours is not None else 24.0,
        unlock_mode=data.unlock_mode or "both",
        require_google_drive_submission=bool(data.require_google_drive_submission),
        completion_requirements=data.completion_requirements,
        attachments=data.attachments,
        published=data.published,
        require_approval=data.require_approval,
        require_task_submission=data.require_task_submission
    )
    db.add(day)
    db.commit()
    db.refresh(day)

    # Persist checklist items if submitted
    if data.checklist_items:
        for idx, item_data in enumerate(data.checklist_items):
            item = ChecklistTemplateItem(
                day_id=day.id,
                title=item_data.title.strip(),
                description=item_data.description,
                display_order=item_data.display_order if item_data.display_order is not None else idx + 1,
                is_required=item_data.is_required,
                active=item_data.active
            )
            db.add(item)
        db.commit()

    # Persist resources if submitted
    if data.resources:
        for idx, r_data in enumerate(data.resources):
            res = LearningResource(
                day_id=day.id,
                title=r_data.title.strip(),
                resource_type=r_data.resource_type,
                url=r_data.url,
                content=r_data.content,
                display_order=r_data.display_order if r_data.display_order is not None else idx + 1,
                active=r_data.active
            )
            db.add(res)
        db.commit()

    # Persist flashcards if submitted
    if data.flashcards:
        for idx, f_data in enumerate(data.flashcards):
            fc = Flashcard(
                day_id=day.id,
                front_text=f_data.front_text.strip(),
                back_text=f_data.back_text.strip(),
                display_order=f_data.display_order if f_data.display_order is not None else idx + 1,
                active=f_data.active
            )
            db.add(fc)
        db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="ADD_LEARNING_DAY",
        target_type="learning_day",
        target_id=day.id,
        details=f"Day {day.day_number}: '{day.title}' added to track '{track.name}'"
    )

    return {"id": day.id, "day_number": day.day_number, "title": day.title, "published": day.published}

@router.get("/days/{day_id}")
def get_day_details(
    day_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    items = db.query(ChecklistTemplateItem).filter(
        ChecklistTemplateItem.day_id == day.id
    ).order_by(ChecklistTemplateItem.display_order.asc()).all()

    tasks = db.query(DailyTask).filter(DailyTask.day_id == day.id).all()
    resources = db.query(LearningResource).filter(
        LearningResource.day_id == day.id
    ).order_by(LearningResource.display_order.asc()).all()
    flashcards = db.query(Flashcard).filter(
        Flashcard.day_id == day.id
    ).order_by(Flashcard.display_order.asc()).all()

    return {
        "id": day.id,
        "track_id": day.track_id,
        "day_number": day.day_number,
        "title": day.title,
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
        "unlock_delay_hours": day.unlock_delay_hours or 24.0,
        "unlock_mode": day.unlock_mode or "both",
        "require_google_drive_submission": bool(day.require_google_drive_submission),
        "completion_requirements": day.completion_requirements,
        "attachments": day.attachments,
        "published": day.published,
        "require_approval": day.require_approval,
        "require_task_submission": day.require_task_submission,
        "created_at": day.created_at,
        "checklist_items": [ChecklistItemResponse.model_validate(i).dict() for i in items],
        "tasks": [DailyTaskResponse.model_validate(tsk).dict() for tsk in tasks],
        "resources": [LearningResourceResponse.model_validate(r).dict() for r in resources],
        "flashcards": [FlashcardResponse.model_validate(f).dict() for f in flashcards]
    }

@router.patch("/days/{day_id}")
def update_day(
    day_id: str,
    data: LearningDayUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    if data.title is not None:
        day.title = data.title.strip()
    if data.day_number is not None:
        day.day_number = data.day_number
    if data.description is not None:
        day.description = data.description
    if data.content is not None:
        day.content = data.content
    if data.video_url is not None:
        day.video_url = data.video_url
        if not day.summary_video_url:
            day.summary_video_url = data.video_url
    if data.summary_main is not None:
        day.summary_main = data.summary_main
    if data.summary_telugu is not None:
        day.summary_telugu = data.summary_telugu
    if data.summary_english is not None:
        day.summary_english = data.summary_english
    if data.summary_video_url is not None:
        day.summary_video_url = data.summary_video_url
        if not day.video_url:
            day.video_url = data.summary_video_url
    if data.summary_url is not None:
        day.summary_url = data.summary_url
    if data.quiz_url is not None:
        day.quiz_url = data.quiz_url
    if data.assignment_url is not None:
        day.assignment_url = data.assignment_url
    if data.unlock_delay_hours is not None:
        day.unlock_delay_hours = data.unlock_delay_hours
    if data.unlock_mode is not None:
        day.unlock_mode = data.unlock_mode
    if data.require_google_drive_submission is not None:
        day.require_google_drive_submission = data.require_google_drive_submission
    if data.completion_requirements is not None:
        day.completion_requirements = data.completion_requirements
    if data.attachments is not None:
        day.attachments = data.attachments
    if data.published is not None:
        day.published = data.published
    if data.require_approval is not None:
        day.require_approval = data.require_approval
    if data.require_task_submission is not None:
        day.require_task_submission = data.require_task_submission

    db.commit()
    db.refresh(day)

    log_audit(
        db=db,
        actor=current_user,
        action="UPDATE_LEARNING_DAY",
        target_type="learning_day",
        target_id=day.id,
        details=f"Day {day.day_number}: '{day.title}' updated"
    )

    return {"id": day.id, "title": day.title, "published": day.published}

@router.delete("/days/{day_id}")
def delete_day(
    day_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    title = day.title
    db.query(DayProgress).filter(DayProgress.day_id == day_id).delete(synchronize_session=False)
    db.delete(day)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="DELETE_LEARNING_DAY",
        target_type="learning_day",
        target_id=day_id,
        details=f"Day '{title}' deleted"
    )
    return {"message": "Learning day deleted successfully"}

# Learning Resources CRUD
@router.post("/days/{day_id}/resources", response_model=LearningResourceResponse)
def add_learning_resource(
    day_id: str,
    data: LearningResourceCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    res = LearningResource(
        day_id=day.id,
        title=data.title.strip(),
        resource_type=data.resource_type,
        url=data.url,
        content=data.content,
        display_order=data.display_order,
        active=data.active
    )
    db.add(res)
    db.commit()
    db.refresh(res)

    log_audit(
        db=db,
        actor=current_user,
        action="ADD_LEARNING_RESOURCE",
        target_type="learning_resource",
        target_id=res.id,
        details=f"Resource '{res.title}' added to Day {day.day_number}"
    )
    return res

@router.patch("/resources/{resource_id}", response_model=LearningResourceResponse)
def update_learning_resource(
    resource_id: str,
    data: LearningResourceUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    res = db.query(LearningResource).filter(LearningResource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")

    if data.title is not None:
        res.title = data.title.strip()
    if data.resource_type is not None:
        res.resource_type = data.resource_type
    if data.url is not None:
        res.url = data.url
    if data.content is not None:
        res.content = data.content
    if data.display_order is not None:
        res.display_order = data.display_order
    if data.active is not None:
        res.active = data.active

    db.commit()
    db.refresh(res)
    return res

@router.delete("/resources/{resource_id}")
def delete_learning_resource(
    resource_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    res = db.query(LearningResource).filter(LearningResource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")

    title = res.title
    db.delete(res)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="DELETE_LEARNING_RESOURCE",
        target_type="learning_resource",
        target_id=resource_id,
        details=f"Resource '{title}' deleted"
    )
    return {"message": "Resource deleted successfully"}

# Flashcards CRUD
@router.post("/days/{day_id}/flashcards", response_model=FlashcardResponse)
def add_flashcard(
    day_id: str,
    data: FlashcardCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    fc = Flashcard(
        day_id=day.id,
        front_text=data.front_text.strip(),
        back_text=data.back_text.strip(),
        display_order=data.display_order,
        active=data.active
    )
    db.add(fc)
    db.commit()
    db.refresh(fc)

    log_audit(
        db=db,
        actor=current_user,
        action="ADD_FLASHCARD",
        target_type="flashcard",
        target_id=fc.id,
        details=f"Flashcard added to Day {day.day_number}"
    )
    return fc

@router.patch("/flashcards/{flashcard_id}", response_model=FlashcardResponse)
def update_flashcard(
    flashcard_id: str,
    data: FlashcardUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    fc = db.query(Flashcard).filter(Flashcard.id == flashcard_id).first()
    if not fc:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    if data.front_text is not None:
        fc.front_text = data.front_text.strip()
    if data.back_text is not None:
        fc.back_text = data.back_text.strip()
    if data.display_order is not None:
        fc.display_order = data.display_order
    if data.active is not None:
        fc.active = data.active

    db.commit()
    db.refresh(fc)
    return fc

@router.delete("/flashcards/{flashcard_id}")
def delete_flashcard(
    flashcard_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    fc = db.query(Flashcard).filter(Flashcard.id == flashcard_id).first()
    if not fc:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    db.delete(fc)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="DELETE_FLASHCARD",
        target_type="flashcard",
        target_id=flashcard_id,
        details="Flashcard deleted"
    )
    return {"message": "Flashcard deleted successfully"}


@router.get("/programs/{program_id}/export-template")
def export_curriculum_template(
    program_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Generates and returns an Excel (.xlsx) curriculum template pre-filled with columns
    and 9 sequential sample days.
    """
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Curriculum_Import"

    headers = [
        "Day", "Module", "Day Title", "Summary", "Main Class Video",
        "Quiz", "Assignment", "Checklist", "Resources"
    ]
    ws.append(headers)

    # Style header row
    from openpyxl.styles import Font, PatternFill, Alignment
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    # Add 9 sample sequential days
    for i in range(1, 10):
        mod_name = "Module 1: Foundations" if i <= 5 else "Module 2: Advanced Topics"
        ws.append([
            i,
            mod_name,
            f"Day {i}: {program.name} Core Topic {i}",
            f"Comprehensive summary and key learning notes for Day {i}. Explains the core theory and practical implementation.",
            f"https://www.youtube.com/watch?v=sample_class_video_{i}",
            f"https://forms.google.com/sample_quiz_{i}",
            f"Complete the Day {i} assignment in a Word document, upload it to Google Drive, and submit the link.",
            f"Watch main class video; Review key concepts; Complete assignment; Submit Google Drive URL",
            f"https://docs.google.com/document/d/sample_notes_{i}"
        ])

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = col[0].column_letter
        ws.column_dimensions[col_letter].width = min(50, max(12, max_len + 3))

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"{program.code or 'Program'}_Curriculum_Template.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/programs/{program_id}/import-excel", response_model=dict)
async def import_program_curriculum_excel(
    program_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Imports curriculum days, modules/tracks, main class video links, summaries,
    quizzes, assignments, and checklists from an Excel (.xlsx/.xls) or CSV file at once.
    """
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename_lower = file.filename.lower() if file.filename else ""
    try:
        import pandas as pd
        import openpyxl
        if filename_lower.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}. Please upload a valid .xlsx or .csv spreadsheet.")

    if df.empty:
        raise HTTPException(status_code=400, detail="Spreadsheet contains no data rows.")

    # Normalize column headers
    col_map = {col: str(col).strip().lower() for col in df.columns}

    def get_val(row, candidates, default=""):
        for c in candidates:
            for orig, norm in col_map.items():
                if norm == c or c in norm:
                    v = row[orig]
                    if pd.notna(v) and str(v).strip() != "":
                        return str(v).strip()
        return default

    stats = {
        "days_created": 0,
        "days_updated": 0,
        "tracks_created": 0,
        "resources_created": 0,
        "checklists_created": 0,
        "tasks_created": 0,
        "total_rows": len(df)
    }

    # Cache existing tracks
    existing_tracks = {
        t.name.lower(): t for t in db.query(LearningTrack).filter(LearningTrack.program_id == program.id).all()
    }

    for idx, (_, row) in enumerate(df.iterrows(), start=1):
        # 1. Day Number
        raw_day = get_val(row, ["day number", "day no", "day_number", "dayno", "day"])
        try:
            nums = re.findall(r"\d+", str(raw_day))
            day_num = int(nums[0]) if nums else idx
        except Exception:
            day_num = idx

        # 2. Track / Module
        track_name = get_val(row, ["module", "track", "submodule", "learning track", "module name"])
        if not track_name:
            track_name = "Module 1: Course Curriculum"

        track = existing_tracks.get(track_name.lower())
        if not track:
            pos = len(existing_tracks) + 1
            track = LearningTrack(
                program_id=program.id,
                name=track_name,
                description=f"Curriculum track for {track_name}",
                position=pos,
                active=True
            )
            db.add(track)
            db.commit()
            db.refresh(track)
            existing_tracks[track_name.lower()] = track
            stats["tracks_created"] += 1

        # 3. Day Title & Summary
        day_title = get_val(row, ["day title", "topic", "lesson", "title", "session title"])
        if not day_title:
            day_title = f"Day {day_num} Learning Session"

        summary = get_val(row, ["summary", "summery", "overview", "day summary", "description", "notes"])
        video_url = get_val(row, ["main class video", "class video", "main video", "video url", "video link", "video", "recording link", "lecture video"])
        quiz_data = get_val(row, ["quiz", "quize", "quiz link", "quiz url", "quiz description", "assessment"])
        assignment_data = get_val(row, ["assignment", "daily task", "task", "project", "assignment description"])
        checklist_data = get_val(row, ["checklist", "checklist items", "tasks checklist", "checklist tasks"])
        resources_data = get_val(row, ["resources", "resource links", "materials", "reference links", "learning resources"])

        # Find or create Day
        day = db.query(LearningDay).filter(
            LearningDay.track_id == track.id,
            LearningDay.day_number == day_num
        ).first()

        if not day:
            day = LearningDay(
                track_id=track.id,
                day_number=day_num,
                title=day_title,
                description=summary or f"Day {day_num} curriculum and assignments",
                summary_main=summary if summary else None,
                video_url=video_url if video_url else None,
                summary_video_url=video_url if video_url else None,
                quiz_url=quiz_data if (quiz_data and quiz_data.startswith("http")) else None,
                assignment_url=assignment_data if (assignment_data and assignment_data.startswith("http")) else None,
                unlock_mode="both",
                unlock_delay_hours=24.0,
                base_reward_points=20.0,
                published=True,
                require_task_submission=bool(assignment_data)
            )
            db.add(day)
            db.commit()
            db.refresh(day)
            stats["days_created"] += 1
        else:
            day.title = day_title
            if summary:
                day.description = summary
                day.summary_main = summary
            if video_url:
                day.video_url = video_url
                day.summary_video_url = video_url
            if quiz_data and quiz_data.startswith("http"):
                day.quiz_url = quiz_data
            if assignment_data:
                day.require_task_submission = True
                if assignment_data.startswith("http"):
                    day.assignment_url = assignment_data
            day.published = True
            db.commit()
            stats["days_updated"] += 1

        # Section 1: Summary Note
        if summary:
            existing_note = db.query(LearningResource).filter(
                LearningResource.day_id == day.id,
                LearningResource.resource_type == "note"
            ).first()
            if existing_note:
                existing_note.content = summary
            else:
                db.add(LearningResource(
                    day_id=day.id,
                    title="Day Summary & Key Notes",
                    resource_type="note",
                    content=summary,
                    display_order=1,
                    active=True
                ))
                stats["resources_created"] += 1

        # Section 2: Main Class Video
        if video_url:
            existing_vid = db.query(LearningResource).filter(
                LearningResource.day_id == day.id,
                LearningResource.resource_type == "video"
            ).first()
            if existing_vid:
                existing_vid.url = video_url
            else:
                db.add(LearningResource(
                    day_id=day.id,
                    title="Main Class Lecture Video",
                    resource_type="video",
                    url=video_url,
                    display_order=2,
                    active=True
                ))
                stats["resources_created"] += 1

        # Section 3: Quiz Link / Description
        if quiz_data:
            existing_quiz = db.query(LearningResource).filter(
                LearningResource.day_id == day.id,
                LearningResource.resource_type == "quiz"
            ).first()
            if existing_quiz:
                if quiz_data.startswith("http"):
                    existing_quiz.url = quiz_data
                else:
                    existing_quiz.content = quiz_data
            else:
                db.add(LearningResource(
                    day_id=day.id,
                    title="Daily Knowledge Assessment Quiz",
                    resource_type="quiz",
                    url=quiz_data if quiz_data.startswith("http") else None,
                    content=quiz_data if not quiz_data.startswith("http") else None,
                    display_order=3,
                    active=True
                ))
                stats["resources_created"] += 1

        # Section 4: Additional Resources
        if resources_data:
            links = [lk.strip() for lk in re.split(r"[,;\n]+", resources_data) if lk.strip()]
            for lk_idx, lk in enumerate(links, start=1):
                existing_link = db.query(LearningResource).filter(
                    LearningResource.day_id == day.id,
                    LearningResource.url == lk
                ).first()
                if not existing_link:
                    db.add(LearningResource(
                        day_id=day.id,
                        title=f"Learning Reference Material #{lk_idx}",
                        resource_type="link",
                        url=lk,
                        display_order=4 + lk_idx,
                        active=True
                    ))
                    stats["resources_created"] += 1

        # Section 5: Daily Tasks / Assignment
        if assignment_data:
            existing_task = db.query(DailyTask).filter(DailyTask.day_id == day.id).first()
            if existing_task:
                existing_task.instructions = assignment_data
                existing_task.is_required = True
            else:
                db.add(DailyTask(
                    day_id=day.id,
                    title=f"Day {day_num} Learning Assignment",
                    instructions=assignment_data,
                    submission_type="both",
                    is_required=True,
                    max_file_size_mb=25,
                    allowed_extensions="pdf,doc,docx,zip,png,jpg,jpeg,txt"
                ))
                stats["tasks_created"] += 1

        # Section 6: Checklist Items
        if checklist_data:
            items = [it.strip() for it in re.split(r"[,;\n]+", checklist_data) if it.strip()]
            for item_idx, it_text in enumerate(items, start=1):
                existing_it = db.query(ChecklistTemplateItem).filter(
                    ChecklistTemplateItem.day_id == day.id,
                    ChecklistTemplateItem.title == it_text
                ).first()
                if not existing_it:
                    db.add(ChecklistTemplateItem(
                        day_id=day.id,
                        title=it_text,
                        display_order=item_idx,
                        is_required=True,
                        active=True
                    ))
                    stats["checklists_created"] += 1

        db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="IMPORT_CURRICULUM_EXCEL",
        target_type="program",
        target_id=program.id,
        details=f"Imported curriculum from Excel: {stats['days_created']} days created, {stats['days_updated']} days updated, {stats['resources_created']} resources added."
    )

    return {
        "success": True,
        "message": f"Successfully imported {stats['days_created'] + stats['days_updated']} learning days from Excel!",
        "stats": stats
    }
