import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey, 
    UniqueConstraint, Index, Date
)
from sqlalchemy.orm import relationship
from backend.app.db.session import Base

def gen_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True)  # 'admin', 'employee', 'student'
    status = Column(String(50), nullable=False, default="active", index=True)  # 'active', 'blocked', 'inactive'
    identifier = Column(String(100), unique=True, nullable=True, index=True)
    contact_number = Column(String(50), nullable=True)
    designation = Column(String(100), nullable=True)
    referral_code = Column(String(50), unique=True, nullable=True, index=True)
    referral_link = Column(String(500), nullable=True)
    referral_link_approved = Column(Boolean, default=True, nullable=False)
    access_duration = Column(String(50), default="lifetime", nullable=True)  # '1_month', '6_months', '1_year', 'lifetime'
    access_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    team_memberships = relationship("TeamMembership", back_populates="employee", cascade="all, delete-orphan")
    student_enrollments = relationship("Enrollment", foreign_keys="[Enrollment.student_id]", back_populates="student")
    employee_enrollments = relationship("Enrollment", foreign_keys="[Enrollment.employee_id]", back_populates="employee")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    referrals_made = relationship("ReferralRecord", foreign_keys="[ReferralRecord.referrer_id]", back_populates="referrer", cascade="all, delete-orphan")

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(512), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="refresh_tokens")

class Team(Base):
    __tablename__ = "teams"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    memberships = relationship("TeamMembership", back_populates="team", cascade="all, delete-orphan")

class TeamMembership(Base):
    __tablename__ = "team_memberships"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("team_id", "employee_id", name="uq_team_employee"),
    )

    team = relationship("Team", back_populates="memberships")
    employee = relationship("User", back_populates="team_memberships")

class Program(Base):
    __tablename__ = "programs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    code = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="draft", nullable=False)  # 'draft', 'published', 'archived'
    price = Column(Float, default=2000.0, nullable=False)
    allow_redemption = Column(Boolean, default=True, nullable=False)
    max_redemption_percent = Column(Float, default=100.0, nullable=False)
    referral_bonus_points = Column(Float, default=500.0, nullable=False)
    eligible_for_referral = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tracks = relationship("LearningTrack", back_populates="program", cascade="all, delete-orphan", order_by="LearningTrack.position")
    enrollments = relationship("Enrollment", back_populates="program")
    attendance_sessions = relationship("AttendanceSession", back_populates="program", cascade="all, delete-orphan")

