"""Tests for SSIM inspection and defect classification."""

import os

import cv2
import numpy as np

from config import InspectionConfig
from inspector import (
    inspect_frame,
    classify_severity,
    classify_defect_type,
    align_frame,
    find_worst_block,
)
from models import Severity, AIVerdict


class TestInspectFrame:
    def test_good_label_passes(
        self, test_config: InspectionConfig, reference_label: np.ndarray, good_label: np.ndarray
    ) -> None:
        result = inspect_frame(good_label, reference_label, test_config, sensitivity=75)
        assert not result.is_defect
        assert result.ai_verdict == AIVerdict.accept

    def test_defective_label_detected(
        self, test_config: InspectionConfig, reference_label: np.ndarray, defective_label: np.ndarray
    ) -> None:
        result = inspect_frame(defective_label, reference_label, test_config, sensitivity=75)
        assert result.is_defect
        assert result.severity is not None
        assert result.defect_type != ""

    def test_identical_frames_perfect_score(
        self, test_config: InspectionConfig, reference_label: np.ndarray
    ) -> None:
        result = inspect_frame(reference_label.copy(), reference_label, test_config, sensitivity=100)
        assert not result.is_defect
        assert result.worst_block_score > 0.99

    def test_high_sensitivity_more_strict(
        self, test_config: InspectionConfig, reference_label: np.ndarray, defective_label: np.ndarray
    ) -> None:
        result_low = inspect_frame(defective_label, reference_label, test_config, sensitivity=0)
        result_high = inspect_frame(defective_label, reference_label, test_config, sensitivity=100)
        # High sensitivity should always detect what low sensitivity detects
        if result_low.is_defect:
            assert result_high.is_defect

    def test_resizes_mismatched_frames(
        self, test_config: InspectionConfig, reference_label: np.ndarray
    ) -> None:
        big_frame = np.full((200, 400, 3), 200, dtype=np.uint8)
        result = inspect_frame(big_frame, reference_label, test_config, sensitivity=50)
        assert isinstance(result.ssim_score, float)


class TestFindWorstBlock:
    def test_perfect_map_returns_one(self) -> None:
        ssim_map = np.ones((128, 128), dtype=np.float64)
        worst, pos = find_worst_block(ssim_map, block=64, stride=32)
        assert worst > 0.99

    def test_locates_bad_region(self) -> None:
        ssim_map = np.ones((256, 256), dtype=np.float64)
        # Plant a bad patch
        ssim_map[100:164, 100:164] = 0.2
        worst, (wx, wy) = find_worst_block(ssim_map, block=64, stride=32)
        assert worst < 0.5
        # Should be near the planted region
        assert 60 <= wx <= 140
        assert 60 <= wy <= 140


class TestAlignFrame:
    def _make_textured(self, h: int = 200, w: int = 400) -> np.ndarray:
        """Create a textured grayscale image that template matching can lock onto."""
        rng = np.random.default_rng(42)
        img = np.full((h, w), 180, dtype=np.uint8)
        img[40:80, 50:150] = 30
        img[40:80, 200:350] = 30
        img[120:160, 80:320] = 30
        noise = rng.integers(-5, 6, size=img.shape, dtype=np.int16)
        return np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    def test_detects_horizontal_shift(self) -> None:
        ref = self._make_textured()
        M = np.float32([[1, 0, 8], [0, 1, 0]])
        shifted = cv2.warpAffine(ref, M, (ref.shape[1], ref.shape[0]))
        _, dx, dy, conf = align_frame(shifted, ref)
        assert abs(dx - 8) <= 2
        assert abs(dy) <= 2

    def test_detects_vertical_shift(self) -> None:
        ref = self._make_textured()
        M = np.float32([[1, 0, 0], [0, 1, 6]])
        shifted = cv2.warpAffine(ref, M, (ref.shape[1], ref.shape[0]))
        _, dx, dy, conf = align_frame(shifted, ref)
        assert abs(dx) <= 2
        assert abs(dy - 6) <= 2

    def test_alignment_recovers_ssim(self) -> None:
        from skimage.metrics import structural_similarity
        ref = self._make_textured()
        M = np.float32([[1, 0, 10], [0, 1, 5]])
        shifted = cv2.warpAffine(ref, M, (ref.shape[1], ref.shape[0]))

        raw_score = structural_similarity(ref, shifted)
        aligned, _, _, conf = align_frame(shifted, ref)
        aligned_score = structural_similarity(ref, aligned)

        assert raw_score < 0.90, "raw should be degraded by shift"
        assert aligned_score > raw_score, "alignment should improve SSIM"

    def test_excessive_shift_skipped(self) -> None:
        ref = self._make_textured()
        M = np.float32([[1, 0, 100], [0, 1, 0]])
        shifted = cv2.warpAffine(ref, M, (ref.shape[1], ref.shape[0]))
        _, dx, dy, conf = align_frame(shifted, ref, max_shift=50)
        assert dx == 0
        assert dy == 0


