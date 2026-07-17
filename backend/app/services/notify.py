"""
Additional module - status notifications (email / SMS).

Sends a message when a verification's status changes (e.g.
under_review -> approved). Every attempt is logged to NotificationLog
regardless of outcome, so the feature is demoable and auditable even
without real provider credentials configured.

Honest limitation, stated plainly: sending real email/SMS needs your own
provider credentials - there's no free universal option, same as the
IP-geolocation caveat elsewhere in this project.
  - Email: standard SMTP via Python's built-in smtplib. Set SMTP_HOST,
    SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM as environment
    variables (e.g. a Gmail app password, or any SMTP relay like
    SendGrid/Mailgun/Postmark's SMTP endpoint). Works for real the moment
    those are set.
  - SMS: calls the Twilio REST API directly over HTTPS (no twilio SDK
    dependency needed). Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER. Any other provider would need a different
    send_sms() implementation - this one is Twilio-specific.

Without those env vars set, both functions log a
"skipped_not_configured" NotificationLog row instead of raising -
so the rest of the KYC flow is never blocked by a missing integration.
"""
import os
import smtplib
from email.mime.text import MIMEText

import requests

from .. import models

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER")

STATUS_MESSAGES = {
    "approved": "Good news - your identity verification has been approved.",
    "rejected": "Your identity verification could not be approved. Please contact support.",
    "under_review": "Your identity verification is under manual review. We'll notify you once it's resolved.",
}


def _log(db, verification_id, channel, recipient, event, status, detail=""):
    db.add(models.NotificationLog(
        verification_id=verification_id, channel=channel, recipient=recipient,
        event=event, status=status, detail=detail,
    ))
    db.commit()


def send_email(db, verification_id: str, to_email: str, subject: str, body: str):
    event = f"status_changed"
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
        _log(db, verification_id, "email", to_email, event, "skipped_not_configured",
             "SMTP_HOST/SMTP_USER/SMTP_PASSWORD not set - see services/notify.py")
        return
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=8) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        _log(db, verification_id, "email", to_email, event, "sent")
    except Exception as exc:
        _log(db, verification_id, "email", to_email, event, "failed", str(exc))


def send_sms(db, verification_id: str, to_number: str, body: str):
    event = f"status_changed"
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER):
        _log(db, verification_id, "sms", to_number, event, "skipped_not_configured",
             "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER not set - see services/notify.py")
        return
    try:
        resp = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
            data={"To": to_number, "From": TWILIO_FROM_NUMBER, "Body": body},
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            timeout=8,
        )
        if resp.status_code < 300:
            _log(db, verification_id, "sms", to_number, event, "sent")
        else:
            _log(db, verification_id, "sms", to_number, event, "failed", resp.text[:300])
    except Exception as exc:
        _log(db, verification_id, "sms", to_number, event, "failed", str(exc))


def notify_status_change(db, verification: models.Verification, user: models.User, new_status: str):
    """Fires both channels (best-effort, independently) whenever a
    verification's status resolves to approved/rejected/under_review."""
    body = STATUS_MESSAGES.get(new_status)
    if not body:
        return

    if user and user.email:
        send_email(db, verification.id, user.email, "SECURIX verification update", body)

    phone = verification.phone_number or (user.mobile if user else None)
    if phone:
        send_sms(db, verification.id, phone, body)
