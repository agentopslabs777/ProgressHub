from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import User, RewardWallet, RewardTransaction, RewardConfig
from backend.app.permissions.permissions import get_current_user, require_admin, log_audit
from backend.app.services.reward_service import (
    get_or_create_reward_config, get_or_create_wallet, credit_reward_points, debit_reward_points
)

router = APIRouter(prefix="/rewards", tags=["Reward Points & Wallet"])

class RewardConfigUpdate(BaseModel):
    point_to_rupee_ratio: Optional[float] = None
    default_submission_points: Optional[float] = None
    award_timing: Optional[str] = None
    max_employee_points_per_review: Optional[float] = None
    allow_redemption: Optional[bool] = None
    max_redemption_percent: Optional[float] = None
    qualify_rejected: Optional[bool] = None

class AdminAdjustRequest(BaseModel):
    user_id: str
    points: float
    reason: str

@router.get("/config", response_model=dict)
def get_reward_policy_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    config = get_or_create_reward_config(db)
    return {
        "point_to_rupee_ratio": config.point_to_rupee_ratio,
        "default_submission_points": config.default_submission_points,
        "award_timing": config.award_timing,
        "max_employee_points_per_review": config.max_employee_points_per_review,
        "allow_redemption": config.allow_redemption,
        "max_redemption_percent": config.max_redemption_percent,
        "qualify_rejected": config.qualify_rejected,
        "updated_at": config.updated_at
    }

@router.patch("/config", response_model=dict)
def update_reward_policy_config(
    data: RewardConfigUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    config = get_or_create_reward_config(db)
    if data.point_to_rupee_ratio is not None:
        if data.point_to_rupee_ratio <= 0:
            raise HTTPException(status_code=400, detail="Conversion ratio must be greater than zero.")
        config.point_to_rupee_ratio = data.point_to_rupee_ratio
    if data.default_submission_points is not None:
        config.default_submission_points = data.default_submission_points
    if data.award_timing is not None:
        config.award_timing = data.award_timing
    if data.max_employee_points_per_review is not None:
        config.max_employee_points_per_review = data.max_employee_points_per_review
    if data.allow_redemption is not None:
        config.allow_redemption = data.allow_redemption
    if data.max_redemption_percent is not None:
        config.max_redemption_percent = data.max_redemption_percent
    if data.qualify_rejected is not None:
        config.qualify_rejected = data.qualify_rejected

    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)

    log_audit(
        db=db,
        actor=current_user,
        action="UPDATE_REWARD_CONFIG",
        target_type="reward_config",
        target_id=config.id,
        details=f"Admin updated reward policy: ratio={config.point_to_rupee_ratio}, base_points={config.default_submission_points}"
    )

    return {"message": "Reward configuration updated successfully", "config": {
        "point_to_rupee_ratio": config.point_to_rupee_ratio,
        "default_submission_points": config.default_submission_points,
        "award_timing": config.award_timing,
        "max_employee_points_per_review": config.max_employee_points_per_review,
        "allow_redemption": config.allow_redemption,
        "max_redemption_percent": config.max_redemption_percent,
        "qualify_rejected": config.qualify_rejected
    }}

@router.get("/wallet", response_model=dict)
def get_user_wallet(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    wallet = get_or_create_wallet(db, current_user.id)
    config = get_or_create_reward_config(db)

    txs = db.query(RewardTransaction).filter(
        RewardTransaction.user_id == current_user.id
    ).order_by(RewardTransaction.created_at.desc()).all()

    # Category breakdowns
    submission_points = sum(t.points for t in txs if t.transaction_type == "submission_base" and t.points > 0)
    employee_points = sum(t.points for t in txs if t.transaction_type == "employee_review" and t.points > 0)
    referral_points = sum(t.points for t in txs if t.transaction_type == "referral_bonus" and t.points > 0)
    redeemed_points = sum(abs(t.points) for t in txs if t.transaction_type == "program_redemption" and t.points < 0)

    equivalent_inr = wallet.balance * config.point_to_rupee_ratio

    tx_list = []
    for t in txs:
        creator_name = t.created_by.full_name if t.created_by else None
        tx_list.append({
            "id": t.id,
            "amount": t.amount,
            "points": t.points,
            "conversion_rate": t.conversion_rate,
            "transaction_type": t.transaction_type,
            "reason": t.reason,
            "related_entity_type": t.related_entity_type,
            "related_entity_id": t.related_entity_id,
            "created_by": creator_name,
            "created_at": t.created_at
        })

    return {
        "balance": wallet.balance,
        "equivalent_inr": equivalent_inr,
        "point_to_rupee_ratio": config.point_to_rupee_ratio,
        "total_earned": wallet.total_earned,
        "total_redeemed": wallet.total_redeemed,
        "breakdown": {
            "submission_points": submission_points,
            "employee_points": employee_points,
            "referral_points": referral_points,
            "redeemed_points": redeemed_points
        },
        "transactions": tx_list
    }

@router.post("/admin/adjust", response_model=dict)
def admin_adjust_points(
    data: AdminAdjustRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    target = db.query(User).filter(User.id == data.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")

    if data.points > 0:
        tx = credit_reward_points(
            db=db,
            user_id=target.id,
            points=data.points,
            transaction_type="admin_adjustment",
            reason=data.reason,
            created_by_id=current_user.id
        )
    else:
        tx = debit_reward_points(
            db=db,
            user_id=target.id,
            points=abs(data.points),
            transaction_type="admin_adjustment",
            reason=data.reason,
            created_by_id=current_user.id
        )

    log_audit(
        db=db,
        actor=current_user,
        action="ADMIN_ADJUST_REWARD_POINTS",
        target_type="user",
        target_id=target.id,
        details=f"Admin adjusted {data.points} points for {target.full_name}: {data.reason}"
    )

    return {"message": "Points adjusted successfully", "transaction_id": tx.id}
