import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.models.models import (
    User, Program, Enrollment, ProgramPurchase, PaymentWebhookEvent,
    ReferralRecord, ReferralCampaign, Notification, RazorpaySetting
)
from backend.app.permissions.permissions import get_current_user, require_admin, log_audit
from backend.app.services.razorpay_service import (
    create_razorpay_order, verify_razorpay_signature, verify_webhook_signature,
    is_razorpay_configured, get_razorpay_credentials, test_razorpay_credentials
)
from backend.app.services.reward_service import (
    get_or_create_wallet, get_or_create_reward_config, debit_reward_points, credit_reward_points, reverse_reward_points
)

router = APIRouter(prefix="/payments", tags=["Payments & Checkout"])

class RazorpayConfigUpdateRequest(BaseModel):
    key_id: str
    key_secret: Optional[str] = None
    webhook_secret: Optional[str] = None
    is_test_mode: Optional[bool] = True
    account_name: Optional[str] = "Razorpay Standard Account"

class CreateOrderRequest(BaseModel):
    program_id: str
    points_to_redeem: Optional[float] = 0.0
    referral_code: Optional[str] = None

class VerifyPaymentRequest(BaseModel):
    purchase_id: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None

@router.get("/config", response_model=dict)
def get_payment_client_config(db: Session = Depends(get_db)):
    """
    Returns public Razorpay Key ID for frontend checkout.
    Secret is NEVER exposed to the frontend.
    """
    key_id, _, _, is_test = get_razorpay_credentials(db)
    return {
        "is_configured": bool(key_id),
        "key_id": key_id,
        "razorpay_key_id": key_id,
        "currency": "INR",
        "is_test_mode": is_test
    }

