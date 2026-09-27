"""
Additional Module - Multi-Technique Forgery Detection.

This is an ADDITIVE module (does not replace ocr.authenticity_score, which
stays exactly as-is). It complements the existing ELA-based authenticity
check with several independent classical-CV heuristics adapted from a
dedicated forgery-detection microservice:

  - edge pattern analysis      (unnatural edge density / uniform gradients)
  - texture consistency        (regions that don't match the rest of the doc)
  - color-channel analysis     (posterization / spiky histograms)
  - noise pattern analysis     (over-smoothing or uniform noise)

Each technique returns an independent 0-1 "suspicion" score plus
human-readable indicators; the overall forgery_score (0-100, higher =
more suspicious) is the average of all techniques, and is stored
alongside (not instead of) the existing document_authenticity_score.
"""
from typing import Any
import base64
import io

import cv2
import numpy as np
from PIL import Image


def _pil_to_bgr(image: Image.Image) -> np.ndarray:
    rgb = np.array(image.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


_STRIP_ROWS = 256


def _strip_mean_var(gray: np.ndarray, fn) -> tuple[float, float]:
    """Mean and (population) variance of fn(gray) over the whole image,
    computed strip by strip so a large photo never needs a full-size
    float64 copy. fn must be a 3x3 filter: each strip carries one real
    neighbouring row above/below, so every output pixel is exactly what
    running fn on the whole image would give."""
    h = gray.shape[0]
    n, mean, m2 = 0, 0.0, 0.0
    for y0 in range(0, h, _STRIP_ROWS):
        y1 = min(y0 + _STRIP_ROWS, h)
        top, bottom = (1 if y0 > 0 else 0), (1 if y1 < h else 0)
        out = np.asarray(fn(gray[y0 - top:y1 + bottom]), dtype=np.float64)[top:top + (y1 - y0)]
        cn = out.size
        cmean = float(out.mean())
        cm2 = float(np.square(out - cmean).sum())
        # Chan et al. parallel combination of running mean/M2
        delta = cmean - mean
        total = n + cn
        mean += delta * cn / total
        m2 += cm2 + delta * delta * n * cn / total
        n = total
    return mean, (m2 / n if n else 0.0)


def _analyze_edge_patterns(gray: np.ndarray) -> dict:
    score = 0.0
    indicators = []

    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.sum(edges > 0) / (edges.shape[0] * edges.shape[1]))

    if edge_density < 0.01:
        score += 0.3
        indicators.append("Low edge density - possible blur/manipulation")
    elif edge_density > 0.1:
        score += 0.2
        indicators.append("High edge density - possible over-sharpening")

    _, direction_var = _strip_mean_var(gray, lambda g: np.arctan2(
        cv2.Sobel(g, cv2.CV_64F, 0, 1, ksize=3), cv2.Sobel(g, cv2.CV_64F, 1, 0, ksize=3)))
    direction_std = float(np.sqrt(direction_var))
    if direction_std < 0.5:
        score += 0.2
        indicators.append("Uniform edge directions - possible manipulation")

    return {"score": min(score, 1.0), "indicators": indicators}


