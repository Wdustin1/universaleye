"""Tests for CaptureManager (without real camera)."""

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
