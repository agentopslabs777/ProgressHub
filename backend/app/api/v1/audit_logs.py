from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import AuditLog, User
from backend.app.schemas.schemas import AuditLogResponse
from backend.app.permissions.permissions import require_admin

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    action: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if target_type:
        query = query.filter(AuditLog.target_type == target_type)

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [AuditLogResponse.model_validate(l) for l in logs]
