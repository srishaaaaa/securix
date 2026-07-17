from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    mobile: str = Field(..., min_length=7, max_length=15)
    password: str = Field(..., min_length=6, max_length=72)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    full_name: str
    email: str
    mobile: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class OCRResult(BaseModel):
    document_type: str
    name: Optional[str]
    dob: Optional[str]
    address: Optional[str]
    doc_number: Optional[str]
    confidence: float
    format_valid: bool
    authenticity_score: float


class FaceResult(BaseModel):
    face_detected: bool
    face_match_score: float
    liveness_score: float
    liveness_checks_passed: list[str]


class VerificationOut(BaseModel):
    id: str
    user_id: str
    document_type: Optional[str]
    ocr_name: Optional[str]
    ocr_dob: Optional[str]
    ocr_address: Optional[str]
    ocr_doc_number: Optional[str]
    ocr_confidence: float
    document_format_valid: bool
    document_authenticity_score: float
    forgery_score: float
    forgery_indicators: str
    face_detected: bool
    face_match_score: float
    liveness_score: float
    liveness_checks_passed: str
    duplicate_identity_flag: bool
    manipulation_flag: bool
    fraud_notes: str
    risk_score: float
    risk_band: str

    # Additional modules
    challenge_type: Optional[str]
    challenge_passed: Optional[bool]
    challenge_confidence: float
    challenge_detail: str
    travel_flag: bool
    travel_detail: str
    geo_city: Optional[str]
    geo_country: Optional[str]
    fraud_network_flag: bool
    fraud_network_size: int
    trust_score: float
    trust_breakdown: str

    # Aadhaar Secure QR module
    aadhaar_qr_present: bool
    aadhaar_qr_signature_valid: Optional[bool]
    aadhaar_qr_using_test_cert: bool
    aadhaar_qr_mismatch_flag: bool

    # Risk-based step-up flow
    step_up_action: str
    step_up_status: str
    step_up_method: Optional[str]
    step_up_reason: str

    status: str
    admin_note: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChallengeIn(BaseModel):
    challenge_type: str  # smile / turn_left / turn_right / raise_eyebrows
    frames_base64: list[str]  # short burst of frames captured during the challenge


class ChallengeOut(BaseModel):
    passed: bool
    confidence: float
    detail: str


class DeviceSignalIn(BaseModel):
    phone_number: Optional[str] = None
    device_fingerprint: dict  # raw client metadata: UA, screen, timezone, etc.


class DeviceSignalOut(BaseModel):
    device_id_hash: str
    ip_address: Optional[str]
    geo_city: Optional[str]
    geo_country: Optional[str]
    travel_flag: bool
    travel_detail: str


class FraudNetworkNode(BaseModel):
    id: str
    kind: str
    label: str
    degree: int
    is_anchor: bool


class FraudNetworkEdge(BaseModel):
    source: str
    target: str


class FraudNetworkOut(BaseModel):
    nodes: list[FraudNetworkNode]
    edges: list[FraudNetworkEdge]
    flagged: bool
    linked_count: int


class AdminDecision(BaseModel):
    status: str  # approved / under_review / rejected
    admin_note: Optional[str] = ""


class ManualReviewCreate(BaseModel):
    verification_id: str
    reason: str = ""
    priority: str = "medium"  # low / medium / high / urgent


class ManualReviewUpdate(BaseModel):
    status: Optional[str] = None  # pending / in_progress / completed
    assigned_to_id: Optional[str] = None
    review_notes: Optional[str] = None
    priority: Optional[str] = None


class ManualReviewOut(BaseModel):
    id: str
    verification_id: str
    assigned_to_id: Optional[str]
    reason: str
    priority: str
    status: str
    review_notes: str
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Additional module - Aadhaar Secure QR verification
# ---------------------------------------------------------------------------

class AadhaarQrOut(BaseModel):
    qr_present: bool
    decodable: bool
    signature_valid: Optional[bool]
    using_test_certificate: bool
    certificate_subject: Optional[str]
    fields: dict
    reference_id_masked: Optional[str]
    mismatch_flag: bool
    errors: list[str]


# ---------------------------------------------------------------------------
# Additional module - Risk-based step-up flow
# ---------------------------------------------------------------------------

class StepUpStatusOut(BaseModel):
    action: str    # none / second_factor / video_kyc
    status: str    # not_required / pending / completed / failed
    method: Optional[str]
    reason: str


class OtpRequestOut(BaseModel):
    sent: bool
    expires_in_seconds: int
    dev_otp: Optional[str] = None  # only populated when no real SMS/email provider is configured


class OtpVerifyIn(BaseModel):
    otp: str = Field(..., min_length=4, max_length=8)


class StepUpResultOut(BaseModel):
    passed: bool
    detail: str
    verification: VerificationOut


class VideoKycQueueOut(BaseModel):
    id: str
    verification_id: str
    assigned_agent_id: Optional[str]
    status: str
    agent_notes: str
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class VideoKycAssign(BaseModel):
    agent_id: Optional[str] = None  # defaults to the requesting admin


class VideoKycComplete(BaseModel):
    decision: str  # approved / rejected
    notes: str = ""


# ---------------------------------------------------------------------------
# Additional module - KYC-as-a-service (API keys + webhooks)
# ---------------------------------------------------------------------------

class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)


class ApiKeyCreated(BaseModel):
    """Returned exactly once, at creation time - the raw key is never
    retrievable again after this response."""
    id: str
    name: str
    key_prefix: str
    api_key: str


class ApiKeyOut(BaseModel):
    id: str
    name: str
    key_prefix: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime]

    class Config:
        from_attributes = True


class WebhookCreate(BaseModel):
    api_key_id: str
    url: str = Field(..., min_length=8, max_length=500)


class WebhookCreated(BaseModel):
    """Returned exactly once, at creation time - the signing secret is
    never retrievable again after this response."""
    id: str
    url: str
    secret: str


class WebhookOut(BaseModel):
    id: str
    api_key_id: str
    url: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class WebhookDeliveryOut(BaseModel):
    id: str
    webhook_endpoint_id: str
    verification_id: Optional[str]
    event: str
    status: str
    response_code: Optional[int]
    attempts: int
    created_at: datetime

    class Config:
        from_attributes = True


# Partner-facing (/api/v1) response - a trimmed subset of VerificationOut,
# deliberately not including every internal field (forgery indicators,
# device fingerprint, etc.) since this is a third party's response shape.
class PartnerVerificationOut(BaseModel):
    id: str
    status: str
    risk_score: float
    risk_band: str
    trust_score: float
    ocr_name: Optional[str]
    ocr_doc_number: Optional[str]
    face_match_score: float
    document_authenticity_score: float
    note: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Additional module - status notifications
# ---------------------------------------------------------------------------

class NotificationLogOut(BaseModel):
    id: str
    verification_id: str
    channel: str
    recipient: Optional[str]
    event: str
    status: str
    detail: str
    created_at: datetime

    class Config:
        from_attributes = True
