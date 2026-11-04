from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from backend.app.db.session import get_db, SessionLocal
from backend.app.models.models import Conversation, ChatMessage, User, Enrollment, Notification, Program, AuditLog
from backend.app.schemas.schemas import ChatMessageCreate
from backend.app.permissions.permissions import get_current_user, log_audit
from backend.app.core.security import decode_token
from backend.app.websocket.chat_ws import chat_manager

router = APIRouter(prefix="/chat", tags=["Chat & Messaging"])

class CreateConversationRequest(BaseModel):
    student_id: Optional[str] = None
    employee_id: Optional[str] = None
    program_id: Optional[str] = None
    contact_admin: Optional[bool] = False

def verify_conversation_access(db: Session, user: User, conversation_id: str, log_admin_audit: bool = False) -> Conversation:
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if user.role != "admin" and user.id not in [conv.student_id, conv.employee_id]:
        raise HTTPException(status_code=403, detail="You do not have access to this conversation")

    if user.role == "admin" and log_admin_audit and user.id not in [conv.student_id, conv.employee_id]:
        log_audit(
            db=db,
            actor=user,
            action="ADMIN_INSPECT_CONVERSATION",
            target_type="conversation",
            target_id=conv.id,
            details=f"Admin inspected conversation between {conv.student.full_name if conv.student else 'Student'} and {conv.employee.full_name if conv.employee else 'Staff'}"
        )

    return conv

@router.get("/conversations", response_model=List[dict])
def list_conversations(
    search: Optional[str] = None,
    program_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Conversation)

    if current_user.role == "student":
        query = query.filter(Conversation.student_id == current_user.id)
    elif current_user.role == "employee":
        query = query.filter(
            or_(
                Conversation.employee_id == current_user.id,
                Conversation.student_id == current_user.id
            )
        )
    # Admin has access to all conversations

    if program_id:
        query = query.filter(Conversation.program_id == program_id)

    conversations = query.order_by(Conversation.updated_at.desc()).all()
    results = []

    search_q = search.lower().strip() if search else None

    for c in conversations:
        stu_name = c.student.full_name if c.student else "Student"
        emp_name = c.employee.full_name if c.employee else "Teacher"
        prog_name = c.program.name if c.program else None

        if search_q:
            match_stu = search_q in stu_name.lower() or (c.student and search_q in c.student.email.lower())
            match_emp = search_q in emp_name.lower() or (c.employee and search_q in c.employee.email.lower())
            match_prog = prog_name and search_q in prog_name.lower()
            if not (match_stu or match_emp or match_prog):
                continue

        last_msg = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == c.id
        ).order_by(ChatMessage.created_at.desc()).first()

        unread = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == c.id,
            ChatMessage.sender_id != current_user.id,
            ChatMessage.is_read == False
        ).count()

        results.append({
            "id": c.id,
            "student_id": c.student_id,
            "student_name": stu_name,
            "student_email": c.student.email if c.student else "",
            "employee_id": c.employee_id,
            "employee_name": emp_name,
            "employee_role": c.employee.role if c.employee else "employee",
            "program_id": c.program_id,
            "program_name": prog_name,
            "last_message": last_msg.message_text if last_msg else None,
            "last_message_at": last_msg.created_at if last_msg else c.created_at,
            "unread_count": unread
        })

    return results

@router.get("/contacts", response_model=dict)
def get_user_chat_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns authorized contacts strictly adhering to platform communication policy:
    - Student: ONLY assigned supporting teachers (employees).
    - Employee: Admin AND assigned students.
    - Admin: All registered students AND employees.
    """
    if current_user.role == "student":
        # Students ONLY chat with their assigned employees
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.status == "active",
            Enrollment.employee_id != None
        ).all()

        assigned_teachers = []
        seen = set()
        for e in enrollments:
            if e.employee and e.employee.id not in seen:
                seen.add(e.employee.id)
                assigned_teachers.append({
                    "id": e.employee.id,
                    "name": e.employee.full_name,
                    "email": e.employee.email,
                    "role": e.employee.role,
                    "program_name": e.program.name if e.program else None,
                    "program_id": e.program_id
                })

        return {
            "assigned_teachers": assigned_teachers,
            "admin_contact": None  # Students cannot contact admin directly
        }

    elif current_user.role == "employee":
        # Employees chat with assigned students AND admin
        enrollments = db.query(Enrollment).filter(
            Enrollment.employee_id == current_user.id,
            Enrollment.status == "active"
        ).all()

        assigned_students = []
        seen = set()
        for e in enrollments:
            if e.student and e.student.id not in seen:
                seen.add(e.student.id)
                assigned_students.append({
                    "id": e.student.id,
                    "name": e.student.full_name,
                    "email": e.student.email,
                    "role": e.student.role,
                    "program_name": e.program.name if e.program else None,
                    "program_id": e.program_id
                })

        admin_user = db.query(User).filter(User.role == "admin", User.status == "active").first()
        admin_info = None
        if admin_user:
            admin_info = {
                "id": admin_user.id,
                "name": f"Platform Admin ({admin_user.full_name})",
                "email": admin_user.email,
                "role": "admin"
            }

        return {
            "assigned_students": assigned_students,
            "admin_contact": admin_info
        }

    else:  # Admin
        # Admin can chat with all registered students AND all employees
        students = db.query(User).filter(User.role == "student", User.status == "active").all()
        employees = db.query(User).filter(User.role == "employee", User.status == "active").all()
        return {
            "students": [{"id": s.id, "name": s.full_name, "email": s.email, "role": s.role} for s in students],
            "employees": [{"id": e.id, "name": e.full_name, "email": e.email, "role": e.role} for e in employees]
        }

@router.post("/conversations", response_model=dict)
def get_or_create_conversation(
    data: Optional[CreateConversationRequest] = None,
    student_id: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    program_id: Optional[str] = Query(None),
    contact_admin: Optional[bool] = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req_student_id = (data.student_id if data and data.student_id else None) or student_id
    req_employee_id = (data.employee_id if data and data.employee_id else None) or employee_id
    req_program_id = (data.program_id if data and data.program_id else None) or program_id
    req_contact_admin = (data.contact_admin if data and data.contact_admin is not None else False) or contact_admin

    if current_user.role == "student":
        req_student_id = current_user.id
        if not req_employee_id:
            # Find assigned employee from active enrollment
            enrollment = db.query(Enrollment).filter(
                Enrollment.student_id == current_user.id,
                Enrollment.status == "active",
                Enrollment.employee_id != None
            ).first()
            if not enrollment or not enrollment.employee_id:
                raise HTTPException(status_code=400, detail="You do not have an assigned supporting teacher yet.")
            req_employee_id = enrollment.employee_id
            req_program_id = enrollment.program_id
        else:
            # Verify employee is indeed assigned to this student
            enr = db.query(Enrollment).filter(
                Enrollment.student_id == current_user.id,
                Enrollment.employee_id == req_employee_id,
                Enrollment.status == "active"
            ).first()
            if not enr:
                raise HTTPException(status_code=403, detail="Students can only message their assigned supporting teacher.")
            if not req_program_id:
                req_program_id = enr.program_id

    elif current_user.role == "employee":
        if req_contact_admin:
            admin = db.query(User).filter(User.role == "admin", User.status == "active").first()
            if not admin:
                raise HTTPException(status_code=404, detail="No active admin available.")
            req_student_id = current_user.id
            req_employee_id = admin.id
        else:
            req_employee_id = current_user.id
            if not req_student_id:
                raise HTTPException(status_code=400, detail="Student ID required.")
            # Verify student is assigned to this employee
            enr = db.query(Enrollment).filter(
                Enrollment.student_id == req_student_id,
                Enrollment.employee_id == current_user.id,
                Enrollment.status == "active"
            ).first()
            if not enr:
                raise HTTPException(status_code=403, detail="Employees can only message students assigned to them.")
            if not req_program_id:
                req_program_id = enr.program_id

    else:  # Admin
        if not req_student_id and not req_employee_id:
            raise HTTPException(status_code=400, detail="Must provide student_id or employee_id to contact.")
        if req_student_id and not req_employee_id:
            req_employee_id = current_user.id
        elif req_employee_id and not req_student_id:
            req_student_id = current_user.id

    conv = db.query(Conversation).filter(
        Conversation.student_id == req_student_id,
        Conversation.employee_id == req_employee_id
    ).first()

    if not conv:
        conv = Conversation(
            student_id=req_student_id,
            employee_id=req_employee_id,
            program_id=req_program_id
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    stu_name = conv.student.full_name if conv.student else "Student"
    emp_name = conv.employee.full_name if conv.employee else "Teacher"
    prog_name = conv.program.name if conv.program else None

    last_msg = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conv.id
    ).order_by(ChatMessage.created_at.desc()).first()

    return {
        "id": conv.id,
        "student_id": conv.student_id,
        "student_name": stu_name,
        "student_email": conv.student.email if conv.student else "",
        "employee_id": conv.employee_id,
        "employee_name": emp_name,
        "employee_role": conv.employee.role if conv.employee else "employee",
        "program_id": conv.program_id,
        "program_name": prog_name,
        "last_message": last_msg.message_text if last_msg else None,
        "last_message_at": last_msg.created_at if last_msg else conv.created_at,
        "unread_count": 0
    }

@router.get("/conversations/{conversation_id}/messages", response_model=List[dict])
def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = verify_conversation_access(db, current_user, conversation_id, log_admin_audit=True)

    # Mark unread messages as read
    db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conv.id,
        ChatMessage.sender_id != current_user.id,
        ChatMessage.is_read == False
    ).update({"is_read": True})
    db.commit()

    messages = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conv.id
    ).order_by(ChatMessage.created_at.asc()).all()

    return [{
        "id": m.id,
        "conversation_id": m.conversation_id,
        "sender_id": m.sender_id,
        "sender_name": m.sender.full_name if m.sender else "User",
        "sender_role": m.sender.role if m.sender else "",
        "message_text": m.message_text,
        "is_read": m.is_read,
        "created_at": m.created_at
    } for m in messages]

@router.post("/conversations/{conversation_id}/messages", response_model=dict)
async def send_message_rest(
    conversation_id: str,
    data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = verify_conversation_access(db, current_user, conversation_id)

    msg = ChatMessage(
        conversation_id=conv.id,
        sender_id=current_user.id,
        message_text=data.message_text.strip()
    )
    db.add(msg)
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    # Send notification to other party
    recipient_id = conv.employee_id if current_user.id == conv.student_id else conv.student_id
    notif = Notification(
        user_id=recipient_id,
        title=f"New message from {current_user.full_name}",
        message=msg.message_text[:60],
        link="/chat"
    )
    db.add(notif)
    db.commit()

    message_payload = {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.full_name,
        "sender_role": current_user.role,
        "message_text": msg.message_text,
        "is_read": False,
        "created_at": msg.created_at.isoformat()
    }

    # Broadcast via WebSocket
    await chat_manager.broadcast_to_conversation(conv.id, message_payload)

    return message_payload

@router.websocket("/ws/{conversation_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    conversation_id: str,
    token: Optional[str] = Query(None)
):
    db = SessionLocal()
    try:
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        payload = decode_token(token)
        if not payload or "sub" not in payload:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user_id = payload["sub"]
        user = db.query(User).filter(User.id == user_id, User.status == "active").first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv or (user.role != "admin" and user.id not in [conv.student_id, conv.employee_id]):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await chat_manager.connect(websocket, user.id, conversation_id)

        try:
            while True:
                data = await websocket.receive_text()
                if not data.strip():
                    continue

                msg = ChatMessage(
                    conversation_id=conversation_id,
                    sender_id=user.id,
                    message_text=data.strip()
                )
                db.add(msg)
                conv.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(msg)

                msg_data = {
                    "id": msg.id,
                    "conversation_id": msg.conversation_id,
                    "sender_id": msg.sender_id,
                    "sender_name": user.full_name,
                    "sender_role": user.role,
                    "message_text": msg.message_text,
                    "is_read": False,
                    "created_at": msg.created_at.isoformat()
                }
                await chat_manager.broadcast_to_conversation(conversation_id, msg_data)
        except WebSocketDisconnect:
            chat_manager.disconnect(websocket, user.id, conversation_id)
    finally:
        db.close()
