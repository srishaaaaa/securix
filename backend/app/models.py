import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey, Boolean, Text, Enum
)
from sqlalchemy.orm import relationship

from .database import Base


def gen_id():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    customer = "customer"
    admin = "admin"


class VerificationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    under_review = "under_review"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    mobile = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.customer)
    created_at = Column(DateTime, default=datetime.utcnow)

    verifications = relationship("Verification", back_populates="user")


class Verification(Base):
    """One KYC attempt/session for a user, aggregating every module's output."""
    __tablename__ = "verifications"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    # Module 2 - document
    document_type = Column(String, nullable=True)
    document_path = Column(String, nullable=True)
    ocr_name = Column(String, nullable=True)
    ocr_dob = Column(String, nullable=True)
    ocr_address = Column(String, nullable=True)
    ocr_doc_number = Column(String, nullable=True)
    ocr_confidence = Column(Float, default=0.0)
    document_format_valid = Column(Boolean, default=False)
    document_authenticity_score = Column(Float, default=0.0)

    # Additional forgery-detection module (additive, complements the ELA
    # score above with independent edge/texture/color/noise heuristics)
    forgery_score = Column(Float, default=0.0)  # 0-100, higher = more suspicious
    forgery_indicators = Column(Text, default="")  # comma separated

    # Module 3 - face
    selfie_path = Column(String, nullable=True)
    face_detected = Column(Boolean, default=False)
    face_match_score = Column(Float, default=0.0)
    liveness_score = Column(Float, default=0.0)
    liveness_checks_passed = Column(String, default="")  # comma separated

    # Module 4/5 - fraud + risk
    duplicate_identity_flag = Column(Boolean, default=False)
    manipulation_flag = Column(Boolean, default=False)
    fraud_notes = Column(Text, default="")
    risk_score = Column(Float, default=0.0)
    risk_band = Column(String, default="")  # low / medium / high

    # ---- Additional modules (additive) ----

    # Module 1 add-on: challenge-response liveness (smile / turn_left /
    # turn_right / raise_eyebrows), on top of the existing passive burst
    # liveness check above - does not replace liveness_score/checks_passed.
    challenge_type = Column(String, nullable=True)
    challenge_passed = Column(Boolean, nullable=True)
    challenge_confidence = Column(Float, default=0.0)
    challenge_detail = Column(Text, default="")

    # Module 2: device fingerprint + geo-velocity ("impossible travel")
    phone_number = Column(String, nullable=True)
    device_fingerprint = Column(Text, default="")  # raw JSON string from the client
    device_id_hash = Column(String, nullable=True)  # stable hash used for graph linking
    ip_address = Column(String, nullable=True)
    geo_city = Column(String, nullable=True)
    geo_country = Column(String, nullable=True)
    geo_lat = Column(Float, nullable=True)
    geo_lon = Column(Float, nullable=True)
    travel_flag = Column(Boolean, default=False)
    travel_detail = Column(Text, default="")

    # Module 3: fraud network membership (set at finalize time)
    fraud_network_flag = Column(Boolean, default=False)
    fraud_network_size = Column(Integer, default=0)

    # Module 4: trust score engine (combines every signal above into one
    # explainable 0-100 score with a visible rule breakdown). This is
    # separate from risk_score/risk_band above, which stay unchanged.
    trust_score = Column(Float, default=0.0)
    trust_breakdown = Column(Text, default="[]")  # JSON list of {label, delta}

    # KYC-as-a-service: set when this verification was created via the
    # partner API (/api/v1) instead of the web UI, nullable so nothing
    # about UI-created verifications changes.
    api_key_id = Column(String, nullable=True)

    # ------------------------------------------------------------------
    # Additional module - Aadhaar Secure QR verification.
    #
    # Only ever populated when document_type == "aadhaar" and a decodable
    # Secure QR was found; otherwise stays at these defaults, which the
    # full-report endpoint reports as "not available" rather than faking
    # a score. See services/aadhaar_qr.py.
    # ------------------------------------------------------------------
    aadhaar_qr_present = Column(Boolean, default=False)
    aadhaar_qr_signature_valid = Column(Boolean, nullable=True)  # None = not checked
    aadhaar_qr_using_test_cert = Column(Boolean, default=True)
    aadhaar_qr_fields = Column(Text, default="{}")       # JSON of QR-signed demographic fields
    aadhaar_qr_mismatch_flag = Column(Boolean, default=False)  # QR fields vs OCR fields disagree
    aadhaar_qr_notes = Column(Text, default="")

    # ------------------------------------------------------------------
    # Additional module - Risk-based step-up flow.
    #
    # Computed once, right after the existing trust-score engine runs in
    # finalize() (that engine itself is untouched). Drives the new
    # step-up endpoints in routers/kyc.py and routers/video_kyc.py.
    # ------------------------------------------------------------------
    step_up_action = Column(String, default="none")            # none / second_factor / video_kyc
    step_up_status = Column(String, default="not_required")    # not_required / pending / completed / failed
    step_up_method = Column(String, nullable=True)              # otp / selfie (for second_factor only)
    step_up_reason = Column(Text, default="")
    step_up_completed_at = Column(DateTime, nullable=True)

    # Module 6 - decision
    status = Column(Enum(VerificationStatus), default=VerificationStatus.pending)
    decided_at = Column(DateTime, nullable=True)
    admin_note = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="verifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    verification_id = Column(String, ForeignKey("verifications.id"), nullable=True)
    action = Column(String, nullable=False)
    detail = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class ReviewPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class ReviewStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"


