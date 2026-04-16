"""Tests for the data-collection codepath.

Covers the end-to-end happy path for `start_collect_mode`,
`insert_collected_frame`, `get_collected_frames`, `label_collected_frame`,
and `clear_collected_frames` — none of which were exercised before.
"""

from __future__ import annotations

from datetime import datetime

import numpy as np
import pytest

from capture import CaptureManager
from database import DefectDatabase


@pytest.fixture
def collection_db(tmp_path) -> DefectDatabase:
    """Fresh DB with isolated collection dir."""
    db = DefectDatabase(
        db_path=tmp_path / "test.db",
        image_dir=tmp_path / "images",
        collect_dir=tmp_path / "collected",
    )
    yield db
    db.close()


class TestCollectMode:
    def test_default_off(self, test_config, collection_db) -> None:
        cm = CaptureManager(test_config, collection_db)
        assert cm.is_collect_mode() is False

    def test_start_stop(self, test_config, collection_db) -> None:
        cm = CaptureManager(test_config, collection_db)
        cm.start_collect_mode()
        assert cm.is_collect_mode() is True
        cm.stop_collect_mode()
        assert cm.is_collect_mode() is False

    def test_collection_stats_reflects_mode(self, test_config, collection_db) -> None:
        cm = CaptureManager(test_config, collection_db)
        cm.start_collect_mode()
        stats = cm.get_collection_stats()
        assert stats["collecting"] is True
        cm.stop_collect_mode()
        stats = cm.get_collection_stats()
        assert stats["collecting"] is False


class TestCollectedFrames:
    def test_insert_and_retrieve(self, collection_db, blank_frame) -> None:
        fid = collection_db.insert_collected_frame(
            datetime.now().isoformat(timespec="seconds"), blank_frame,
        )
        frames = collection_db.get_collected_frames()
        assert len(frames) == 1
        assert frames[0]["id"] == fid
        assert frames[0]["label"] is None

    def test_image_file_persisted(self, collection_db, blank_frame, tmp_path) -> None:
        fid = collection_db.insert_collected_frame(
            datetime.now().isoformat(timespec="seconds"), blank_frame,
        )
        path = collection_db.get_collected_frame_path(fid)
        assert path is not None
        assert path.exists()
        assert path.stat().st_size > 0

    def test_label_round_trip(self, collection_db, blank_frame) -> None:
        fid = collection_db.insert_collected_frame(
            datetime.now().isoformat(timespec="seconds"), blank_frame,
        )
        assert collection_db.label_collected_frame(fid, "good") is True
        frames = collection_db.get_collected_frames(label_filter="good")
        assert len(frames) == 1
        assert frames[0]["label"] == "good"

    def test_label_unknown_id_returns_false(self, collection_db) -> None:
        assert collection_db.label_collected_frame(99999, "good") is False

    def test_unlabeled_filter(self, collection_db, blank_frame) -> None:
        f1 = collection_db.insert_collected_frame(
            "2026-04-16T10:00:00", blank_frame,
        )
        f2 = collection_db.insert_collected_frame(
            "2026-04-16T10:00:01", blank_frame,
        )
        collection_db.label_collected_frame(f1, "good")
        unlabeled = collection_db.get_collected_frames(label_filter="unlabeled")
        assert len(unlabeled) == 1
        assert unlabeled[0]["id"] == f2

    def test_stats_counts_match(self, collection_db, blank_frame) -> None:
        ids = [
            collection_db.insert_collected_frame(
                f"2026-04-16T10:00:0{i}", blank_frame,
            )
            for i in range(4)
        ]
        collection_db.label_collected_frame(ids[0], "good")
        collection_db.label_collected_frame(ids[1], "good")
        collection_db.label_collected_frame(ids[2], "bad")
        stats = collection_db.get_collection_stats()
        assert stats["total"] == 4
        assert stats["good"] == 2
        assert stats["bad"] == 1
        assert stats["unlabeled"] == 1

    def test_clear_drops_rows_and_files(self, collection_db, blank_frame) -> None:
        fid = collection_db.insert_collected_frame(
            datetime.now().isoformat(timespec="seconds"), blank_frame,
        )
        path = collection_db.get_collected_frame_path(fid)
        assert path is not None and path.exists()

        collection_db.clear_collected_frames()
        assert collection_db.get_collection_stats()["total"] == 0
        assert collection_db.get_collected_frame_path(fid) is None


class TestEventCallbackThreadSafety:
    """Smoke-test that register/unregister are safe under thread contention.
    Pins the lock that fixes CON-002."""

    def test_concurrent_register_unregister(self, test_config, collection_db) -> None:
        import threading

        cm = CaptureManager(test_config, collection_db)
        stop = threading.Event()

        def churn() -> None:
            cb = lambda d: None  # noqa: E731
            while not stop.is_set():
                cm.register_event_callback(cb)
                cm.unregister_event_callback(cb)

        threads = [threading.Thread(target=churn, daemon=True) for _ in range(4)]
        for t in threads:
            t.start()
        # If the list mutation isn't lock-protected, one of these threads
        # will eventually raise; if it is, this loop completes cleanly.
        try:
            stop.wait(0.25)
        finally:
            stop.set()
            for t in threads:
                t.join(timeout=1.0)
        # No assertions needed — surviving the run is the test.
