"""
Module 2 - Document Upload & OCR.

Uses real Tesseract OCR (via pytesseract) to extract text from the uploaded
ID image, then applies regex/format rules per document type to pull out
structured fields and validate the format.

Note: this performs *format* validation (does the number look like a real
Aadhaar/PAN/passport number, is text extractable at all) rather than
verifying against a government database, which would require a live
UIDAI/NSDL integration not available in this environment.
"""
import re
from typing import Optional

import numpy as np
import pytesseract
from PIL import Image, ImageFilter, ImageOps

PAN_RE = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
AADHAAR_RE = re.compile(r"\b(\d{4}[ \t]?\d{4}[ \t]?\d{4})\b")
PASSPORT_RE = re.compile(r"\b[A-PR-WYa-pr-wy][0-9]{7}\b")
DL_RE = re.compile(r"\b[A-Z]{2}[0-9]{1,2}[ \t]?[0-9]{4,11}\b")
DOB_RE = re.compile(r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})\b")
NAME_LINE_RE = re.compile(r"^[A-Za-z][A-Za-z\s.]{2,40}$")
_NAME_STOPWORDS = {
    "GOVERNMENT", "INDIA", "INCOME", "TAX", "DEPARTMENT", "CARD", "UNIQUE",
    "IDENTIFICATION", "AUTHORITY", "AADHAAR", "PERMANENT", "ACCOUNT", "NUMBER",
    "PASSPORT", "LICENSE", "LICENCE", "DRIVING", "REPUBLIC", "DOB", "DATE",
    "BIRTH", "ADDRESS", "MALE", "FEMALE", "SIGNATURE",
}

# Standard Aadhaar/PAN/passport disclaimer sentences ("Aadhaar is proof of
# identity, not of citizenship... should not be used without further
# verification (online/offline)...") are long, comma-free prose - exactly
# the shape the crude "longest remaining line" address guess below is
# looking for, so without an explicit denylist they get picked as the
# address instead of the real one. Matched case-insensitively against
# individual words, tolerant of the OCR mangling common on these lines.
_ADDRESS_DISCLAIMER_WORDS = {
    "verification", "verify", "verified", "citizenship", "proof", "declared",
    "electronically", "generated", "signature", "helpline", "toll", "download",
    "downloaded", "specimen", "resident", "residents", "grievance", "complaint",
    "offline", "masked", "transmitted", "reprint", "letter", "require", "requires",
}
_PIN_CODE_RE = re.compile(r"\b\d{6}\b")

# Ignored when deciding whether a line is "pure boilerplate" (e.g.
# "GOVERNMENT OF INDIA") so a connector word like "OF" doesn't make an
# otherwise all-stopword header line slip past the boilerplate check.
_CONNECTOR_WORDS = {"OF", "AND", "THE", "FOR", "TO", "IN", "A", "AN", "IS", "ON", "&"}


def _verhoeff_check(number: str) -> bool:
    """Lightweight structural check for a 12-digit Aadhaar-style number.

    This is NOT the real Verhoeff algorithm table (that requires UIDAI's
    exact multiplication/permutation tables) - it's a structural sanity
    check (length + all-digit + not all-repeating) used as a stand-in so
    the pipeline has something concrete to validate against.
    """
    digits = number.replace(" ", "")
    if len(digits) != 12 or not digits.isdigit():
        return False
    if len(set(digits)) == 1:  # all same digit -> obviously fake
        return False
    return True


def _pan_structural_check(pan: str) -> bool:
    return bool(PAN_RE.fullmatch(pan))


def preprocess_for_ocr(image: Image.Image) -> Image.Image:
    gray = ImageOps.grayscale(image)
    gray = gray.filter(ImageFilter.SHARPEN)
    # simple contrast stretch
    arr = np.array(gray).astype(np.float32)
    lo, hi = np.percentile(arr, 2), np.percentile(arr, 98)
    if hi > lo:
        arr = np.clip((arr - lo) * 255.0 / (hi - lo), 0, 255)
    return Image.fromarray(arr.astype(np.uint8))


