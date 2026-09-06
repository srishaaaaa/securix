"""
Additional Module - Risk-based step-up flow: the admin/agent side.

High-risk verifications land in this queue (see services/step_up.py and
routers/kyc.py's `request_video_kyc`) instead of being auto-rejected. An
admin/agent works the queue here, then records the outcome of the live
call, which updates the underlying Verification's status through the
exact same audited pattern routers/admin.py's existing decision endpoint
uses (status + admin_note + decided_at + audit log + notification +
webhook). That existing endpoint is untouched - this is a new, additive
router.
"""
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import auth as auth_utils, models, schemas
from ..database import get_db
from ..services import notify as notify_service
from ..services import webhooks as webhooks_service

router = APIRouter(prefix="/api/admin/video-kyc", tags=["video-kyc"])


@router.get("", response_model=list[schemas.VideoKycQueueOut])
def list_queue(
    status: str | None = None,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(models.VideoKycQueue)
    if status:
        q = q.filter(models.VideoKycQueue.status == status)
    return q.order_by(models.VideoKycQueue.created_at.asc()).all()


@router.post("/{entry_id}/assign", response_model=schemas.VideoKycQueueOut)
def assign_entry(
    entry_id: str,
    payload: schemas.VideoKycAssign,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    entry = db.query(models.VideoKycQueue).filter(models.VideoKycQueue.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found.")

    entry.assigned_agent_id = payload.agent_id or admin.id
    entry.status = "in_progress"
    entry.started_at = datetime.utcnow()
    db.commit()
    db.refresh(entry)

    db.add(models.AuditLog(
        user_id=admin.id, verification_id=entry.verification_id,
        action="video_kyc_assigned", detail=f"Assigned to agent {entry.assigned_agent_id}",
    ))
    db.commit()

    return entry


@router.post("/{entry_id}/complete", response_model=schemas.VideoKycQueueOut)
def complete_entry(
    entry_id: str,
    payload: schemas.VideoKycComplete,
    background_tasks: BackgroundTasks,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    if payload.decision not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="decision must be 'approved' or 'rejected'.")

    entry = db.query(models.VideoKycQueue).filter(models.VideoKycQueue.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found.")

    verification = db.query(models.Verification).filter(models.Verification.id == entry.verification_id).first()
    if not verification:
        raise HTTPException(status_code=404, detail="Underlying verification not found.")

    entry.status = "completed"
    entry.agent_notes = payload.notes
    entry.completed_at = datetime.utcnow()

    previous_status = verification.status.value if verification.status else None
    verification.status = models.VerificationStatus(payload.decision)
    verification.admin_note = (verification.admin_note + " " if verification.admin_note else "") + f"Video-KYC call outcome: {payload.decision}. {payload.notes}"
    verification.decided_at = datetime.utcnow()
    verification.step_up_status = "completed"
    verification.step_up_completed_at = datetime.utcnow()
    db.commit()
    db.refresh(entry)
    db.refresh(verification)

    db.add(models.AuditLog(
        user_id=admin.id, verification_id=verification.id,
        action="video_kyc_completed",
        detail=f"Agent {admin.email} recorded video-KYC decision: {payload.decision}. {payload.notes}",
    ))
    db.commit()

    if payload.decision != previous_status:
        background_tasks.add_task(notify_service.notify_status_change, verification.id, verification.user_id, payload.decision)
        background_tasks.add_task(webhooks_service.dispatch_event, "verification.status_changed", verification.id)

    return entry


@router.post("/{entry_id}/cancel", response_model=schemas.VideoKycQueueOut)
def cancel_entry(
    entry_id: str,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    entry = db.query(models.VideoKycQueue).filter(models.VideoKycQueue.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found.")
    entry.status = "cancelled"
    db.commit()
    db.refresh(entry)
    return entry
