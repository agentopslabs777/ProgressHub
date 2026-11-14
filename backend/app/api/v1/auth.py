from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.config import settings
from backend.app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from backend.app.models.models import User, RefreshToken
from backend.app.schemas.schemas import LoginInput, TokenResponse, RefreshTokenInput, UserCreate, UserResponse
from backend.app.permissions.permissions import get_current_user, require_admin, log_audit

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(input_data: LoginInput, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == input_data.email.strip().lower()).first()
    if not user or not verify_password(input_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Check access validity for student accounts
    if user.role == "student" and user.access_expires_at and user.access_expires_at <= datetime.utcnow():
        if user.status != "blocked":
            user.status = "blocked"
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your student course access duration has expired. Please contact the administrator to extend your access."
        )

    if user.status == "blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been blocked. Please contact the administrator."
        )

    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token_str = create_refresh_token()
    
    # Store refresh token
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db_refresh = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=expires_at
    )
    db.add(db_refresh)
    db.commit()

    log_audit(db=db, actor=user, action="LOGIN", target_type="user", target_id=user.id)

    user_resp = UserResponse.model_validate(user)
    if user.role == "student" and user.access_duration and user.access_duration != "lifetime" and not user.access_expires_at:
        dur_days = {"1_month": 30, "6_months": 180, "1_year": 365}.get(user.access_duration, 30)
        user.access_expires_at = (user.created_at or datetime.utcnow()) + timedelta(days=dur_days)
        db.commit()
    if user.access_expires_at:
        delta = (user.access_expires_at - datetime.utcnow()).total_seconds()
        user_resp.days_left = max(0, int(delta // 86400) + (1 if delta % 86400 > 0 else 0))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        user=user_resp
    )

@router.post("/refresh")
def refresh_token(data: RefreshTokenInput, db: Session = Depends(get_db)):
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == data.refresh_token,
        RefreshToken.revoked == False
    ).first()

    if not db_token or db_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if user.role == "student" and user.access_expires_at and user.access_expires_at <= datetime.utcnow():
        if user.status != "blocked":
            user.status = "blocked"
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your student course access duration has expired. Please contact the administrator to extend your access."
        )

    if user.status == "blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is blocked or inactive"
        )

    # Rotate refresh token
    db_token.revoked = True
    new_refresh_str = create_refresh_token()
    new_expires = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    new_refresh = RefreshToken(user_id=user.id, token=new_refresh_str, expires_at=new_expires)
    db.add(new_refresh)
    db.commit()

    new_access_token = create_access_token(subject=user.id, role=user.role)
    user_resp = UserResponse.model_validate(user)
    if user.role == "student" and user.access_duration and user.access_duration != "lifetime" and not user.access_expires_at:
        dur_days = {"1_month": 30, "6_months": 180, "1_year": 365}.get(user.access_duration, 30)
        user.access_expires_at = (user.created_at or datetime.utcnow()) + timedelta(days=dur_days)
        db.commit()
    if user.access_expires_at:
        delta = (user.access_expires_at - datetime.utcnow()).total_seconds()
        user_resp.days_left = max(0, int(delta // 86400) + (1 if delta % 86400 > 0 else 0))

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_str,
        "token_type": "bearer",
        "user": user_resp
    }

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Revoke all active refresh tokens for user
    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).update({"revoked": True})
    db.commit()
    log_audit(db=db, actor=current_user, action="LOGOUT", target_type="user", target_id=current_user.id)
    return {"message": "Successfully logged out"}

class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str


@router.get("/me", response_model=UserResponse)
def get_current_account(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "student" and current_user.access_duration and current_user.access_duration != "lifetime" and not current_user.access_expires_at:
        dur_days = {"1_month": 30, "6_months": 180, "1_year": 365}.get(current_user.access_duration, 30)
        current_user.access_expires_at = (current_user.created_at or datetime.utcnow()) + timedelta(days=dur_days)
        db.commit()
    resp = UserResponse.model_validate(current_user)
    if current_user.access_expires_at:
        delta = (current_user.access_expires_at - datetime.utcnow()).total_seconds()
        resp.days_left = max(0, int(delta // 86400) + (1 if delta % 86400 > 0 else 0))
    return resp


@router.post("/change-password")
def change_admin_password(
    data: ChangePasswordInput,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if len(data.new_password.strip()) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters",
        )
    current_user.password_hash = get_password_hash(data.new_password)
    db.commit()
    log_audit(
        db=db,
        actor=current_user,
        action="CHANGE_ADMIN_PASSWORD",
        target_type="user",
        target_id=current_user.id,
        details="Admin changed own password",
    )
    return {"message": "Admin password updated successfully"}

@router.post("/setup-admin", response_model=TokenResponse)
def setup_first_admin(data: UserCreate, db: Session = Depends(get_db)):
    existing_admin = db.query(User).filter(User.role == "admin").first()
    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An administrator account already exists. Use the login page."
        )

    admin = User(
        email=data.email.strip().lower(),
        full_name=data.full_name.strip(),
        password_hash=get_password_hash(data.password),
        role="admin",
        status="active",
        identifier="ADMIN-001"
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    access_token = create_access_token(subject=admin.id, role=admin.role)
    refresh_token_str = create_refresh_token()
    db_refresh = RefreshToken(
        user_id=admin.id,
        token=refresh_token_str,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(db_refresh)
    db.commit()

    log_audit(db=db, actor=admin, action="SETUP_INITIAL_ADMIN", target_type="user", target_id=admin.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        user=UserResponse.model_validate(admin)
    )
