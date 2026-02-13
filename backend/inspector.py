"""SSIM-based defect inspection and classification.

Compares a captured frame against a golden reference image using
Structural Similarity Index (SSIM).  Before comparison, the frame
is aligned to the reference via template matching so that label
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


# ------ Alignment via template matching ------

def locate_label(
    frame_gray: np.ndarray,
    ref_gray: np.ndarray,
    margin_pct: float = 0.15,
) -> tuple[int, int, float]:
    """Find the label offset using template matching.

    Crops the central portion of the reference (avoiding edges that
    may be background) and searches for it in the current frame.
    Much more robust than phase correlation for large shifts — finds
    the label wherever it is in the frame.

    Returns (dx, dy, confidence) where dx/dy is how much the frame
    content is shifted relative to the reference, and confidence is
    the normalised correlation score (0–1).
    """
    h, w = ref_gray.shape
    my = int(h * margin_pct)
    mx = int(w * margin_pct)
    template = ref_gray[my : h - my, mx : w - mx]

    result = cv2.matchTemplate(frame_gray, template, cv2.TM_CCOEFF_NORMED)
    _, confidence, _, max_loc = cv2.minMaxLoc(result)

    # max_loc is where the template top-left was found in the frame.
    # The template was cut from (mx, my) in the reference, so the
    # offset of the frame relative to the reference is:
    dx = max_loc[0] - mx
    dy = max_loc[1] - my

    return dx, dy, float(confidence)


def align_frame(
    frame_gray: np.ndarray,
    ref_gray: np.ndarray,
    max_shift: int = 200,
    min_confidence: float = 0.3,
) -> tuple[np.ndarray, int, int, float]:
    """Align *frame_gray* to *ref_gray* using template matching.

    Returns (aligned_frame, dx, dy, confidence).  If the match
    confidence is too low or the shift exceeds *max_shift*, the
    frame is returned unchanged.
    """
    dx, dy, confidence = locate_label(frame_gray, ref_gray)

    if confidence < min_confidence:
        logger.debug(
            "Template match confidence %.2f below threshold %.2f; skipping alignment",
            confidence, min_confidence,
        )
        return frame_gray, 0, 0, confidence

    if abs(dx) > max_shift or abs(dy) > max_shift:
        logger.debug("Shift (%d, %d) exceeds max_shift %d", dx, dy, max_shift)
        return frame_gray, 0, 0, confidence

    if dx == 0 and dy == 0:
        return frame_gray, 0, 0, confidence

    M = np.float32([[1, 0, -dx], [0, 1, -dy]])
    aligned = cv2.warpAffine(
        frame_gray, M, (frame_gray.shape[1], frame_gray.shape[0]),
        borderMode=cv2.BORDER_REPLICATE,
    )
    return aligned, dx, dy, confidence


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

    1. Template matching locates the label in the frame regardless
       of where it has drifted.
    2. The frame is warped to align with the reference.
    3. Border regions affected by the warp are masked out.
    4. Local block SSIM detects spatial defects; per-channel global
       SSIM detects colour-plane defects.
    """
    if frame.shape[:2] != reference.shape[:2]:
        frame = cv2.resize(frame, (reference.shape[1], reference.shape[0]))

    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_ref = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)

    # --- Align frame to reference via template matching ---
    gray_frame, dx, dy, confidence = align_frame(
        gray_frame, gray_ref, max_shift=config.alignment_max_shift,
    )

    if confidence < 0.3:
        logger.info(
            "Template match confidence %.2f too low — label may not be in frame, skipping",
            confidence,
        )
        return _SKIP

    if dx != 0 or dy != 0:
        logger.debug("Aligned frame: shift=(%d, %d), confidence=%.2f", dx, dy, confidence)

    # If the shift is so large that the usable comparison area is less
    # than half the frame, skip — the label hasn't settled.
    h, w = gray_frame.shape
    margin_x = abs(dx) + 2 if dx != 0 else 0
    margin_y = abs(dy) + 2 if dy != 0 else 0
    if (w - 2 * margin_x) < w * 0.5 or (h - 2 * margin_y) < h * 0.5:
        logger.info(
            "Shift too large (%d, %d) — usable area too small, skipping inspection",
            dx, dy,
        )
        return _SKIP

    # --- Grayscale SSIM for local detection (spatial defects) ---
    gray_global, gray_map = ssim(gray_ref, gray_frame, full=True)

    # Mask out border pixels affected by alignment warp
    if dx != 0 or dy != 0:
        mx = abs(dx) + 2
        my = abs(dy) + 2
        gray_map[:my, :] = 1.0
        gray_map[-my:, :] = 1.0
        gray_map[:, :mx] = 1.0
        gray_map[:, -mx:] = 1.0

    worst_block, worst_pos = find_worst_block(
        gray_map, config.ssim_block_size, config.ssim_block_stride,
    )
    bad_pixel_count = int(np.sum(gray_map < 0.5))

    local_threshold = config.ssim_local_threshold_for_sensitivity(sensitivity)
    local_defect = (
        worst_block < local_threshold and bad_pixel_count >= config.ssim_bad_pixel_floor
    )

    # --- Per-channel SSIM for global detection (colour-plane defects) ---
    if dx != 0 or dy != 0:
        M = np.float32([[1, 0, -dx], [0, 1, -dy]])
        for c in range(3):
            frame[:, :, c] = cv2.warpAffine(
                frame[:, :, c], M,
                (frame.shape[1], frame.shape[0]),
                borderMode=cv2.BORDER_REPLICATE,
            )

    ref_ch = reference
    frm_ch = frame
    if dx != 0 or dy != 0:
        mx = abs(dx) + 2
        my = abs(dy) + 2
        ref_ch = reference[my:-my, mx:-mx]
        frm_ch = frame[my:-my, mx:-mx]

    channel_scores = []
    for c in range(3):
        ch_score, _ = ssim(ref_ch[:, :, c], frm_ch[:, :, c], full=True)
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
            "shift=(%d,%d), conf=%.2f, type=%s, severity=%s",
            worst_block, worst_pos, bad_pixel_count, global_score,
            dx, dy, confidence, defect_type, severity.value,
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