@router.get("/admin/razorpay-config", response_model=dict)
def get_admin_razorpay_config(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only endpoint to inspect current Razorpay connection credentials.
    """
    cfg = db.query(RazorpaySetting).filter(RazorpaySetting.is_active == True).first()
    key_id, key_sec, wh_sec, is_test = get_razorpay_credentials(db)
    return {
        "is_connected": bool(key_id and key_sec),
        "key_id": key_id,
        "has_secret": bool(key_sec),
        "masked_secret": (key_sec[:4] + "••••••••" + key_sec[-4:]) if len(key_sec) >= 8 else ("••••••••" if key_sec else ""),
        "webhook_secret": wh_sec or "",
        "is_test_mode": cfg.is_test_mode if cfg else is_test,
        "account_name": cfg.account_name if cfg else "Razorpay Standard Account",
        "updated_at": cfg.updated_at if cfg else None
    }

@router.post("/admin/razorpay-config", response_model=dict)
def update_admin_razorpay_config(
    data: RazorpayConfigUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin can directly connect and save their Razorpay Key ID, Key Secret, and Webhook Secret.
    """
    cfg = db.query(RazorpaySetting).first()
    if not cfg:
        if not data.key_secret or not data.key_secret.strip():
            raise HTTPException(
                status_code=400,
                detail="Razorpay Key Secret is required to connect your account."
            )
        cfg = RazorpaySetting(
            key_id=data.key_id.strip(),
            key_secret=data.key_secret.strip(),
            webhook_secret=data.webhook_secret.strip() if data.webhook_secret else "",
            is_active=True,
            is_test_mode=data.is_test_mode if data.is_test_mode is not None else True,
            account_name=data.account_name or "Razorpay Standard Account"
        )
        db.add(cfg)
    else:
        cfg.key_id = data.key_id.strip()
        if data.key_secret and data.key_secret.strip():
            cfg.key_secret = data.key_secret.strip()
        elif not cfg.key_secret:
            raise HTTPException(
                status_code=400,
                detail="Razorpay Key Secret is required to connect your account."
            )
        if data.webhook_secret is not None:
            cfg.webhook_secret = data.webhook_secret.strip()
        if data.is_test_mode is not None:
            cfg.is_test_mode = data.is_test_mode
        if data.account_name:
            cfg.account_name = data.account_name.strip()
        cfg.is_active = True

    db.commit()
    db.refresh(cfg)

    log_audit(
        db=db,
        actor=current_user,
        action="CONNECT_RAZORPAY_ACCOUNT",
        target_type="razorpay_setting",
        target_id=cfg.id,
        details=f"Connected Razorpay account key {cfg.key_id[:8]}... (test_mode={cfg.is_test_mode})"
    )

    return {
        "success": True,
        "message": "Razorpay account connection saved successfully.",
        "is_connected": bool(cfg.key_id and cfg.key_secret),
        "key_id": cfg.key_id,
        "is_test_mode": cfg.is_test_mode
    }

@router.post("/admin/test-connection", response_model=dict)
async def test_admin_razorpay_connection(
    data: RazorpayConfigUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Tests live authentication against Razorpay Orders API.
    """
    key_id = data.key_id.strip()
    key_sec = data.key_secret.strip() if data.key_secret else ""
    if not key_sec:
        cfg = db.query(RazorpaySetting).first()
        if cfg and cfg.key_secret:
            key_sec = cfg.key_secret
        else:
            key_sec = settings.RAZORPAY_KEY_SECRET

    success, message = await test_razorpay_credentials(key_id, key_sec)
    return {"success": success, "message": message}

@router.get("/programs", response_model=List[dict])
def list_purchasable_programs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists published programs available for enrollment and purchase.
    """
    programs = db.query(Program).filter(Program.status == "published").all()
    wallet = get_or_create_wallet(db, current_user.id)
    config = get_or_create_reward_config(db)

    # Check already enrolled
    enrolled_pids = {
        e.program_id for e in db.query(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.status == "active"
        ).all()
    }

    results = []
    for p in programs:
        price = getattr(p, "price", 2000.0) or 2000.0
        bonus_pts = getattr(p, "referral_bonus_points", 500.0) or 500.0
        allow_redemption = getattr(p, "allow_redemption", True)

        max_redeem_pts = min(wallet.balance, price / config.point_to_rupee_ratio) if allow_redemption else 0.0
        max_discount = max_redeem_pts * config.point_to_rupee_ratio

        results.append({
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "description": p.description,
            "price": price,
            "allow_redemption": allow_redemption,
            "referral_bonus_points": bonus_pts,
            "is_enrolled": p.id in enrolled_pids,
            "user_wallet_balance": wallet.balance,
            "user_wallet_inr": wallet.balance * config.point_to_rupee_ratio,
            "max_redeemable_points": max_redeem_pts,
            "max_discount_inr": max_discount
        })
    return results

@router.post("/create-order", response_model=dict)
async def create_purchase_order(
    data: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    program = db.query(Program).filter(Program.id == data.program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    # Check if already active enrolled
    existing_enr = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.program_id == program.id,
        Enrollment.status == "active"
    ).first()
    if existing_enr:
        raise HTTPException(status_code=400, detail="You are already enrolled in this program.")

    original_price = float(getattr(program, "price", 2000.0) or 2000.0)
    config = get_or_create_reward_config(db)
    wallet = get_or_create_wallet(db, current_user.id)

    # Validate points redemption
    points_to_redeem = float(data.points_to_redeem or 0.0)
    if points_to_redeem < 0:
        raise HTTPException(status_code=400, detail="Points to redeem cannot be negative.")

    if points_to_redeem > 0:
        if not config.allow_redemption or not getattr(program, "allow_redemption", True):
            raise HTTPException(status_code=400, detail="Reward points redemption is disabled for this program.")

        if points_to_redeem > wallet.balance:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot redeem {points_to_redeem:.0f} points. Your available balance is {wallet.balance:.0f} points."
            )

        max_inr_discount = original_price * (getattr(program, "max_redemption_percent", 100.0) / 100.0)
        max_possible_points = max_inr_discount / config.point_to_rupee_ratio
        if points_to_redeem > max_possible_points:
            points_to_redeem = max_possible_points

    discount_inr = points_to_redeem * config.point_to_rupee_ratio
    final_amount = max(0.0, round(original_price - discount_inr, 2))

    # Check referral code attribution
    referrer_id = None
    cleaned_ref_code = None
    if data.referral_code and data.referral_code.strip():
        cleaned_ref_code = data.referral_code.strip().upper()
        ref_user = db.query(User).filter(User.referral_code == cleaned_ref_code).first()
        if ref_user and ref_user.id != current_user.id:
            referrer_id = ref_user.id

    # Create ProgramPurchase record
    purchase = ProgramPurchase(
        student_id=current_user.id,
        program_id=program.id,
        original_price=original_price,
        points_redeemed=points_to_redeem,
        discount_amount=discount_inr,
        final_amount=final_amount,
        currency="INR",
        payment_method="reward_points" if final_amount == 0 else "razorpay",
        payment_status="created",
        referral_code_used=cleaned_ref_code,
        referrer_id=referrer_id
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)

    # If amount is 0 (fully paid via reward points)
    if final_amount == 0:
        if points_to_redeem > 0:
            debit_reward_points(
                db=db,
                user_id=current_user.id,
                points=points_to_redeem,
                transaction_type="program_redemption",
                reason=f"Redeemed for {program.name} 100% scholarship purchase",
                related_entity_type="program_purchase",
                related_entity_id=purchase.id
            )

        purchase.payment_status = "paid"
        purchase.paid_at = datetime.utcnow()

        # Enroll student immediately with compulsory supporting teacher assignment
        default_emp = db.query(User).filter(User.role == "employee", User.status == "active").first()
        enrollment = Enrollment(
            student_id=current_user.id,
            program_id=program.id,
            employee_id=default_emp.id if default_emp else None,
            status="active"
        )
        db.add(enrollment)
        db.commit()

        # Credit referral if applicable
        if referrer_id:
            bonus = getattr(program, "referral_bonus_points", 500.0) or 500.0
            credit_reward_points(
                db=db,
                user_id=referrer_id,
                points=bonus,
                transaction_type="referral_bonus",
                reason=f"Referral bonus: Friend {current_user.full_name} enrolled in {program.name}",
                related_entity_type="program_purchase",
                related_entity_id=purchase.id
            )
            purchase.referral_reward_credited = True
            db.commit()

        return {
            "purchase_id": purchase.id,
            "is_free_or_fully_redeemed": True,
            "final_amount": 0,
            "message": "Program purchase completed successfully using reward points!"
        }

    # Otherwise, create Razorpay Order
    rzp_order = await create_razorpay_order(
        amount_inr=final_amount,
        receipt=f"PUR-{purchase.id[:8].upper()}",
        notes={
            "purchase_id": purchase.id,
            "program_id": program.id,
            "student_id": current_user.id,
            "referral_code": cleaned_ref_code or ""
        },
        db=db
    )

    purchase.razorpay_order_id = rzp_order["id"]
    db.commit()

    active_key_id, _, _, _ = get_razorpay_credentials(db)

    return {
        "purchase_id": purchase.id,
        "is_free_or_fully_redeemed": False,
        "razorpay_order_id": rzp_order["id"],
        "razorpay_key_id": active_key_id,
        "amount": rzp_order["amount"],  # in paise
        "amount_inr": final_amount,
        "currency": "INR",
        "program_name": program.name,
        "customer_name": current_user.full_name,
        "customer_email": current_user.email,
        "customer_phone": current_user.contact_number or ""
    }

@router.post("/verify", response_model=dict)
def verify_payment(
    data: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    purchase = db.query(ProgramPurchase).filter(ProgramPurchase.id == data.purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase record not found")

    if purchase.payment_status == "paid":
        return {"message": "Payment already verified and enrolled successfully", "purchase_id": purchase.id}

    # Verify signature
    valid = verify_razorpay_signature(
        razorpay_order_id=data.razorpay_order_id,
        razorpay_payment_id=data.razorpay_payment_id,
        razorpay_signature=data.razorpay_signature
    )

    if not valid:
        purchase.payment_status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature.")

    # Deduct redeemed points if any
    if purchase.points_redeemed > 0:
        debit_reward_points(
            db=db,
            user_id=purchase.student_id,
            points=purchase.points_redeemed,
            transaction_type="program_redemption",
            reason=f"Redeemed for {purchase.program.name} purchase",
            related_entity_type="program_purchase",
            related_entity_id=purchase.id
        )

    # Mark purchase paid
    purchase.payment_status = "paid"
    purchase.razorpay_payment_id = data.razorpay_payment_id
    purchase.razorpay_signature = data.razorpay_signature
    purchase.paid_at = datetime.utcnow()

    # Enroll student if not already enrolled
    existing_enr = db.query(Enrollment).filter(
        Enrollment.student_id == purchase.student_id,
        Enrollment.program_id == purchase.program_id
    ).first()

    if not existing_enr:
        default_emp = db.query(User).filter(User.role == "employee", User.status == "active").first()
        enrollment = Enrollment(
            student_id=purchase.student_id,
            program_id=purchase.program_id,
            employee_id=default_emp.id if default_emp else None,
            status="active"
        )
        db.add(enrollment)
    elif existing_enr.status != "active":
        if not existing_enr.employee_id:
            default_emp = db.query(User).filter(User.role == "employee", User.status == "active").first()
            existing_enr.employee_id = default_emp.id if default_emp else None
        existing_enr.status = "active"

    db.commit()

    # Award referral reward points to referring student
    if purchase.referrer_id and not purchase.referral_reward_credited:
        bonus = getattr(purchase.program, "referral_bonus_points", 500.0) or 500.0
        credit_reward_points(
            db=db,
            user_id=purchase.referrer_id,
            points=bonus,
            transaction_type="referral_bonus",
            reason=f"Referral bonus: Friend {current_user.full_name} purchased {purchase.program.name}",
            related_entity_type="program_purchase",
            related_entity_id=purchase.id
        )
        purchase.referral_reward_credited = True

        # Update ReferralRecord funnel stage if matched
        ref_rec = db.query(ReferralRecord).filter(
            ReferralRecord.referrer_id == purchase.referrer_id,
            ReferralRecord.referred_email == current_user.email
        ).first()
        if ref_rec:
            ref_rec.funnel_stage = "bought"
            ref_rec.reward_amount = bonus
            ref_rec.reward_status = "approved"
            ref_rec.reward_approved_at = datetime.utcnow()

        db.commit()

    log_audit(
        db=db,
        actor=current_user,
        action="PROGRAM_PURCHASE_COMPLETED",
        target_type="program_purchase",
        target_id=purchase.id,
        details=f"Payment verified for {purchase.program.name}. Paid: ₹{purchase.final_amount}, Redeemed: {purchase.points_redeemed} pts"
    )

    return {
        "message": "Payment verified and program access activated successfully!",
        "purchase_id": purchase.id,
        "program_id": purchase.program_id,
        "program_name": purchase.program.name
    }

@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Secure webhook endpoint for asynchronous payment capture, payment failures, and refunds.
    Verifies X-Razorpay-Signature and guarantees idempotent duplicate protection.
    """
    raw_body = await request.body()

    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header.")

    if not verify_webhook_signature(raw_body, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    try:
        event_data = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON in webhook body.")

    event_id = event_data.get("event_id") or event_data.get("id") or str(datetime.utcnow().timestamp())
    event_type = event_data.get("event", "unknown")

    # Idempotency check
    existing_event = db.query(PaymentWebhookEvent).filter(PaymentWebhookEvent.event_id == event_id).first()
    if existing_event:
        return {"status": "ok", "message": "Duplicate event already processed"}

    webhook_record = PaymentWebhookEvent(
        event_id=event_id,
        event_type=event_type,
        payload=raw_body.decode("utf-8")[:3000],
        status="processed"
    )
    db.add(webhook_record)
    db.commit()

    # Handle payment.captured / order.paid
    if event_type in ("payment.captured", "order.paid"):
        payment_entity = event_data.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment_entity.get("order_id")
        payment_id = payment_entity.get("id")

        if order_id:
            purchase = db.query(ProgramPurchase).filter(ProgramPurchase.razorpay_order_id == order_id).first()
            if purchase and purchase.payment_status != "paid":
                purchase.payment_status = "paid"
                purchase.razorpay_payment_id = payment_id
                purchase.paid_at = datetime.utcnow()

                # Enroll student
                existing_enr = db.query(Enrollment).filter(
                    Enrollment.student_id == purchase.student_id,
                    Enrollment.program_id == purchase.program_id
                ).first()
                if not existing_enr:
                    db.add(Enrollment(student_id=purchase.student_id, program_id=purchase.program_id, status="active"))
                elif existing_enr.status != "active":
                    existing_enr.status = "active"

                # Deduct redeemed points
                if purchase.points_redeemed > 0:
                    debit_reward_points(
                        db=db,
                        user_id=purchase.student_id,
                        points=purchase.points_redeemed,
                        transaction_type="program_redemption",
                        reason=f"Redeemed for {purchase.program.name} purchase",
                        related_entity_type="program_purchase",
                        related_entity_id=purchase.id
                    )

                # Award referral points
                if purchase.referrer_id and not purchase.referral_reward_credited:
                    bonus = getattr(purchase.program, "referral_bonus_points", 500.0) or 500.0
                    credit_reward_points(
                        db=db,
                        user_id=purchase.referrer_id,
                        points=bonus,
                        transaction_type="referral_bonus",
                        reason=f"Referral bonus: Friend enrolled in {purchase.program.name}",
                        related_entity_type="program_purchase",
                        related_entity_id=purchase.id
                    )
                    purchase.referral_reward_credited = True

                db.commit()

    # Handle refund.created
    elif event_type in ("refund.created", "refund.processed"):
        payment_entity = event_data.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment_entity.get("order_id")
        if order_id:
            purchase = db.query(ProgramPurchase).filter(ProgramPurchase.razorpay_order_id == order_id).first()
            if purchase and purchase.payment_status == "paid":
                purchase.payment_status = "refunded"
                purchase.refunded_at = datetime.utcnow()

                # Reverse referral points if they were credited
                if purchase.referrer_id and purchase.referral_reward_credited:
                    bonus = getattr(purchase.program, "referral_bonus_points", 500.0) or 500.0
                    reverse_reward_points(
                        db=db,
                        user_id=purchase.referrer_id,
                        points=bonus,
                        reason=f"Reversed referral bonus due to refund for {purchase.program.name}",
                        related_entity_type="program_purchase",
                        related_entity_id=purchase.id
                    )
                    purchase.referral_reward_credited = False

                # Restore student's redeemed points
                if purchase.points_redeemed > 0:
                    credit_reward_points(
                        db=db,
                        user_id=purchase.student_id,
                        points=purchase.points_redeemed,
                        transaction_type="admin_adjustment",
                        reason=f"Restored reward points due to refunded purchase of {purchase.program.name}",
                        related_entity_type="program_purchase",
                        related_entity_id=purchase.id
                    )

                db.commit()

    return {"status": "ok", "event": event_type}

@router.get("/history", response_model=List[dict])
def get_user_payment_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    purchases = db.query(ProgramPurchase).filter(
        ProgramPurchase.student_id == current_user.id
    ).order_by(ProgramPurchase.created_at.desc()).all()

    return [{
        "id": p.id,
        "program_id": p.program_id,
        "program_name": p.program.name if p.program else "Program",
        "program_code": p.program.code if p.program else "",
        "original_price": p.original_price,
        "points_redeemed": p.points_redeemed,
        "discount_amount": p.discount_amount,
        "final_amount": p.final_amount,
        "currency": p.currency,
        "payment_method": p.payment_method,
        "payment_status": p.payment_status,
        "razorpay_order_id": p.razorpay_order_id,
        "razorpay_payment_id": p.razorpay_payment_id,
        "created_at": p.created_at,
        "paid_at": p.paid_at
    } for p in purchases]

@router.get("/all", response_model=List[dict])
def list_all_payments_admin(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    purchases = db.query(ProgramPurchase).order_by(ProgramPurchase.created_at.desc()).all()
    return [{
        "id": p.id,
        "student_id": p.student_id,
        "student_name": p.student.full_name if p.student else "Student",
        "student_email": p.student.email if p.student else "",
        "program_id": p.program_id,
        "program_name": p.program.name if p.program else "Program",
        "original_price": p.original_price,
        "points_redeemed": p.points_redeemed,
        "discount_amount": p.discount_amount,
        "final_amount": p.final_amount,
        "payment_status": p.payment_status,
        "referral_code_used": p.referral_code_used,
        "referrer_name": p.referrer.full_name if p.referrer else None,
        "referral_reward_credited": p.referral_reward_credited,
        "razorpay_order_id": p.razorpay_order_id,
        "razorpay_payment_id": p.razorpay_payment_id,
        "created_at": p.created_at,
        "paid_at": p.paid_at
    } for p in purchases]
