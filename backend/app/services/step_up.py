"""
Additional Module - Risk-based step-up flow.

Today every verification gets exactly the same three checks and lands on
a single decision. This module adds a routing layer on top of the
existing trust-score engine (services/risk.py::compute_trust_score) that
mirrors how real fintechs actually gate friction:

  low predicted risk    -> instant approve            (no change in behavior)
  medium predicted risk -> require a second factor     (repeat selfie OR OTP)
  high predicted risk   -> route to live video-KYC      with a human agent

It is a pure decision function - `decide_step_up()` takes the trust
engine's existing recommendation (already computed, unchanged) and maps
it to an action. Nothing in compute_risk()/compute_trust_score() is
touched; this only decides *what happens next* once those scores exist,
and the actual gating (marking a verification pending step-up, completing
it via OTP/second-selfie/video-KYC) lives in the new endpoints in
routers/kyc.py and routers/video_kyc.py, layered strictly after the
existing finalize() logic.
"""
import hashlib
import os
import random
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

OTP_LENGTH = 6
OTP_TTL_MINUTES = 5
OTP_MAX_ATTEMPTS = 5

# Threshold at which a repeat-selfie step-up is considered passed - deliberately
# stricter than the original face/liveness thresholds used earlier in the
# flow, since this is the *second* chance for a risky verification.
STEP_UP_SELFIE_MATCH_THRESHOLD = 65.0
STEP_UP_SELFIE_LIVENESS_THRESHOLD = 65.0


@dataclass
class StepUpDecision:
    action: str          # "none" | "second_factor" | "video_kyc"
    status: str          # "not_required" | "pending"
    reason: str


def decide_step_up(trust_recommendation: str, risk_band: str) -> StepUpDecision:
    """`trust_recommendation` is compute_trust_score()'s existing
    "approve" / "manual_review" / "reject" output. `risk_band` (the base
    risk engine's "low"/"medium"/"high") is passed too so the reason text
    can cite the concrete signal, but the trust engine's recommendation -
    which already folds in every additional-module penalty - drives the
    routing decision itself.
    """
    if trust_recommendation == "approve":
        return StepUpDecision(action="none", status="not_required", reason="Low predicted risk - instant approval.")
    if trust_recommendation == "manual_review":
        return StepUpDecision(
            action="second_factor",
            status="pending",
            reason=f"Medium predicted risk (risk band: {risk_band}) - a second factor (repeat selfie or OTP) is required before approval.",
        )
    return StepUpDecision(
        action="video_kyc",
        status="pending",
        reason=f"High predicted risk (risk band: {risk_band}) - routed to a live video-KYC call with a human agent instead of an automatic rejection.",
    )


# ---------------------------------------------------------------------------
# OTP helpers
# ---------------------------------------------------------------------------

def generate_otp() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))


def hash_otp(otp: str, verification_id: str) -> str:
    # salted with the verification id so the same OTP digits hash
    # differently across sessions
    return hashlib.sha256(f"{verification_id}:{otp}".encode()).hexdigest()


def otp_expiry() -> datetime:
    return datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES)


def otp_matches(otp: str, verification_id: str, stored_hash: str) -> bool:
    return secrets.compare_digest(hash_otp(otp, verification_id), stored_hash)


# In non-production setups there's usually no real SMS provider configured
# (see services/notify.py's honest "skipped_not_configured" pattern) - so
# the OTP is echoed back in the API response when DEBUG-style behavior is
# wanted, purely so the flow is testable end-to-end without real SMS/email
# credentials. Real deployments should set SECURIX_HIDE_DEV_OTP=1.
def should_expose_dev_otp() -> bool:
    return os.getenv("SECURIX_HIDE_DEV_OTP", "0") != "1"
