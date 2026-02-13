"""Tests for SQLite defect persistence."""

import numpy as np
import pytest

from database import DefectDatabase, create_annotated_image


@pytest.fixture
def db(tmp_path):
    """Fresh database in a temporary directory."""
    d = DefectDatabase(
        db_path=tmp_path / "test.db",
        image_dir=tmp_path / "images",
    )
    yield d
    d.close()


@pytest.fixture
def sample_frame() -> np.ndarray:
    """200x300 BGR frame with some dark regions."""
    frame = np.full((200, 300, 3), 200, dtype=np.uint8)
    frame[50:100, 80:220] = 40
    return frame


@pytest.fixture
def sample_diff() -> np.ndarray:
    """Grayscale diff image with a bright defect region."""
    diff = np.zeros((200, 300), dtype=np.uint8)
    diff[60:90, 100:200] = 180
    return diff


class TestCreateAnnotatedImage:
    def test_output_shape_matches_input(self, sample_frame, sample_diff) -> None:
        result = create_annotated_image(sample_frame, sample_diff)
        assert result.shape == sample_frame.shape
        assert result.dtype == np.uint8

    def test_defect_region_has_red_tint(self, sample_frame, sample_diff) -> None:
        result = create_annotated_image(sample_frame, sample_diff)
        # The defect region should have higher red channel than original
        defect_region = result[70, 150]  # centre of diff region
        original = sample_frame[70, 150]
        assert defect_region[2] > original[2]  # BGR: index 2 is red


class TestInsertDefect:
    def test_returns_sequential_ids(self, db, sample_frame, sample_diff) -> None:
        id1 = db.insert_defect(
            "2026-02-12T10:00:00", "Hickey", "major", "reject",
            0.72, sample_frame, sample_diff,
        )
        id2 = db.insert_defect(
            "2026-02-12T10:00:05", "Smudge", "minor", "review",
            0.85, sample_frame, sample_diff,
        )
        assert id2 == id1 + 1

    def test_creates_image_file(self, db, tmp_path, sample_frame, sample_diff) -> None:
        defect_id = db.insert_defect(
            "2026-02-12T10:00:00", "Hickey", "major", "reject",
            0.72, sample_frame, sample_diff,
        )
        img_path = tmp_path / "images" / f"{defect_id}.jpg"
        assert img_path.exists()
        assert img_path.stat().st_size > 0

    def test_no_image_when_diff_is_none(self, db, sample_frame) -> None:
        defect_id = db.insert_defect(
            "2026-02-12T10:00:00", "Hickey", "major", "reject",
            0.72, sample_frame, None,
        )
        assert db.get_defect_image_path(defect_id) is None


class TestGetDefects:
    def test_newest_first(self, db, sample_frame, sample_diff) -> None:
        db.insert_defect("2026-02-12T10:00:00", "Hickey", "major", "reject", 0.7, sample_frame, sample_diff)
        db.insert_defect("2026-02-12T10:00:05", "Smudge", "minor", "review", 0.9, sample_frame, sample_diff)
        results = db.get_defects()
        assert results[0]["type"] == "Smudge"
        assert results[1]["type"] == "Hickey"

    def test_pagination(self, db, sample_frame, sample_diff) -> None:
        for i in range(5):
            db.insert_defect(f"2026-02-12T10:00:{i:02d}", "Hickey", "major", "reject", 0.7, sample_frame, sample_diff)
        page1 = db.get_defects(offset=0, limit=2)
        page2 = db.get_defects(offset=2, limit=2)
        assert len(page1) == 2
        assert len(page2) == 2
        assert page1[0]["id"] != page2[0]["id"]

    def test_camelcase_keys(self, db, sample_frame, sample_diff) -> None:
        db.insert_defect("2026-02-12T10:00:00", "Hickey", "major", "reject", 0.72, sample_frame, sample_diff)
        row = db.get_defects()[0]
        assert "aiVerdict" in row
        assert "ssimScore" in row
        assert "ai_verdict" not in row

    def test_empty_returns_empty_list(self, db) -> None:
        assert db.get_defects() == []


class TestGetDefectBreakdown:
    def test_aggregation(self, db, sample_frame, sample_diff) -> None:
        for _ in range(3):
            db.insert_defect("2026-02-12T10:00:00", "Hickey", "major", "reject", 0.7, sample_frame, sample_diff)
        db.insert_defect("2026-02-12T10:00:01", "Smudge", "minor", "review", 0.9, sample_frame, sample_diff)
        breakdown = db.get_defect_breakdown()
        assert breakdown[0]["type"] == "Hickey"
        assert breakdown[0]["count"] == 3
        assert breakdown[0]["percentage"] == 75.0
        assert breakdown[1]["type"] == "Smudge"
        assert breakdown[1]["count"] == 1

    def test_empty_returns_empty(self, db) -> None:
        assert db.get_defect_breakdown() == []


class TestGetDefectCount:
    def test_count(self, db, sample_frame, sample_diff) -> None:
        assert db.get_defect_count() == 0
        db.insert_defect("2026-02-12T10:00:00", "Hickey", "major", "reject", 0.7, sample_frame, sample_diff)
        assert db.get_defect_count() == 1


class TestGetDefectImagePath:
    def test_returns_path_for_existing(self, db, sample_frame, sample_diff) -> None:
        defect_id = db.insert_defect(
            "2026-02-12T10:00:00", "Hickey", "major", "reject",
            0.72, sample_frame, sample_diff,
        )
        path = db.get_defect_image_path(defect_id)
        assert path is not None
        assert path.exists()

    def test_returns_none_for_missing(self, db) -> None:
        assert db.get_defect_image_path(999) is None


class TestClearAll:
    def test_removes_rows_and_images(self, db, tmp_path, sample_frame, sample_diff) -> None:
        db.insert_defect("2026-02-12T10:00:00", "Hickey", "major", "reject", 0.7, sample_frame, sample_diff)
        assert db.get_defect_count() == 1
        assert any((tmp_path / "images").iterdir())

        db.clear_all()
        assert db.get_defect_count() == 0
        # Image dir still exists but is empty
        assert (tmp_path / "images").exists()
        assert not any((tmp_path / "images").iterdir())
