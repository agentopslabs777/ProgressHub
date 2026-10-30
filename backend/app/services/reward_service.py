from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException
from backend.app.models.models import (
    RewardWallet, RewardTransaction, RewardConfig, User, Notification
)

def get_or_create_reward_config(db: Session) -> RewardConfig:
    config = db.query(RewardConfig).first()
    if not config:
        config = RewardConfig(
            point_to_rupee_ratio=1.0,  # 1 point = ₹1 default
            default_submission_points=20.0,
            award_timing="immediate",  # 'immediate' on submission or 'on_approval'
            max_employee_points_per_review=50.0,
            allow_redemption=True,
            max_redemption_percent=100.0,
            qualify_rejected=False
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

def get_or_create_wallet(db: Session, user_id: str) -> RewardWallet:
    wallet = db.query(RewardWallet).filter(RewardWallet.user_id == user_id).first()
    if not wallet:
        wallet = RewardWallet(
            user_id=user_id,
            balance=0.0,
            total_earned=0.0,
            total_redeemed=0.0
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet

def credit_reward_points(
    db: Session,
    user_id: str,
    points: float,
    transaction_type: str,
    reason: str,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
    created_by_id: Optional[str] = None
) -> RewardTransaction:
    """
    Credits reward points to a student's wallet and records an immutable ledger transaction.
    Prevents duplicate credits for the same qualifying event if related_entity_type and id are provided.
    """
    if points <= 0:
        raise ValueError("Points to credit must be positive.")

    # Deduplication check
    if related_entity_type and related_entity_id:
        existing = db.query(RewardTransaction).filter(
            RewardTransaction.user_id == user_id,
            RewardTransaction.transaction_type == transaction_type,
            RewardTransaction.related_entity_type == related_entity_type,
            RewardTransaction.related_entity_id == related_entity_id
        ).first()
        if existing:
            return existing

    config = get_or_create_reward_config(db)
    wallet = get_or_create_wallet(db, user_id)

    # 1 point = conversion_rate INR
    amount_inr = points * config.point_to_rupee_ratio

    tx = RewardTransaction(
        wallet_id=wallet.id,
        user_id=user_id,
        amount=amount_inr,
        points=points,
        conversion_rate=config.point_to_rupee_ratio,
        transaction_type=transaction_type,
        reason=reason,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        created_by_id=created_by_id
    )
    db.add(tx)

    wallet.balance += points
    wallet.total_earned += points
    wallet.updated_at = datetime.utcnow()

    # Create notification for student
    notif = Notification(
        user_id=user_id,
        title="Reward Points Received!",
        message=f"You received {points:.0f} reward points (₹{amount_inr:.0f} value): {reason}",
        link="/wallet"
    )
    db.add(notif)

    db.commit()
    db.refresh(tx)
    return tx

def debit_reward_points(
    db: Session,
    user_id: str,
    points: float,
    transaction_type: str,
    reason: str,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
    created_by_id: Optional[str] = None
) -> RewardTransaction:
    """
    Debits reward points from student wallet for redemption during program checkout.
    Ensures balance never becomes negative.
    """
    if points <= 0:
        raise ValueError("Points to debit must be positive.")

    wallet = get_or_create_wallet(db, user_id)
    if wallet.balance < points:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient reward points balance. Available: {wallet.balance:.0f}, requested: {points:.0f}"
        )

    config = get_or_create_reward_config(db)
    amount_inr = points * config.point_to_rupee_ratio

    tx = RewardTransaction(
        wallet_id=wallet.id,
        user_id=user_id,
        amount=-amount_inr,
        points=-points,
        conversion_rate=config.point_to_rupee_ratio,
        transaction_type=transaction_type,
        reason=reason,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        created_by_id=created_by_id
    )
    db.add(tx)

    wallet.balance -= points
    wallet.total_redeemed += points
    wallet.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(tx)
    return tx

def reverse_reward_points(
    db: Session,
    user_id: str,
    points: float,
    reason: str,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None
) -> RewardTransaction:
    """
    Reverses previously awarded points (e.g., when a referral purchase is refunded or cancelled).
    """
    wallet = get_or_create_wallet(db, user_id)
    config = get_or_create_reward_config(db)
    amount_inr = points * config.point_to_rupee_ratio

    tx = RewardTransaction(
        wallet_id=wallet.id,
        user_id=user_id,
        amount=-amount_inr,
        points=-points,
        conversion_rate=config.point_to_rupee_ratio,
        transaction_type="refund_reversal",
        reason=reason,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id
    )
    db.add(tx)

    wallet.balance = max(0.0, wallet.balance - points)
    wallet.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(tx)
    return tx
