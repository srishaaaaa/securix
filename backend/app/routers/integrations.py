"""
Additional module - admin management of KYC-as-a-service credentials and
the status-notification log. Everything here is admin-only since API
keys/webhook secrets are sensitive integration credentials.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth as auth_utils
from ..database import get_db

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


# ---- API keys ----

@router.post("/api-keys", response_model=schemas.ApiKeyCreated)
def create_api_key(
    payload: schemas.ApiKeyCreate,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    raw_key, prefix, key_hash = auth_utils.generate_api_key()
    api_key = models.ApiKey(
        name=payload.name, key_prefix=prefix, key_hash=key_hash, created_by_id=admin.id,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    db.add(models.AuditLog(
        user_id=admin.id, action="api_key_created",
        detail=f"Key '{payload.name}' ({prefix}...) created by {admin.email}",
    ))
    db.commit()

    return schemas.ApiKeyCreated(id=api_key.id, name=api_key.name, key_prefix=prefix, api_key=raw_key)


@router.get("/api-keys", response_model=list[schemas.ApiKeyOut])
def list_api_keys(admin: models.User = Depends(auth_utils.require_admin), db: Session = Depends(get_db)):
    return db.query(models.ApiKey).order_by(models.ApiKey.created_at.desc()).all()


@router.delete("/api-keys/{key_id}")
def revoke_api_key(key_id: str, admin: models.User = Depends(auth_utils.require_admin), db: Session = Depends(get_db)):
    api_key = db.query(models.ApiKey).filter(models.ApiKey.id == key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found.")
    api_key.is_active = False
    db.commit()

    db.add(models.AuditLog(
        user_id=admin.id, action="api_key_revoked", detail=f"Key '{api_key.name}' revoked by {admin.email}",
    ))
    db.commit()
    return {"revoked": True}


# ---- Webhooks ----

@router.post("/webhooks", response_model=schemas.WebhookCreated)
def create_webhook(
    payload: schemas.WebhookCreate,
    admin: models.User = Depends(auth_utils.require_admin),
    db: Session = Depends(get_db),
):
    api_key = db.query(models.ApiKey).filter(models.ApiKey.id == payload.api_key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found.")

    import secrets
    secret = secrets.token_urlsafe(32)
    endpoint = models.WebhookEndpoint(api_key_id=payload.api_key_id, url=payload.url, secret=secret)
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return schemas.WebhookCreated(id=endpoint.id, url=endpoint.url, secret=secret)


@router.get("/webhooks", response_model=list[schemas.WebhookOut])
def list_webhooks(admin: models.User = Depends(auth_utils.require_admin), db: Session = Depends(get_db)):
    return db.query(models.WebhookEndpoint).order_by(models.WebhookEndpoint.created_at.desc()).all()


@router.delete("/webhooks/{webhook_id}")
def revoke_webhook(webhook_id: str, admin: models.User = Depends(auth_utils.require_admin), db: Session = Depends(get_db)):
    endpoint = db.query(models.WebhookEndpoint).filter(models.WebhookEndpoint.id == webhook_id).first()
    if not endpoint:
        raise HTTPException(status_code=404, detail="Webhook not found.")
    endpoint.is_active = False
    db.commit()
    return {"revoked": True}


@router.get("/webhooks/{webhook_id}/deliveries", response_model=list[schemas.WebhookDeliveryOut])
def webhook_deliveries(webhook_id: str, admin: models.User = Depends(auth_utils.require_admin), db: Session = Depends(get_db)):
    return (
        db.query(models.WebhookDelivery)
        .filter(models.WebhookDelivery.webhook_endpoint_id == webhook_id)
        .order_by(models.WebhookDelivery.created_at.desc())
        .limit(100)
        .all()
    )


# ---- Notification log ----

@router.get("/notifications", response_model=list[schemas.NotificationLogOut])
def notification_log(admin: models.User = Depends(auth_utils.require_admin), db: Session = Depends(get_db)):
    return db.query(models.NotificationLog).order_by(models.NotificationLog.created_at.desc()).limit(100).all()
