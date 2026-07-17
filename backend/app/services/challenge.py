"""
Additional Module 1 - Challenge-response liveness.

Complements (does not replace) the existing passive burst-liveness check
in the router. A random challenge - smile / turn_left / turn_right /
raise_eyebrows - is issued, the client captures a short burst while the
user performs it, and this module uses MediaPipe Face Mesh landmarks to
check the requested motion actually happened across the burst. A static
photo or a pre-recorded loop can beat a plain blink check far more easily
than a randomized, per-attempt physical instruction.

This measures relative geometric change from the first ("neutral") frame
to the most extreme frame in the burst - it does not claim to recognize
identity or expressions in general, just "did this specific motion happen."
Thresholds below are reasonable starting points, not empirically tuned;
adjust CHALLENGE_THRESHOLDS if you see false rejects/accepts in testing.
"""
from typing import Optional

import numpy as np
from PIL import Image

try:
    import mediapipe as mp
    _face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True, max_num_faces=1,
        refine_landmarks=False, min_detection_confidence=0.5,
    )
    _MEDIAPIPE_AVAILABLE = True
except Exception:
    # If mediapipe isn't installed (see requirements.txt) or fails to load
    # its model (needs internet on first run), the challenge step degrades
    # to "unavailable" instead of crashing the whole verification.
    _MEDIAPIPE_AVAILABLE = False

VALID_CHALLENGES = ["smile", "turn_left", "turn_right", "raise_eyebrows"]

# landmark indices, MediaPipe's 468-point face mesh
_MOUTH_LEFT, _MOUTH_RIGHT = 61, 291
_UPPER_LIP, _LOWER_LIP = 13, 14
_LEFT_CHEEK, _RIGHT_CHEEK = 234, 454
_NOSE_TIP = 1
_LEFT_EYEBROW, _LEFT_EYE_TOP = 105, 159
_RIGHT_EYEBROW, _RIGHT_EYE_TOP = 334, 386
_CHIN, _FOREHEAD = 152, 10

CHALLENGE_THRESHOLDS = {
    "smile": 0.06,          # relative mouth-width growth vs face width
    "raise_eyebrows": 0.05,  # relative eyebrow-to-eye gap growth vs face height
    "turn_left": 0.15,      # yaw ratio shift
    "turn_right": 0.15,
}


def _landmarks_for(image: Image.Image) -> Optional[np.ndarray]:
    if not _MEDIAPIPE_AVAILABLE:
        return None
    rgb = np.array(image.convert("RGB"))
    result = _face_mesh.process(rgb)
    if not result.multi_face_landmarks:
        return None
    h, w = rgb.shape[:2]
    lm = result.multi_face_landmarks[0].landmark
    return np.array([[p.x * w, p.y * h] for p in lm])


def _metric(landmarks: np.ndarray, challenge_type: str) -> float:
    face_w = np.linalg.norm(landmarks[_LEFT_CHEEK] - landmarks[_RIGHT_CHEEK]) + 1e-6
    face_h = np.linalg.norm(landmarks[_FOREHEAD] - landmarks[_CHIN]) + 1e-6

    if challenge_type == "smile":
        mouth_w = np.linalg.norm(landmarks[_MOUTH_LEFT] - landmarks[_MOUTH_RIGHT])
        return float(mouth_w / face_w)

    if challenge_type == "raise_eyebrows":
        left_gap = np.linalg.norm(landmarks[_LEFT_EYEBROW] - landmarks[_LEFT_EYE_TOP])
        right_gap = np.linalg.norm(landmarks[_RIGHT_EYEBROW] - landmarks[_RIGHT_EYE_TOP])
        return float((left_gap + right_gap) / 2.0 / face_h)

    if challenge_type in ("turn_left", "turn_right"):
        # yaw ratio: 0 = nose at left cheek, 1 = nose at right cheek, ~0.5 = facing camera
        span = (landmarks[_RIGHT_CHEEK][0] - landmarks[_LEFT_CHEEK][0]) + 1e-6
        return float((landmarks[_NOSE_TIP][0] - landmarks[_LEFT_CHEEK][0]) / span)

    return 0.0


def verify_challenge(frames: list[Image.Image], challenge_type: str) -> dict:
    """Returns {"passed": bool, "confidence": float (0-100), "detail": str}."""
    if challenge_type not in VALID_CHALLENGES:
        return {"passed": False, "confidence": 0.0, "detail": f"Unknown challenge type '{challenge_type}'."}

    if not _MEDIAPIPE_AVAILABLE:
        return {
            "passed": False, "confidence": 0.0,
            "detail": "Challenge verification unavailable: mediapipe is not installed/loaded on the server.",
        }

    metrics = []
    for frame in frames:
        lm = _landmarks_for(frame)
        if lm is not None:
            metrics.append(_metric(lm, challenge_type))

    if len(metrics) < max(2, len(frames) // 2):
        return {
            "passed": False, "confidence": 0.0,
            "detail": f"Face landmarks were only detected in {len(metrics)}/{len(frames)} frames - retake the challenge with better lighting.",
        }

    baseline = metrics[0]
    threshold = CHALLENGE_THRESHOLDS[challenge_type]

    if challenge_type in ("smile", "raise_eyebrows"):
        peak = max(metrics)
        delta = peak - baseline
    elif challenge_type == "turn_left":
        peak = min(metrics)
        delta = baseline - peak
    else:  # turn_right
        peak = max(metrics)
        delta = peak - baseline

    passed = delta >= threshold
    confidence = float(max(0.0, min(100.0, (delta / threshold) * 100.0))) if threshold else 0.0
    detail = (
        f"Detected {challenge_type.replace('_', ' ')} (Δ={delta:.3f}, threshold={threshold})"
        if passed else
        f"Requested motion not clearly detected (Δ={delta:.3f}, needed ≥{threshold}) - "
        f"possible spoof attempt or the motion wasn't performed."
    )
    return {"passed": passed, "confidence": round(confidence, 1), "detail": detail}