def _analyze_texture_consistency(gray: np.ndarray) -> dict:
    score = 0.0
    indicators = []

    h, w = gray.shape
    features = []
    for i in range(4):
        for j in range(4):
            region = gray[i * h // 4:(i + 1) * h // 4, j * w // 4:(j + 1) * w // 4]
            if region.size > 0:
                features.append(float(np.var(region)))

    if len(features) > 1:
        std, mean = float(np.std(features)), float(np.mean(features))
        if mean > 0 and std > mean * 0.5:
            score += 0.3
            indicators.append("Inconsistent texture patterns across regions")
        if mean > 0 and std < mean * 0.1:
            score += 0.2
            indicators.append("Unnaturally uniform texture - possible smoothing")

    return {"score": min(score, 1.0), "indicators": indicators}


def _analyze_color_patterns(bgr: np.ndarray) -> dict:
    score = 0.0
    indicators = []

    for idx, name in enumerate(["B", "G", "R"]):
        channel = bgr[:, :, idx]
        hist = cv2.calcHist([channel], [0], None, [256], [0, 256])
        hist_std, hist_mean = float(np.std(hist)), float(np.mean(hist))
        if hist_mean > 0 and hist_std > hist_mean * 2:
            score += 0.1
            indicators.append(f"Unnatural {name} channel distribution")
        if len(np.unique(channel)) < 50:
            score += 0.2
            indicators.append(f"Posterization detected in {name} channel")

    return {"score": min(score, 1.0), "indicators": indicators}


def _analyze_noise_patterns(gray: np.ndarray) -> dict:
    score = 0.0
    indicators = []

    _, laplacian_var = _strip_mean_var(gray, lambda g: cv2.Laplacian(g, cv2.CV_64F))
    if laplacian_var < 10:
        score += 0.3
        indicators.append("Very low noise level - possible smoothing")
    elif laplacian_var > 500:
        score += 0.2
        indicators.append("High noise level - possible compression artifacts")

    kernel = np.ones((3, 3), np.float32) / 9
    _, noise_var = _strip_mean_var(
        gray, lambda g: g.astype(np.float32) - cv2.filter2D(g, -1, kernel).astype(np.float32))
    noise_std = float(np.sqrt(noise_var))
    if noise_var > 0 and noise_std < noise_var * 0.1:
        score += 0.2
        indicators.append("Unnaturally uniform noise pattern")

    return {"score": min(score, 1.0), "indicators": indicators}


def detect_forgery(image: Image.Image) -> dict[str, Any]:
    """Runs all forgery-detection techniques on a document image.

    Returns:
        {
            "forgery_score": float,     # 0-100, higher = more suspicious
            "indicators": list[str],    # human-readable flags
            "breakdown": dict,          # per-technique 0-1 suspicion score
        }
    """
    bgr = _pil_to_bgr(image)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    techniques = {
        "edge_analysis": _analyze_edge_patterns(gray),
        "texture_analysis": _analyze_texture_consistency(gray),
        "color_analysis": _analyze_color_patterns(bgr),
        "noise_analysis": _analyze_noise_patterns(gray),
    }

    scores = [t["score"] for t in techniques.values()]
    indicators: list[str] = []
    for t in techniques.values():
        indicators.extend(t["indicators"])

    forgery_score = (sum(scores) / len(scores)) * 100.0 if scores else 0.0

    return {
        "forgery_score": round(float(forgery_score), 2),
        "indicators": sorted(set(indicators)),
        "breakdown": {k: round(v["score"], 3) for k, v in techniques.items()},
    }


# ---------------------------------------------------------------------------
# Additional Module - Metadata / Copy-Move / QR / Heatmap analysis
#
# These extend the forgery report shown on the new "Verification Progress"
# dashboard. Each is a genuine, if lightweight, classical technique - not a
# black box. Where a requested check has no honest signal available without
# a reference dataset or paid API (e.g. signature verification against a
# bank's specimen signature), it is intentionally left out of this module
# rather than faked; the caller marks it "not available" instead.
# ---------------------------------------------------------------------------

_EDITING_SOFTWARE_HINTS = (
    "photoshop", "gimp", "paint.net", "pixelmator", "affinity photo",
    "canva", "snapseed", "lightroom",
)


def analyze_metadata(raw_bytes: bytes) -> dict:
    """Reads EXIF data (if any) and flags telltale signs of prior editing."""
    from PIL import Image as _Image
    from PIL.ExifTags import TAGS

    indicators = []
    exif_present = False
    software = None
    try:
        img = _Image.open(io.BytesIO(raw_bytes))
        raw_exif = img.getexif()
        if raw_exif:
            exif_present = True
            tags = {TAGS.get(k, k): v for k, v in raw_exif.items()}
            software = str(tags.get("Software", "")) or None
            if software and any(hint in software.lower() for hint in _EDITING_SOFTWARE_HINTS):
                indicators.append(f"Editing software tag found: {software}")
    except Exception:
        pass

    # most phone/scanner captures carry SOME EXIF; a document image with
    # none at all isn't proof of tampering by itself (screenshots/re-saves
    # strip it too) but it's worth surfacing as a low-weight signal
    if not exif_present:
        indicators.append("No EXIF metadata present (image may have been re-saved or screenshotted)")

    return {"exif_present": exif_present, "software_tag": software, "indicators": indicators}


def detect_copy_move(image: Image.Image, block_size: int = 16) -> dict:
    """Lightweight copy-move/clone detection: hashes fixed-size blocks and
    flags near-duplicate blocks that are NOT adjacent to each other (i.e.
    the same patch appears to have been copy-pasted elsewhere in the
    document, a common way to duplicate a photo/signature/seal).
    """
    gray = cv2.cvtColor(_pil_to_bgr(image), cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    if h < block_size * 4 or w < block_size * 4:
        return {"copy_move_score": 0.0, "duplicate_regions": 0, "note": "Image too small for block analysis"}

    step = block_size
    blocks = []
    for y in range(0, h - block_size, step):
        for x in range(0, w - block_size, step):
            block = gray[y:y + block_size, x:x + block_size]
            # cheap perceptual hash: downsample + average-threshold
            small = cv2.resize(block, (8, 8), interpolation=cv2.INTER_AREA)
            avg = small.mean()
            phash = tuple((small > avg).flatten().tolist())
            blocks.append((x, y, phash))

    seen: dict[tuple, tuple[int, int]] = {}
    duplicates = 0
    for x, y, phash in blocks:
        if phash in seen:
            ox, oy = seen[phash]
            # only count it if the match is far from its source block -
            # neighboring identical blocks are usually just flat background
            if abs(ox - x) > block_size * 3 or abs(oy - y) > block_size * 3:
                duplicates += 1
        else:
            seen[phash] = (x, y)

    total_blocks = max(len(blocks), 1)
    copy_move_score = round(min(100.0, (duplicates / total_blocks) * 100.0 * 8), 2)  # amplify a rare event

    return {
        "copy_move_score": copy_move_score,
        "duplicate_regions": duplicates,
        "note": "Duplicate non-adjacent blocks may indicate a copy-pasted photo, seal, or signature",
    }


def detect_qr(image: Image.Image) -> dict:
    """Detects and decodes a QR code if present, using OpenCV's built-in
    detector (no external zbar dependency)."""
    bgr = _pil_to_bgr(image)
    detector = cv2.QRCodeDetector()
    try:
        data, points, _ = detector.detectAndDecode(bgr)
    except Exception:
        return {"qr_present": False, "qr_valid": False, "qr_data_length": 0}

    present = points is not None
    valid = bool(present and data)
    return {
        "qr_present": present,
        "qr_valid": valid,
        "qr_data_length": len(data) if data else 0,
    }


def generate_ela_heatmap(image: Image.Image, quality: int = 90) -> str:
    """Re-compresses the image and returns a base64-encoded PNG heatmap of
    the per-pixel compression error, amplified so tampered regions (which
    tend to have a different error signature than the rest of a
    once-compressed document) stand out visually in red/yellow.
    """
    original = image.convert("RGB")
    buf = io.BytesIO()
    original.save(buf, "JPEG", quality=quality)
    buf.seek(0)
    resaved = Image.open(buf).convert("RGB")

    # per-pixel error summed over channels (max 3*255, fits uint16), built
    # in row strips to avoid full-size int16/int64/float64 copies
    width, height = original.size
    diff = np.empty((height, width), dtype=np.uint16)  # H x W
    for y0 in range(0, height, _STRIP_ROWS):
        box = (0, y0, width, min(y0 + _STRIP_ROWS, height))
        arr1 = np.asarray(original.crop(box)).astype(np.int16)
        arr2 = np.asarray(resaved.crop(box)).astype(np.int16)
        diff[box[1]:box[3]] = np.abs(arr1 - arr2).sum(axis=2)
    del original, resaved

    max_val = diff.max() if diff.max() > 0 else 1
    amplified = np.empty((height, width), dtype=np.uint8)
    for y0 in range(0, height, _STRIP_ROWS):
        rows = slice(y0, min(y0 + _STRIP_ROWS, height))
        amplified[rows] = np.clip((diff[rows] / max_val) * 255.0, 0, 255).astype(np.uint8)
    del diff

    heatmap = cv2.applyColorMap(amplified, cv2.COLORMAP_JET)
    del amplified
    heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    del heatmap

    out = io.BytesIO()
    Image.fromarray(heatmap_rgb).save(out, "PNG")
    return base64.b64encode(out.getvalue()).decode("ascii")


def full_report(raw_bytes: bytes, image: Image.Image) -> dict:
    """Assembles the complete forgery module report used by the
    Verification Progress dashboard: the core multi-technique score plus
    metadata / copy-move / QR / heatmap. Does not touch or replace
    `detect_forgery`, which the existing upload flow still calls directly.
    """
    core = detect_forgery(image)
    metadata = analyze_metadata(raw_bytes)
    copy_move = detect_copy_move(image)
    qr = detect_qr(image)
    try:
        heatmap_b64 = generate_ela_heatmap(image)
    except Exception:
        heatmap_b64 = None

    all_indicators = sorted(set(core["indicators"] + metadata["indicators"]))

    if core["forgery_score"] >= 60 or copy_move["copy_move_score"] >= 40:
        verdict = "Forged"
    elif core["forgery_score"] >= 30 or metadata["indicators"] or copy_move["copy_move_score"] > 0:
        verdict = "Suspicious"
    else:
        verdict = "Authentic"

    return {
        "forgery_score": core["forgery_score"],
        "authenticity_verdict": verdict,
        "indicators": all_indicators,
        "breakdown": core["breakdown"],
        "metadata": metadata,
        "copy_move": copy_move,
        "qr": qr,
        "heatmap_png_base64": heatmap_b64,
        "not_available": [
            "font_inconsistency_analysis",  # needs per-glyph stroke-width reference data
            "signature_verification",        # needs a specimen signature on file to compare against
        ],
    }