class TestInspectFrameWithShift:
    def test_shifted_good_label_still_passes(
        self, test_config: InspectionConfig, reference_label: np.ndarray
    ) -> None:
        """A good label shifted by a few pixels should NOT be flagged as defective."""
        shifted = reference_label.copy()
        M = np.float32([[1, 0, 5], [0, 1, 3]])
        for c in range(3):
            shifted[:, :, c] = cv2.warpAffine(
                reference_label[:, :, c], M,
                (reference_label.shape[1], reference_label.shape[0]),
                borderMode=cv2.BORDER_REPLICATE,
            )
        result = inspect_frame(shifted, reference_label, test_config, sensitivity=75)
        assert not result.is_defect, (
            f"Shifted good label should pass but got worst_block={result.worst_block_score:.3f}"
        )

    def test_shifted_defective_label_still_caught(
        self, test_config: InspectionConfig, reference_label: np.ndarray, defective_label: np.ndarray
    ) -> None:
        """A defective label with added shift should still be detected."""
        shifted = defective_label.copy()
        M = np.float32([[1, 0, 3], [0, 1, 2]])
        for c in range(3):
            shifted[:, :, c] = cv2.warpAffine(
                defective_label[:, :, c], M,
                (defective_label.shape[1], defective_label.shape[0]),
                borderMode=cv2.BORDER_REPLICATE,
            )
        result = inspect_frame(shifted, reference_label, test_config, sensitivity=75)
        assert result.is_defect, "Defective label should still be caught even with shift"


class TestRealFootageSingleLetter:
    """Test against actual Dremel video: erase one letter and verify detection."""

    VIDEO_PATH = os.path.join(
        os.path.dirname(__file__), "..", "..", "public", "Dremel, screen capture..mov"
    )

    def _load_cropped_frame(self, frame_idx: int = 0) -> np.ndarray:
        cap = cv2.VideoCapture(self.VIDEO_PATH)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, raw = cap.read()
        cap.release()
        assert ret, "Failed to read video frame"
        return raw[70:1040, 52:1920]

    def _find_text_patch(self, gray: np.ndarray, size: int = 30) -> tuple[int, int]:
        """Find a patch dense with dark text pixels."""
        best_dark, best_y, best_x = 0, 0, 0
        h, w = gray.shape
        for y in range(0, h - size, size // 2):
            for x in range(0, w - size, size // 2):
                dark = int(np.sum(gray[y : y + size, x : x + size] < 80))
                if dark > best_dark:
                    best_dark, best_y, best_x = dark, y, x
        return best_y, best_x

    @staticmethod
    def _has_video() -> bool:
        path = os.path.join(
            os.path.dirname(__file__), "..", "..", "public", "Dremel, screen capture..mov"
        )
        return os.path.isfile(path)

    def test_single_letter_erased_is_detected(self) -> None:
        """Erase a single letter-sized patch from real Dremel footage and verify it's caught."""
        if not self._has_video():
            import pytest
            pytest.skip("Dremel video not available")

        ref = self._load_cropped_frame(0)
        ref_gray = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
        bg = int(np.median(ref_gray[ref_gray > 150]))

        # Find densest text patch (~one letter)
        py, px = self._find_text_patch(ref_gray, size=30)

        # Erase it
        damaged = ref.copy()
        damaged[py : py + 30, px : px + 30] = bg

        cfg = InspectionConfig()
        result = inspect_frame(damaged, ref, cfg, sensitivity=75)
        assert result.is_defect, (
            f"Single erased letter at ({px},{py}) not detected: "
            f"worst_block={result.worst_block_score:.4f}"
        )

    def test_clean_frame_passes(self) -> None:
        """Two identical frames from footage should pass inspection."""
        if not self._has_video():
            import pytest
            pytest.skip("Dremel video not available")

        ref = self._load_cropped_frame(0)
        cfg = InspectionConfig()
        result = inspect_frame(ref.copy(), ref, cfg, sensitivity=75)
        assert not result.is_defect, (
            f"Clean frame flagged as defect: worst_block={result.worst_block_score:.4f}"
        )

    def test_shifted_clean_frame_passes(self) -> None:
        """A clean frame with moderate drift should still pass after alignment."""
        if not self._has_video():
            import pytest
            pytest.skip("Dremel video not available")

        ref = self._load_cropped_frame(0)
        shifted = ref.copy()
        M = np.float32([[1, 0, 5], [0, 1, 3]])
        for c in range(3):
            shifted[:, :, c] = cv2.warpAffine(
                ref[:, :, c], M,
                (ref.shape[1], ref.shape[0]),
                borderMode=cv2.BORDER_REPLICATE,
            )
        cfg = InspectionConfig()
        result = inspect_frame(shifted, ref, cfg, sensitivity=75)
        assert not result.is_defect, (
            f"Shifted clean frame flagged: worst_block={result.worst_block_score:.4f}"
        )

    def test_shifted_with_erased_letter_still_caught(self) -> None:
        """Erase a letter AND shift the frame — should still detect the defect."""
        if not self._has_video():
            import pytest
            pytest.skip("Dremel video not available")

        ref = self._load_cropped_frame(0)
        ref_gray = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
        bg = int(np.median(ref_gray[ref_gray > 150]))
        py, px = self._find_text_patch(ref_gray, size=30)

        damaged = ref.copy()
        damaged[py : py + 30, px : px + 30] = bg

        # Also shift
        M = np.float32([[1, 0, 7], [0, 1, 4]])
        for c in range(3):
            damaged[:, :, c] = cv2.warpAffine(
                damaged[:, :, c], M,
                (damaged.shape[1], damaged.shape[0]),
                borderMode=cv2.BORDER_REPLICATE,
            )

        cfg = InspectionConfig()
        result = inspect_frame(damaged, ref, cfg, sensitivity=75)
        assert result.is_defect, (
            f"Shifted + erased letter not detected: worst_block={result.worst_block_score:.4f}"
        )


class TestClassifySeverity:
    def test_critical(self, test_config: InspectionConfig) -> None:
        assert classify_severity(0.20, test_config) == Severity.critical

    def test_major(self, test_config: InspectionConfig) -> None:
        assert classify_severity(0.40, test_config) == Severity.major

    def test_minor(self, test_config: InspectionConfig) -> None:
        assert classify_severity(0.60, test_config) == Severity.minor


class TestClassifyDefectType:
    def test_empty_diff_returns_smudge(self) -> None:
        diff = np.zeros((100, 100), dtype=np.uint8)
        assert classify_defect_type(diff) == "Smudge"

    def test_large_defect_is_missing_print(self) -> None:
        diff = np.zeros((100, 200), dtype=np.uint8)
        diff[10:90, 20:180] = 255
        assert classify_defect_type(diff) == "Missing Print"

    def test_small_round_defect(self) -> None:
        diff = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(diff, (100, 100), 5, 255, -1)
        result = classify_defect_type(diff)
        assert result in ("Hickey", "Splash/Spot")
