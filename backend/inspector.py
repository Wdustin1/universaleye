"""SSIM-based defect inspection and classification.

Compares a captured frame against a golden reference image using
Structural Similarity Index (SSIM). Before comparison, the frame
is aligned to the reference via phase correlation so that camera
drift / operator adjustments don't trigger false defects.
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


def align_frame(
    frame_gray: np.ndarray,
    ref_gray: np.ndarray,
    max_shift: float = 50.0,
    min_shift: float = 1.0,
) -> tuple[np.ndarray, float, float]:
    """Align *frame_gray* to *ref_gray* using phase correlation.

    Phase correlation uses FFT to detect the translational offset between
    two images.  It's fast (single FFT pair), sub-pixel accurate, and
    handles the kind of drift seen on the ELSCAN camera feed.

    Returns (aligned_frame, dx, dy).  If the detected shift exceeds
    *max_shift* in either axis the frame is returned unchanged — a huge
    jump likely means a scene change rather than drift.  Shifts below
    *min_shift* are ignored (phaseCorrelate has a ~0.5 px DC bias on
    near-identical images that would introduce interpolation noise).
    """
    shift, _response = cv2.phaseCorrelate(
        ref_gray.astype(np.float64),
        frame_gray.astype(np.float64),
    )
    dx, dy = shift  # how much frame is shifted relative to ref

    if abs(dx) > max_shift or abs(dy) > max_shift:
        logger.debug("Shift (%.1f, %.1f) exceeds max_shift; skipping alignment", dx, dy)
        return frame_gray, 0.0, 0.0

    if abs(dx) < min_shift and abs(dy) < min_shift:
        return frame_gray, 0.0, 0.0

    # Round to integer pixels.  Sub-pixel warpAffine introduces bilinear
    # interpolation blur that degrades SSIM across the whole image.
    # Integer translation is exact — no new artifacts, only border
    # replication (which we mask out later).
    dx = round(dx)
    dy = round(dy)

    M = np.float32([[1, 0, -dx], [0, 1, -dy]])
    aligned = cv2.warpAffine(
        frame_gray, M, (frame_gray.shape[1], frame_gray.shape[0]),
        borderMode=cv2.BORDER_REPLICATE,
    )
    return aligned, dx, dy


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


def inspect_frame(
    frame: np.ndarray,
    reference: np.ndarray,
    config: InspectionConfig,
    sensitivity: int,
) -> InspectionResult:
    """Compare a captured frame against the golden reference.

    Detection uses the **local SSIM map**: the image is scanned in
    overlapping blocks and the *worst* block determines whether a defect
    exists.  This catches small localised defects (e.g. a single missing
    letter) that a global average would miss entirely.
    """
    if frame.shape[:2] != reference.shape[:2]:
        frame = cv2.resize(frame, (reference.shape[1], reference.shape[0]))

    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_ref = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)

    # Align frame to reference to compensate for camera drift
    gray_frame, dx, dy = align_frame(gray_frame, gray_ref)
    if dx != 0.0 or dy != 0.0:
        logger.debug("Aligned frame: shift=(%.1f, %.1f)", dx, dy)

    # --- Grayscale SSIM for local detection (spatial defects) ---
    gray_global, gray_map = ssim(gray_ref, gray_frame, full=True)

    # Mask out border pixels affected by alignment warp (BORDER_REPLICATE
    # introduces synthetic values that would otherwise cause false positives).
    if dx != 0.0 or dy != 0.0:
        mx = int(np.ceil(abs(dx))) + 2
        my = int(np.ceil(abs(dy))) + 2
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

    # --- Per-channel SSIM for global detection (colour-plane defects like
    #     misregister, density shift, haze — per-channel catches single-
    #     colour-plate issues that grayscale averages away) ---
    if dx != 0.0 or dy != 0.0:
        M = np.float32([[1, 0, -dx], [0, 1, -dy]])
        for c in range(3):
            frame[:, :, c] = cv2.warpAffine(
                frame[:, :, c], M,
                (frame.shape[1], frame.shape[0]),
                borderMode=cv2.BORDER_REPLICATE,
            )

    # Crop border regions for per-channel SSIM when alignment was applied,
    # preventing BORDER_REPLICATE artifacts from depressing global scores.
    ref_ch = reference
    frm_ch = frame
    if dx != 0.0 or dy != 0.0:
        mx = int(np.ceil(abs(dx))) + 2
        my = int(np.ceil(abs(dy))) + 2
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
            "Defect detected: worst_block=%.3f at %s, bad_px=%d, type=%s, severity=%s",
            worst_block, worst_pos, bad_pixel_count, defect_type, severity.value,
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
