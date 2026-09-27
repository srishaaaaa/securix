"""
Additional module - KYC-as-a-service partner API.

Lets a partner (fintech/bank) submit a document + selfie directly via a
server-to-server call, authenticated with an API key instead of a user
login, and get a decision back synchronously. This is what turns SECURIX
from "an app with a UI" into something another company's onboarding flow
can call directly.

Honest limitation, stated plainly: passive burst-liveness and the
challenge-response check (Module 1) both require an interactive client
capturing a live camera burst over several seconds - there's no way to
do that from a single server-to-server request with two static images.
This endpoint runs every *document*-side check (OCR, forgery, quality)
and a face-match between the two supplied images, but liveness is
reported as "not assessed" rather than faked with a placeholder score,
and the risk engine treats that honestly (an unassessed liveness signal
pulls the risk score down, same as a failed one would).
"""
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from PIL import Image
import pytesseract

from .. import models, schemas, auth as auth_utils
from ..database import get_db
from ..services import ocr as ocr_service
from ..services import face as face_service
from ..services import risk as risk_service
from ..services import forgery as forgery_service
from ..services import webhooks as webhooks_service
from ..services import notify as notify_service
from .kyc import VALID_DOC_TYPES, image_processing_slot

router = APIRouter(prefix="/api/v1", tags=["partner-api"])


@router.post("/verifications", response_model=schemas.PartnerVerificationOut)
def create_verification(
    background_tasks: BackgroundTasks,
    document_type: str = Form(...),
    document: UploadFile = File(...),
    selfie: UploadFile = File(...),
    api_key: models.ApiKey = Depends(auth_utils.require_api_key),
    db: Session = Depends(get_db),
    _slot: None = Depends(image_processing_slot),
):
    if document_type not in VALID_DOC_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported document type.")

    doc_raw = document.file.read()
    selfie_raw = selfie.file.read()
    if not doc_raw or not selfie_raw:
        raise HTTPException(status_code=400, detail="Both 'document' and 'selfie' files are required.")

    try:
        doc_image = Image.open(io.BytesIO(doc_raw))
        doc_image.verify()
        doc_image = Image.open(io.BytesIO(doc_raw))
    except Exception:
        raise HTTPException(status_code=400, detail="'document' is not a valid image.")

    try:
        Image.open(io.BytesIO(selfie_raw)).verify()
    except Exception:
        raise HTTPException(status_code=400, detail="'selfie' is not a valid image.")

    try:
        text, ocr_conf = ocr_service.extract_text_and_confidence(doc_image)
    except pytesseract.TesseractNotFoundError:
        raise HTTPException(status_code=500, detail="OCR engine (Tesseract) is not installed on the server.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {exc}")

    fields = ocr_service.extract_fields(text, document_type)
    auth_score = ocr_service.authenticity_score(doc_image, ocr_conf, fields["format_valid"])

    try:
        forgery_result = forgery_service.detect_forgery(doc_image)
    except Exception:
        forgery_result = {"forgery_score": 0.0, "indicators": []}

    doc_detected, doc_crop, _ = face_service.detect_face(doc_raw)
    selfie_detected, selfie_crop, _ = face_service.detect_face(selfie_raw)
    face_match_score = 0.0
    if doc_detected and selfie_detected:
        face_match_score = face_service.face_similarity(doc_crop, selfie_crop)

    duplicate = False
    if fields["doc_number"]:
        dup = db.query(models.Verification).filter(
            models.Verification.ocr_doc_number == fields["doc_number"],
            models.Verification.user_id != api_key.created_by_id,
        ).first()
        duplicate = dup is not None

    manipulation_flag = auth_score < 35 or forgery_result["forgery_score"] >= 60

    ri = risk_service.RiskInput(
        ocr_confidence=ocr_conf,
        face_match_score=face_match_score,
        liveness_score=0.0,  # not assessable via a single server-to-server call - see module docstring
        authenticity_score=auth_score,
        document_format_valid=fields["format_valid"],
        duplicate_identity_flag=duplicate,
        manipulation_flag=manipulation_flag,
    )
    result = risk_service.compute_risk(ri)

    verification = models.Verification(
        user_id=api_key.created_by_id,
        api_key_id=api_key.id,
        document_type=document_type,
        ocr_name=fields["name"], ocr_dob=fields["dob"], ocr_address=fields["address"],
        ocr_doc_number=fields["doc_number"], ocr_confidence=ocr_conf,
        document_format_valid=fields["format_valid"], document_authenticity_score=auth_score,
        forgery_score=forgery_result["forgery_score"], forgery_indicators=",".join(forgery_result["indicators"]),
        face_detected=doc_detected and selfie_detected, face_match_score=face_match_score,
        liveness_score=0.0, liveness_checks_passed="",
        duplicate_identity_flag=duplicate, manipulation_flag=manipulation_flag,
        fraud_notes=" ".join(result.notes) + " Liveness not assessed via partner API.",
        risk_score=result.risk_score, risk_band=result.risk_band,
        status=models.VerificationStatus(result.status),
        decided_at=datetime.utcnow(),
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)

    ti = risk_service.TrustInput(
        base_risk_score=result.risk_score, face_match_score=face_match_score,
        liveness_score=0.0, authenticity_score=auth_score,
        manipulation_flag=manipulation_flag, duplicate_identity_flag=duplicate,
        challenge_issued=False, challenge_passed=None,
        travel_flag=False, fraud_network_flag=False,
    )
    trust_result = risk_service.compute_trust_score(ti)
    verification.trust_score = trust_result["trust_score"]
    import json
    verification.trust_breakdown = json.dumps(trust_result["breakdown"])
    db.commit()
    db.refresh(verification)

    db.add(models.AuditLog(
        user_id=api_key.created_by_id, verification_id=verification.id,
        action="partner_api_verification",
        detail=f"Created via API key '{api_key.name}' ({api_key.key_prefix}...)",
    ))
    db.commit()

    # webhook + notification dispatch, non-blocking
    background_tasks.add_task(webhooks_service.dispatch_event, "verification.completed", verification.id)
    background_tasks.add_task(notify_service.notify_status_change, verification.id, api_key.created_by_id, verification.status.value)

    response = schemas.PartnerVerificationOut(
        id=verification.id, status=verification.status.value, risk_score=verification.risk_score,
        risk_band=verification.risk_band, trust_score=verification.trust_score,
        ocr_name=verification.ocr_name, ocr_doc_number=verification.ocr_doc_number,
        face_match_score=verification.face_match_score, document_authenticity_score=verification.document_authenticity_score,
        note="Liveness and challenge-response were not assessed (requires an interactive client). "
             "This decision is based on document + face-match signals only.",
        created_at=verification.created_at,
    )
    return response


@router.get("/verifications/{verification_id}", response_model=schemas.PartnerVerificationOut)
def get_verification(
    verification_id: str,
    api_key: models.ApiKey = Depends(auth_utils.require_api_key),
    db: Session = Depends(get_db),
):
    verification = db.query(models.Verification).filter(
        models.Verification.id == verification_id,
        models.Verification.api_key_id == api_key.id,
    ).first()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found for this API key.")

    return schemas.PartnerVerificationOut(
        id=verification.id, status=verification.status.value, risk_score=verification.risk_score,
        risk_band=verification.risk_band, trust_score=verification.trust_score,
        ocr_name=verification.ocr_name, ocr_doc_number=verification.ocr_doc_number,
        face_match_score=verification.face_match_score, document_authenticity_score=verification.document_authenticity_score,
        note="", created_at=verification.created_at,
    )
