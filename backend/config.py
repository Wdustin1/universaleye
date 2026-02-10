"""Configuration constants for the inspection system.

All thresholds are tunable. Sensitivity from the frontend (0-100)
scales the SSIM defect threshold linearly between SSIM_THRESHOLD_LOW
and SSIM_THRESHOLD_HIGH.
"""

from dataclasses import dataclass, field


@dataclass
class InspectionConfig:
    # Camera
    camera_index: int = 1
    camera_width: int = 1920
    camera_height: int = 1080
    capture_fps: int = 30

    # Motion detection (state machine)
    motion_threshold: float = 0.02  # 2% of pixels changed = motion
    pixel_diff_threshold: int = 25
    stability_frames: int = 5

    # SSIM defect detection
    ssim_threshold_low: float = 0.70   # sensitivity=0 (tolerant)
    ssim_threshold_high: float = 0.95  # sensitivity=100 (strict)
    default_sensitivity: int = 75

    # Defect severity SSIM ranges
    critical_ssim: float = 0.60
    major_ssim: float = 0.75

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )

    # MJPEG stream
    mjpeg_quality: int = 80
    mjpeg_fps: int = 15

    def ssim_threshold_for_sensitivity(self, sensitivity: int) -> float:
        """Map frontend sensitivity (0-100) to an SSIM threshold."""
        t = max(0, min(100, sensitivity)) / 100.0
        return self.ssim_threshold_low + t * (
            self.ssim_threshold_high - self.ssim_threshold_low
        )


config = InspectionConfig()
