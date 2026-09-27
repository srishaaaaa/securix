"""
Module 3 - Face Verification & Liveness Detection.

Uses OpenCV Haar cascades for face/eye detection (bundled with
opencv-python, no extra model download needed) plus classical CV heuristics
for matching and liveness. This is intentionally dependency-light so the
project runs anywhere without GPU/dlib builds.

IMPORTANT - production note: real deployments should replace
`face_similarity()` with an embedding-based matcher (e.g. FaceNet/ArcFace
via `face_recognition`/`deepface`) for accuracy. The ORB-based matcher here
is a transparent, zero-download stand-in suitable for a hackathon/demo
build, not for production-grade fraud prevention.
"""
from typing import Optional

import cv2
import numpy as np

_FACE_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
_face_cascade = cv2.CascadeClassifier(_FACE_CASCADE_PATH)
# OpenCV keeps scratch buffers inside a classifier sized to the largest image
# it has scanned (~100 MB after a 12MP document photo) and never frees them.
# Images above this size get a throwaway classifier (same model file, same
# detections) so that memory is released afterwards; webcam-sized frames
# keep reusing the shared one.
_LARGE_IMAGE_PIXELS = 2_000_000
_eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")


def _to_gray(image_bytes: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), img


def detect_face(image_bytes: bytes):
    result = _to_gray(image_bytes)
    if result is None:
        return None, None, None
    gray, color = result
    cascade = _face_cascade if gray.size <= _LARGE_IMAGE_PIXELS else cv2.CascadeClassifier(_FACE_CASCADE_PATH)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if len(faces) == 0:
        return False, None, color
    # take the largest detected face
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    crop = gray[y:y + h, x:x + w]
    return True, crop, color


def count_eyes(face_gray_crop: np.ndarray) -> int:
    eyes = _eye_cascade.detectMultiScale(face_gray_crop, scaleFactor=1.1, minNeighbors=6)
    return len(eyes)


def face_similarity(crop_a: np.ndarray, crop_b: np.ndarray) -> float:
    """ORB keypoint-matching similarity between two face crops, 0-100."""
    if crop_a is None or crop_b is None:
        return 0.0
    a = cv2.resize(crop_a, (200, 200))
    b = cv2.resize(crop_b, (200, 200))
    orb = cv2.ORB_create(nfeatures=500)
    kp1, des1 = orb.detectAndCompute(a, None)
    kp2, des2 = orb.detectAndCompute(b, None)
    if des1 is None or des2 is None or len(kp1) < 5 or len(kp2) < 5:
        # fall back to normalized cross-correlation on pixel intensities
        a_f = a.astype(np.float32) - a.mean()
        b_f = b.astype(np.float32) - b.mean()
        denom = (np.linalg.norm(a_f) * np.linalg.norm(b_f))
        corr = float((a_f * b_f).sum() / denom) if denom > 0 else 0.0
        return float(max(0.0, min(100.0, (corr + 1) * 50)))

    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(des1, des2)
    if not matches:
        return 0.0
    good = [m for m in matches if m.distance < 60]
    ratio = len(good) / max(len(kp1), len(kp2), 1)
    return float(max(0.0, min(100.0, ratio * 140)))  # scaled so decent matches land 60-90+


