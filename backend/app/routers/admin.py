from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models, schemas, auth as auth_utils
from ..database import get_db
from ..services import webhooks as webhooks_service
from ..services import notify as notify_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/verifications", response_model=list[schemas.VerificationOut])
def list_verifications(
    status: str | None = None,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(models.Verification)
    if status:
        q = q.filter(models.Verification.status == status)
    return q.order_by(models.Verification.created_at.desc()).all()


@router.get("/stats")
def stats(admin: models.User = Depends(auth_utils.require_admin), db: Session = Depends(get_db)):
    total_users = db.query(func.count(models.User.id)).scalar()
    total_verifications = db.query(func.count(models.Verification.id)).scalar()

    by_status = dict(
        db.query(models.Verification.status, func.count(models.Verification.id))
        .group_by(models.Verification.status)
        .all()
    )
    by_status = {k.value if hasattr(k, "value") else k: v for k, v in by_status.items()}

    by_band = dict(
        db.query(models.Verification.risk_band, func.count(models.Verification.id))
        .filter(models.Verification.risk_band != "")
        .group_by(models.Verification.risk_band)
        .all()
    )

    avg_risk = db.query(func.avg(models.Verification.risk_score)).scalar() or 0
    fraud_flags = (
        db.query(func.count(models.Verification.id))
        .filter(
            (models.Verification.duplicate_identity_flag == True)  # noqa: E712
            | (models.Verification.manipulation_flag == True)  # noqa: E712
        )
        .scalar()
    )

    return {
        "total_users": total_users,
        "total_verifications": total_verifications,
        "by_status": by_status,
        "by_risk_band": by_band,
        "average_risk_score": round(float(avg_risk), 2),
        "fraud_flag_count": fraud_flags,
    }


@router.post("/verifications/{verification_id}/decision", response_model=schemas.VerificationOut)
def override_decision(
    verification_id: str,
    payload: schemas.AdminDecision,
    background_tasks: BackgroundTasks,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    if payload.status not in {"approved", "under_review", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid status value.")

    v = db.query(models.Verification).filter(models.Verification.id == verification_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found.")

    previous_status = v.status.value if v.status else None
    v.status = models.VerificationStatus(payload.status)
    v.admin_note = payload.admin_note or v.admin_note
    v.decided_at = datetime.utcnow()
    db.commit()
    db.refresh(v)

    db.add(models.AuditLog(
        user_id=admin.id, verification_id=v.id, action="admin_override",
        detail=f"Admin {admin.email} set status to {payload.status}: {payload.admin_note}",
    ))
    db.commit()

    # status-notification module: fire only on an actual transition, so
    # re-saving the same status twice doesn't spam the user
    if payload.status != previous_status:
        owner = db.query(models.User).filter(models.User.id == v.user_id).first()
        background_tasks.add_task(notify_service.notify_status_change, db, v, owner, payload.status)
        background_tasks.add_task(webhooks_service.dispatch_event, db, "verification.status_changed", v)

    return v


@router.get("/audit-logs")
def audit_logs(admin: models.User = Depends(auth_utils.require_admin), db: Session = Depends(get_db), limit: int = 100):
    logs = db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id, "user_id": l.user_id, "verification_id": l.verification_id,
            "action": l.action, "detail": l.detail, "created_at": l.created_at,
        }
        for l in logs
    ]


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(admin: models.User = Depends(auth_utils.require_admin), db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()
