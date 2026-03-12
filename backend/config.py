"""Configuration constants for the inspection system.

All thresholds are tunable. Sensitivity from the frontend (0-100)
scales the SSIM defect threshold linearly between SSIM_THRESHOLD_LOW
and SSIM_THRESHOLD_HIGH.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class InspectionConfig:
    # Camera
    camera_index: int = 1
    camera_width: int = 1920
    camera_height: int = 1080
    capture_fps: int = 30
    video_file: str | None = None  # Path to a video file to use instead of camera (loops)

    # Motion detection (state machine)
    motion_threshold: float = 0.02  # 2% of pixels changed = motion
    pixel_diff_threshold: int = 25
    stability_frames: int = 8  # require more stable frames before inspecting

    # ORB feature matching alignment
    orb_features: int = 500         # max ORB keypoints to detect
    orb_min_matches: int = 10       # minimum good matches for homography
    alignment_border_margin: int = 3  # extra pixels to erode beyond detected shift
    # State machine motion blur
    motion_blur_kernel: int = 5     # Gaussian blur kernel for jitter suppression

    # SSIM defect detection — local map approach
    # The SSIM diff map is scanned in blocks; the *worst* block determines
    # whether a defect is present so that even a single missing letter is caught.
    ssim_block_size: int = 32           # local block side length (px)
    ssim_block_stride: int = 16         # overlap between blocks (half-block)
    ssim_local_threshold_low: float = 0.80   # sensitivity=0  (tolerant)
    ssim_local_threshold_high: float = 0.95  # sensitivity=100 (strict)
    # Global SSIM threshold — catches diffuse defects (density shift, haze,
    # misregister) that lower the overall score without a single bad block.
    ssim_global_threshold_low: float = 0.90  # sensitivity=0
    ssim_global_threshold_high: float = 0.97 # sensitivity=100
    # Minimum number of bad pixels (local SSIM < 0.5) to confirm a local defect.
    # Prevents single-pixel noise from triggering.
    ssim_bad_pixel_floor: int = 20
    default_sensitivity: int = 75

    # Defect severity — based on worst-block SSIM
    critical_ssim: float = 0.30
    major_ssim: float = 0.55

    # Storage — set DATA_DIR env var to redirect all data to an external drive
    # e.g. DATA_DIR=/Volumes/UniversalEye uvicorn main:app ...
    # Defaults to backend/data/ if not set.
    data_dir: Path | None = None

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )

    # Frame crop (removes ELSCAN OMS3 UI overlay)
    crop_top: int = 70
    crop_left: int = 52
    crop_bottom: int = 1040
    crop_right: int = 1920
    # Vertical ROI marker lines from ELSCAN (x-start, x-end pairs)
    crop_mask_lines: list[tuple[int, int]] = field(
        default_factory=lambda: [
            (335, 338), (425, 428),
            (972, 976), (1064, 1068),
            (1614, 1618), (1706, 1710),
        ]
    )

    # MJPEG stream
    mjpeg_quality: int = 80
    mjpeg_fps: int = 15

    def ssim_local_threshold_for_sensitivity(self, sensitivity: int) -> float:
        """Map frontend sensitivity (0-100) to a local-block SSIM threshold."""
        t = max(0, min(100, sensitivity)) / 100.0
        return self.ssim_local_threshold_low + t * (
            self.ssim_local_threshold_high - self.ssim_local_threshold_low
        )

    def ssim_global_threshold_for_sensitivity(self, sensitivity: int) -> float:
        """Map frontend sensitivity (0-100) to a global SSIM threshold."""
        t = max(0, min(100, sensitivity)) / 100.0
        return self.ssim_global_threshold_low + t * (
            self.ssim_global_threshold_high - self.ssim_global_threshold_low
        )


def _resolve_data_dir() -> "Path | None":
    raw = os.environ.get("DATA_DIR")
    if raw:
        p = Path(raw).expanduser().resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p
    return None


config = InspectionConfig(
    video_file=os.environ.get("VIDEO_FILE"),
    data_dir=_resolve_data_dir(),
)
