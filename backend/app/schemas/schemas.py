from typing import Optional, List, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict

# Base Schema Config
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# Authentication & User Schemas
class LoginInput(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class RefreshTokenInput(BaseModel):
    refresh_token: str

class UserBase(BaseSchema):
    email: str
    full_name: str
    role: str
    status: str = "active"
    identifier: Optional[str] = None
    contact_number: Optional[str] = None
    designation: Optional[str] = None
    referral_code: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str = Field(..., min_length=6)
    role: str
    identifier: Optional[str] = None
    contact_number: Optional[str] = None
    designation: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    status: Optional[str] = None
    identifier: Optional[str] = None
    contact_number: Optional[str] = None
    designation: Optional[str] = None

class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

# Teams Schemas
class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    active: bool = True

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None

class TeamMemberResponse(BaseSchema):
    employee_id: str
    full_name: str
    email: str
    joined_at: datetime

class TeamResponse(BaseSchema):
    id: str
    name: str
    description: Optional[str] = None
    active: bool
    created_at: datetime
    updated_at: datetime
    member_count: int = 0
    members: List[TeamMemberResponse] = []

# Programs, Tracks & Days Schemas
class ProgramCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    status: str = "published"  # 'draft', 'published', 'archived'
    price: Optional[float] = 2000.0
    allow_redemption: Optional[bool] = True
    max_redemption_percent: Optional[float] = 100.0
    referral_bonus_points: Optional[float] = 500.0
    eligible_for_referral: Optional[bool] = True

class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    price: Optional[float] = None
    allow_redemption: Optional[bool] = None
    max_redemption_percent: Optional[float] = None
    referral_bonus_points: Optional[float] = None
    eligible_for_referral: Optional[bool] = None

class ChecklistItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    display_order: int = 1
    is_required: bool = True
    active: bool = True

class ChecklistItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_required: Optional[bool] = None
    active: Optional[bool] = None

class ChecklistItemResponse(BaseSchema):
    id: str
    day_id: str
    title: str
    description: Optional[str] = None
    display_order: int
    is_required: bool
    active: bool
    created_at: datetime
    completed: Optional[bool] = False

class DailyTaskCreate(BaseModel):
    title: str
    instructions: Optional[str] = None
    submission_type: str = "both"  # 'text', 'file', 'both'
    is_required: bool = True
    max_file_size_mb: int = 25
    allowed_extensions: str = "pdf,doc,docx,zip,png,jpg,jpeg,txt"

class DailyTaskUpdate(BaseModel):
    title: Optional[str] = None
    instructions: Optional[str] = None
    submission_type: Optional[str] = None
    is_required: Optional[bool] = None
    max_file_size_mb: Optional[int] = None
    allowed_extensions: Optional[str] = None

class DailyTaskResponse(BaseSchema):
    id: str
    day_id: str
    title: str
    instructions: Optional[str] = None
    submission_type: str
    is_required: bool
    max_file_size_mb: int
    allowed_extensions: str
    created_at: datetime

# Multi-resource Learning Schemas
class LearningResourceCreate(BaseModel):
    title: str
    resource_type: str = "link"  # 'link', 'video', 'document', 'note', 'quiz'
    url: Optional[str] = None
    content: Optional[str] = None
    display_order: int = 1
    active: bool = True

class LearningResourceUpdate(BaseModel):
    title: Optional[str] = None
    resource_type: Optional[str] = None
    url: Optional[str] = None
    content: Optional[str] = None
    display_order: Optional[int] = None
    active: Optional[bool] = None

class LearningResourceResponse(BaseSchema):
    id: str
    day_id: str
    title: str
    resource_type: str
    url: Optional[str] = None
    content: Optional[str] = None
    display_order: int
    active: bool
    created_at: datetime

class FlashcardCreate(BaseModel):
    front_text: str
    back_text: str
    display_order: int = 1
    active: bool = True

class FlashcardUpdate(BaseModel):
    front_text: Optional[str] = None
    back_text: Optional[str] = None
    display_order: Optional[int] = None
    active: Optional[bool] = None

class FlashcardResponse(BaseSchema):
    id: str
    day_id: str
    front_text: str
    back_text: str
    display_order: int
    active: bool
    created_at: datetime

class LearningDayCreate(BaseModel):
    day_number: Optional[int] = None
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    video_url: Optional[str] = None
    attachments: Optional[str] = None
    published: bool = False
    require_approval: bool = False
    require_task_submission: bool = False
    
    # Enhanced multi-resource fields
    summary_main: Optional[str] = None
    summary_telugu: Optional[str] = None
    summary_english: Optional[str] = None
    summary_video_url: Optional[str] = None
    summary_url: Optional[str] = None
    quiz_url: Optional[str] = None
    assignment_url: Optional[str] = None
    unlock_delay_hours: Optional[float] = 24.0
    unlock_mode: Optional[str] = "both"  # 'timer', 'manual', 'both'
    require_google_drive_submission: Optional[bool] = False
    completion_requirements: Optional[str] = None

    checklist_items: Optional[List[ChecklistItemCreate]] = None
    resources: Optional[List[LearningResourceCreate]] = None
    flashcards: Optional[List[FlashcardCreate]] = None

class LearningDayUpdate(BaseModel):
    day_number: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    video_url: Optional[str] = None
    attachments: Optional[str] = None
    published: Optional[bool] = None
    require_approval: Optional[bool] = None
    require_task_submission: Optional[bool] = None

    summary_main: Optional[str] = None
    summary_telugu: Optional[str] = None
    summary_english: Optional[str] = None
    summary_video_url: Optional[str] = None
    summary_url: Optional[str] = None
    quiz_url: Optional[str] = None
    assignment_url: Optional[str] = None
    unlock_delay_hours: Optional[float] = None
    unlock_mode: Optional[str] = None
    require_google_drive_submission: Optional[bool] = None
    completion_requirements: Optional[str] = None

class LearningDayResponse(BaseSchema):
    id: str
    track_id: str
    day_number: int
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    video_url: Optional[str] = None
    attachments: Optional[str] = None
    published: bool
    require_approval: bool
    require_task_submission: bool

    summary_main: Optional[str] = None
    summary_telugu: Optional[str] = None
    summary_english: Optional[str] = None
    summary_video_url: Optional[str] = None
    summary_url: Optional[str] = None
    quiz_url: Optional[str] = None
    assignment_url: Optional[str] = None
    unlock_delay_hours: float = 24.0
    unlock_mode: str = "both"
    require_google_drive_submission: bool = False
    completion_requirements: Optional[str] = None

    created_at: datetime
    checklist_items: List[ChecklistItemResponse] = []
    tasks: List[DailyTaskResponse] = []
    resources: List[LearningResourceResponse] = []
    flashcards: List[FlashcardResponse] = []

    status: Optional[str] = None  # 'available', 'completed', 'locked', 'pending_review'
    completed_at: Optional[datetime] = None
    is_unlocked: Optional[bool] = True
    next_unlock_time: Optional[datetime] = None
    remaining_seconds: Optional[int] = 0
    is_manually_unlocked: Optional[bool] = False
    unlocked_by_name: Optional[str] = None
    unlock_reason: Optional[str] = None
    pending_reasons: Optional[List[str]] = []

class LearningTrackCreate(BaseModel):
    name: str
    description: Optional[str] = None
    position: Optional[int] = 1
    active: bool = True

class LearningTrackUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    position: Optional[int] = None
    active: Optional[bool] = None

class LearningTrackResponse(BaseSchema):
    id: str
    program_id: str
    name: str
    description: Optional[str] = None
    position: int
    active: bool
    created_at: datetime
    days: List[LearningDayResponse] = []
    day_count: int = 0
    completed_days: int = 0
    progress: int = 0

class ProgramResponse(BaseSchema):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    track_count: int = 0
    enrollment_count: int = 0
    tracks: List[LearningTrackResponse] = []

# Enrollment Schemas
class EnrollmentCreate(BaseModel):
    student_id: str
    program_id: str
    employee_id: str

class EnrollmentResponse(BaseSchema):
    id: str
    student_id: str
    student_name: str
    student_email: str
    program_id: str
    program_name: str
    program_code: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    status: str
    enrolled_at: datetime
    revoked_at: Optional[datetime] = None
    progress: int = 0

class AssignEmployeeInput(BaseModel):
    employee_id: Optional[str] = None

class ManualUnlockInput(BaseModel):
    reason: str = "Authorized unlock by instructor"

class ManualLockInput(BaseModel):
    reason: str = "Administrative lock"

# Task Submission Schemas
class TaskSubmissionCreate(BaseModel):
    submission_text: Optional[str] = None
    file_id: Optional[str] = None

class TaskSubmissionReview(BaseModel):
    status: str  # 'accepted', 'rejected', 'revision_requested'
    feedback: Optional[str] = None

class TaskSubmissionResponse(BaseSchema):
    id: str
    enrollment_id: str
    task_id: str
    task_title: Optional[str] = None
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    program_name: Optional[str] = None
    submission_text: Optional[str] = None
    file_id: Optional[str] = None
    file_name: Optional[str] = None
    status: str
    feedback: Optional[str] = None
    reviewer_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None

# Google Drive Submission Schemas
class GoogleDriveSubmissionCreate(BaseModel):
    day_id: str
    google_drive_url: str
    notes: Optional[str] = None

class GoogleDriveSubmissionReview(BaseModel):
    status: Optional[str] = "approved"  # 'approved', 'changes_requested', 'rejected', 'under_review'
    review_comments: Optional[str] = None
    rating: Optional[int] = None  # 1-100 or 1-5 score
    improvement_suggestions: Optional[str] = None
    additional_reward_points: Optional[float] = None

class GoogleDriveSubmissionResponse(BaseSchema):
    id: str
    enrollment_id: str
    day_id: str
    day_title: Optional[str] = None
    day_number: Optional[int] = None
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    program_name: Optional[str] = None
    google_drive_url: str
    notes: Optional[str] = None
    attempt_number: int
    is_latest: bool
    status: str
    reviewer_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    review_comments: Optional[str] = None
    rating: Optional[int] = None
    improvement_suggestions: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None

# Referral System Schemas
class ReferralCampaignCreate(BaseModel):
    program_id: Optional[str] = None
    name: str
    headline: str = "INVITE AND EARN"
    currency: str = "₹"
    base_reward_amount: float = 999.0
    tier_reward_amount: float = 799.20
    vip_price: float = 999.0
    instructions: Optional[str] = None
    rungs_config: Optional[str] = None
    is_active: bool = True

class ReferralCampaignUpdate(BaseModel):
    program_id: Optional[str] = None
    name: Optional[str] = None
    headline: Optional[str] = None
    currency: Optional[str] = None
    base_reward_amount: Optional[float] = None
    tier_reward_amount: Optional[float] = None
    vip_price: Optional[float] = None
    instructions: Optional[str] = None
    rungs_config: Optional[str] = None
    is_active: Optional[bool] = None

class ReferralCampaignResponse(BaseSchema):
    id: str
    program_id: Optional[str] = None
    name: str
    headline: str
    currency: str
    base_reward_amount: float
    tier_reward_amount: float
    vip_price: float
    instructions: Optional[str] = None
    rungs_config: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

class ReferralRecordCreate(BaseModel):
    referral_code: str
    referred_name: Optional[str] = None
    referred_email: Optional[str] = None
    referred_phone: Optional[str] = None
    funnel_stage: str = "invited"  # 'invited', 'opened', 'claimed', 'came', 'took_seat', 'bought'

class ReferralRecordReview(BaseModel):
    reward_status: str  # 'approved', 'paid', 'rejected'
    reward_amount: Optional[float] = None

class ReferralRecordResponse(BaseSchema):
    id: str
    campaign_id: Optional[str] = None
    referrer_id: str
    referrer_name: Optional[str] = None
    referred_email: Optional[str] = None
    referred_name: Optional[str] = None
    referred_phone: Optional[str] = None
    referral_code: str
    funnel_stage: str
    reward_amount: float
    reward_status: str
    reward_approved_at: Optional[datetime] = None
    reward_approved_by: Optional[str] = None
    reward_approved_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# Attendance Schemas
class AttendanceSessionCreate(BaseModel):
    program_id: str
    session_date: date
    title: str

class AttendanceRecordUpdate(BaseModel):
    student_id: str
    status: str  # 'present', 'absent', 'late', 'excused'
    notes: Optional[str] = None

class AttendanceBatchUpdate(BaseModel):
    session_id: str
    records: List[AttendanceRecordUpdate]

class AttendanceRecordResponse(BaseSchema):
    id: str
    session_id: str
    student_id: str
    student_name: str
    student_email: str
    status: str
    notes: Optional[str] = None
    updated_at: datetime

class AttendanceSessionResponse(BaseSchema):
    id: str
    program_id: str
    program_name: Optional[str] = None
    session_date: date
    title: str
    created_at: datetime
    total_students: int = 0
    present_count: int = 0
    records: List[AttendanceRecordResponse] = []

# Chat & Messaging Schemas
class ConversationCreate(BaseModel):
    student_id: str
    employee_id: str

class ChatMessageCreate(BaseModel):
    message_text: str

class ChatMessageResponse(BaseSchema):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    message_text: str
    is_read: bool
    created_at: datetime

class ConversationResponse(BaseSchema):
    id: str
    student_id: str
    student_name: str
    employee_id: str
    employee_name: str
    title: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0

# Notifications Schemas
class NotificationResponse(BaseSchema):
    id: str
    user_id: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

# Audit Log Schemas
class AuditLogResponse(BaseSchema):
    id: str
    actor_id: Optional[str] = None
    actor_name: str
    action: str
    target_type: str
    target_id: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime
