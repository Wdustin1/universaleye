"""SQLite persistence for defect records and annotated images."""

from __future__ import annotations

import logging
import shutil
import sqlite3
import threading
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

_DEFAULT_DATA_DIR = Path(__file__).parent / "data"


def _default_data_dir() -> Path:
    """Returns DATA_DIR from config if set, otherwise the sibling data/ folder."""
    try:
        from config import config  # imported lazily to avoid circular import at module load
        if config.data_dir is not None:
            return config.data_dir
    except Exception:
        pass
    return _DEFAULT_DATA_DIR


def _resolve_paths() -> tuple[Path, Path, Path]:
    base = _default_data_dir()
    return base / "defects.db", base / "defect_images", base / "collected_frames"


DB_PATH, IMAGE_DIR, COLLECT_DIR = _resolve_paths()

_CREATE_TABLE = """\
CREATE TABLE IF NOT EXISTS defects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT NOT NULL,
    type        TEXT NOT NULL,
    severity    TEXT NOT NULL,
    ai_verdict  TEXT NOT NULL,
    ssim_score  REAL,
    image_path  TEXT
);
CREATE TABLE IF NOT EXISTS collected_frames (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT NOT NULL,
    image_path  TEXT,
    label       TEXT DEFAULT NULL  -- 'good' | 'bad' | NULL (unlabeled)
);
"""

_CREATE_INDEXES = """\
CREATE INDEX IF NOT EXISTS idx_defects_timestamp ON defects(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_defects_type ON defects(type);
CREATE INDEX IF NOT EXISTS idx_collected_timestamp ON collected_frames(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_collected_label ON collected_frames(label);
"""


def create_annotated_image(
    frame: np.ndarray,
    diff_image: np.ndarray,
    threshold: int = 40,
    alpha: float = 0.4,
) -> np.ndarray:
    """Overlay diff_image as a red highlight on the original frame."""
    _, mask = cv2.threshold(diff_image, threshold, 255, cv2.THRESH_BINARY)
    overlay = frame.copy()
    overlay[mask > 0] = [0, 0, 255]  # BGR red
    result = frame.copy()
    blended = cv2.addWeighted(frame, 1 - alpha, overlay, alpha, 0)
    result[mask > 0] = blended[mask > 0]
    return result


