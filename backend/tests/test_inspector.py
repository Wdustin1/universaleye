"""Tests for SSIM inspection and defect classification."""

import cv2
import numpy as np

from config import InspectionConfig
from inspector import inspect_frame, classify_severity, classify_defect_type
from models import Severity, AIVerdict


class TestInspectFrame:
    def test_good_label_passes(
        self, test_config: InspectionConfig, reference_label: np.ndarray, good_label: np.ndarray
    ) -> None:
        result = inspect_frame(good_label, reference_label, test_config, sensitivity=75)
        assert not result.is_defect
        assert result.ai_verdict == AIVerdict.accept
        assert result.ssim_score > 0.9

    def test_defective_label_detected(
        self, test_config: InspectionConfig, reference_label: np.ndarray, defective_label: np.ndarray
    ) -> None:
        result = inspect_frame(defective_label, reference_label, test_config, sensitivity=75)
        assert result.is_defect
        assert result.severity is not None
        assert result.defect_type != ""
        assert result.ssim_score < 0.95

    def test_identical_frames_perfect_score(
        self, test_config: InspectionConfig, reference_label: np.ndarray
    ) -> None:
        result = inspect_frame(reference_label.copy(), reference_label, test_config, sensitivity=100)
        assert not result.is_defect
        assert result.ssim_score > 0.99

    def test_high_sensitivity_more_strict(
        self, test_config: InspectionConfig, reference_label: np.ndarray, defective_label: np.ndarray
    ) -> None:
        result_low = inspect_frame(defective_label, reference_label, test_config, sensitivity=0)
        result_high = inspect_frame(defective_label, reference_label, test_config, sensitivity=100)
        # SSIM score is the same, but threshold changes
        assert result_low.ssim_score == result_high.ssim_score
        assert result_high.is_defect

    def test_resizes_mismatched_frames(
        self, test_config: InspectionConfig, reference_label: np.ndarray
    ) -> None:
        big_frame = np.full((200, 400, 3), 200, dtype=np.uint8)
        result = inspect_frame(big_frame, reference_label, test_config, sensitivity=50)
        assert isinstance(result.ssim_score, float)


class TestClassifySeverity:
    def test_critical(self, test_config: InspectionConfig) -> None:
        assert classify_severity(0.50, test_config) == Severity.critical

    def test_major(self, test_config: InspectionConfig) -> None:
        assert classify_severity(0.70, test_config) == Severity.major

    def test_minor(self, test_config: InspectionConfig) -> None:
        assert classify_severity(0.80, test_config) == Severity.minor


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