class LearningTrack(Base):
    __tablename__ = "learning_tracks"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    program_id = Column(String(36), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    position = Column(Integer, default=1, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    program = relationship("Program", back_populates="tracks")
    days = relationship("LearningDay", back_populates="track", cascade="all, delete-orphan", order_by="LearningDay.day_number")

class LearningDay(Base):
    __tablename__ = "learning_days"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    track_id = Column(String(36), ForeignKey("learning_tracks.id", ondelete="CASCADE"), nullable=False)
    day_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    video_url = Column(String(500), nullable=True)
    attachments = Column(Text, nullable=True)  # JSON-encoded array of attachments
    published = Column(Boolean, default=False, nullable=False)
    require_approval = Column(Boolean, default=False, nullable=False)
    require_task_submission = Column(Boolean, default=False, nullable=False)
    
    # Enhanced configurable multi-resource learning attributes
    summary_main = Column(Text, nullable=True)
    summary_telugu = Column(Text, nullable=True)
    summary_english = Column(Text, nullable=True)
    summary_video_url = Column(String(500), nullable=True)
    summary_url = Column(String(500), nullable=True)
    quiz_url = Column(String(500), nullable=True)
    assignment_url = Column(String(500), nullable=True)
    unlock_delay_hours = Column(Float, default=24.0, nullable=False)
    unlock_mode = Column(String(50), default="both", nullable=False)  # 'timer', 'manual', 'both'
    require_google_drive_submission = Column(Boolean, default=False, nullable=False)
    base_reward_points = Column(Float, nullable=True)  # custom base points for day, default uses reward_config
    completion_requirements = Column(Text, nullable=True)  # JSON-encoded array of requirements

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("track_id", "day_number", name="uq_track_day_number"),
    )

    track = relationship("LearningTrack", back_populates="days")
    checklist_items = relationship("ChecklistTemplateItem", back_populates="day", cascade="all, delete-orphan", order_by="ChecklistTemplateItem.display_order")
    tasks = relationship("DailyTask", back_populates="day", cascade="all, delete-orphan")
    day_progress_records = relationship("DayProgress", back_populates="day", cascade="all, delete-orphan")
    resources = relationship("LearningResource", back_populates="day", cascade="all, delete-orphan", order_by="LearningResource.display_order")
    flashcards = relationship("Flashcard", back_populates="day", cascade="all, delete-orphan", order_by="Flashcard.display_order")
    google_drive_submissions = relationship("GoogleDriveSubmission", back_populates="day", cascade="all, delete-orphan")

class LearningResource(Base):
    __tablename__ = "learning_resources"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    day_id = Column(String(36), ForeignKey("learning_days.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    resource_type = Column(String(50), default="link", nullable=False)  # 'link', 'video', 'document', 'note', 'quiz'
    url = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)
    display_order = Column(Integer, default=1, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    day = relationship("LearningDay", back_populates="resources")

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    day_id = Column(String(36), ForeignKey("learning_days.id", ondelete="CASCADE"), nullable=False)
    front_text = Column(Text, nullable=False)
    back_text = Column(Text, nullable=False)
    display_order = Column(Integer, default=1, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    day = relationship("LearningDay", back_populates="flashcards")

class ChecklistTemplateItem(Base):
    __tablename__ = "checklist_template_items"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    day_id = Column(String(36), ForeignKey("learning_days.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=1, nullable=False)
    is_required = Column(Boolean, default=True, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    day = relationship("LearningDay", back_populates="checklist_items")
    completions = relationship("ChecklistCompletion", back_populates="item", cascade="all, delete-orphan")

class DailyTask(Base):
    __tablename__ = "daily_tasks"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    day_id = Column(String(36), ForeignKey("learning_days.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    instructions = Column(Text, nullable=True)
    submission_type = Column(String(50), default="both", nullable=False)  # 'text', 'file', 'both'
    is_required = Column(Boolean, default=True, nullable=False)
    max_file_size_mb = Column(Integer, default=25, nullable=False)
    allowed_extensions = Column(String(255), default="pdf,doc,docx,zip,png,jpg,jpeg,txt", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    day = relationship("LearningDay", back_populates="tasks")
    submissions = relationship("TaskSubmission", back_populates="task", cascade="all, delete-orphan")

class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    student_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    program_id = Column(String(36), ForeignKey("programs.id", ondelete="RESTRICT"), nullable=False)
    employee_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default="active", nullable=False)  # 'active', 'revoked'
    enrolled_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("student_id", "program_id", name="uq_student_program_enrollment"),
    )

    student = relationship("User", foreign_keys=[student_id], back_populates="student_enrollments")
    program = relationship("Program", back_populates="enrollments")
    employee = relationship("User", foreign_keys=[employee_id], back_populates="employee_enrollments")
    day_progress_records = relationship("DayProgress", back_populates="enrollment", cascade="all, delete-orphan")
    checklist_completions = relationship("ChecklistCompletion", back_populates="enrollment", cascade="all, delete-orphan")
    task_submissions = relationship("TaskSubmission", back_populates="enrollment", cascade="all, delete-orphan")
    google_drive_submissions = relationship("GoogleDriveSubmission", back_populates="enrollment", cascade="all, delete-orphan")

class DayProgress(Base):
    __tablename__ = "day_progress"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    enrollment_id = Column(String(36), ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    day_id = Column(String(36), ForeignKey("learning_days.id", ondelete="RESTRICT"), nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    approved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Manual unlock and 24-hr unlock timer tracking
    unlocked_at = Column(DateTime, nullable=True)
    is_manually_unlocked = Column(Boolean, default=False, nullable=False)
    unlocked_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    unlock_reason = Column(Text, nullable=True)

    # Activity tracking per day
    summary_viewed = Column(Boolean, default=False, nullable=False)
    telugu_summary_viewed = Column(Boolean, default=False, nullable=False)
    english_summary_viewed = Column(Boolean, default=False, nullable=False)
    video_watched = Column(Boolean, default=False, nullable=False)
    flashcards_completed = Column(Boolean, default=False, nullable=False)
    quiz_completed = Column(Boolean, default=False, nullable=False)
    quiz_score = Column(Integer, nullable=True)
    assignment_completed = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("enrollment_id", "day_id", name="uq_enrollment_day_progress"),
    )

    enrollment = relationship("Enrollment", back_populates="day_progress_records")
    day = relationship("LearningDay", back_populates="day_progress_records")
    unlocked_by = relationship("User", foreign_keys=[unlocked_by_id])

class GoogleDriveSubmission(Base):
    __tablename__ = "google_drive_submissions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    enrollment_id = Column(String(36), ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    day_id = Column(String(36), ForeignKey("learning_days.id", ondelete="CASCADE"), nullable=False)
    google_drive_url = Column(String(500), nullable=False)
    notes = Column(Text, nullable=True)
    attempt_number = Column(Integer, default=1, nullable=False)
    is_latest = Column(Boolean, default=True, nullable=False)
    status = Column(String(50), default="submitted", nullable=False)  # 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected'
    reviewer_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_comments = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)  # 1-100 or 1-5 score
    improvement_suggestions = Column(Text, nullable=True)
    base_reward_points = Column(Float, default=0.0, nullable=False)
    additional_reward_points = Column(Float, default=0.0, nullable=False)
    reward_awarded = Column(Boolean, default=False, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    enrollment = relationship("Enrollment", back_populates="google_drive_submissions")
    day = relationship("LearningDay", back_populates="google_drive_submissions")
    reviewer = relationship("User", foreign_keys=[reviewer_id])

class ChecklistCompletion(Base):
    __tablename__ = "checklist_completions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    enrollment_id = Column(String(36), ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(String(36), ForeignKey("checklist_template_items.id", ondelete="CASCADE"), nullable=False)
    completed = Column(Boolean, default=True, nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("enrollment_id", "item_id", name="uq_enrollment_item_completion"),
    )

    enrollment = relationship("Enrollment", back_populates="checklist_completions")
    item = relationship("ChecklistTemplateItem", back_populates="completions")

class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    original_name = Column(String(255), nullable=False)
    stored_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String(100), nullable=False)
    uploaded_by_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    uploaded_by = relationship("User")

class TaskSubmission(Base):
    __tablename__ = "task_submissions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    enrollment_id = Column(String(36), ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(String(36), ForeignKey("daily_tasks.id", ondelete="CASCADE"), nullable=False)
    submission_text = Column(Text, nullable=True)
    file_id = Column(String(36), ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default="submitted", nullable=False)  # 'submitted', 'under_review', 'revision_requested', 'accepted', 'rejected'
    feedback = Column(Text, nullable=True)
    reviewer_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    enrollment = relationship("Enrollment", back_populates="task_submissions")
    task = relationship("DailyTask", back_populates="submissions")
    file = relationship("UploadedFile")
    reviewer = relationship("User", foreign_keys=[reviewer_id])

class ReferralCampaign(Base):
    __tablename__ = "referral_campaigns"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    program_id = Column(String(36), ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    headline = Column(String(255), default="INVITE AND EARN", nullable=False)
    currency = Column(String(10), default="₹", nullable=False)
    base_reward_amount = Column(Float, default=999.0, nullable=False)
    tier_reward_amount = Column(Float, default=799.20, nullable=False)
    vip_price = Column(Float, default=999.0, nullable=False)
    instructions = Column(Text, nullable=True)
    rungs_config = Column(Text, nullable=True)  # JSON array of tier rungs / milestones
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    program = relationship("Program")
    referrals = relationship("ReferralRecord", back_populates="campaign")

class ReferralRecord(Base):
    __tablename__ = "referral_records"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    campaign_id = Column(String(36), ForeignKey("referral_campaigns.id", ondelete="SET NULL"), nullable=True)
    referrer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    referred_email = Column(String(255), nullable=True)
    referred_name = Column(String(255), nullable=True)
    referred_phone = Column(String(50), nullable=True)
    referral_code = Column(String(50), nullable=False, index=True)
    funnel_stage = Column(String(50), default="invited", nullable=False)  # 'invited', 'opened', 'claimed', 'came', 'took_seat', 'bought'
    reward_amount = Column(Float, default=0.0, nullable=False)
    reward_status = Column(String(50), default="pending", nullable=False)  # 'pending', 'approved', 'paid', 'rejected'
    reward_approved_at = Column(DateTime, nullable=True)
    reward_approved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    referrer = relationship("User", foreign_keys=[referrer_id], back_populates="referrals_made")
    campaign = relationship("ReferralCampaign", back_populates="referrals")
    approver = relationship("User", foreign_keys=[reward_approved_by])

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    program_id = Column(String(36), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False)
    session_date = Column(Date, nullable=False)
    title = Column(String(255), nullable=False)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    program = relationship("Program", back_populates="attendance_sessions")
    records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_id])

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="present", nullable=False)  # 'present', 'absent', 'late', 'excused'
    notes = Column(Text, nullable=True)
    recorded_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_session_student_attendance"),
    )

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("User", foreign_keys=[student_id])
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    student_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    program_id = Column(String(36), ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("student_id", "employee_id", name="uq_student_employee_conversation"),
    )

    student = relationship("User", foreign_keys=[student_id])
    employee = relationship("User", foreign_keys=[employee_id])
    program = relationship("Program", foreign_keys=[program_id])
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message_text = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="notifications")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    actor_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False)
    target_type = Column(String(100), nullable=False)
    target_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    actor = relationship("User", foreign_keys=[actor_id])

class RewardWallet(Base):
    __tablename__ = "reward_wallets"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    balance = Column(Float, default=0.0, nullable=False)
    total_earned = Column(Float, default=0.0, nullable=False)
    total_redeemed = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User")
    transactions = relationship("RewardTransaction", back_populates="wallet", cascade="all, delete-orphan", order_by="RewardTransaction.created_at.desc()")

class RewardTransaction(Base):
    __tablename__ = "reward_transactions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    wallet_id = Column(String(36), ForeignKey("reward_wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)  # positive = credit, negative = debit
    points = Column(Float, nullable=False)
    conversion_rate = Column(Float, default=1.0, nullable=False)
    transaction_type = Column(String(50), nullable=False)  # 'submission_base', 'employee_review', 'referral_bonus', 'program_redemption', 'refund_reversal', 'admin_adjustment'
    reason = Column(String(255), nullable=False)
    related_entity_type = Column(String(50), nullable=True)  # 'google_drive_submission', 'program_purchase', 'referral_record', 'program'
    related_entity_id = Column(String(100), nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    wallet = relationship("RewardWallet", back_populates="transactions")
    user = relationship("User", foreign_keys=[user_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

class RewardConfig(Base):
    __tablename__ = "reward_configs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    point_to_rupee_ratio = Column(Float, default=1.0, nullable=False)  # default 1 point = ₹1
    default_submission_points = Column(Float, default=20.0, nullable=False)
    award_timing = Column(String(50), default="immediate", nullable=False)  # 'immediate' or 'on_approval'
    max_employee_points_per_review = Column(Float, default=50.0, nullable=False)
    allow_redemption = Column(Boolean, default=True, nullable=False)
    max_redemption_percent = Column(Float, default=100.0, nullable=False)
    qualify_rejected = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class ProgramPurchase(Base):
    __tablename__ = "program_purchases"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    student_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    program_id = Column(String(36), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True)
    original_price = Column(Float, nullable=False)
    points_redeemed = Column(Float, default=0.0, nullable=False)
    discount_amount = Column(Float, default=0.0, nullable=False)
    final_amount = Column(Float, nullable=False)  # in INR
    currency = Column(String(10), default="INR", nullable=False)
    payment_method = Column(String(50), default="razorpay", nullable=False)
    razorpay_order_id = Column(String(100), nullable=True, index=True)
    razorpay_payment_id = Column(String(100), nullable=True, index=True)
    razorpay_signature = Column(String(255), nullable=True)
    payment_status = Column(String(50), default="created", nullable=False, index=True)  # 'created', 'paid', 'failed', 'refunded', 'cancelled'
    referral_code_used = Column(String(50), nullable=True, index=True)
    referrer_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    referral_reward_credited = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    paid_at = Column(DateTime, nullable=True)
    refunded_at = Column(DateTime, nullable=True)

    student = relationship("User", foreign_keys=[student_id])
    program = relationship("Program", foreign_keys=[program_id])
    referrer = relationship("User", foreign_keys=[referrer_id])

class PaymentWebhookEvent(Base):
    __tablename__ = "payment_webhook_events"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    event_id = Column(String(100), unique=True, nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    payload = Column(Text, nullable=False)
    status = Column(String(50), default="processed", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class RazorpaySetting(Base):
    __tablename__ = "razorpay_settings"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    key_id = Column(String(255), default="", nullable=False)
    key_secret = Column(String(255), default="", nullable=False)
    webhook_secret = Column(String(255), default="", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_test_mode = Column(Boolean, default=True, nullable=False)
    account_name = Column(String(255), default="Razorpay Standard Account", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class StudentApplication(Base):
    __tablename__ = "student_applications"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    full_name = Column(String(255), nullable=False)
    contact_number = Column(String(50), nullable=True)
    email = Column(String(255), nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    payment_id = Column(String(255), nullable=True)
    program_id = Column(String(36), ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default="pending", nullable=False)  # 'pending', 'approved', 'rejected'
    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    reviewed_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_student_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_enrollment_id = Column(String(36), ForeignKey("enrollments.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    program = relationship("Program")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    created_student = relationship("User", foreign_keys=[created_student_id])
    created_enrollment = relationship("Enrollment", foreign_keys=[created_enrollment_id])


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)



