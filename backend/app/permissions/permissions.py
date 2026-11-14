from typing import List, Optional
from datetime import datetime
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.security import decode_token
from backend.app.models.models import User, AuditLog

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.role == "student" and user.access_expires_at and user.access_expires_at <= datetime.utcnow():
        if user.status != "blocked":
            user.status = "blocked"
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your student course access duration has expired. Please contact the administrator to extend your access.",
        )

    if user.status == "blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been blocked. Please contact the administrator.",
        )
    
    return user

def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role '{current_user.role}'",
            )
        return current_user
    return role_checker

require_admin = require_roles(["admin"])
require_employee = require_roles(["admin", "employee"])
require_student = require_roles(["student"])

def log_audit(
    db: Session,
    actor: Optional[User],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    details: Optional[str] = None,
    commit: bool = True
):
    try:
        actor_id = actor.id if actor else None
        actor_name = actor.full_name if actor else "System"
        audit = AuditLog(
            actor_id=actor_id,
            actor_name=actor_name,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details
        )
        db.add(audit)
        if commit:
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error logging audit: {e}")
