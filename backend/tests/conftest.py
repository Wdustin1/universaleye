"""Shared test fixtures using synthetic images."""

import sys
from pathlib import Path

import numpy as np
import pytest

# Add backend dir to path so tests can import modules directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import InspectionConfig
from database import DefectDatabase


@pytest.fixture
def test_config() -> InspectionConfig:
    return InspectionConfig(
        motion_threshold=0.01,
        pixel_diff_threshold=10,
        stability_frames=3,
        ssim_block_size=32,
        ssim_block_stride=16,
        ssim_local_threshold_low=0.80,
        ssim_local_threshold_high=0.95,
        ssim_global_threshold_low=0.90,
        ssim_global_threshold_high=0.97,
        ssim_bad_pixel_floor=20,
        default_sensitivity=75,
    )


@pytest.fixture
def test_db(tmp_path) -> DefectDatabase:
    """Fresh SQLite database in a temp directory."""
    db = DefectDatabase(
        db_path=tmp_path / "test.db",
        image_dir=tmp_path / "images",
    )
    yield db
    db.close()


@pytest.fixture
def blank_frame() -> np.ndarray:
    """100x100 solid gray BGR frame."""
    return np.full((100, 100, 3), 128, dtype=np.uint8)


@pytest.fixture
def shifted_frame(blank_frame: np.ndarray) -> np.ndarray:
    """Frame with significant motion (shifted content)."""
    frame = blank_frame.copy()
    frame[:, 20:] = blank_frame[:, :-20]
    frame[:, :20] = 0
    return frame


@pytest.fixture
def noisy_frame(blank_frame: np.ndarray) -> np.ndarray:
    """Frame with minor noise (below motion threshold)."""
    rng = np.random.default_rng(42)
    noise = rng.integers(-3, 4, size=blank_frame.shape, dtype=np.int16)
    return np.clip(blank_frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)


@pytest.fixture
def reference_label() -> np.ndarray:
    """Synthetic 'golden master' label image (200x100 BGR)."""
    img = np.full((100, 200, 3), 200, dtype=np.uint8)
    img[20:40, 30:170] = 50
    img[80:95, 30:80] = [180, 50, 50]
    img[80:95, 80:130] = [50, 180, 50]
    img[80:95, 130:170] = [50, 50, 180]
    return img


@pytest.fixture
def good_label(reference_label: np.ndarray) -> np.ndarray:
    """Label very similar to reference (minor noise only)."""
    rng = np.random.default_rng(99)
    noise = rng.integers(-2, 3, size=reference_label.shape, dtype=np.int16)
    return np.clip(
        reference_label.astype(np.int16) + noise, 0, 255
    ).astype(np.uint8)


@pytest.fixture
def defective_label(reference_label: np.ndarray) -> np.ndarray:
    """Label with a large visible defect (smudge covering text area)."""
    img = reference_label.copy()
    # Large white smudge covering most of the text area
    img[15:45, 40:160] = 240
    # Also corrupt some of the color bars
    img[75:95, 40:140] = 200
    return img
