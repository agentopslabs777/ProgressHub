from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import (
    LearningDay, ChecklistTemplateItem, ChecklistCompletion, 
    Enrollment, User
)
from backend.app.schemas.schemas import (
    ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemResponse
)
from backend.app.permissions.permissions import get_current_user, require_admin, log_audit
from backend.app.services.learning_engine import (
    verify_student_day_access, check_and_update_day_progress, calculate_enrollment_progress
)

router = APIRouter(tags=["Checklists"])

@router.get("/days/{day_id}/checklist", response_model=List[dict])
def get_day_checklist(
    day_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    items = db.query(ChecklistTemplateItem).filter(
        ChecklistTemplateItem.day_id == day.id,
        ChecklistTemplateItem.active == True
    ).order_by(ChecklistTemplateItem.display_order.asc()).all()

    # If student, fetch completion status
    completed_item_ids = set()
    if current_user.role == "student":
        enrollment, _ = verify_student_day_access(db, current_user.id, day.id)
        completions = db.query(ChecklistCompletion).filter(
            ChecklistCompletion.enrollment_id == enrollment.id,
            ChecklistCompletion.completed == True
        ).all()
        completed_item_ids = {c.item_id for c in completions}

    results = []
    for it in items:
        results.append({
            "id": it.id,
            "day_id": it.day_id,
            "dayId": it.day_id,
            "title": it.title,
            "description": it.description,
            "display_order": it.display_order,
            "displayOrder": it.display_order,
            "is_required": it.is_required,
            "isRequired": it.is_required,
            "active": it.active,
            "created_at": it.created_at,
            "completed": it.id in completed_item_ids
        })
    return results

@router.post("/days/{day_id}/checklist", response_model=ChecklistItemResponse)
def add_checklist_item(
    day_id: str,
    data: ChecklistItemCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    day = db.query(LearningDay).filter(LearningDay.id == day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Learning day not found")

    order = data.display_order or (db.query(ChecklistTemplateItem).filter(ChecklistTemplateItem.day_id == day_id).count() + 1)
    item = ChecklistTemplateItem(
        day_id=day_id,
        title=data.title.strip(),
        description=data.description,
        display_order=order,
        is_required=data.is_required,
        active=data.active
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    log_audit(
        db=db,
        actor=current_user,
        action="ADD_CHECKLIST_ITEM",
        target_type="checklist_item",
        target_id=item.id,
        details=f"Item '{item.title}' added to Day {day.day_number}"
    )

    return ChecklistItemResponse.model_validate(item)

@router.patch("/checklist-items/{item_id}", response_model=ChecklistItemResponse)
def update_checklist_item(
    item_id: str,
    data: ChecklistItemUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    item = db.query(ChecklistTemplateItem).filter(ChecklistTemplateItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    if data.title:
        item.title = data.title.strip()
    if data.description is not None:
        item.description = data.description
    if data.display_order is not None:
        item.display_order = data.display_order
    if data.is_required is not None:
        item.is_required = data.is_required
    if data.active is not None:
        item.active = data.active

    db.commit()
    db.refresh(item)

    log_audit(
        db=db,
        actor=current_user,
        action="UPDATE_CHECKLIST_ITEM",
        target_type="checklist_item",
        target_id=item.id,
        details=f"Item '{item.title}' updated"
    )

    return ChecklistItemResponse.model_validate(item)

@router.delete("/checklist-items/{item_id}")
def delete_checklist_item(
    item_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    item = db.query(ChecklistTemplateItem).filter(ChecklistTemplateItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    db.delete(item)
    db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="DELETE_CHECKLIST_ITEM",
        target_type="checklist_item",
        target_id=item_id,
        details=f"Deleted checklist item {item_id}"
    )

    return {"message": "Checklist item deleted"}

@router.post("/checklist-completions")
def toggle_checklist_completion(
    item_id: str,
    completed: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(ChecklistTemplateItem).filter(ChecklistTemplateItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    day = db.query(LearningDay).filter(LearningDay.id == item.day_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Associated learning day not found")

    # Verify student has access to this day and is actively enrolled
    enrollment, _ = verify_student_day_access(db, current_user.id, day.id)

    completion = db.query(ChecklistCompletion).filter(
        ChecklistCompletion.enrollment_id == enrollment.id,
        ChecklistCompletion.item_id == item.id
    ).first()

    if not completion:
        completion = ChecklistCompletion(
            enrollment_id=enrollment.id,
            item_id=item.id,
            completed=completed,
            completed_at=datetime.utcnow()
        )
        db.add(completion)
    else:
        completion.completed = completed
        completion.completed_at = datetime.utcnow()

    db.commit()

    # Trigger progression engine: evaluate day completion and auto-unlock next day if all conditions met!
    is_day_completed = check_and_update_day_progress(db, enrollment, day, current_user)
    updated_progress = calculate_enrollment_progress(db, enrollment)

    return {
        "item_id": item.id,
        "completed": completed,
        "is_day_completed": is_day_completed,
        "program_progress": updated_progress
    }