def sharpness(gray: np.ndarray) -> float:
    """Laplacian variance - low values suggest a blurry printed photo or
    a low-quality screen replay rather than a live camera frame."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def frame_motion(gray_a: np.ndarray, gray_b: np.ndarray) -> float:
    """Mean absolute pixel difference between two frames of the same size,
    used as a proxy for natural micro-movement across a liveness capture
    burst. A static printed photo held in front of the camera produces
    near-zero motion; a live face shows small natural jitter/blinks."""
    a = cv2.resize(gray_a, (150, 150)).astype(np.int16)
    b = cv2.resize(gray_b, (150, 150)).astype(np.int16)
    return float(np.abs(a - b).mean())


def analyze_liveness_burst(frames_bytes: list[bytes]) -> dict:
    """Runs the liveness pipeline over a short burst of webcam frames
    (captured client-side over ~2-3 seconds) and returns a 0-100 liveness
    score plus which checks passed."""
    checks_passed = []
    grays = []
    face_crops = []
    for fb in frames_bytes:
        detected, crop, color = detect_face(fb)
        if detected and color is not None:
            gray = cv2.cvtColor(color, cv2.COLOR_BGR2GRAY)
            grays.append(gray)
            face_crops.append(crop)

    if not grays:
        return {"liveness_score": 0.0, "checks_passed": [], "face_detected": False}

    # 1. Sharpness check (screen/print replay tends to be softer or show moire)
    avg_sharp = np.mean([sharpness(g) for g in grays])
    sharp_pass = avg_sharp > 40
    if sharp_pass:
        checks_passed.append("image_sharpness")

    # 2. Motion-across-frames check (natural micro-movement / blink)
    motion_scores = []
    for i in range(len(grays) - 1):
        motion_scores.append(frame_motion(grays[i], grays[i + 1]))
    avg_motion = np.mean(motion_scores) if motion_scores else 0.0
    motion_pass = 0.6 < avg_motion < 40  # some movement, but not a totally different scene
    if motion_pass:
        checks_passed.append("natural_motion")

    # 3. Eye/blink check: eyes should be detected in some frames but not
    # necessarily all (a genuine blink briefly hides them); a static photo
    # of open eyes shows the *same* detection count every single frame.
    eye_counts = [count_eyes(c) for c in face_crops if c is not None and c.size > 0]
    blink_pass = len(set(eye_counts)) > 1 if len(eye_counts) > 1 else eye_counts and eye_counts[0] >= 2
    if blink_pass:
        checks_passed.append("eye_blink_variation")

    # 4. Head movement proxy via face bounding box size variation across frames
    checks_passed_count = len(checks_passed)
    liveness_score = min(100.0, checks_passed_count * 30 + 10)

    return {
        "liveness_score": float(liveness_score),
        "checks_passed": checks_passed,
        "face_detected": True,
        "best_frame_crop": face_crops[len(face_crops) // 2] if face_crops else None,
    }


# ---------------------------------------------------------------------------
# Additional Module - Face Matching report enrichment.
#
# Adds quality/embedding-distance detail for the new Verification Progress
# dashboard, on top of the plain match score already used by the existing
# flow. Signals with no honest source available (age difference, gender
# match, pose difference, expression match) are NOT faked here - see
# `full_face_report` below, which explicitly lists them as unavailable
# rather than inventing numbers for a face-matching setup with no
# demographic/landmark model behind it.
# ---------------------------------------------------------------------------

def face_quality(crop) -> dict:
    if crop is None or crop.size == 0:
        return {"quality_score": 0.0, "sharpness": 0.0, "size_ok": False}
    sharp = sharpness(crop)
    h, w = crop.shape[:2]
    size_ok = h >= 80 and w >= 80
    quality_score = min(100.0, (sharp / 150.0) * 70.0 + (30.0 if size_ok else 0.0))
    return {"quality_score": round(float(quality_score), 1), "sharpness": round(sharp, 1), "size_ok": size_ok}


def full_face_report(selfie_crop, doc_crop, match_score: float) -> dict:
    return {
        "similarity_percent": round(match_score, 1),
        "matched": match_score >= 60.0,
        "selfie_quality": face_quality(selfie_crop),
        "document_photo_quality": face_quality(doc_crop),
        # Not a true embedding distance (no FaceNet/ArcFace model here) -
        # this is only a labeled proxy derived from the ORB match ratio.
        "embedding_distance_proxy": round(max(0.0, 1.0 - (match_score / 100.0)), 3),
        "not_available": [
            "age_difference", "gender_match", "pose_difference", "expression_match",
        ],
    }
