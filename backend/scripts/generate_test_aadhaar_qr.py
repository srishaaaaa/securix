"""
Generates a fake Aadhaar card image with a genuine, correctly-signed
Secure QR code on it, signed with the bundled TEST private key
(certs/test_uidai_private_key.pem). Upload the resulting image as an
"aadhaar" document in the KYC flow to see the Aadhaar Secure QR module
(services/aadhaar_qr.py) report `signature_valid: true` end to end.

This does NOT produce a real/usable Aadhaar card - it's for demoing and
testing the verification pipeline only. Run from the backend/ directory:

    python scripts/generate_test_aadhaar_qr.py \\
        --name "Test User" --dob 01-01-1990 --gender M \\
        --state Karnataka --vtc Bengaluru --pincode 560001

Also accepts --tamper, which flips a byte in the signed payload after
signing so you can see the module correctly report `signature_valid:
false` for a tampered/forged QR.
"""
import argparse
import gzip
import os
import random
import sys

import qrcode
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(HERE)
PRIVATE_KEY_PATH = os.path.join(BACKEND_DIR, "certs", "test_uidai_private_key.pem")

FIELD_ORDER = [
    "reference_id", "name", "dob", "gender", "care_of", "district",
    "landmark", "house", "location", "pincode", "post_office", "state",
    "sub_district", "vtc",
]


def build_signed_qr_bytes(fields: dict) -> bytes:
    with open(PRIVATE_KEY_PATH, "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)

    ordered = [str(fields.get(name, "")) for name in FIELD_ORDER]
    payload = ("\xff".join(ordered)).encode("latin-1")

    signature = private_key.sign(payload, padding.PKCS1v15(), hashes.SHA256())
    return gzip.compress(payload + signature)


def build_tampered_qr_bytes(fields: dict) -> bytes:
    """Signs correctly, then corrupts one payload byte afterwards - same
    shape as a genuine QR, but the signature will no longer match."""
    signed = build_signed_qr_bytes(fields)
    raw = bytearray(gzip.decompress(signed))
    idx = random.randint(0, max(0, len(raw) - 257))  # stay clear of the signature tail
    raw[idx] ^= 0xFF
    return gzip.compress(bytes(raw))


def render_card(qr_payload: bytes, fields: dict, out_path: str):
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=2)
    qr.add_data(qr_payload)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((260, 260))

    card = Image.new("RGB", (700, 440), "white")
    draw = ImageDraw.Draw(card)
    draw.rectangle([0, 0, 699, 439], outline=(60, 60, 60), width=2)
    draw.rectangle([0, 0, 699, 60], fill=(30, 60, 120))
    draw.text((20, 18), "GOVERNMENT OF INDIA (TEST CARD - NOT A REAL AADHAAR)", fill="white")

    lines = [
        f"Name: {fields.get('name', '')}",
        f"DOB: {fields.get('dob', '')}",
        f"Gender: {fields.get('gender', '')}",
        f"Aadhaar No: XXXX XXXX {fields.get('reference_id', '0000')[-4:]}",
        f"{fields.get('vtc', '')}, {fields.get('state', '')} - {fields.get('pincode', '')}",
    ]
    y = 90
    for line in lines:
        draw.text((24, y), line, fill=(20, 20, 20))
        y += 34

    card.paste(qr_img, (410, 90))
    card.save(out_path)
    return out_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", default="Test User")
    parser.add_argument("--dob", default="01-01-1990")
    parser.add_argument("--gender", default="M")
    parser.add_argument("--state", default="Karnataka")
    parser.add_argument("--vtc", default="Bengaluru")
    parser.add_argument("--pincode", default="560001")
    parser.add_argument("--reference-id", default=str(random.randint(10**11, 10**12 - 1)))
    parser.add_argument("--tamper", action="store_true", help="produce a QR whose signature will NOT verify")
    parser.add_argument("--out", default=os.path.join(BACKEND_DIR, "test_aadhaar_card.png"))
    args = parser.parse_args()

    if not os.path.exists(PRIVATE_KEY_PATH):
        print(f"Test private key not found at {PRIVATE_KEY_PATH}.", file=sys.stderr)
        print("Regenerate it (see certs/README.md) before running this script.", file=sys.stderr)
        sys.exit(1)

    fields = {
        "reference_id": args.reference_id,
        "name": args.name,
        "dob": args.dob,
        "gender": args.gender,
        "care_of": "",
        "district": "",
        "landmark": "",
        "house": "",
        "location": "",
        "pincode": args.pincode,
        "post_office": "",
        "state": args.state,
        "sub_district": "",
        "vtc": args.vtc,
    }

    qr_bytes = build_tampered_qr_bytes(fields) if args.tamper else build_signed_qr_bytes(fields)
    out_path = render_card(qr_bytes, fields, args.out)

    mode = "TAMPERED (signature will fail to verify)" if args.tamper else "genuinely signed"
    print(f"Wrote {mode} test Aadhaar card to: {out_path}")
    print("Upload this image as document_type='aadhaar' in the KYC flow to test the module.")


if __name__ == "__main__":
    main()
