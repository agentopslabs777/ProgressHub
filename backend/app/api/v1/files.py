import os
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.config import settings
from backend.app.models.models import UploadedFile, TaskSubmission, Enrollment, User
from backend.app.permissions.permissions import get_current_user, log_audit

router = APIRouter(prefix="/files", tags=["File Storage"])

ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "zip", "png", "jpg", "jpeg", "txt", "csv", "xlsx"}

@router.post("/upload", response_model=dict)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    original_name = file.filename or "upload"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File extension '.{ext}' is not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Generate unique stored filename
    stored_name = f"{uuid.uuid4()}.{ext}"
    target_path = settings.UPLOAD_DIR / stored_name

    # Save to private disk
    size = 0
    with target_path.open("wb") as buffer:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            size += len(chunk)
            if size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                buffer.close()
                target_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"File size exceeds maximum permitted limit of {settings.MAX_UPLOAD_SIZE_MB}MB"
                )
            buffer.write(chunk)

    uploaded_record = UploadedFile(
        original_name=original_name,
        stored_name=stored_name,
        file_path=str(target_path),
        file_size=size,
        content_type=file.content_type or "application/octet-stream",
        uploaded_by_id=current_user.id
    )
    db.add(uploaded_record)
    db.commit()
    db.refresh(uploaded_record)

    log_audit(
        db=db,
        actor=current_user,
        action="UPLOAD_FILE",
        target_type="uploaded_file",
        target_id=uploaded_record.id,
        details=f"File '{original_name}' ({size} bytes) uploaded"
    )

    return {
        "file_id": uploaded_record.id,
        "original_name": uploaded_record.original_name,
        "file_size": uploaded_record.file_size
    }

@router.get("/{file_id}/download")
def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Permission check:
    # 1. Admin can download any file
    # 2. Uploader can download their own file
    # 3. If employee, can download if file is attached to a submission of an assigned student
    authorized = False
    if current_user.role == "admin" or file_record.uploaded_by_id == current_user.id:
        authorized = True
    elif current_user.role == "employee":
        sub = db.query(TaskSubmission).join(Enrollment).filter(
            TaskSubmission.file_id == file_record.id,
            Enrollment.employee_id == current_user.id
        ).first()
        if sub:
            authorized = True

    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this private file"
        )

    file_path = Path(file_record.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File on disk not found")

    return FileResponse(
        path=str(file_path),
        filename=file_record.original_name,
        media_type=file_record.content_type
    )
