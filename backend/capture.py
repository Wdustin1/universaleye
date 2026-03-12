"""Video capture thread and frame management.

Runs OpenCV VideoCapture in a dedicated thread (not asyncio) because
cv2.read() is a blocking C call. Shares frames with the FastAPI
async handlers via a threading.Lock-protected buffer.
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime

import cv2
import numpy as np

from config import InspectionConfig
from database import DefectDatabase
from inspector import inspect_frame
from models import Defect, InspectionState
from state_machine import MotionStateMachine, State

logger = logging.getLogger(__name__)


class CaptureManager:
    """Manages video capture, state machine, and inspection in a background thread."""

    def __init__(self, config: InspectionConfig, db: DefectDatabase) -> None:
        self.config = config
        self._db = db
        self._lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None
        self._cap: cv2.VideoCapture | None = None

        # Shared state (protected by _lock)
        self._latest_frame: np.ndarray | None = None
        self._reference_image: np.ndarray | None = None
        self._last_inspected_frame: np.ndarray | None = None
        self._inspection_state = InspectionState.stopped
        self._sensitivity: int = config.default_sensitivity

        # Stats
        self._labels_inspected: int = 0
        self._start_time: datetime | None = None

        # Data collection mode — saves every inspected label frame for labeling
        self._collect_mode: bool = False

        # State machine (only accessed from capture thread)
        self._state_machine = MotionStateMachine(config)

        # SSE event callbacks
        self._event_callbacks: list = []

        # Camera availability flag
        self._camera_available = False
        self._using_video_file = False

    # ------ Frame preprocessing ------

    def _crop_frame(self, frame: np.ndarray) -> np.ndarray:
        """Remove ELSCAN OMS3 UI overlay and mask ROI marker lines."""
        cfg = self.config

        # Interpolate over thin vertical ROI marker lines
        for x1, x2 in cfg.crop_mask_lines:
            if x1 > 1 and x2 < frame.shape[1] - 2:
                left = frame[:, x1 - 2 : x1, :].mean(axis=1, keepdims=True)
                right = frame[:, x2 + 1 : x2 + 3, :].mean(axis=1, keepdims=True)
                span = x2 - x1 + 1
                for i, x in enumerate(range(x1, x2 + 1)):
                    t = i / max(span - 1, 1)
                    frame[:, x, :] = ((1 - t) * left + t * right).squeeze().astype(
                        np.uint8
                    )

        # Crop to label area
        return frame[cfg.crop_top : cfg.crop_bottom, cfg.crop_left : cfg.crop_right]

    # ------ Thread lifecycle ------

    def start_capture(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        logger.info("Capture thread started")

    def stop_capture(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=5.0)
            self._thread = None
        if self._cap and self._cap.isOpened():
            self._cap.release()
            self._cap = None
        logger.info("Capture thread stopped")

    def _open_camera(self) -> bool:
        try:
            if self.config.video_file:
                self._cap = cv2.VideoCapture(self.config.video_file)
                if not self._cap.isOpened():
                    logger.warning(
                        "Video file %s not found. Running in no-camera mode.",
                        self.config.video_file,
                    )
                    self._camera_available = False
                    return False
                self._camera_available = True
                self._using_video_file = True
                logger.info("Video file opened: %s", self.config.video_file)
                return True

            self._cap = cv2.VideoCapture(self.config.camera_index)
            if not self._cap.isOpened():
                logger.warning(
                    "Camera index %d not available. Running in no-camera mode.",
                    self.config.camera_index,
                )
                self._camera_available = False
                return False
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.camera_width)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.camera_height)
            self._camera_available = True
            logger.info("Camera opened successfully (index=%d)", self.config.camera_index)
            return True
        except Exception:
            logger.exception("Failed to open camera")
            self._camera_available = False
            return False

    def _generate_placeholder_frame(self) -> np.ndarray:
        """Generate a full-resolution placeholder (will be cropped by _crop_frame)."""
        frame = np.full(
            (self.config.camera_height, self.config.camera_width, 3),
            20,
            dtype=np.uint8,
        )
        text = "NO CAMERA SIGNAL"
        font = cv2.FONT_HERSHEY_SIMPLEX
        scale = 1.5
        thickness = 2
        (tw, th), _ = cv2.getTextSize(text, font, scale, thickness)
        x = (frame.shape[1] - tw) // 2
        y = (frame.shape[0] + th) // 2
        cv2.putText(frame, text, (x, y), font, scale, (80, 80, 80), thickness)
        return frame

    def _capture_loop(self) -> None:
        camera_ok = self._open_camera()
        frame_interval = 1.0 / self.config.capture_fps

        while self._running:
            loop_start = time.monotonic()

            if camera_ok and self._cap and self._cap.isOpened():
                ret, raw = self._cap.read()
                if not ret:
                    if self._using_video_file:
                        self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        ret, raw = self._cap.read()
                    if not ret:
                        raw = self._generate_placeholder_frame()
            else:
                raw = self._generate_placeholder_frame()

            frame = self._crop_frame(raw)

            # Snapshot everything needed for inspection while holding the lock,
            # then run the expensive SSIM pass *outside* the lock so the MJPEG
            # stream is never blocked during a label inspection (50-200 ms).
            inspect_data: tuple | None = None
            with self._lock:
                self._latest_frame = frame

                if self._inspection_state == InspectionState.running:
                    sm_state = self._state_machine.process_frame(frame)

                    if sm_state == State.INSPECT and self._reference_image is not None:
                        inspect_data = (
                            self._state_machine.locked_frame.copy(),
                            self._reference_image.copy(),
                            self._sensitivity,
                        )
                        self._labels_inspected += 1
                        self._state_machine.acknowledge_inspection()

            # Runs without the lock — stream stays live during inspection.
            if inspect_data is not None:
                self._run_inspection(*inspect_data)
                # In collect mode, save the raw frame for operator labeling.
                with self._lock:
                    collecting = self._collect_mode
                if collecting:
                    self._save_collected_frame(inspect_data[0])

            elapsed = time.monotonic() - loop_start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    def _run_inspection(
        self,
        locked_frame: np.ndarray,
        reference: np.ndarray,
        sensitivity: int,
    ) -> None:
        """Run SSIM inspection on a snapshot of the locked frame.

        Called **without** ``_lock`` held so the MJPEG stream is never
        blocked during the expensive SSIM computation.  The lock is
        re-acquired briefly at the end only to store ``_last_inspected_frame``.
        """
        result = inspect_frame(locked_frame, reference, self.config, sensitivity)

        # Store the inspected frame for the reference-comparison panel.
        with self._lock:
            self._last_inspected_frame = locked_frame

        if result.is_defect:
            now = datetime.now()
            defect_id = self._db.insert_defect(
                timestamp=now.isoformat(timespec="seconds"),
                defect_type=result.defect_type,
                severity=result.severity.value,
                ai_verdict=result.ai_verdict.value,
                ssim_score=result.ssim_score,
                frame=locked_frame,
                diff_image=result.diff_image,
            )
            defect = Defect(
                id=defect_id,
                timestamp=now.isoformat(timespec="seconds"),
                type=result.defect_type,
                severity=result.severity,
                ai_verdict=result.ai_verdict,
                ssim_score=result.ssim_score,
            )

            for callback in self._event_callbacks:
                try:
                    callback(defect)
                except Exception:
                    logger.exception("SSE callback error")

    def _save_collected_frame(self, frame: np.ndarray) -> None:
        """Persist a raw label frame to the collection store. No lock held."""
        try:
            self._db.insert_collected_frame(
                timestamp=datetime.now().isoformat(timespec="seconds"),
                frame=frame,
            )
        except Exception:
            logger.exception("Failed to save collected frame")

    # ------ Public API (called from FastAPI routes) ------

    def get_latest_frame_jpeg(self) -> bytes | None:
        with self._lock:
            if self._latest_frame is None:
                return None
            _, buf = cv2.imencode(
                ".jpg",
                self._latest_frame,
                [cv2.IMWRITE_JPEG_QUALITY, self.config.mjpeg_quality],
            )
            return buf.tobytes()

    def get_reference_jpeg(self) -> bytes | None:
        with self._lock:
            if self._reference_image is None:
                return None
            _, buf = cv2.imencode(".jpg", self._reference_image)
            return buf.tobytes()

    def get_current_capture_jpeg(self) -> bytes | None:
        with self._lock:
            if self._last_inspected_frame is None:
                return None
            _, buf = cv2.imencode(".jpg", self._last_inspected_frame)
            return buf.tobytes()

    def set_reference(self) -> bool:
        with self._lock:
            if self._latest_frame is not None:
                self._reference_image = self._latest_frame.copy()
                logger.info("Reference image set")
                return True
            return False

    def reset_reference(self) -> None:
        with self._lock:
            self._reference_image = None
            logger.info("Reference image cleared")

    def start_inspection(self) -> None:
        with self._lock:
            self._inspection_state = InspectionState.running
            self._state_machine.reset()
            if self._start_time is None:
                self._start_time = datetime.now()
            logger.info("Inspection started")

    def pause_inspection(self) -> None:
        with self._lock:
            self._inspection_state = InspectionState.paused
            logger.info("Inspection paused")

    def stop_inspection(self) -> None:
        with self._lock:
            self._inspection_state = InspectionState.stopped
            self._state_machine.reset()
            self._labels_inspected = 0
            self._start_time = None
            self._last_inspected_frame = None
        self._db.clear_all()
        logger.info("Inspection stopped, stats reset")

    def set_sensitivity(self, value: int) -> None:
        with self._lock:
            self._sensitivity = max(0, min(100, value))

    def get_stats(self) -> dict:
        with self._lock:
            run_time = "00:00:00"
            if self._start_time and self._inspection_state != InspectionState.stopped:
                elapsed = datetime.now() - self._start_time
                hours, remainder = divmod(int(elapsed.total_seconds()), 3600)
                minutes, seconds = divmod(remainder, 60)
                run_time = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

            return {
                "labelsInspected": self._labels_inspected,
                "defectsFound": self._db.get_defect_count(),
                "runTime": run_time,
                "status": self._inspection_state.value,
                "hasReference": self._reference_image is not None,
            }

    def get_defects(self, offset: int = 0, limit: int = 50) -> list:
        return self._db.get_defects(offset, limit)

    def get_defect_breakdown(self) -> list:
        return self._db.get_defect_breakdown()

    def get_defect_image_path(self, defect_id: int):
        return self._db.get_defect_image_path(defect_id)

    def register_event_callback(self, callback) -> None:
        self._event_callbacks.append(callback)

    def unregister_event_callback(self, callback) -> None:
        try:
            self._event_callbacks.remove(callback)
        except ValueError:
            pass

    # ------ Data Collection ------

    def start_collect_mode(self) -> None:
        with self._lock:
            self._collect_mode = True
        logger.info("Collect mode ON")

    def stop_collect_mode(self) -> None:
        with self._lock:
            self._collect_mode = False
        logger.info("Collect mode OFF")

    def is_collect_mode(self) -> bool:
        with self._lock:
            return self._collect_mode

    def get_collected_frames(
        self, offset: int = 0, limit: int = 50, label_filter: str | None = None
    ) -> list:
        return self._db.get_collected_frames(offset, limit, label_filter)

    def label_collected_frame(self, frame_id: int, label: str | None) -> bool:
        return self._db.label_collected_frame(frame_id, label)

    def get_collection_stats(self) -> dict:
        stats = self._db.get_collection_stats()
        with self._lock:
            stats["collecting"] = self._collect_mode
        return stats

    def get_collected_frame_path(self, frame_id: int):
        return self._db.get_collected_frame_path(frame_id)

    def clear_collected_frames(self) -> None:
        self._db.clear_collected_frames()
