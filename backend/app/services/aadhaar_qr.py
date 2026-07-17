"""
Additional Module - Aadhaar Secure QR verification (UIDAI signed QR).

Every Aadhaar card/e-Aadhaar since 2018 carries a "Secure QR Code" printed
on it. It is not just a barcode of the visible text - it's a
UIDAI-signed data blob: gzip-compressed demographic fields with a
256-byte RSA-2048/SHA-256 signature appended at the end. Verifying that
signature against UIDAI's public certificate proves the QR's contents
were genuinely issued by UIDAI and haven't been altered, entirely
offline - no OCR guesswork, no hitting any government API.

This is a genuinely distinctive, Aadhaar-specific check that complements
(does not replace) the generic `forgery.detect_qr()` presence check
elsewhere in this project, which only tells you *a* QR code is readable,
not whether its contents are authentic.

Pipeline
--------
1. Decode the QR code from the document image -> raw bytes (pyzbar).
2. gzip-decompress those bytes.
3. The last 256 bytes are the RSA signature; everything before that is
   the signed payload.
4. Split the payload on 0xFF delimiters to recover demographic fields
   (best-effort field-order mapping - see `_FIELD_ORDER` below).
5. Verify the signature against a bundled X.509 certificate using
   RSASSA-PKCS1-v1_5 / SHA-256.

Honest limitation, stated plainly
----------------------------------
UIDAI's real public certificate is normally downloaded from
uidai.gov.in - that domain isn't reachable from this build environment's
network allowlist, so the certificate bundled here
(`certs/test_uidai_cert.pem`) is a locally-generated TEST certificate,
NOT UIDAI's real signing key. Verifying a real Aadhaar's QR against it
will correctly report "signature invalid", because it genuinely wasn't
signed by this test key - that's expected, not a bug. `scripts/
generate_test_aadhaar_qr.py` generates a fake Aadhaar QR signed with the
matching test private key, so you can see a genuine end-to-end pass.

To go live with real Aadhaar cards:
  1. Download UIDAI's current signing certificate from uidai.gov.in
     (Documents > "Aadhaar Paperless Offline e-KYC" page ships the
     public key used to verify Secure QR / offline XML signatures).
  2. Save it as `backend/certs/uidai_cert.pem` (PEM format; convert with
     `openssl x509 -inform der -in uidai.cer -out uidai_cert.pem` if
     UIDAI distributes it as a .cer/DER file).
  3. Set the environment variable `UIDAI_CERT_PATH=certs/uidai_cert.pem`
     (or just drop the file at that path - it's picked up automatically
     if present) and restart the backend. No code changes needed.
"""
import gzip
import io
import json
import os
from dataclasses import dataclass, field
from typing import Optional

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from PIL import Image

_HERE = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))  # backend/
DEFAULT_TEST_CERT_PATH = os.path.join(_HERE, "certs", "test_uidai_cert.pem")
REAL_CERT_PATH = os.getenv("UIDAI_CERT_PATH", os.path.join(_HERE, "certs", "uidai_cert.pem"))

SIGNATURE_LENGTH_BYTES = 256  # RSA-2048 signature is always 256 bytes

# Best-effort field order for Secure QR v2 demographic fields (there is no
# public UIDAI spec document - this order is reconstructed from community
# reverse-engineering write-ups and matches what scripts/
# generate_test_aadhaar_qr.py writes). Real cards may carry more fields
# after this (e.g. a photo blob) which are ignored here - the signature
# check itself does not depend on getting the field mapping exactly right,
# only on the raw byte boundary between payload and signature.
_FIELD_ORDER = [
    "reference_id", "name", "dob", "gender", "care_of", "district",
    "landmark", "house", "location", "pincode", "post_office", "state",
    "sub_district", "vtc",
]


@dataclass
class AadhaarQrResult:
    qr_present: bool = False
    decodable: bool = False
    signature_valid: Optional[bool] = None  # None = not checked (no QR / decode failed)
    using_test_certificate: bool = True
    certificate_subject: Optional[str] = None
    fields: dict = field(default_factory=dict)
    reference_id_masked: Optional[str] = None
    errors: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "qr_present": self.qr_present,
            "decodable": self.decodable,
            "signature_valid": self.signature_valid,
            "using_test_certificate": self.using_test_certificate,
            "certificate_subject": self.certificate_subject,
            "fields": self.fields,
            "reference_id_masked": self.reference_id_masked,
            "errors": self.errors,
        }


def _load_certificate():
    """Prefers a real UIDAI cert if the operator has dropped one in;
    otherwise falls back to the bundled test cert so the module is always
    demoable. Returns (public_key, subject_str, using_test: bool)."""
    path, using_test = REAL_CERT_PATH, False
    if not os.path.exists(path):
        path, using_test = DEFAULT_TEST_CERT_PATH, True

    with open(path, "rb") as f:
        cert = x509.load_pem_x509_certificate(f.read())
    subject = cert.subject.rfc4514_string()
    return cert.public_key(), subject, using_test