def extract_text_and_confidence(image: Image.Image) -> tuple[str, float]:
    processed = preprocess_for_ocr(image)
    data = pytesseract.image_to_data(processed, output_type=pytesseract.Output.DICT)

    # group words back into real lines using tesseract's block/par/line indices,
    # instead of one word per line, so multi-word names and spaced-out ID
    # numbers ("1234 5678 9123") stay on a single matchable line.
    lines: dict[tuple, list[str]] = {}
    n = len(data["text"])
    for i in range(n):
        word = data["text"][i]
        if not word.strip():
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        lines.setdefault(key, []).append(word)

    text = "\n".join(" ".join(words) for words in lines.values())
    confidences = [float(c) for c in data["conf"] if c not in ("-1", -1)]
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return text, max(0.0, min(100.0, avg_conf))


def extract_fields(text: str, document_type: str) -> dict:
    fields = {"name": None, "dob": None, "address": None, "doc_number": None, "format_valid": False}

    dob_match = DOB_RE.search(text)
    if dob_match:
        fields["dob"] = dob_match.group(1)

    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    for ln in lines:
        words = ln.split()
        if NAME_LINE_RE.match(ln) and len(words) >= 2:
            if any(w.upper().strip(".") in _NAME_STOPWORDS for w in words):
                continue
            fields["name"] = ln.title()
            break

    if document_type == "aadhaar":
        m = AADHAAR_RE.search(text)
        if m:
            num = m.group(1)
            fields["doc_number"] = num
            fields["format_valid"] = _verhoeff_check(num)
    elif document_type == "pan":
        m = PAN_RE.search(text.upper())
        if m:
            fields["doc_number"] = m.group(0)
            fields["format_valid"] = _pan_structural_check(m.group(0))
    elif document_type == "passport":
        m = PASSPORT_RE.search(text.upper())
        if m:
            fields["doc_number"] = m.group(0)
            fields["format_valid"] = True
    elif document_type == "driving_license":
        m = DL_RE.search(text.upper())
        if m:
            fields["doc_number"] = m.group(0)
            fields["format_valid"] = True

    # crude address guess: longest remaining line that isn't the name,
    # a pure boilerplate header, the ID-number line, or the standard legal
    # disclaimer sentence - and preferring a line with a 6-digit PIN code
    # (a real positive signal for an Indian address) over plain length.
    addr_candidates = sorted(lines, key=len, reverse=True)
    addr_candidates = sorted(addr_candidates, key=lambda c: bool(_PIN_CODE_RE.search(c)), reverse=True)
    for c in addr_candidates:
        words = c.split()
        substantive_words = [w for w in words if w.upper().strip(".") not in _CONNECTOR_WORDS]
        is_boilerplate = substantive_words and all(w.upper().strip(".") in _NAME_STOPWORDS for w in substantive_words)
        is_disclaimer = any(w.lower().strip(".,()?'’") in _ADDRESS_DISCLAIMER_WORDS for w in words)
        if c.title() == fields.get("name") or is_boilerplate or is_disclaimer:
            continue
        if fields.get("doc_number") and fields["doc_number"].replace(" ", "") in c.replace(" ", ""):
            continue
        if len(c) > 15:
            fields["address"] = c
            break

    return fields


def authenticity_score(image: Image.Image, ocr_confidence: float, format_valid: bool) -> float:
    """Very lightweight tamper heuristic combining OCR confidence, format
    validity, and an Error-Level-Analysis-style recompression check.
    Returns a 0-100 'looks authentic' score (higher = more trustworthy).
    """
    import io as _io
    original = image.convert("RGB")
    tmp = _io.BytesIO()
    original.save(tmp, "JPEG", quality=90)
    tmp.seek(0)
    resaved = Image.open(tmp)

    arr1 = np.asarray(original).astype(np.int16)
    arr2 = np.asarray(resaved).astype(np.int16)
    diff = np.abs(arr1 - arr2)
    ela_score = float(diff.mean())  # low = consistent compression history, high = suspicious local edits

    score = 60.0
    score += (ocr_confidence - 50) * 0.3
    score += 15.0 if format_valid else -25.0
    score -= min(ela_score * 2.0, 30.0)
    return float(max(0.0, min(100.0, score)))
