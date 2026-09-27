import os
import io
import uuid
import json
import base64
import hashlib
import threading
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from sqlalchemy.orm import Session
from PIL import Image
import pytesseract

from .. import models, schemas, auth as auth_utils
from ..database import get_db
from ..services import ocr as ocr_service
from ..services import face as face_service
from ..services import risk as risk_service
from ..services import forgery as forgery_service
from ..services import quality as quality_service
from ..services import geo as geo_service
from ..services import challenge as challenge_service
from ..services import fraud_graph as fraud_graph_service
from ..services import webhooks as webhooks_service
from ..services import notify as notify_service
from ..services import aadhaar_qr as aadhaar_qr_service
from ..services import step_up as step_up_service

router = APIRouter(prefix="/api/kyc", tags=["kyc"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

VALID_DOC_TYPES = {"aadhaar", "pan", "passport", "driving_license"}

# in-memory cache of the best face crop per verification, so step 2 can
# compare the selfie against the document photo without re-decoding files
_doc_face_cache: dict[str, "object"] = {}

# Image-heavy endpoints are plain `def` so FastAPI runs them in its
# threadpool: a slow OCR/forgery pass then no longer blocks the event loop
# (and with it /api/health, which the host uses to decide whether the
# server is alive). This semaphore keeps them one at a time, as they
# effectively were when they blocked the loop, so two large uploads can't
# double peak memory on a small instance.
_image_processing_semaphore = threading.Semaphore(1)


def image_processing_slot():
    with _image_processing_semaphore:
        yield


def _save_bytes(data: bytes, prefix: str) -> str:
    fname = f"{prefix}_{uuid.uuid4().hex}.jpg"
    path = os.path.join(UPLOAD_DIR, fname)
    with open(path, "wb") as f:
        f.write(data)
    return path


@router.post("/document", response_model=schemas.VerificationOut)
def upload_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    phone_number: str = Form(None),  # optional, feeds Module 3's fraud network
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
    _slot: None = Depends(image_processing_slot),
):
    if document_type not in VALID_DOC_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported document type.")

    raw = file.file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Empty file upload.")

    try:
        image = Image.open(io.BytesIO(raw))
        image.verify()
        image = Image.open(io.BytesIO(raw))  # reopen after verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    try:
        text, ocr_conf = ocr_service.extract_text_and_confidence(image)
    except pytesseract.TesseractNotFoundError:
        raise HTTPException(
            status_code=500,
            detail=(
                "OCR engine (Tesseract) is not installed on the server, or not on its PATH. "
                "Install it with 'sudo apt-get install tesseract-ocr' (Linux), "
                "'brew install tesseract' (macOS), or the Windows installer at "
                "https://github.com/UB-Mannheim/tesseract/wiki, then restart the backend."
            ),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {exc}")

    fields = ocr_service.extract_fields(text, document_type)
    auth_score = ocr_service.authenticity_score(image, ocr_conf, fields["format_valid"])

    # additional forgery-detection module (independent of the ELA-based
    # auth_score above; both scores are stored so admins can see either signal)
    try:
        forgery_result = forgery_service.detect_forgery(image)
    except Exception:
        forgery_result = {"forgery_score": 0.0, "indicators": []}

    path = _save_bytes(raw, "doc")

    # additional Aadhaar Secure QR module - only meaningful for Aadhaar
    # documents; never blocks upload if the QR is missing/unreadable, see
    # services/aadhaar_qr.py for what "not available" vs "invalid" means
    aadhaar_qr_present = False
    aadhaar_qr_signature_valid = None
    aadhaar_qr_using_test_cert = True
    aadhaar_qr_fields_json = "{}"
    aadhaar_qr_mismatch = False
    aadhaar_qr_notes = []
    if document_type == "aadhaar":
        try:
            qr_result = aadhaar_qr_service.verify_aadhaar_qr(image)
            aadhaar_qr_present = qr_result.qr_present
            aadhaar_qr_signature_valid = qr_result.signature_valid
            aadhaar_qr_using_test_cert = qr_result.using_test_certificate
            aadhaar_qr_fields_json = json.dumps(qr_result.fields)
            aadhaar_qr_notes = list(qr_result.errors)
            if qr_result.decodable:
                mismatch, mismatch_notes = aadhaar_qr_service.check_field_mismatch(
                    qr_result.fields, fields["name"], fields["dob"]
                )
                aadhaar_qr_mismatch = mismatch
                aadhaar_qr_notes.extend(mismatch_notes)
        except Exception as exc:
            aadhaar_qr_notes = [f"Aadhaar Secure QR check failed to run: {exc}"]

    verification = models.Verification(
        user_id=current_user.id,
        document_type=document_type,
        document_path=path,
        ocr_name=fields["name"],
        ocr_dob=fields["dob"],
        ocr_address=fields["address"],
        ocr_doc_number=fields["doc_number"],
        ocr_confidence=ocr_conf,
        document_format_valid=fields["format_valid"],
        document_authenticity_score=auth_score,
        forgery_score=forgery_result["forgery_score"],
        forgery_indicators=",".join(forgery_result["indicators"]),
        phone_number=phone_number,
        aadhaar_qr_present=aadhaar_qr_present,
        aadhaar_qr_signature_valid=aadhaar_qr_signature_valid,
        aadhaar_qr_using_test_cert=aadhaar_qr_using_test_cert,
        aadhaar_qr_fields=aadhaar_qr_fields_json,
        aadhaar_qr_mismatch_flag=aadhaar_qr_mismatch,
        aadhaar_qr_notes="; ".join(aadhaar_qr_notes),
        status=models.VerificationStatus.pending,
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)

    # cache a face crop from the document photo (if any) for later matching
    detected, crop, _ = face_service.detect_face(raw)
    if detected:
        # copy: crop is a view that would otherwise keep the whole
        # full-resolution grayscale page alive in the cache
        _doc_face_cache[verification.id] = crop.copy()

    detail = f"{document_type} uploaded, OCR confidence {ocr_conf:.1f}, format_valid={fields['format_valid']}"
    if document_type == "aadhaar":
        detail += f", aadhaar_qr_present={aadhaar_qr_present}, aadhaar_qr_signature_valid={aadhaar_qr_signature_valid}"

    db.add(models.AuditLog(
        user_id=current_user.id, verification_id=verification.id,
        action="document_upload",
        detail=detail,
    ))
    db.commit()

    return verification


@router.post("/face/{verification_id}", response_model=schemas.VerificationOut)
def verify_face(
    verification_id: str,
    frames: List[UploadFile] = File(...),
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
    _slot: None = Depends(image_processing_slot),
):
    verification = _get_owned_verification(verification_id, current_user, db)

    if len(frames) < 1:
        raise HTTPException(status_code=400, detail="At least one capture frame is required.")

    frame_bytes = [f.file.read() for f in frames]
    if any(len(fb) == 0 for fb in frame_bytes):
        raise HTTPException(status_code=400, detail="One or more captured frames were empty.")

    liveness_result = face_service.analyze_liveness_burst(frame_bytes)

    if not liveness_result["face_detected"]:
        raise HTTPException(status_code=422, detail="No face detected in the captured frames. Please retry with better lighting.")

    selfie_crop = liveness_result.get("best_frame_crop")
    doc_crop = _doc_face_cache.get(verification_id)
    match_score = face_service.face_similarity(selfie_crop, doc_crop) if doc_crop is not None else 55.0
    if doc_crop is None:
        # no detectable photo on the document scan - don't penalize the user
        # for a document-image-quality issue, but flag it for the admin
        verification.fraud_notes = (verification.fraud_notes or "") + " No face detected on document photo; match score defaulted."

    verification.selfie_path = _save_bytes(frame_bytes[len(frame_bytes) // 2], "selfie")
    verification.face_detected = True
    verification.face_match_score = match_score
    verification.liveness_score = liveness_result["liveness_score"]
    verification.liveness_checks_passed = ",".join(liveness_result["checks_passed"])

    db.commit()
    db.refresh(verification)

    db.add(models.AuditLog(
        user_id=current_user.id, verification_id=verification.id,
        action="face_verification",
        detail=f"match_score={match_score:.1f}, liveness={liveness_result['liveness_score']:.1f}, checks={liveness_result['checks_passed']}",
    ))
    db.commit()

    _doc_face_cache.pop(verification_id, None)
    return verification


# ---------------------------------------------------------------------------
# Additional Module 2 - device fingerprint + geo-velocity.
# ---------------------------------------------------------------------------

@router.post("/{verification_id}/device-signal", response_model=schemas.DeviceSignalOut)
def submit_device_signal(
    verification_id: str,
    payload: schemas.DeviceSignalIn,
    request: Request,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    verification = _get_owned_verification(verification_id, current_user, db)

    fingerprint_json = json.dumps(payload.device_fingerprint, sort_keys=True)
    device_id_hash = hashlib.sha256(fingerprint_json.encode()).hexdigest()[:16]

    # honour X-Forwarded-For if the app is behind a proxy/load balancer,
    # otherwise fall back to the direct client IP
    forwarded = request.headers.get("x-forwarded-for")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)

    geo = geo_service.geolocate(client_ip) if client_ip else None

    travel_flag, travel_detail = False, ""
    if geo:
        prior = (
            db.query(models.Verification)
            .filter(
                models.Verification.user_id == current_user.id,
                models.Verification.id != verification_id,
                models.Verification.geo_lat.isnot(None),
                models.Verification.geo_lon.isnot(None),
            )
            .order_by(models.Verification.created_at.desc())
            .first()
        )
        if prior:
            travel = geo_service.check_impossible_travel(
                prior.geo_lat, prior.geo_lon, prior.created_at,
                geo["lat"], geo["lon"], datetime.utcnow(),
            )
            travel_flag, travel_detail = travel["flag"], travel["detail"]

    verification.phone_number = payload.phone_number or verification.phone_number
    verification.device_fingerprint = fingerprint_json
    verification.device_id_hash = device_id_hash
    verification.ip_address = client_ip
    verification.geo_city = geo["city"] if geo else None
    verification.geo_country = geo["country"] if geo else None
    verification.geo_lat = geo["lat"] if geo else None
    verification.geo_lon = geo["lon"] if geo else None
    verification.travel_flag = travel_flag
    verification.travel_detail = travel_detail

    db.commit()
    db.refresh(verification)

    db.add(models.AuditLog(
        user_id=current_user.id, verification_id=verification.id,
        action="device_signal",
        detail=f"device={device_id_hash}, ip={client_ip}, geo={verification.geo_city}, travel_flag={travel_flag}",
    ))
    db.commit()

    return schemas.DeviceSignalOut(
        device_id_hash=device_id_hash, ip_address=client_ip,
        geo_city=verification.geo_city, geo_country=verification.geo_country,
        travel_flag=travel_flag, travel_detail=travel_detail,
    )


# ---------------------------------------------------------------------------
# Additional Module - Aadhaar Secure QR verification.
# ---------------------------------------------------------------------------

@router.get("/{verification_id}/aadhaar-qr", response_model=schemas.AadhaarQrOut)
def get_aadhaar_qr(
    verification_id: str,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    v = _get_owned_verification(verification_id, current_user, db)
    if v.document_type != "aadhaar":
        raise HTTPException(status_code=400, detail="Aadhaar Secure QR verification only applies to Aadhaar documents.")

    return schemas.AadhaarQrOut(
        qr_present=v.aadhaar_qr_present,
        decodable=bool(v.aadhaar_qr_fields and v.aadhaar_qr_fields != "{}"),
        signature_valid=v.aadhaar_qr_signature_valid,
        using_test_certificate=v.aadhaar_qr_using_test_cert,
        certificate_subject=None,
        fields=json.loads(v.aadhaar_qr_fields) if v.aadhaar_qr_fields else {},
        reference_id_masked=None,
        mismatch_flag=v.aadhaar_qr_mismatch_flag,
        errors=v.aadhaar_qr_notes.split("; ") if v.aadhaar_qr_notes else [],
    )


# ---------------------------------------------------------------------------
# Additional Module 1 - challenge-response liveness.
# ---------------------------------------------------------------------------

@router.get("/{verification_id}/challenge")
def get_challenge(
    verification_id: str,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    """Assigns (or re-returns) a random challenge for this verification.
    Randomized per attempt so a pre-recorded video of one specific gesture
    can't be reused across verifications."""
    verification = _get_owned_verification(verification_id, current_user, db)
    if not verification.challenge_type:
        import random
        verification.challenge_type = random.choice(challenge_service.VALID_CHALLENGES)
        db.commit()
        db.refresh(verification)
    return {"challenge_type": verification.challenge_type}


@router.post("/{verification_id}/challenge", response_model=schemas.ChallengeOut)
def submit_challenge(
    verification_id: str,
    payload: schemas.ChallengeIn,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    verification = _get_owned_verification(verification_id, current_user, db)

    if verification.challenge_type and payload.challenge_type != verification.challenge_type:
        raise HTTPException(
            status_code=400,
            detail=f"Wrong challenge — this attempt was issued '{verification.challenge_type}', not '{payload.challenge_type}'.",
        )

    if not payload.frames_base64:
        raise HTTPException(status_code=400, detail="No frames were captured for the challenge.")

    frames = []
    for b64 in payload.frames_base64:
        try:
            raw = base64.b64decode(b64.split(",")[-1])
            frames.append(Image.open(io.BytesIO(raw)))
        except Exception:
            continue

    if not frames:
        raise HTTPException(status_code=400, detail="Captured frames could not be decoded.")

    result = challenge_service.verify_challenge(frames, payload.challenge_type)

    verification.challenge_type = payload.challenge_type
    verification.challenge_passed = result["passed"]
    verification.challenge_confidence = result["confidence"]
    verification.challenge_detail = result["detail"]
    db.commit()

    db.add(models.AuditLog(
        user_id=current_user.id, verification_id=verification.id,
        action="challenge_liveness",
        detail=f"type={payload.challenge_type}, passed={result['passed']}, confidence={result['confidence']}",
    ))
    db.commit()

    return schemas.ChallengeOut(**result)


@router.post("/finalize/{verification_id}", response_model=schemas.VerificationOut)
def finalize(
    verification_id: str,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    verification = _get_owned_verification(verification_id, current_user, db)

    duplicate = False
    if verification.ocr_doc_number:
        dup = (
            db.query(models.Verification)
            .filter(
                models.Verification.ocr_doc_number == verification.ocr_doc_number,
                models.Verification.user_id != verification.user_id,
            )
            .first()
        )
        duplicate = dup is not None

    manipulation_flag = verification.document_authenticity_score < 35
    # additional signal from the multi-technique forgery detector; OR'd in
    # so it can only ever add coverage, never suppress the original check
    if verification.forgery_score >= 60:
        manipulation_flag = True

    ri = risk_service.RiskInput(
        ocr_confidence=verification.ocr_confidence,
        face_match_score=verification.face_match_score,
        liveness_score=verification.liveness_score,
        authenticity_score=verification.document_authenticity_score,
        document_format_valid=verification.document_format_valid,
        duplicate_identity_flag=duplicate,
        manipulation_flag=manipulation_flag,
    )
    result = risk_service.compute_risk(ri)

    from datetime import datetime
    verification.duplicate_identity_flag = duplicate
    verification.manipulation_flag = manipulation_flag
    verification.fraud_notes = " ".join(result.notes)
    if verification.forgery_indicators:
        verification.fraud_notes += " Forgery-detector flags: " + verification.forgery_indicators + "."
    verification.risk_score = result.risk_score
    verification.risk_band = result.risk_band
    verification.status = models.VerificationStatus(result.status)
    verification.decided_at = datetime.utcnow()

    # ---- Additional Module 3: fraud network ----
    # record this verification's (device, phone, doc-number) triple, then
    # check whether it's now part of a suspicious cluster
    if verification.device_id_hash or verification.phone_number or verification.ocr_doc_number:
        existing_link = db.query(models.IdentityLink).filter(
            models.IdentityLink.verification_id == verification.id
        ).first()
        if not existing_link:
            db.add(models.IdentityLink(
                verification_id=verification.id,
                device_id_hash=verification.device_id_hash,
                phone_number=verification.phone_number,
                id_number=verification.ocr_doc_number,
            ))
            db.commit()

    try:
        graph = fraud_graph_service.build_graph(db, verification.id)
    except Exception:
        graph = {"flagged": False, "linked_count": 0}
    verification.fraud_network_flag = graph["flagged"]
    verification.fraud_network_size = graph["linked_count"]

    # ---- Additional Module 4: trust score engine ----
    ti = risk_service.TrustInput(
        base_risk_score=result.risk_score,
        face_match_score=verification.face_match_score,
        liveness_score=verification.liveness_score,
        authenticity_score=verification.document_authenticity_score,
        manipulation_flag=manipulation_flag,
        duplicate_identity_flag=duplicate,
        challenge_issued=bool(verification.challenge_type),
        challenge_passed=verification.challenge_passed,
        travel_flag=verification.travel_flag,
        fraud_network_flag=verification.fraud_network_flag,
        aadhaar_qr_checked=verification.document_type == "aadhaar" and verification.aadhaar_qr_present,
        aadhaar_qr_signature_valid=verification.aadhaar_qr_signature_valid,
        aadhaar_qr_mismatch_flag=verification.aadhaar_qr_mismatch_flag,
    )
    trust_result = risk_service.compute_trust_score(ti)
    verification.trust_score = trust_result["trust_score"]
    verification.trust_breakdown = json.dumps(trust_result["breakdown"])

    # ---- Additional module: risk-based step-up flow ----
    # Purely a routing decision layered on top of the trust engine above -
    # compute_risk()/compute_trust_score() themselves are untouched. Only
    # sets/advances step_up_* fields; never overwrites verification.status,
    # which keeps being whatever the existing risk engine decided. The new
    # step-up endpoints below are what a user/agent actually use to move a
    # "pending" verification forward.
    step_up_decision = step_up_service.decide_step_up(trust_result["recommendation"], result.risk_band)
    verification.step_up_action = step_up_decision.action
    verification.step_up_status = step_up_decision.status
    verification.step_up_reason = step_up_decision.reason

    db.commit()
    db.refresh(verification)

    db.add(models.AuditLog(
        user_id=current_user.id, verification_id=verification.id,
        action="decision",
        detail=(
            f"risk_score={result.risk_score}, band={result.risk_band}, status={result.status}, "
            f"trust_score={trust_result['trust_score']}, fraud_network_flag={verification.fraud_network_flag}, "
            f"step_up_action={verification.step_up_action}"
        ),
    ))
    db.commit()

    # KYC-as-a-service webhook (only fires for verifications created via the
    # partner API - see services/webhooks.py) + status notification email/SMS.
    # Both are best-effort and run after the response, never blocking it.
    background_tasks.add_task(webhooks_service.dispatch_event, "verification.completed", verification.id)
    background_tasks.add_task(notify_service.notify_status_change, verification.id, current_user.id, verification.status.value)

    return verification


# ---------------------------------------------------------------------------
# Additional Module - Risk-based step-up flow.
#
# finalize() above only *decides* what's needed (verification.step_up_action
# / step_up_status). These endpoints are how a user actually clears a
# "second_factor" step-up (OTP or a repeat selfie), or gets queued for
# "video_kyc". Completing a second-factor step-up successfully advances the
# verification to "approved" through the same audited status-change path
# admin overrides use (audit log + notification + webhook) - it never
# touches compute_risk()/compute_trust_score(), only the final status.
# ---------------------------------------------------------------------------

def _advance_status_after_step_up(
    db: Session, background_tasks: BackgroundTasks,
    verification: models.Verification, actor: models.User, new_status: str, note: str,
):
    previous_status = verification.status.value if verification.status else None
    verification.status = models.VerificationStatus(new_status)
    verification.admin_note = (verification.admin_note + " " if verification.admin_note else "") + note
    verification.decided_at = datetime.utcnow()
    db.commit()
    db.refresh(verification)

    db.add(models.AuditLog(
        user_id=actor.id, verification_id=verification.id,
        action="step_up_resolved", detail=f"{note} (status {previous_status} -> {new_status})",
    ))
    db.commit()

    if new_status != previous_status:
        background_tasks.add_task(notify_service.notify_status_change, verification.id, verification.user_id, new_status)
        background_tasks.add_task(webhooks_service.dispatch_event, "verification.status_changed", verification.id)


def _require_pending_second_factor(v: models.Verification):
    if v.step_up_action != "second_factor":
        raise HTTPException(status_code=400, detail=f"This verification does not require a second factor (step_up_action={v.step_up_action}).")
    if v.step_up_status == "completed":
        raise HTTPException(status_code=400, detail="Step-up was already completed for this verification.")


@router.get("/{verification_id}/step-up", response_model=schemas.StepUpStatusOut)
def get_step_up_status(
    verification_id: str,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    v = _get_owned_verification(verification_id, current_user, db)
    return schemas.StepUpStatusOut(
        action=v.step_up_action, status=v.step_up_status, method=v.step_up_method, reason=v.step_up_reason,
    )


@router.post("/{verification_id}/step-up/otp/request", response_model=schemas.OtpRequestOut)
def request_step_up_otp(
    verification_id: str,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    v = _get_owned_verification(verification_id, current_user, db)
    _require_pending_second_factor(v)

    otp = step_up_service.generate_otp()
    db.add(models.StepUpOtp(
        verification_id=v.id,
        otp_hash=step_up_service.hash_otp(otp, v.id),
        expires_at=step_up_service.otp_expiry(),
    ))
    v.step_up_method = "otp"
    db.commit()

    # Honest limitation, same as services/notify.py: sending a real SMS/
    # email needs your own provider credentials, which this demo doesn't
    # assume. Without SECURIX_HIDE_DEV_OTP=1 set, the OTP is returned in
    # the response below so the flow is testable end-to-end; wire this up
    # to notify_service's real SMTP/Twilio senders for production use.

    db.add(models.AuditLog(
        user_id=current_user.id, verification_id=v.id, action="step_up_otp_requested", detail="OTP generated for second-factor step-up",
    ))
    db.commit()

    return schemas.OtpRequestOut(
        sent=True,
        expires_in_seconds=step_up_service.OTP_TTL_MINUTES * 60,
        dev_otp=otp if step_up_service.should_expose_dev_otp() else None,
    )


@router.post("/{verification_id}/step-up/otp/verify", response_model=schemas.StepUpResultOut)
def verify_step_up_otp(
    verification_id: str,
    payload: schemas.OtpVerifyIn,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    v = _get_owned_verification(verification_id, current_user, db)
    _require_pending_second_factor(v)

    record = (
        db.query(models.StepUpOtp)
        .filter(models.StepUpOtp.verification_id == v.id, models.StepUpOtp.consumed == False)  # noqa: E712
        .order_by(models.StepUpOtp.created_at.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=400, detail="No OTP has been requested for this verification yet.")
    if datetime.utcnow() > record.expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired. Request a new one.")
    if record.attempts >= step_up_service.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new OTP.")

    record.attempts += 1
    db.commit()

    if not step_up_service.otp_matches(payload.otp, v.id, record.otp_hash):
        db.add(models.AuditLog(user_id=current_user.id, verification_id=v.id, action="step_up_otp_failed", detail="Incorrect OTP submitted"))
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect OTP.")

    record.consumed = True
    v.step_up_status = "completed"
    v.step_up_completed_at = datetime.utcnow()
    db.commit()

    _advance_status_after_step_up(db, background_tasks, v, current_user, "approved", "Second-factor step-up (OTP) passed.")
    db.refresh(v)

    return schemas.StepUpResultOut(passed=True, detail="OTP verified - verification approved.", verification=v)


@router.post("/{verification_id}/step-up/selfie", response_model=schemas.StepUpResultOut)
def submit_step_up_selfie(
    verification_id: str,
    background_tasks: BackgroundTasks,
    frames: List[UploadFile] = File(...),
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
    _slot: None = Depends(image_processing_slot),
):
    """The "repeat selfie" alternative to OTP - re-runs liveness + face
    match at a stricter threshold than the original step-1 check. Reads
    the document photo straight from disk rather than the transient
    upload-time face cache, since that cache is popped after the first
    face-verification step and won't exist here."""
    v = _get_owned_verification(verification_id, current_user, db)
    _require_pending_second_factor(v)

    if len(frames) < 1:
        raise HTTPException(status_code=400, detail="At least one capture frame is required.")
    frame_bytes = [f.file.read() for f in frames]
    if any(len(fb) == 0 for fb in frame_bytes):
        raise HTTPException(status_code=400, detail="One or more captured frames were empty.")

    liveness_result = face_service.analyze_liveness_burst(frame_bytes)
    if not liveness_result["face_detected"]:
        raise HTTPException(status_code=422, detail="No face detected in the captured frames. Please retry with better lighting.")

    doc_crop = None
    if v.document_path and os.path.exists(v.document_path):
        with open(v.document_path, "rb") as f:
            _, doc_crop, _ = face_service.detect_face(f.read())

    selfie_crop = liveness_result.get("best_frame_crop")
    match_score = face_service.face_similarity(selfie_crop, doc_crop) if doc_crop is not None else 0.0

    v.step_up_method = "selfie"
    passed = (
        match_score >= step_up_service.STEP_UP_SELFIE_MATCH_THRESHOLD
        and liveness_result["liveness_score"] >= step_up_service.STEP_UP_SELFIE_LIVENESS_THRESHOLD
    )

    db.add(models.AuditLog(
        user_id=current_user.id, verification_id=v.id, action="step_up_selfie",
        detail=f"match_score={match_score:.1f}, liveness={liveness_result['liveness_score']:.1f}, passed={passed}",
    ))
    db.commit()

    if passed:
        v.step_up_status = "completed"
        v.step_up_completed_at = datetime.utcnow()
        db.commit()
        _advance_status_after_step_up(db, background_tasks, v, current_user, "approved", "Second-factor step-up (repeat selfie) passed.")
        db.refresh(v)
        return schemas.StepUpResultOut(passed=True, detail="Repeat selfie matched - verification approved.", verification=v)

    v.step_up_status = "failed"
    db.commit()
    db.refresh(v)
    return schemas.StepUpResultOut(
        passed=False,
        detail=f"Repeat selfie did not meet the step-up threshold (match {match_score:.0f}%, liveness {liveness_result['liveness_score']:.0f}%). This verification will need manual/admin review.",
        verification=v,
    )


@router.post("/{verification_id}/step-up/video-kyc/request", response_model=schemas.VideoKycQueueOut)
def request_video_kyc(
    verification_id: str,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    v = _get_owned_verification(verification_id, current_user, db)
    if v.step_up_action != "video_kyc":
        raise HTTPException(status_code=400, detail=f"This verification was not routed to video-KYC (step_up_action={v.step_up_action}).")

    existing = db.query(models.VideoKycQueue).filter(
        models.VideoKycQueue.verification_id == v.id, models.VideoKycQueue.status.in_(["waiting", "in_progress"]),
    ).first()
    if existing:
        return existing

    entry = models.VideoKycQueue(verification_id=v.id, status="waiting")
    db.add(entry)
    v.step_up_method = "video_kyc"
    db.commit()
    db.refresh(entry)

    db.add(models.AuditLog(
        user_id=current_user.id, verification_id=v.id, action="video_kyc_queued", detail="Queued for live video-KYC call.",
    ))
    db.commit()

    return entry


@router.get("/mine", response_model=list[schemas.VerificationOut])
def my_verifications(current_user: models.User = Depends(auth_utils.get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(models.Verification)
        .filter(models.Verification.user_id == current_user.id)
        .order_by(models.Verification.created_at.desc())
        .all()
    )


@router.get("/{verification_id}", response_model=schemas.VerificationOut)
def get_verification(verification_id: str, current_user: models.User = Depends(auth_utils.get_current_user), db: Session = Depends(get_db)):
    return _get_owned_verification(verification_id, current_user, db)


def _get_owned_verification(verification_id: str, user: models.User, db: Session) -> models.Verification:
    v = db.query(models.Verification).filter(models.Verification.id == verification_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found.")
    if v.user_id != user.id and user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to access this verification.")
    return v


# ---------------------------------------------------------------------------
# Additional Module - Verification Progress full report.
#
# Assembles a rich, dashboard-ready report by combining data already stored
# on the Verification row with a few checks re-computed live from the saved
# files (quality, extended forgery signals, extended face signals). Nothing
# here changes upload_document / verify_face / finalize above - it's a
# read-only aggregation on top of them.
# ---------------------------------------------------------------------------

@router.get("/{verification_id}/full-report")
def full_report(
    verification_id: str,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
    _slot: None = Depends(image_processing_slot),
):
    v = _get_owned_verification(verification_id, current_user, db)

    # ---- 1. Document Upload module ----
    quality = {"quality_score": None, "issues": ["Document file not found"]}
    doc_image = None
    if v.document_path and os.path.exists(v.document_path):
        try:
            with open(v.document_path, "rb") as f:
                doc_raw = f.read()
            doc_image = Image.open(io.BytesIO(doc_raw))
            quality = quality_service.check_quality(doc_image)
        except Exception:
            doc_raw = None
    else:
        doc_raw = None

    document_upload = {
        "document_type": v.document_type,
        "uploaded": bool(v.document_path),
        "quality": quality,
    }

    # ---- 2. OCR module ----
    field_map = {
        "full_name": v.ocr_name,
        "date_of_birth": v.ocr_dob,
        "address": v.ocr_address,
        "document_number": v.ocr_doc_number,
    }
    missing_fields = [k for k, val in field_map.items() if not val]
    ocr_module = {
        "fields": field_map,
        "missing_fields": missing_fields,
        "ocr_confidence": v.ocr_confidence,
        "format_valid": v.document_format_valid,
    }

    # ---- 3. Forgery module (recomputed live for the heatmap/metadata/QR) ----
    if doc_image is not None and doc_raw is not None:
        try:
            forgery_module = forgery_service.full_report(doc_raw, doc_image)
        except Exception:
            forgery_module = {"forgery_score": v.forgery_score, "indicators": v.forgery_indicators.split(",") if v.forgery_indicators else []}
    else:
        forgery_module = {"forgery_score": v.forgery_score, "indicators": v.forgery_indicators.split(",") if v.forgery_indicators else []}

    # ---- 4. Face Matching module ----
    selfie_crop = None
    doc_crop = None
    if v.selfie_path and os.path.exists(v.selfie_path):
        with open(v.selfie_path, "rb") as f:
            _, selfie_crop, _ = face_service.detect_face(f.read())
    if doc_raw is not None:
        _, doc_crop, _ = face_service.detect_face(doc_raw)
    face_module = face_service.full_face_report(selfie_crop, doc_crop, v.face_match_score or 0.0)
    face_module["face_detected"] = v.face_detected

    # ---- 5. Liveness module ----
    liveness_module = {
        "liveness_score": v.liveness_score,
        "checks_passed": v.liveness_checks_passed.split(",") if v.liveness_checks_passed else [],
        "challenge": {
            "challenge_type": v.challenge_type,
            "passed": v.challenge_passed,
            "confidence": v.challenge_confidence,
            "detail": v.challenge_detail,
        },
        "not_available": [
            "mask_detection", "replay_attack_detection", "deepfake_detection",
        ],
    }

    # ---- 6. Risk Assessment module ----
    window_start = datetime.utcnow() - timedelta(hours=24)
    velocity_count = (
        db.query(models.Verification)
        .filter(models.Verification.user_id == v.user_id, models.Verification.created_at >= window_start)
        .count()
    )
    prior_fraud_count = (
        db.query(models.Verification)
        .filter(
            models.Verification.user_id == v.user_id,
            models.Verification.id != v.id,
            (models.Verification.manipulation_flag == True) | (models.Verification.duplicate_identity_flag == True),  # noqa: E712
        )
        .count()
    )
    risk_module = {
        "risk_score": v.risk_score,
        "risk_band": v.risk_band,
        "status": v.status.value if v.status else None,
        "factors": {
            "ocr_confidence": v.ocr_confidence,
            "forgery_score": v.forgery_score,
            "face_match_score": v.face_match_score,
            "liveness_score": v.liveness_score,
            "velocity_last_24h": velocity_count,
            "prior_flagged_verifications": prior_fraud_count,
        },
        "device_and_geo": {
            "device_id_hash": v.device_id_hash,
            "ip_address": v.ip_address,
            "geo_city": v.geo_city,
            "geo_country": v.geo_country,
            "travel_flag": v.travel_flag,
            "travel_detail": v.travel_detail,
        },
        "fraud_network": {
            "flagged": v.fraud_network_flag,
            "linked_count": v.fraud_network_size,
        },
        "trust_engine": {
            "trust_score": v.trust_score,
            "breakdown": json.loads(v.trust_breakdown) if v.trust_breakdown else [],
        },
        "not_available": ["ip_reputation", "vpn_detection", "behavior_analysis", "document_age"],
    }

    # ---- 7. Aadhaar Secure QR module (only meaningful for Aadhaar docs) ----
    aadhaar_qr_module = None
    if v.document_type == "aadhaar":
        aadhaar_qr_module = {
            "qr_present": v.aadhaar_qr_present,
            "signature_valid": v.aadhaar_qr_signature_valid,
            "using_test_certificate": v.aadhaar_qr_using_test_cert,
            "fields": json.loads(v.aadhaar_qr_fields) if v.aadhaar_qr_fields else {},
            "mismatch_flag": v.aadhaar_qr_mismatch_flag,
            "notes": v.aadhaar_qr_notes.split("; ") if v.aadhaar_qr_notes else [],
        }

    # ---- 8. Risk-based step-up module ----
    video_kyc_entry = (
        db.query(models.VideoKycQueue)
        .filter(models.VideoKycQueue.verification_id == v.id)
        .order_by(models.VideoKycQueue.created_at.desc())
        .first()
    )
    step_up_module = {
        "action": v.step_up_action,
        "status": v.step_up_status,
        "method": v.step_up_method,
        "reason": v.step_up_reason,
        "video_kyc_queue_status": video_kyc_entry.status if video_kyc_entry else None,
    }

    return {
        "verification_id": v.id,
        "document_upload": document_upload,
        "ocr": ocr_module,
        "forgery": forgery_module,
        "face": face_module,
        "liveness": liveness_module,
        "risk": risk_module,
        "aadhaar_qr": aadhaar_qr_module,
        "step_up": step_up_module,
    }
