import secrets
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.db.session import get_db
from backend.app.models.models import ReferralCampaign, ReferralRecord, User, Notification
from backend.app.schemas.schemas import (
    ReferralCampaignCreate, ReferralCampaignUpdate, ReferralCampaignResponse,
    ReferralRecordCreate, ReferralRecordReview, ReferralRecordResponse
)
from backend.app.permissions.permissions import get_current_user, require_admin, require_employee, log_audit

router = APIRouter(prefix="/referrals", tags=["Referrals"])

@router.get("/my-info", response_model=dict)
def get_user_referral_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the student's or employee's unique referral code, shareable link assigned by admin,
    active campaign rules, calculated potential rewards, and guest list.
    """
    is_employee = (current_user.role == "employee")
    max_limit = None if is_employee else 5

    # Ensure user has a referral code & link assigned
    if not current_user.referral_code:
        clean_name = "".join(filter(str.isalnum, current_user.full_name))[:6].upper()
        prefix = "EMP" if is_employee else "STU"
        current_user.referral_code = f"{prefix}-{clean_name}-{secrets.token_hex(2).upper()}"
        current_user.referral_link = f"http://localhost:5173/login?ref={current_user.referral_code}"
        current_user.referral_link_approved = True
        db.commit()
    elif not current_user.referral_link:
        current_user.referral_link = f"http://localhost:5173/login?ref={current_user.referral_code}"
        current_user.referral_link_approved = True
        db.commit()

    campaign = db.query(ReferralCampaign).filter(ReferralCampaign.is_active == True).first()
    if not campaign:
        campaign = ReferralCampaign(
            name="General VIP Referral Campaign",
            headline="INVITE AND EARN",
            currency="₹",
            base_reward_amount=999.0,
            tier_reward_amount=799.20,
            vip_price=999.0,
            instructions="Share your unique referral link or WhatsApp invite with friends. Earn direct cash bonuses approved by Admin!",
            rungs_config='[{"count": 1, "title": "Friend 1", "reward": 999.0}, {"count": 2, "title": "Friend 2", "reward": 1798.2}, {"count": 3, "title": "Friend 3", "reward": 2597.4}, {"count": 4, "title": "Friend 4", "reward": 3396.6}, {"count": 5, "title": "Friend 5", "reward": 4195.8}, {"count": 10, "title": "Friend 10", "reward": 8193.0}, {"count": 20, "title": "Friend 20", "reward": 16187.0}]',
            is_active=True
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)

    # Fetch this user's referrals
    referrals = db.query(ReferralRecord).filter(
        ReferralRecord.referrer_id == current_user.id
    ).order_by(ReferralRecord.created_at.desc()).all()

    total_invites = len(referrals)
    claimed_count = sum(1 for r in referrals if r.funnel_stage in ("claimed", "came", "took_seat", "bought"))
    bought_count = sum(1 for r in referrals if r.funnel_stage == "bought")
    
    # Calculate earnings approved by admin
    earned_so_far = sum(r.reward_amount for r in referrals if r.reward_status in ("approved", "paid"))
    pending_rewards = sum(r.reward_amount for r in referrals if r.reward_status == "pending")

    return {
        "referral_code": current_user.referral_code,
        "referral_link": current_user.referral_link or f"http://localhost:5173/login?ref={current_user.referral_code}",
        "referral_link_approved": bool(current_user.referral_link_approved),
        "is_link_assigned_by_admin": bool(current_user.referral_link_approved),
        "user_role": current_user.role,
        "is_employee": is_employee,
        "max_friends_limit": max_limit,
        "whatsapp_share_text": f"Hey! I'm on this training platform. Use my official VIP referral link given by admin to get special access: {current_user.referral_link or f'http://localhost:5173/login?ref={current_user.referral_code}'}",
        "campaign": {
            "id": campaign.id,
            "headline": campaign.headline,
            "currency": campaign.currency,
            "base_reward_amount": campaign.base_reward_amount,
            "tier_reward_amount": campaign.tier_reward_amount,
            "vip_price": campaign.vip_price,
            "instructions": campaign.instructions,
            "rungs_config": campaign.rungs_config,
            "max_friends_limit": max_limit
        },
        "stats": {
            "total_invites": total_invites,
            "claimed_count": claimed_count,
            "bought_count": bought_count,
            "earned_so_far": earned_so_far,
            "pending_rewards": pending_rewards,
            "max_friends_limit": max_limit
        },
        "guests": [{
            "id": r.id,
            "name": r.referred_name or "Friend",
            "email": r.referred_email,
            "phone": r.referred_phone,
            "funnel_stage": r.funnel_stage,
            "reward_amount": r.reward_amount,
            "reward_status": r.reward_status,
            "reward_approved_at": r.reward_approved_at,
            "created_at": r.created_at
        } for r in referrals]
    }

from pydantic import BaseModel
from backend.app.services.reward_service import credit_reward_points

class WhatsAppShareRequest(BaseModel):
    friend_name: Optional[str] = None
    friend_phone: Optional[str] = None

@router.get("/leaderboard", response_model=List[dict])
def get_referral_leaderboard(
    db: Session = Depends(get_db)
):
    """
    Returns real top inviters from the database with podium bonus awards for Top 1, Top 2, and Top 3:
    - 1st Place: +500 Reward Points (₹500 INR)
    - 2nd Place: +300 Reward Points (₹300 INR)
    - 3rd Place: +150 Reward Points (₹150 INR)
    """
    results = db.query(
        ReferralRecord.referrer_id,
        func.count(ReferralRecord.id).label("total_referrals"),
        func.sum(ReferralRecord.reward_amount).label("total_earned")
    ).group_by(ReferralRecord.referrer_id).order_by(func.count(ReferralRecord.id).desc()).limit(10).all()

    podium_prizes = {
        1: (500.0, "🏆 Gold Champion: +500 Bonus Points (₹500)"),
        2: (300.0, "🥈 Silver Winner: +300 Bonus Points (₹300)"),
        3: (150.0, "🥉 Bronze Winner: +150 Bonus Points (₹150)")
    }

    leaderboard = []
    for rank, (ref_id, count, total_earned) in enumerate(results, start=1):
        user = db.query(User).filter(User.id == ref_id).first()
        if user:
            bonus_pts, bonus_label = podium_prizes.get(rank, (0.0, None))
            leaderboard.append({
                "rank": rank,
                "user_id": user.id,
                "name": user.full_name,
                "total_referrals": count,
                "total_earned": float(total_earned or 0.0),
                "bonus_points": bonus_pts,
                "bonus_label": bonus_label
            })

    return leaderboard

@router.post("/whatsapp-share", response_model=dict)
def log_whatsapp_referral_share(
    data: Optional[WhatsAppShareRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logs an invitation record when sharing on WhatsApp so it immediately appears
    in 'Your Guests & Referral Approval' list.
    """
    campaign = db.query(ReferralCampaign).filter(ReferralCampaign.is_active == True).first()

    # For students: enforce maximum 5 friends limit. Employees have NO limit on referrals!
    if current_user.role == "student":
        existing_count = db.query(ReferralRecord).filter(
            ReferralRecord.referrer_id == current_user.id
        ).count()
        if existing_count >= 5:
            raise HTTPException(
                status_code=400,
                detail="Maximum referral limit reached. Students can only refer up to 5 friends."
            )
    else:
        existing_count = db.query(ReferralRecord).filter(
            ReferralRecord.referrer_id == current_user.id
        ).count()

    base_amount = campaign.base_reward_amount if campaign else 999.0
    tier_amount = campaign.tier_reward_amount if campaign else 799.20
    assigned_reward = base_amount if existing_count == 0 else tier_amount

    name = (data.friend_name.strip() if data and data.friend_name and data.friend_name.strip() else f"WhatsApp Invite #{existing_count + 1}")
    phone = (data.friend_phone.strip() if data and data.friend_phone and data.friend_phone.strip() else "Shared via WhatsApp")

    record = ReferralRecord(
        campaign_id=campaign.id if campaign else None,
        referrer_id=current_user.id,
        referred_name=name,
        referred_email="",
        referred_phone=phone,
        referral_code=current_user.referral_code,
        funnel_stage="invite_sent",
        reward_amount=assigned_reward,
        reward_status="pending"
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    log_audit(
        db=db,
        actor=current_user,
        action="REFERRAL_WHATSAPP_SHARED",
        target_type="referral_record",
        target_id=record.id,
        details=f"Shared referral via WhatsApp to '{name}' ({phone})"
    )

    return {
        "id": record.id,
        "name": record.referred_name,
        "phone": record.referred_phone,
        "funnel_stage": record.funnel_stage,
        "reward_amount": record.reward_amount,
        "message": "WhatsApp invitation logged successfully in Your Guests list!"
    }

@router.post("/award-podium-bonus", response_model=dict)
def award_podium_bonus_points(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin can credit extra reward points to Top 1 (+500 pts), Top 2 (+300 pts), and Top 3 (+150 pts)
    directly to their wallets.
    """
    results = db.query(
        ReferralRecord.referrer_id,
        func.count(ReferralRecord.id).label("total_referrals")
    ).group_by(ReferralRecord.referrer_id).order_by(func.count(ReferralRecord.id).desc()).limit(3).all()

    prizes = [(1, 500.0, "1st Gold Podium"), (2, 300.0, "2nd Silver Podium"), (3, 150.0, "3rd Bronze Podium")]
    awarded = []

    for idx, (rank, pts, label) in enumerate(prizes):
        if idx < len(results):
            user_id = results[idx][0]
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                credit_reward_points(
                    db=db,
                    user_id=user.id,
                    points=pts,
                    transaction_type="referral_leaderboard_bonus",
                    reason=f"Referral Leaderboard {label} Bonus ({pts:.0f} pts)"
                )
                notif = Notification(
                    user_id=user.id,
                    title="🎉 Referral Leaderboard Podium Bonus!",
                    message=f"Congratulations! You won {label} on the Referral Leaderboard and received +{pts:.0f} reward points (₹{pts:.0f} INR)!",
                    link="/wallet"
                )
                db.add(notif)
                awarded.append({"rank": rank, "user_name": user.full_name, "points": pts})

    db.commit()
    return {
        "success": True,
        "awarded_count": len(awarded),
        "winners": awarded,
        "message": f"Successfully credited podium reward points to top {len(awarded)} inviters!"
    }

@router.post("/invite", response_model=dict)
def register_invited_friend(
    data: ReferralRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(ReferralCampaign).filter(ReferralCampaign.is_active == True).first()
    
    # For students: enforce maximum 5 friends limit. Employees have NO limit on referrals!
    if current_user.role == "student":
        existing_referrals_count = db.query(ReferralRecord).filter(
            ReferralRecord.referrer_id == current_user.id
        ).count()
        if existing_referrals_count >= 5:
            raise HTTPException(
                status_code=400,
                detail="Maximum referral limit reached. Students can only refer up to 5 friends."
            )
    else:
        existing_referrals_count = db.query(ReferralRecord).filter(
            ReferralRecord.referrer_id == current_user.id
        ).count()

    base_amount = campaign.base_reward_amount if campaign else 999.0
    tier_amount = campaign.tier_reward_amount if campaign else 799.20
    assigned_reward = base_amount if existing_referrals_count == 0 else tier_amount

    record = ReferralRecord(
        campaign_id=campaign.id if campaign else None,
        referrer_id=current_user.id,
        referred_name=data.referred_name,
        referred_email=data.referred_email,
        referred_phone=data.referred_phone,
        referral_code=data.referral_code or current_user.referral_code,
        funnel_stage=data.funnel_stage or "invited",
        reward_amount=assigned_reward,
        reward_status="pending"
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    log_audit(
        db=db,
        actor=current_user,
        action="REFERRAL_INVITE_SENT",
        target_type="referral_record",
        target_id=record.id,
        details=f"Invited friend '{record.referred_name}' ({record.referred_email}) [Referrer Role: {current_user.role}]"
    )

    return {
        "id": record.id,
        "name": record.referred_name,
        "funnel_stage": record.funnel_stage,
        "reward_amount": record.reward_amount,
        "message": "Friend invitation logged successfully"
    }

@router.post("/claim", response_model=dict)
def claim_referral_invitation(
    code: str,
    guest_name: Optional[str] = None,
    guest_email: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Invoked when a guest claims an invite code.
    """
    referrer = db.query(User).filter(User.referral_code == code.strip().upper()).first()
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    # Check if this friend was already invited by this referrer
    existing_invite = None
    if guest_email:
        existing_invite = db.query(ReferralRecord).filter(
            ReferralRecord.referrer_id == referrer.id,
            ReferralRecord.referred_email == guest_email
        ).first()

    if existing_invite:
        existing_invite.funnel_stage = "claimed"
        if guest_name:
            existing_invite.referred_name = guest_name
        db.commit()
    else:
        existing_referrals_count = db.query(ReferralRecord).filter(
            ReferralRecord.referrer_id == referrer.id
        ).count()

        # Enforce 5 friend limit ONLY for student referrers (Employees have NO limit!)
        if referrer.role == "student" and existing_referrals_count >= 5:
            raise HTTPException(
                status_code=400,
                detail="This student referral code has reached its maximum limit of 5 friends."
            )

        campaign = db.query(ReferralCampaign).filter(ReferralCampaign.is_active == True).first()
        base_amount = campaign.base_reward_amount if campaign else 999.0
        tier_amount = campaign.tier_reward_amount if campaign else 799.20
        assigned_reward = base_amount if existing_referrals_count == 0 else tier_amount

        record = ReferralRecord(
            campaign_id=campaign.id if campaign else None,
            referrer_id=referrer.id,
            referred_name=guest_name or "Guest Claimer",
            referred_email=guest_email,
            referral_code=code.strip().upper(),
            funnel_stage="claimed",
            reward_amount=assigned_reward,
            reward_status="pending"
        )
        db.add(record)
        db.commit()

    # Notify referrer
    notif = Notification(
        user_id=referrer.id,
        title="Referral Seat Claimed!",
        message=f"{guest_name or 'A friend'} claimed a seat using your referral code {code}!",
        link="/referrals"
    )
    db.add(notif)
    db.commit()

    return {"message": "Referral seat claimed successfully", "referrer_name": referrer.full_name}

# Admin Campaign Management
@router.get("/campaigns", response_model=List[ReferralCampaignResponse])
def list_campaigns(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return db.query(ReferralCampaign).order_by(ReferralCampaign.created_at.desc()).all()

@router.post("/campaigns", response_model=ReferralCampaignResponse)
def create_campaign(
    data: ReferralCampaignCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    camp = ReferralCampaign(
        program_id=data.program_id,
        name=data.name.strip(),
        headline=data.headline,
        currency=data.currency,
        base_reward_amount=data.base_reward_amount,
        tier_reward_amount=data.tier_reward_amount,
        vip_price=data.vip_price,
        instructions=data.instructions,
        rungs_config=data.rungs_config,
        is_active=data.is_active
    )
    db.add(camp)
    db.commit()
    db.refresh(camp)

    log_audit(
        db=db,
        actor=current_user,
        action="CREATE_REFERRAL_CAMPAIGN",
        target_type="referral_campaign",
        target_id=camp.id,
        details=f"Campaign '{camp.name}' created"
    )
    return camp

@router.patch("/campaigns/{campaign_id}", response_model=ReferralCampaignResponse)
def update_campaign(
    campaign_id: str,
    data: ReferralCampaignUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    camp = db.query(ReferralCampaign).filter(ReferralCampaign.id == campaign_id).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if data.name is not None:
        camp.name = data.name.strip()
    if data.headline is not None:
        camp.headline = data.headline
    if data.currency is not None:
        camp.currency = data.currency
    if data.base_reward_amount is not None:
        camp.base_reward_amount = data.base_reward_amount
    if data.tier_reward_amount is not None:
        camp.tier_reward_amount = data.tier_reward_amount
    if data.vip_price is not None:
        camp.vip_price = data.vip_price
    if data.instructions is not None:
        camp.instructions = data.instructions
    if data.rungs_config is not None:
        camp.rungs_config = data.rungs_config
    if data.is_active is not None:
        camp.is_active = data.is_active

    db.commit()
    db.refresh(camp)
    return camp

@router.get("/all", response_model=List[dict])
def list_all_referrals(
    status_filter: Optional[str] = None,
    role_filter: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(ReferralRecord)
    if status_filter:
        query = query.filter(ReferralRecord.reward_status == status_filter)
    if role_filter:
        query = query.join(User, ReferralRecord.referrer_id == User.id).filter(User.role == role_filter)

    records = query.order_by(ReferralRecord.created_at.desc()).all()
    results = []
    for r in records:
        ref = r.referrer
        results.append({
            "id": r.id,
            "campaign_id": r.campaign_id,
            "referrer_id": r.referrer_id,
            "referrer_name": ref.full_name if ref else "Unknown",
            "referrer_email": ref.email if ref else "",
            "referrer_role": ref.role if ref else "student",
            "referred_name": r.referred_name,
            "referred_email": r.referred_email,
            "referred_phone": r.referred_phone,
            "referral_code": r.referral_code,
            "funnel_stage": r.funnel_stage,
            "reward_amount": r.reward_amount,
            "reward_status": r.reward_status,
            "reward_approved_at": r.reward_approved_at,
            "created_at": r.created_at
        })
    return results

@router.post("/{record_id}/review", response_model=dict)
def review_referral_reward(
    record_id: str,
    data: ReferralRecordReview,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    record = db.query(ReferralRecord).filter(ReferralRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Referral record not found")

    record.reward_status = data.reward_status
    if data.reward_amount is not None:
        record.reward_amount = data.reward_amount
    record.reward_approved_at = datetime.utcnow()
    record.reward_approved_by = current_user.id

    db.commit()
    db.refresh(record)

    log_audit(
        db=db,
        actor=current_user,
        action="REVIEW_REFERRAL_REWARD",
        target_type="referral_record",
        target_id=record.id,
        details=f"Admin reviewed referral reward to '{record.reward_status}' (Amount: ₹{record.reward_amount})"
    )

    # Notify student or employee
    ref = record.referrer
    ref_title = "Admin Approved Your Referral Reward!" if record.reward_status == "approved" else "Referral Reward Status Update"
    notif = Notification(
        user_id=record.referrer_id,
        title=ref_title,
        message=f"Your referral bonus for {record.referred_name or 'a friend'} was marked as '{record.reward_status}' by Admin (Amount: ₹{record.reward_amount})",
        link="/referrals"
    )
    db.add(notif)
    db.commit()

    return {
        "id": record.id,
        "reward_status": record.reward_status,
        "reward_amount": record.reward_amount,
        "message": f"Referral reward marked as {record.reward_status}"
    }

@router.get("/user-links", response_model=List[dict])
def list_user_referral_links(
    role_filter: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to view all students and employees, their assigned referral links,
    and whether the links have been approved/given by admin.
    """
    query = db.query(User).filter(User.role.in_(["student", "employee"]))
    if role_filter:
        query = query.filter(User.role == role_filter)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(User.full_name.ilike(s) | User.email.ilike(s))

    users = query.order_by(User.role.asc(), User.full_name.asc()).all()
    results = []
    for u in users:
        # If user has no referral code yet, auto-provision
        if not u.referral_code:
            clean_name = "".join(filter(str.isalnum, u.full_name))[:6].upper()
            prefix = "EMP" if u.role == "employee" else "STU"
            u.referral_code = f"{prefix}-{clean_name}-{secrets.token_hex(2).upper()}"
            u.referral_link = f"http://localhost:5173/login?ref={u.referral_code}"
            u.referral_link_approved = True
            db.commit()

        total_invites = db.query(ReferralRecord).filter(ReferralRecord.referrer_id == u.id).count()
        approved_count = db.query(ReferralRecord).filter(
            ReferralRecord.referrer_id == u.id,
            ReferralRecord.reward_status.in_(["approved", "paid"])
        ).count()
        total_earned = db.query(func.sum(ReferralRecord.reward_amount)).filter(
            ReferralRecord.referrer_id == u.id,
            ReferralRecord.reward_status.in_(["approved", "paid"])
        ).scalar() or 0.0

        results.append({
            "id": u.id,
            "name": u.full_name,
            "email": u.email,
            "role": u.role,
            "referral_code": u.referral_code,
            "referral_link": u.referral_link or f"http://localhost:5173/login?ref={u.referral_code}",
            "referral_link_approved": bool(u.referral_link_approved),
            "total_invites": total_invites,
            "approved_count": approved_count,
            "total_earned": float(total_earned),
            "max_limit": "No Limit (Unlimited)" if u.role == "employee" else "5 Friends Max"
        })
    return results

@router.post("/user-links/{user_id}/assign", response_model=dict)
def assign_user_referral_link(
    user_id: str,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin assigns, generates, or approves the official referral invite link/code for a student or employee.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    code = data.get("referral_code")
    link = data.get("referral_link")
    approved = data.get("approved", True)

    if code and code.strip():
        new_code = code.strip().upper()
        # Check uniqueness if changed
        existing = db.query(User).filter(User.referral_code == new_code, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Referral code already in use by another user")
        target_user.referral_code = new_code
    elif not target_user.referral_code:
        clean_name = "".join(filter(str.isalnum, target_user.full_name))[:6].upper()
        prefix = "EMP" if target_user.role == "employee" else "STU"
        target_user.referral_code = f"{prefix}-{clean_name}-{secrets.token_hex(2).upper()}"

    if link and link.strip():
        target_user.referral_link = link.strip()
    else:
        target_user.referral_link = f"http://localhost:5173/login?ref={target_user.referral_code}"

    target_user.referral_link_approved = bool(approved)

    db.commit()
    db.refresh(target_user)

    log_audit(
        db=db,
        actor=current_user,
        action="ADMIN_ASSIGN_REFERRAL_LINK",
        target_type="user",
        target_id=target_user.id,
        details=f"Admin assigned official referral link {target_user.referral_link} to {target_user.full_name} ({target_user.role})"
    )

    notif = Notification(
        user_id=target_user.id,
        title="Official Referral Link Given by Admin",
        message=f"Admin has provided & approved your official referral invite link: {target_user.referral_link}. You can now share it and invite candidates!",
        link="/referrals"
    )
    db.add(notif)
    db.commit()

    return {
        "message": f"Referral link successfully assigned and approved for {target_user.full_name}",
        "user_id": target_user.id,
        "referral_code": target_user.referral_code,
        "referral_link": target_user.referral_link,
        "referral_link_approved": target_user.referral_link_approved
    }
