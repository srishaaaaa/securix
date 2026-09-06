"""
Additional module - KYC-as-a-service: signed webhook delivery.

Fires an HMAC-SHA256-signed POST to every active webhook endpoint tied to
the API key that owns (or, for UI-created verifications, to every active
endpoint across all keys - see dispatch_event) a completed verification.
Signature scheme matches the Stripe/GitHub convention: the raw JSON body
is signed with the endpoint's secret, sent as X-Securix-Signature, so a
partner can verify the request actually came from SECURIX and wasn't
forged or replayed from a different payload.

Delivery is best-effort and non-blocking: called via FastAPI
BackgroundTasks from the router, so a slow or unreachable partner
endpoint never delays the verification response itself.
"""
import hashlib
import hmac
import json

import requests

from .. import models
from ..database import SessionLocal

WEBHOOK_TIMEOUT_SECONDS = 5


def sign_payload(secret: str, raw_body: str) -> str:
    return hmac.new(secret.encode(), raw_body.encode(), hashlib.sha256).hexdigest()


def deliver(db, endpoint: models.WebhookEndpoint, event: str, data: dict) -> models.WebhookDelivery:
    body = json.dumps({"event": event, "data": data}, default=str)
    signature = sign_payload(endpoint.secret, body)

    delivery = models.WebhookDelivery(
        webhook_endpoint_id=endpoint.id,
        verification_id=data.get("verification_id"),
        event=event,
        payload=body,
        status="pending",
        attempts=1,
    )

    try:
        resp = requests.post(
            endpoint.url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Securix-Signature": signature,
                "X-Securix-Event": event,
            },
            timeout=WEBHOOK_TIMEOUT_SECONDS,
        )
        delivery.response_code = resp.status_code
        delivery.status = "success" if 200 <= resp.status_code < 300 else "failed"
    except Exception as exc:
        delivery.status = "failed"
        delivery.response_code = None
        # keep the payload plus the exception message, for admin debugging/replay
        delivery.payload = json.dumps({"event": event, "data": data, "error": str(exc)}, default=str)

    db.add(delivery)
    db.commit()
    return delivery


def dispatch_event(event: str, verification_id: str):
    """Delivers `event` to every active webhook endpoint belonging to the
    API key that created this verification. UI-created verifications have
    no api_key_id, so they simply have no endpoints to notify (a partner
    only gets webhooks for verifications they submitted via the API).

    Runs as a FastAPI BackgroundTask, i.e. after the triggering request's
    own `db` session has already been closed (see notify.py's
    notify_status_change docstring for why) - so this opens its own
    short-lived session and re-fetches the verification fresh instead of
    being handed the closed one.
    """
    db = SessionLocal()
    try:
        verification = db.query(models.Verification).filter(models.Verification.id == verification_id).first()
        if not verification or not verification.api_key_id:
            return

        endpoints = db.query(models.WebhookEndpoint).filter(
            models.WebhookEndpoint.api_key_id == verification.api_key_id,
            models.WebhookEndpoint.is_active == True,  # noqa: E712
        ).all()
        if not endpoints:
            return

        data = {
            "verification_id": verification.id,
            "status": verification.status.value if verification.status else None,
            "risk_score": verification.risk_score,
            "risk_band": verification.risk_band,
            "trust_score": verification.trust_score,
        }
        for endpoint in endpoints:
            deliver(db, endpoint, event, data)
    finally:
        db.close()
