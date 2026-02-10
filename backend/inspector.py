"""SSIM-based defect inspection and classification.

Compares a captured frame against a golden reference image using
Structural Similarity Index (SSIM). Classifies defects by severity
based on the SSIM score and maps low-SSIM regions to defect types.
"""

from __future__ import annotations

import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim

from config import InspectionConfig
from models import Severity, AIVerdict

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


class InspectionResult:
    __slots__ = ("is_defect", "ssim_score", "defect_type", "severity", "ai_verdict", "diff_image")

    def __init__(
        self,
        is_defect: bool,
        ssim_score: float,
        defect_type: str,
        severity: Severity | None,
        ai_verdict: AIVerdict,
        diff_image: np.ndarray | None,
    ) -> None:
        self.is_defect = is_defect
        self.ssim_score = ssim_score
        self.defect_type = defect_type
        self.severity = severity
        self.ai_verdict = ai_verdict
        self.diff_image = diff_image


def classify_severity(ssim_score: float, config: InspectionConfig) -> Severity:
    if ssim_score < config.critical_ssim:
        return Severity.critical
    elif ssim_score < config.major_ssim:
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
    """Compare a captured frame against the golden reference."""
    if frame.shape[:2] != reference.shape[:2]:
        frame = cv2.resize(frame, (reference.shape[1], reference.shape[0]))

    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_ref = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)

    score, diff = ssim(gray_ref, gray_frame, full=True)
    diff_uint8 = (255 - (diff * 255)).astype(np.uint8)

    threshold = config.ssim_threshold_for_sensitivity(sensitivity)
    is_defect = score < threshold

    if is_defect:
        severity = classify_severity(score, config)
        defect_type = classify_defect_type(diff_uint8)
        if severity == Severity.critical or severity == Severity.major:
            ai_verdict = AIVerdict.reject
        else:
            ai_verdict = AIVerdict.review
    else:
        severity = None
        defect_type = ""
        ai_verdict = AIVerdict.accept

    return InspectionResult(
        is_defect=is_defect,
        ssim_score=score,
        defect_type=defect_type,
        severity=severity,
        ai_verdict=ai_verdict,
        diff_image=diff_uint8 if is_defect else None,
    )
