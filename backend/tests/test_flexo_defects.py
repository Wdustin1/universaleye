"""Validate inspection pipeline against simulated flexographic printing defects.

Each test loads a real frame from the Dremel video, applies a realistic
defect simulation, and verifies the inspector catches it.  A clean-frame
baseline confirms zero false positives.
"""

import os

import cv2
import numpy as np
import pytest

from config import InspectionConfig
from inspector import inspect_frame
from tests.defect_simulator import (
    hickey,
    misregister,
    smear,
    density_shift,
    missing_print,
    doctor_blade_streak,
    hazing,
    dot_gain,
    web_crease,
    splash_spots,
)

VIDEO_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "public", "Dremel, screen capture..mov"
)

_needs_video = pytest.mark.skipif(
    not os.path.isfile(VIDEO_PATH), reason="Dremel video not available"
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def ref_frame() -> np.ndarray:
    """Cropped reference frame from Dremel footage."""
    cap = cv2.VideoCapture(VIDEO_PATH)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    ret, raw = cap.read()
    cap.release()
    assert ret, "Could not read video"
    return raw[70:1040, 52:1920]


@pytest.fixture(scope="module")
def cfg() -> InspectionConfig:
    return InspectionConfig()


@pytest.fixture(scope="module")
def text_center(ref_frame: np.ndarray) -> tuple[int, int]:
    """(x, y) of the densest text region — useful for targeting defects at ink."""
    gray = cv2.cvtColor(ref_frame, cv2.COLOR_BGR2GRAY)
    best, by, bx = 0, 0, 0
    h, w = gray.shape
    for y in range(0, h - 40, 20):
        for x in range(0, w - 40, 20):
            d = int(np.sum(gray[y:y + 40, x:x + 40] < 80))
            if d > best:
                best, by, bx = d, y, x
    return bx + 20, by + 20  # centre of the patch


# ---------------------------------------------------------------------------
# Baseline — no false positives
# ---------------------------------------------------------------------------

@_needs_video
class TestBaseline:
    def test_clean_frame_passes(self, ref_frame, cfg) -> None:
        result = inspect_frame(ref_frame.copy(), ref_frame, cfg, sensitivity=75)
        assert not result.is_defect, f"False positive: wb={result.worst_block_score:.4f}"

    def test_clean_frame_at_max_sensitivity(self, ref_frame, cfg) -> None:
        result = inspect_frame(ref_frame.copy(), ref_frame, cfg, sensitivity=100)
        assert not result.is_defect, f"False positive at sens=100: wb={result.worst_block_score:.4f}"


# ---------------------------------------------------------------------------
# Individual defect detection tests
# ---------------------------------------------------------------------------

@_needs_video
class TestHickey:
    def test_negative_hickey_on_ink(self, ref_frame, cfg, text_center) -> None:
        damaged = hickey(ref_frame, center=text_center, radius=12, kind="negative")
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Negative hickey missed: wb={result.worst_block_score:.4f}"

    def test_positive_hickey_on_ink(self, ref_frame, cfg, text_center) -> None:
        damaged = hickey(ref_frame, center=text_center, radius=14, kind="positive")
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Positive hickey missed: wb={result.worst_block_score:.4f}"

    def test_hickey_on_substrate(self, ref_frame, cfg) -> None:
        """Hickey landing on a white area (ink dot on clean substrate)."""
        # Find a white area
        gray = cv2.cvtColor(ref_frame, cv2.COLOR_BGR2GRAY)
        whites = np.argwhere(gray > 200)
        cy, cx = whites[len(whites) // 2]
        damaged = hickey(ref_frame, center=(int(cx), int(cy)), radius=15, kind="positive")
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Substrate hickey missed: wb={result.worst_block_score:.4f}"


@_needs_video
class TestMisregister:
    def test_horizontal_shift(self, ref_frame, cfg) -> None:
        damaged = misregister(ref_frame, channel=0, dx=6, dy=0)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"H-misregister missed: wb={result.worst_block_score:.4f}"

    def test_vertical_shift(self, ref_frame, cfg) -> None:
        damaged = misregister(ref_frame, channel=0, dx=0, dy=5)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"V-misregister missed: wb={result.worst_block_score:.4f}"

    def test_diagonal_shift(self, ref_frame, cfg) -> None:
        damaged = misregister(ref_frame, channel=0, dx=4, dy=3)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Diagonal misregister missed: wb={result.worst_block_score:.4f}"


@_needs_video
class TestSmear:
    def test_downward_smear(self, ref_frame, cfg) -> None:
        """Visible smear — trailing ink drag in machine direction."""
        damaged = smear(ref_frame, direction="down", length=50, intensity=0.9)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Down smear missed: wb={result.worst_block_score:.4f}"

    def test_rightward_smear(self, ref_frame, cfg) -> None:
        damaged = smear(ref_frame, direction="right", length=50, intensity=0.9)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Right smear missed: wb={result.worst_block_score:.4f}"


@_needs_video
class TestDensityShift:
    def test_under_inked(self, ref_frame, cfg) -> None:
        damaged = density_shift(ref_frame, factor=0.30, direction="under")
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Under-ink missed: wb={result.worst_block_score:.4f}"

    def test_over_inked(self, ref_frame, cfg) -> None:
        damaged = density_shift(ref_frame, factor=0.40, direction="over")
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Over-ink missed: wb={result.worst_block_score:.4f}"


@_needs_video
class TestMissingPrint:
    def test_void_in_text(self, ref_frame, cfg, text_center) -> None:
        damaged = missing_print(ref_frame, center=text_center, size=50)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Missing print missed: wb={result.worst_block_score:.4f}"

    def test_small_void(self, ref_frame, cfg, text_center) -> None:
        damaged = missing_print(ref_frame, center=text_center, size=25)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Small void missed: wb={result.worst_block_score:.4f}"


@_needs_video
class TestDoctorBladeStreak:
    def test_dark_streak(self, ref_frame, cfg) -> None:
        y = ref_frame.shape[0] // 2
        damaged = doctor_blade_streak(ref_frame, y_pos=y, width=3, kind="dark")
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Dark streak missed: wb={result.worst_block_score:.4f}"

    def test_light_streak(self, ref_frame, cfg) -> None:
        y = ref_frame.shape[0] // 3
        damaged = doctor_blade_streak(ref_frame, y_pos=y, width=4, kind="light")
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Light streak missed: wb={result.worst_block_score:.4f}"


@_needs_video
class TestHazing:
    def test_moderate_haze(self, ref_frame, cfg) -> None:
        damaged = hazing(ref_frame, ink_bgr=(200, 80, 30), intensity=0.12)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Hazing missed: wb={result.worst_block_score:.4f}"

    def test_subtle_haze(self, ref_frame, cfg) -> None:
        """Subtle haze at 8% — detectable at high sensitivity."""
        damaged = hazing(ref_frame, ink_bgr=(200, 80, 30), intensity=0.08)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=100)
        assert result.is_defect, f"Subtle haze missed at sens=100: wb={result.worst_block_score:.4f}"


@_needs_video
class TestDotGain:
    def test_moderate_gain(self, ref_frame, cfg) -> None:
        damaged = dot_gain(ref_frame, gain_px=3)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Dot gain missed: wb={result.worst_block_score:.4f}"


@_needs_video
class TestWebCrease:
    def test_diagonal_crease(self, ref_frame, cfg) -> None:
        h, w = ref_frame.shape[:2]
        damaged = web_crease(
            ref_frame,
            start=(w // 4, 50),
            end=(3 * w // 4, h - 50),
            width=8,
        )
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Web crease missed: wb={result.worst_block_score:.4f}"


@_needs_video
class TestSplashSpots:
    def test_ink_spatter(self, ref_frame, cfg) -> None:
        h, w = ref_frame.shape[:2]
        damaged = splash_spots(
            ref_frame,
            center=(w // 2, h // 2),
            num_spots=20,
            spread=150,
            ink_bgr=(180, 60, 20),
        )
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Splash spots missed: wb={result.worst_block_score:.4f}"


# ---------------------------------------------------------------------------
# Combined: defect + camera drift — both at once
# ---------------------------------------------------------------------------

@_needs_video
class TestDefectPlusDrift:
    """Ensure defects are still caught when the frame has also shifted."""

    @staticmethod
    def _shift(frame: np.ndarray, dx: int, dy: int) -> np.ndarray:
        out = frame.copy()
        M = np.float32([[1, 0, dx], [0, 1, dy]])
        for c in range(3):
            out[:, :, c] = cv2.warpAffine(
                frame[:, :, c], M,
                (frame.shape[1], frame.shape[0]),
                borderMode=cv2.BORDER_REPLICATE,
            )
        return out

    def test_hickey_with_drift(self, ref_frame, cfg, text_center) -> None:
        damaged = hickey(ref_frame, center=text_center, radius=12)
        damaged = self._shift(damaged, 8, 5)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Hickey+drift missed: wb={result.worst_block_score:.4f}"

    def test_missing_print_with_drift(self, ref_frame, cfg, text_center) -> None:
        damaged = missing_print(ref_frame, center=text_center, size=40)
        damaged = self._shift(damaged, 6, 3)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Void+drift missed: wb={result.worst_block_score:.4f}"

    def test_streak_with_drift(self, ref_frame, cfg) -> None:
        damaged = doctor_blade_streak(ref_frame, y_pos=400, width=3, kind="dark")
        damaged = self._shift(damaged, 10, 7)
        result = inspect_frame(damaged, ref_frame, cfg, sensitivity=75)
        assert result.is_defect, f"Streak+drift missed: wb={result.worst_block_score:.4f}"
