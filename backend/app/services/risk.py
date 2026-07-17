"""
Module 5 & 6 - Risk Analysis and Decision Engine.

Combines every verification signal into a single 0-100 risk score
(higher = riskier) using the weights from the project brief:
  OCR Accuracy 25, Face Match 30, Liveness 20, Document Authenticity 25
then layers on fraud-specific penalties (duplicate identity, suspected
manipulation) before mapping to a final decision band.
"""
from dataclasses import dataclass
from typing import Optional

WEIGHTS = {"ocr": 25, "face": 30, "liveness": 20, "authenticity": 25}


@dataclass
class RiskInput:
    ocr_confidence: float          # 0-100
    face_match_score: float        # 0-100
    liveness_score: float          # 0-100
    authenticity_score: float      # 0-100
    document_format_valid: bool
    duplicate_identity_flag: bool
    manipulation_flag: bool


@dataclass
class RiskOutput:
    risk_score: float
    risk_band: str
    status: str
    breakdown: dict
    notes: list[str]


def compute_risk(ri: RiskInput) -> RiskOutput:
    notes = []

    trust = (
        ri.ocr_confidence * WEIGHTS["ocr"]
        + ri.face_match_score * WEIGHTS["face"]
        + ri.liveness_score * WEIGHTS["liveness"]
        + ri.authenticity_score * WEIGHTS["authenticity"]
    ) / 100.0  # 0-100 scale

    risk_score = 100.0 - trust

    if not ri.document_format_valid:
        risk_score += 15
        notes.append("Document number failed structural format validation.")

    if ri.duplicate_identity_flag:
        risk_score += 30
        notes.append("Document number matches an existing verified identity.")

    if ri.manipulation_flag:
        risk_score += 20
        notes.append("Possible image manipulation detected (recompression artifacts).")

    if ri.face_match_score < 40:
        notes.append("Selfie does not closely match the document photo.")

    if ri.liveness_score < 40:
        notes.append("Liveness signals were weak — possible spoofing attempt.")

    risk_score = max(0.0, min(100.0, risk_score))

    if risk_score <= 30:
        band, status = "low", "approved"
    elif risk_score <= 70:
        band, status = "medium", "under_review"
    else:
        band, status = "high", "rejected"

    breakdown = {
        "ocr_confidence": ri.ocr_confidence,
        "face_match_score": ri.face_match_score,
        "liveness_score": ri.liveness_score,
        "authenticity_score": ri.authenticity_score,
        "weights": WEIGHTS,
        "trust_score": round(trust, 2),
    }

    if not notes:
        notes.append("All verification signals within expected range.")

    return RiskOutput(risk_score=round(risk_score, 2), risk_band=band, status=status, breakdown=breakdown, notes=notes)


# ---------------------------------------------------------------------------
# Additional Module 4 - Trust Score Engine
# ---------------------------------------------------------------------------
# A separate, explainable rule combiner that every other additional module
# (challenge liveness, geo-velocity, fraud network) feeds into. Deliberately
# kept independent of compute_risk() above so the original risk engine's
# behavior is untouched; this produces a second, additive score with a
# human-readable rule breakdown, e.g. "+30 impossible travel, +25 device
# mismatch, +20 face liveness fail".

TRUST_RULES = {
    "impossible_travel": 30,
    "challenge_liveness_fail": 20,
    "fraud_network": 25,
    "weak_face_match": 15,
    "weak_passive_liveness": 10,
    "document_manipulation": 20,
    "duplicate_identity": 25,
    "low_document_authenticity": 15,
    # Aadhaar Secure QR module (additive - only ever fires for document_type
    # == "aadhaar" verifications where a QR was actually found & decoded)
    "aadhaar_qr_signature_invalid": 30,
    "aadhaar_qr_data_mismatch": 25,
}


@dataclass
class TrustInput:
    base_risk_score: float             # from compute_risk(), 0-100 (higher = riskier)
    face_match_score: float            # 0-100
    liveness_score: float              # 0-100
    authenticity_score: float          # 0-100
    manipulation_flag: bool
    duplicate_identity_flag: bool
    challenge_issued: bool
    challenge_passed: Optional[bool]
    travel_flag: bool
    fraud_network_flag: bool
    # Aadhaar Secure QR module (additive, all default so every existing
    # caller of TrustInput(...) keeps working unchanged)
    aadhaar_qr_checked: bool = False
    aadhaar_qr_signature_valid: Optional[bool] = None
    aadhaar_qr_mismatch_flag: bool = False


def compute_trust_score(ti: TrustInput) -> dict:
    """Returns {"trust_score": float (0-100, higher = more trustworthy),
    "breakdown": [{"label": str, "delta": int}], "recommendation": str}."""
    penalty = 0
    breakdown = []

    def add(rule_key: str, label: str):
        nonlocal penalty
        pts = TRUST_RULES[rule_key]
        penalty += pts
        breakdown.append({"label": label, "delta": -pts})

    if ti.travel_flag:
        add("impossible_travel", "Impossible travel between attempts")

    if ti.challenge_issued and ti.challenge_passed is False:
        add("challenge_liveness_fail", "Challenge-response liveness failed")

    if ti.fraud_network_flag:
        add("fraud_network", "Linked to other identities via shared device/phone")

    if ti.face_match_score < 40:
        add("weak_face_match", "Weak face match to document photo")

    if ti.liveness_score < 40:
        add("weak_passive_liveness", "Weak passive liveness signal")

    if ti.manipulation_flag:
        add("document_manipulation", "Document manipulation detected")

    if ti.duplicate_identity_flag:
        add("duplicate_identity", "Duplicate identity on file")

    if ti.authenticity_score < 40:
        add("low_document_authenticity", "Low document authenticity score")

    if ti.aadhaar_qr_checked and ti.aadhaar_qr_signature_valid is False:
        add("aadhaar_qr_signature_invalid", "Aadhaar Secure QR signature did not verify")

    if ti.aadhaar_qr_mismatch_flag:
        add("aadhaar_qr_data_mismatch", "Aadhaar Secure QR data disagrees with printed/OCR-read fields")

    # start from the inverse of the base risk engine's score, then layer the
    # additional-module penalties on top so nothing here silently overrides
    # the original risk engine - it just adds more explainable deductions.
    base_trust = 100.0 - ti.base_risk_score
    trust_score = max(0.0, min(100.0, base_trust - penalty))

    if trust_score >= 70:
        recommendation = "approve"
    elif trust_score >= 40:
        recommendation = "manual_review"
    else:
        recommendation = "reject"

    if not breakdown:
        breakdown.append({"label": "No additional risk signals triggered", "delta": 0})

    return {"trust_score": round(trust_score, 2), "breakdown": breakdown, "recommendation": recommendation}