class ManualReview(Base):
    """Additional module - Manual Review Queue.

    Lets admins triage medium/high-risk verifications explicitly (assign,
    prioritize, leave notes) instead of just filtering the verifications
    list by status. Purely additive: does not change how Verification or
    the existing admin decision endpoint behave.
    """
    __tablename__ = "manual_reviews"

    id = Column(String, primary_key=True, default=gen_id)
    verification_id = Column(String, ForeignKey("verifications.id"), nullable=False)
    assigned_to_id = Column(String, ForeignKey("users.id"), nullable=True)

    reason = Column(Text, default="")
    priority = Column(Enum(ReviewPriority), default=ReviewPriority.medium)
    status = Column(Enum(ReviewStatus), default=ReviewStatus.pending)
    review_notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class IdentityLink(Base):
    """Additional module - Fraud Network.

    One row per completed verification, recording the (device, phone,
    document-number) triple. The fraud-network graph (Module 3) is built by
    joining rows that share any one of these three values - e.g. many
    different document numbers all submitted from the same device/phone
    is the "one phone linked to 30 Aadhaar numbers" pattern from the brief.
    Purely additive: nothing else reads or writes this table.
    """
    __tablename__ = "identity_links"

    id = Column(String, primary_key=True, default=gen_id)
    verification_id = Column(String, ForeignKey("verifications.id"), nullable=False)
    device_id_hash = Column(String, nullable=True, index=True)
    phone_number = Column(String, nullable=True, index=True)
    id_number = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Additional module - KYC-as-a-service (API keys + signed webhooks)
# ---------------------------------------------------------------------------

class ApiKey(Base):
    """A partner integration credential. The raw key is only ever shown once,
    at creation time, in the API response - only its SHA-256 hash is stored,
    same pattern as password hashing. Requests authenticate via the
    X-API-Key header, checked in auth.require_api_key."""
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    key_prefix = Column(String, nullable=False)  # e.g. "sx_live_a1b2" - safe to display in lists
    key_hash = Column(String, nullable=False, unique=True)
    created_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)


class WebhookEndpoint(Base):
    """A partner-registered URL that gets a signed POST whenever a
    verification tied to their API key completes. Signed with HMAC-SHA256
    over the raw payload using `secret`, sent as the X-Securix-Signature
    header - the same pattern Stripe/GitHub webhooks use, so a partner can
    verify the request really came from SECURIX."""
    __tablename__ = "webhook_endpoints"

    id = Column(String, primary_key=True, default=gen_id)
    api_key_id = Column(String, ForeignKey("api_keys.id"), nullable=False)
    url = Column(String, nullable=False)
    secret = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WebhookDelivery(Base):
    """Delivery log for every webhook attempt - lets an admin see what was
    sent, whether it succeeded, and replay/debug failures."""
    __tablename__ = "webhook_deliveries"

    id = Column(String, primary_key=True, default=gen_id)
    webhook_endpoint_id = Column(String, ForeignKey("webhook_endpoints.id"), nullable=False)
    verification_id = Column(String, ForeignKey("verifications.id"), nullable=True)
    event = Column(String, nullable=False)
    payload = Column(Text, default="")
    status = Column(String, default="pending")  # pending / success / failed
    response_code = Column(Integer, nullable=True)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Additional module - status notifications (email / SMS)
# ---------------------------------------------------------------------------

class NotificationLog(Base):
    """Every notification attempt, sent or not. Kept even when no real
    SMTP/SMS provider is configured (see services/notify.py) so the feature
    is demoable and auditable without needing live credentials."""
    __tablename__ = "notification_logs"

    id = Column(String, primary_key=True, default=gen_id)
    verification_id = Column(String, ForeignKey("verifications.id"), nullable=False)
    channel = Column(String, nullable=False)  # email / sms
    recipient = Column(String, nullable=True)
    event = Column(String, nullable=False)  # e.g. "status_changed:approved"
    status = Column(String, nullable=False)  # sent / skipped_not_configured / failed
    detail = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Additional module - Risk-based step-up flow
# ---------------------------------------------------------------------------

class StepUpOtp(Base):
    """A one-time-password issued for the "second_factor" step-up path.
    Only the salted hash is stored, same pattern as password/API-key
    hashing elsewhere in this project."""
    __tablename__ = "step_up_otps"

    id = Column(String, primary_key=True, default=gen_id)
    verification_id = Column(String, ForeignKey("verifications.id"), nullable=False, index=True)
    otp_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0)
    consumed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class VideoKycQueue(Base):
    """The live-agent queue that high-risk verifications are routed to
    instead of being auto-rejected. An admin/agent picks an entry up,
    conducts the call out of band, then records the outcome here - which
    updates the underlying Verification's status through the same
    audited path the existing admin decision endpoint uses."""
    __tablename__ = "video_kyc_queue"

    id = Column(String, primary_key=True, default=gen_id)
    verification_id = Column(String, ForeignKey("verifications.id"), nullable=False, index=True)
    assigned_agent_id = Column(String, ForeignKey("users.id"), nullable=True)

    status = Column(String, default="waiting")  # waiting / in_progress / completed / cancelled
    agent_notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
