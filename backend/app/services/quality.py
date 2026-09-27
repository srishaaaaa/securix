"""
Additional Module - Document Image Quality Checks.

Runs before/alongside OCR to flag uploads that are too blurry, too small,
or too dark/bright to trust the downstream OCR and forgery results. Uses
the same classical-CV toolkit as the rest of the project (OpenCV Laplacian
variance for blur, plain pixel stats for brightness) - no extra models.
"""
import cv2
import numpy as np
from PIL import Image

from .forgery import _strip_mean_var

MIN_WIDTH = 600
MIN_HEIGHT = 400
BLUR_THRESHOLD = 60.0       # Laplacian variance below this = too blurry
DARK_THRESHOLD = 40.0        # mean brightness (0-255) below this = too dark
BRIGHT_THRESHOLD = 235.0     # mean brightness above this = blown out


def check_quality(image: Image.Image) -> dict:
    rgb = np.array(image.convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    width, height = image.size
    del rgb
    _, blur_score = _strip_mean_var(gray, lambda g: cv2.Laplacian(g, cv2.CV_64F))
    brightness = float(gray.mean())

    resolution_ok = width >= MIN_WIDTH and height >= MIN_HEIGHT
    blur_ok = blur_score >= BLUR_THRESHOLD
    brightness_ok = DARK_THRESHOLD <= brightness <= BRIGHT_THRESHOLD

    issues = []
    if not resolution_ok:
        issues.append(f"Low resolution ({width}x{height}, minimum {MIN_WIDTH}x{MIN_HEIGHT})")
    if not blur_ok:
        issues.append("Image appears blurry")
    if not brightness_ok:
        issues.append("Poor lighting (too dark or overexposed)")

    checks_passed = sum([resolution_ok, blur_ok, brightness_ok])
    quality_score = round((checks_passed / 3.0) * 100.0, 1)

    return {
        "quality_score": quality_score,
        "width": width,
        "height": height,
        "resolution_ok": resolution_ok,
        "blur_score": round(blur_score, 1),
        "blur_ok": blur_ok,
        "brightness": round(brightness, 1),
        "brightness_ok": brightness_ok,
        "issues": issues,
    }
