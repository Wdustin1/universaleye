"""Tests for configuration."""

from config import InspectionConfig


class TestInspectionConfig:
    def test_default_values(self) -> None:
        cfg = InspectionConfig()
        assert cfg.camera_index == 1
        assert cfg.default_sensitivity == 75
        assert cfg.port == 8000

    def test_ssim_threshold_at_zero_sensitivity(self) -> None:
        cfg = InspectionConfig()
        assert cfg.ssim_local_threshold_for_sensitivity(0) == cfg.ssim_local_threshold_low

    def test_ssim_threshold_at_max_sensitivity(self) -> None:
        cfg = InspectionConfig()
        assert cfg.ssim_local_threshold_for_sensitivity(100) == cfg.ssim_local_threshold_high

    def test_ssim_threshold_midpoint(self) -> None:
        cfg = InspectionConfig()
        threshold = cfg.ssim_local_threshold_for_sensitivity(50)
        expected = (cfg.ssim_local_threshold_low + cfg.ssim_local_threshold_high) / 2
        assert abs(threshold - expected) < 1e-6

    def test_ssim_threshold_clamps_below_zero(self) -> None:
        cfg = InspectionConfig()
        assert cfg.ssim_local_threshold_for_sensitivity(-10) == cfg.ssim_local_threshold_low

    def test_ssim_threshold_clamps_above_hundred(self) -> None:
        cfg = InspectionConfig()
        assert cfg.ssim_local_threshold_for_sensitivity(150) == cfg.ssim_local_threshold_high

    def test_global_threshold_at_zero(self) -> None:
        cfg = InspectionConfig()
        assert cfg.ssim_global_threshold_for_sensitivity(0) == cfg.ssim_global_threshold_low

    def test_global_threshold_at_max(self) -> None:
        cfg = InspectionConfig()
        assert cfg.ssim_global_threshold_for_sensitivity(100) == cfg.ssim_global_threshold_high