def _decode_qr_bytes(image: Image.Image) -> Optional[bytes]:
    """Decodes a QR code from the image and recovers the *original* raw
    bytes it encoded.

    zbar (via pyzbar) decodes byte-mode QR segments assuming each raw byte
    is a Latin-1 codepoint, then hands back that string re-encoded as
    UTF-8 - so `.data.decode('utf-8').encode('latin-1')` reverses that and
    recovers the original bytes exactly. This matters here because the
    Secure QR payload is gzip-compressed binary, not text.
    """
    try:
        from pyzbar import pyzbar
    except Exception:
        return None

    try:
        decoded = pyzbar.decode(image.convert("RGB"))
    except Exception:
        return None

    if not decoded:
        return None

    raw = decoded[0].data
    try:
        return raw.decode("utf-8").encode("latin-1")
    except (UnicodeDecodeError, UnicodeEncodeError):
        # not all QR payloads round-trip through utf-8/latin-1 cleanly
        # (e.g. if zbar's ECI handling differs) - fall back to the raw
        # bytes as-is rather than failing outright.
        return raw


def _split_signature(decompressed: bytes) -> tuple[bytes, bytes]:
    payload = decompressed[:-SIGNATURE_LENGTH_BYTES]
    signature = decompressed[-SIGNATURE_LENGTH_BYTES:]
    return payload, signature


def _parse_fields(payload: bytes) -> dict:
    # fields are 0xFF-delimited; decode leniently since the tail of a real
    # card's payload may contain a JPEG photo blob that isn't valid text
    try:
        text = payload.decode("latin-1")
    except Exception:
        return {}
    parts = text.split("\xff")
    out = {}
    for i, name in enumerate(_FIELD_ORDER):
        if i < len(parts):
            out[name] = parts[i]
    return out


def _mask_reference_id(ref_id: Optional[str]) -> Optional[str]:
    if not ref_id:
        return None
    digits = "".join(ch for ch in ref_id if ch.isdigit())
    if len(digits) < 4:
        return "•" * len(digits)
    return "•" * (len(digits) - 4) + digits[-4:]


def verify_aadhaar_qr(image: Image.Image) -> AadhaarQrResult:
    """Top-level entry point. Never raises - any failure is captured in
    `.errors` so a bad/missing QR degrades to "not available" rather than
    breaking the document upload flow."""
    result = AadhaarQrResult()

    raw = _decode_qr_bytes(image)
    if raw is None:
        result.errors.append(
            "No decodable QR code found on this document (or the 'pyzbar' "
            "package / system 'zbar' library isn't installed - see "
            "requirements.txt for install instructions)."
        )
        return result

    result.qr_present = True

    try:
        decompressed = gzip.decompress(raw)
    except OSError:
        result.errors.append("QR code found, but its contents aren't gzip-compressed Secure QR data.")
        return result

    if len(decompressed) <= SIGNATURE_LENGTH_BYTES:
        result.errors.append("Decompressed QR payload is too short to contain a signature.")
        return result

    result.decodable = True
    payload, signature = _split_signature(decompressed)
    result.fields = _parse_fields(payload)
    result.reference_id_masked = _mask_reference_id(result.fields.get("reference_id"))

    try:
        public_key, subject, using_test = _load_certificate()
        result.certificate_subject = subject
        result.using_test_certificate = using_test
    except Exception as exc:
        result.errors.append(f"Could not load verification certificate: {exc}")
        return result

    try:
        public_key.verify(signature, payload, padding.PKCS1v15(), hashes.SHA256())
        result.signature_valid = True
    except InvalidSignature:
        result.signature_valid = False
        if using_test:
            result.errors.append(
                "Signature does not match the bundled TEST certificate. This is "
                "expected for a real Aadhaar card - swap in UIDAI's real "
                "certificate (see aadhaar_qr.py docstring) to verify real cards."
            )
        else:
            result.errors.append("UIDAI signature verification failed - the QR contents may have been tampered with.")
    except Exception as exc:
        result.errors.append(f"Signature verification error: {exc}")

    return result


def check_field_mismatch(qr_fields: dict, ocr_name: Optional[str], ocr_dob: Optional[str]) -> tuple[bool, list]:
    """Compares the QR's signed demographic fields against what OCR read
    off the printed card. A big disagreement (genuine QR, but printed
    name/DOB don't match it) is a strong forgery signal - e.g. a genuine
    QR from one card reused on a photoshopped copy with a different name
    printed over it.
    """
    notes = []
    mismatch = False

    qr_name = (qr_fields.get("name") or "").strip().lower()
    ocr_name_norm = (ocr_name or "").strip().lower()
    if qr_name and ocr_name_norm:
        qr_tokens = set(qr_name.split())
        ocr_tokens = set(ocr_name_norm.split())
        overlap = qr_tokens & ocr_tokens
        if not overlap:
            mismatch = True
            notes.append(f"QR name '{qr_fields.get('name')}' does not match OCR-extracted name '{ocr_name}'.")

    qr_dob = (qr_fields.get("dob") or "").strip()
    ocr_dob_norm = (ocr_dob or "").strip()
    if qr_dob and ocr_dob_norm:
        qr_digits = "".join(ch for ch in qr_dob if ch.isdigit())
        ocr_digits = "".join(ch for ch in ocr_dob_norm if ch.isdigit())
        if qr_digits and ocr_digits and qr_digits != ocr_digits:
            mismatch = True
            notes.append(f"QR date of birth '{qr_dob}' does not match OCR-extracted DOB '{ocr_dob}'.")

    return mismatch, notes
