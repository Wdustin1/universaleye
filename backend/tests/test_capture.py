"""Tests for CaptureManager (without real camera)."""

import cv2
import numpy as np

from capture import CaptureManager
from config import InspectionConfig
from database import DefectDatabase


class TestCaptureManager:
    def test_initial_state_is_stopped(self, test_config, test_db) -> None:
        cm = CaptureManager(test_config, test_db)
        stats = cm.get_stats()
        assert stats["status"] == "stopped"
        assert stats["labelsInspected"] == 0

    def test_get_latest_frame_none_initially(self, test_config, test_db) -> None:
        cm = CaptureManager(test_config, test_db)
        assert cm.get_latest_frame_jpeg() is None

    def test_set_reference_fails_without_frame(self, test_config, test_db) -> None:
        cm = CaptureManager(test_config, test_db)
        assert cm.set_reference() is False

    def test_set_reference_succeeds_with_frame(
        self, test_config, test_db, blank_frame: np.ndarray
    ) -> None:
        cm = CaptureManager(test_config, test_db)
        cm._latest_frame = blank_frame
        assert cm.set_reference() is True
        assert cm.get_reference_jpeg() is not None

    def test_reset_reference(self, test_config, test_db, blank_frame: np.ndarray) -> None:
        cm = CaptureManager(test_config, test_db)
        cm._latest_frame = blank_frame
        cm.set_reference()
        cm.reset_reference()
        assert cm.get_reference_jpeg() is None

    def test_start_sets_running(self, test_config, test_db) -> None:
        cm = CaptureManager(test_config, test_db)
        cm.start_inspection()
        stats = cm.get_stats()
        assert stats["status"] == "running"

    def test_pause_sets_paused(self, test_config, test_db) -> None:
        cm = CaptureManager(test_config, test_db)
        cm.start_inspection()
        cm.pause_inspection()
        stats = cm.get_stats()
        assert stats["status"] == "paused"

    def test_stop_resets_everything(self, test_config, test_db) -> None:
        cm = CaptureManager(test_config, test_db)
        cm.start_inspection()
        cm.stop_inspection()
        stats = cm.get_stats()
        assert stats["status"] == "stopped"
        assert stats["labelsInspected"] == 0

    def test_set_sensitivity_clamps(self, test_config, test_db) -> None:
        cm = CaptureManager(test_config, test_db)
        cm.set_sensitivity(150)
        assert cm._sensitivity == 100
        cm.set_sensitivity(-10)
        assert cm._sensitivity == 0

    def test_get_defects_empty_initially(self, test_config, test_db) -> None:
        cm = CaptureManager(test_config, test_db)
        assert cm.get_defects() == []

    def test_get_defect_breakdown_empty_initially(self, test_config, test_db) -> None:
        cm = CaptureManager(test_config, test_db)
        assert cm.get_defect_breakdown() == []

    def test_placeholder_frame_generated(self, test_config, test_db) -> None:
        cm = CaptureManager(test_config, test_db)
        frame = cm._generate_placeholder_frame()
        assert frame.shape == (test_config.camera_height, test_config.camera_width, 3)


class TestMotionBlur:
    def test_blur_kernel_applied_to_gray_frames(self, test_config):
        """Verify that motion_blur_kernel causes blur to be applied to gray frames."""
        from state_machine import MotionStateMachine

        # Enable blur
        test_config.motion_blur_kernel = 5
        sm = MotionStateMachine(test_config)

        # Create a frame
        frame = np.full((100, 100, 3), 128, dtype=np.uint8)
        frame[40:60, 40:60] = 200

        # Process it
        sm.process_frame(frame)

        # prev_gray should be stored as blurred version
        # Manually compute what it should be
        gray_raw = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray_blurred = cv2.GaussianBlur(gray_raw, (5, 5), 0)

        # Check that prev_gray matches the blurred version, not the raw
        assert np.array_equal(sm.prev_gray, gray_blurred), (
            "prev_gray should be the blurred version when motion_blur_kernel > 1"
        )

    def test_no_blur_when_kernel_is_one(self, test_config):
        """Verify that motion_blur_kernel=1 disables blur."""
        from state_machine import MotionStateMachine

        # Disable blur
        test_config.motion_blur_kernel = 1
        sm = MotionStateMachine(test_config)

        # Create a frame
        frame = np.full((100, 100, 3), 128, dtype=np.uint8)
        frame[40:60, 40:60] = 200

        # Process it
        sm.process_frame(frame)

        # prev_gray should be stored as raw gray (no blur)
        gray_raw = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        assert np.array_equal(sm.prev_gray, gray_raw), (
            "prev_gray should be raw gray when motion_blur_kernel <= 1"
        )
