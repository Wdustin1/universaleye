"""SSIM-based defect inspection and classification.

Compares a captured frame against a golden reference image using
Structural Similarity Index (SSIM).  Before comparison, the frame
is aligned to the reference via ORB feature matching so that label
drift on the web doesn't trigger false defects.
"""

from __future__ import annotations

import logging

import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim

from config import InspectionConfig
from models import Severity, AIVerdict

logger = logging.getLogger(__name__)

DEFECT_TYPES = [
    "Smudge",
    "Misregister",
    "Hickey",
    "Color Shift",
    "Scratch",
    "Splash/Spot",
    "Missing Print",
    "Web Crease",
]


# ------ Alignment via ORB feature matching ------

def align_frame(
    frame_gray: np.ndarray,
    ref_gray: np.ndarray,
    orb_features: int = 500,
    min_matches: int = 10,
) -> tuple[np.ndarray, np.ndarray | None, float]:
    """Align *frame_gray* to *ref_gray* using ORB feature matching + homography.

    Returns (aligned_frame, homography_matrix, confidence).
    - confidence is the ratio of RANSAC inliers to total matches (0-1).
    - If not enough matches, returns (frame_gray, None, 0.0).
    """
    orb = cv2.ORB_create(nfeatures=orb_features)
    kp1, des1 = orb.detectAndCompute(ref_gray, None)
    kp2, des2 = orb.detectAndCompute(frame_gray, None)

    if des1 is None or des2 is None or len(des1) < min_matches or len(des2) < min_matches:
        logger.debug("Not enough ORB features: ref=%s, frame=%s",
                      len(des1) if des1 is not None else 0,
                      len(des2) if des2 is not None else 0)
        return frame_gray, None, 0.0

    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    raw_matches = bf.knnMatch(des1, des2, k=2)

    # Lowe's ratio test
    good = []
    for m_pair in raw_matches:
        if len(m_pair) == 2:
            m, n = m_pair
            if m.distance < 0.75 * n.distance:
                good.append(m)

    if len(good) < min_matches:
        logger.debug("Only %d good matches (need %d)", len(good), min_matches)
        return frame_gray, None, 0.0

    src_pts = np.float32([kp1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst_pts = np.float32([kp2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

    H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)

    if H is None:
        logger.debug("Homography computation failed")
        return frame_gray, None, 0.0

    inliers = int(mask.sum()) if mask is not None else 0
    confidence = inliers / len(good) if good else 0.0

    if confidence < 0.3:
        logger.debug("Homography confidence %.2f too low", confidence)
        return frame_gray, None, confidence

    h, w = ref_gray.shape
    aligned = cv2.warpPerspective(frame_gray, H, (w, h),
                                  borderMode=cv2.BORDER_REPLICATE)

    return aligned, H, confidence


# ------ Inspection helpers ------

class InspectionResult:
    __slots__ = (
        "is_defect", "ssim_score", "worst_block_score",
        "defect_type", "severity", "ai_verdict", "diff_image",
    )

    def __init__(
        self,
        is_defect: bool,
        ssim_score: float,
        worst_block_score: float,
        defect_type: str,
        severity: Severity | None,
        ai_verdict: AIVerdict,
        diff_image: np.ndarray | None,
    ) -> None:
        self.is_defect = is_defect
        self.ssim_score = ssim_score
        self.worst_block_score = worst_block_score
        self.defect_type = defect_type
        self.severity = severity
        self.ai_verdict = ai_verdict
        self.diff_image = diff_image


def find_worst_block(
    ssim_map: np.ndarray,
    block: int,
    stride: int,
) -> tuple[float, tuple[int, int]]:
    """Scan the SSIM map in overlapping blocks and return the worst score + position."""
    h, w = ssim_map.shape
    worst = 1.0
    worst_pos = (0, 0)
    for y in range(0, h - block + 1, stride):
        for x in range(0, w - block + 1, stride):
            val = float(ssim_map[y : y + block, x : x + block].mean())
            if val < worst:
                worst = val
                worst_pos = (x, y)
    return worst, worst_pos


def classify_severity(worst_block_score: float, config: InspectionConfig) -> Severity:
    """Severity based on the worst local block SSIM score."""
    if worst_block_score < config.critical_ssim:
        return Severity.critical
    elif worst_block_score < config.major_ssim:
        return Severity.major
    return Severity.minor


def classify_defect_type(diff_image: np.ndarray) -> str:
    """Heuristic defect type classification based on the difference image."""
    if diff_image is None or diff_image.size == 0:
        return "Smudge"

    _, binary = cv2.threshold(diff_image, 30, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return "Smudge"

    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    perimeter = cv2.arcLength(largest, True)
    x, y, w, h = cv2.boundingRect(largest)
    img_h, img_w = diff_image.shape[:2]

    aspect = w / max(h, 1)
    circularity = (4 * np.pi * area) / max(perimeter**2, 1)
    relative_area = area / max(img_h * img_w, 1)

    if relative_area > 0.15:
        return "Missing Print"
    if aspect > 3.0 or aspect < 0.33:
        if h > img_h * 0.5:
            return "Web Crease"
        return "Scratch"
    if circularity > 0.7 and relative_area < 0.02:
        return "Hickey"
    if circularity > 0.5:
        return "Splash/Spot"
    if abs(x) < 5 or abs(x + w - img_w) < 5:
        return "Misregister"
    if relative_area < 0.05:
        return "Color Shift"
    return "Smudge"


_SKIP = InspectionResult(
    is_defect=False, ssim_score=1.0, worst_block_score=1.0,
    defect_type="", severity=None, ai_verdict=AIVerdict.accept,
    diff_image=None,
)


# ------ Main entry point ------

def inspect_frame(
    frame: np.ndarray,
    reference: np.ndarray,
    config: InspectionConfig,
    sensitivity: int,
) -> InspectionResult:
    """Compare a captured frame against the golden reference.

    1. ORB feature matching aligns the frame to the reference.
    2. A validity mask excludes border pixels affected by the warp.
    3. Local block SSIM detects spatial defects; per-channel global
       SSIM detects colour-plane defects.
    """
    if frame.shape[:2] != reference.shape[:2]:
        frame = cv2.resize(frame, (reference.shape[1], reference.shape[0]))

    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_ref = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)

    # --- Align frame to reference via ORB ---
    gray_frame, H, confidence = align_frame(
        gray_frame, gray_ref,
        orb_features=config.orb_features,
        min_matches=config.orb_min_matches,
    )

    if H is None:
        logger.info(
            "ORB alignment failed (confidence=%.2f) — skipping inspection",
            confidence,
        )
        return _SKIP

    logger.debug("ORB aligned frame: confidence=%.2f", confidence)

    # Build validity mask — warp a white image to find valid pixels
    h, w = gray_ref.shape
    ones = np.ones((h, w), dtype=np.uint8) * 255
    valid_mask = cv2.warpPerspective(ones, H, (w, h)) > 128
    valid_ratio = valid_mask.sum() / valid_mask.size

    if valid_ratio < 0.5:
        logger.info("Valid area ratio %.2f too small — skipping inspection", valid_ratio)
        return _SKIP

    # --- Grayscale SSIM for local detection (spatial defects) ---
    gray_global, gray_map = ssim(gray_ref, gray_frame, full=True)

    # Mask out invalid border pixels from alignment warp
    gray_map[~valid_mask] = 1.0

    worst_block, worst_pos = find_worst_block(
        gray_map, config.ssim_block_size, config.ssim_block_stride,
    )
    bad_pixel_count = int(np.sum(gray_map[valid_mask] < 0.5))

    local_threshold = config.ssim_local_threshold_for_sensitivity(sensitivity)
    local_defect = (
        worst_block < local_threshold and bad_pixel_count >= config.ssim_bad_pixel_floor
    )

    # --- Per-channel SSIM for global detection (colour-plane defects) ---
    aligned_color = frame.copy()
    for c in range(3):
        aligned_color[:, :, c] = cv2.warpPerspective(
            frame[:, :, c], H, (w, h),
            borderMode=cv2.BORDER_REPLICATE,
        )

    # Crop to valid region for channel comparison
    ys, xs = np.where(valid_mask)
    if len(ys) == 0:
        return _SKIP
    y1, y2 = ys.min(), ys.max() + 1
    x1, x2 = xs.min(), xs.max() + 1

    ref_crop = reference[y1:y2, x1:x2]
    frm_crop = aligned_color[y1:y2, x1:x2]

    channel_scores = []
    for c in range(3):
        ch_score, _ = ssim(ref_crop[:, :, c], frm_crop[:, :, c], full=True)
        channel_scores.append(ch_score)

    global_score = float(min(channel_scores))

    global_threshold = config.ssim_global_threshold_for_sensitivity(sensitivity)
    global_defect = global_score < global_threshold

    is_defect = local_defect or global_defect

    # Build diff image from grayscale map for defect classification
    diff_uint8 = (255 - (gray_map * 255)).astype(np.uint8)

    if is_defect:
        severity = classify_severity(worst_block, config)
        defect_type = classify_defect_type(diff_uint8)
        if severity == Severity.critical or severity == Severity.major:
            ai_verdict = AIVerdict.reject
        else:
            ai_verdict = AIVerdict.review
        logger.info(
            "Defect detected: worst_block=%.3f at %s, bad_px=%d, global=%.3f, "
            "conf=%.2f, type=%s, severity=%s",
            worst_block, worst_pos, bad_pixel_count, global_score,
            confidence, defect_type, severity.value,
        )
    else:
        severity = None
        defect_type = ""
        ai_verdict = AIVerdict.accept

    return InspectionResult(
        is_defect=is_defect,
        ssim_score=global_score,
        worst_block_score=worst_block,
        defect_type=defect_type,
        severity=severity,
        ai_verdict=ai_verdict,
        diff_image=diff_uint8 if is_defect else None,
    )