class DefectDatabase:
    """Thread-safe SQLite store for defect records and images."""

    def __init__(
        self,
        db_path: Optional[Path] = None,
        image_dir: Optional[Path] = None,
        collect_dir: Optional[Path] = None,
    ) -> None:
        self._db_path = db_path or DB_PATH
        self._image_dir = image_dir or IMAGE_DIR
        self._collect_dir = collect_dir or COLLECT_DIR
        self._lock = threading.Lock()

        # Ensure directories exist
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._image_dir.mkdir(parents=True, exist_ok=True)
        self._collect_dir.mkdir(parents=True, exist_ok=True)

        self._conn = sqlite3.connect(
            str(self._db_path), check_same_thread=False,
        )
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.executescript(_CREATE_TABLE + _CREATE_INDEXES)
        self._conn.commit()
        logger.info("DefectDatabase ready: %s", self._db_path)

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def insert_defect(
        self,
        timestamp: str,
        defect_type: str,
        severity: str,
        ai_verdict: str,
        ssim_score: float,
        frame: np.ndarray,
        diff_image: Optional[np.ndarray],
    ) -> int:
        """Insert a defect row and save the annotated image. Returns the new ID."""
        # Build annotated image
        image_path: Optional[str] = None
        annotated: Optional[np.ndarray] = None
        if diff_image is not None:
            annotated = create_annotated_image(frame, diff_image)

        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO defects (timestamp, type, severity, ai_verdict, ssim_score)"
                " VALUES (?, ?, ?, ?, ?)",
                (timestamp, defect_type, severity, ai_verdict, ssim_score),
            )
            defect_id = cur.lastrowid
            self._conn.commit()

        # Save image outside the DB lock
        if annotated is not None:
            fname = f"{defect_id}.jpg"
            fpath = self._image_dir / fname
            cv2.imwrite(str(fpath), annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
            image_path = f"defect_images/{fname}"
            with self._lock:
                self._conn.execute(
                    "UPDATE defects SET image_path = ? WHERE id = ?",
                    (image_path, defect_id),
                )
                self._conn.commit()

        return defect_id

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_defects(self, offset: int = 0, limit: int = 50) -> list:
        """Return defects newest-first as camelCase dicts."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT id, timestamp, type, severity, ai_verdict, ssim_score"
                " FROM defects ORDER BY id DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        return [
            {
                "id": r[0],
                "timestamp": r[1],
                "type": r[2],
                "severity": r[3],
                "aiVerdict": r[4],
                "ssimScore": r[5],
            }
            for r in rows
        ]

    def get_defect_breakdown(self) -> list:
        """Return defect type counts with percentages."""
        with self._lock:
            total_row = self._conn.execute(
                "SELECT COUNT(*) FROM defects",
            ).fetchone()
            total = total_row[0] if total_row else 0
            if total == 0:
                return []
            rows = self._conn.execute(
                "SELECT type, COUNT(*) as cnt FROM defects"
                " GROUP BY type ORDER BY cnt DESC",
            ).fetchall()
        return [
            {
                "type": r[0],
                "count": r[1],
                "percentage": round(r[1] / total * 100, 1),
            }
            for r in rows
        ]

    def get_defect_count(self) -> int:
        with self._lock:
            row = self._conn.execute("SELECT COUNT(*) FROM defects").fetchone()
            return row[0] if row else 0

    def get_defect_image_path(self, defect_id: int) -> Optional[Path]:
        """Absolute path to the annotated JPEG, or None."""
        p = self._image_dir / f"{defect_id}.jpg"
        return p if p.exists() else None

    # ------------------------------------------------------------------
    # Data Collection (training data capture)
    # ------------------------------------------------------------------

    def insert_collected_frame(self, timestamp: str, frame: np.ndarray) -> int:
        """Save a raw label frame for training-data collection. Returns the new ID."""
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO collected_frames (timestamp) VALUES (?)",
                (timestamp,),
            )
            frame_id = cur.lastrowid
            self._conn.commit()

        fname = f"{frame_id}.jpg"
        fpath = self._collect_dir / fname
        cv2.imwrite(str(fpath), frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        image_path = f"collected_frames/{fname}"

        with self._lock:
            self._conn.execute(
                "UPDATE collected_frames SET image_path = ? WHERE id = ?",
                (image_path, frame_id),
            )
            self._conn.commit()

        return frame_id

    def get_collected_frames(
        self,
        offset: int = 0,
        limit: int = 50,
        label_filter: Optional[str] = None,  # 'good' | 'bad' | 'unlabeled' | None
    ) -> list:
        with self._lock:
            if label_filter == "unlabeled":
                rows = self._conn.execute(
                    "SELECT id, timestamp, image_path, label FROM collected_frames"
                    " WHERE label IS NULL ORDER BY id DESC LIMIT ? OFFSET ?",
                    (limit, offset),
                ).fetchall()
            elif label_filter in ("good", "bad"):
                rows = self._conn.execute(
                    "SELECT id, timestamp, image_path, label FROM collected_frames"
                    " WHERE label = ? ORDER BY id DESC LIMIT ? OFFSET ?",
                    (label_filter, limit, offset),
                ).fetchall()
            else:
                rows = self._conn.execute(
                    "SELECT id, timestamp, image_path, label FROM collected_frames"
                    " ORDER BY id DESC LIMIT ? OFFSET ?",
                    (limit, offset),
                ).fetchall()
        return [
            {
                "id": r[0],
                "timestamp": r[1],
                "imagePath": r[2],
                "label": r[3],
            }
            for r in rows
        ]

    def label_collected_frame(self, frame_id: int, label: Optional[str]) -> bool:
        """Set label to 'good', 'bad', or None (unlabeled). Returns True if found."""
        with self._lock:
            cur = self._conn.execute(
                "UPDATE collected_frames SET label = ? WHERE id = ?",
                (label, frame_id),
            )
            self._conn.commit()
            return cur.rowcount > 0

    def get_collection_stats(self) -> dict:
        with self._lock:
            total = self._conn.execute(
                "SELECT COUNT(*) FROM collected_frames"
            ).fetchone()[0]
            good = self._conn.execute(
                "SELECT COUNT(*) FROM collected_frames WHERE label = 'good'"
            ).fetchone()[0]
            bad = self._conn.execute(
                "SELECT COUNT(*) FROM collected_frames WHERE label = 'bad'"
            ).fetchone()[0]
        return {
            "total": total,
            "good": good,
            "bad": bad,
            "unlabeled": total - good - bad,
        }

    def get_collected_frame_path(self, frame_id: int) -> Optional[Path]:
        p = self._collect_dir / f"{frame_id}.jpg"
        return p if p.exists() else None

    def clear_collected_frames(self) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM collected_frames")
            self._conn.commit()
        if self._collect_dir.exists():
            shutil.rmtree(self._collect_dir)
            self._collect_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Collected frames cleared")

    # ------------------------------------------------------------------
    # Maintenance
    # ------------------------------------------------------------------

    def clear_all(self) -> None:
        """Delete all defect records and images."""
        with self._lock:
            self._conn.execute("DELETE FROM defects")
            self._conn.commit()
        # Remove all images
        if self._image_dir.exists():
            shutil.rmtree(self._image_dir)
            self._image_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Defect database cleared")

    def close(self) -> None:
        with self._lock:
            self._conn.close()
