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
from inspector import inspect_frame
from models import Defect, InspectionState
from state_machine import MotionStateMachine, State

logger = logging.getLogger(__name__)


class CaptureManager:
    """Manages video capture, state machine, and inspection in a background thread."""

    def __init__(self, config: InspectionConfig) -> None:
        self.config = config
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
        self._defects: list[Defect] = []
        self._defect_id_counter: int = 0
        self._start_time: datetime | None = None

        # State machine (only accessed from capture thread)
        self._state_machine = MotionStateMachine(config)

        # SSE event callbacks
        self._event_callbacks: list = []

        # Camera availability flag
        self._camera_available = False

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
                ret, frame = self._cap.read()
                if not ret:
                    frame = self._generate_placeholder_frame()
            else:
                frame = self._generate_placeholder_frame()

            with self._lock:
                self._latest_frame = frame

                if self._inspection_state == InspectionState.running:
                    sm_state = self._state_machine.process_frame(frame)

                    if sm_state == State.INSPECT and self._reference_image is not None:
                        self._run_inspection(self._state_machine.locked_frame)
                        self._state_machine.acknowledge_inspection()

            elapsed = time.monotonic() - loop_start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    def _run_inspection(self, locked_frame: np.ndarray) -> None:
        """Run SSIM inspection on the locked frame. Called with _lock held."""
        self._labels_inspected += 1
        self._last_inspected_frame = locked_frame.copy()

        result = inspect_frame(
            locked_frame,
            self._reference_image,
            self.config,
            self._sensitivity,
        )

        if result.is_defect:
            self._defect_id_counter += 1
            now = datetime.now()
            defect = Defect(
                id=self._defect_id_counter,
                timestamp=now.strftime("%H:%M:%S"),
                type=result.defect_type,
                severity=result.severity,
                label_number=self._labels_inspected,
                lane=((self._labels_inspected - 1) % 3) + 1,
                ai_verdict=result.ai_verdict,
            )
            self._defects.insert(0, defect)

            for callback in self._event_callbacks:
                try:
                    callback(defect)
                except Exception:
                    logger.exception("SSE callback error")

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
            self._defects.clear()
            self._defect_id_counter = 0
            self._start_time = None
            self._last_inspected_frame = None
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
                "defectsFound": len(self._defects),
                "runTime": run_time,
                "status": self._inspection_state.value,
            }

    def get_defects(self, offset: int = 0, limit: int = 50) -> list[dict]:
        with self._lock:
            sliced = self._defects[offset : offset + limit]
            return [d.model_dump_frontend() for d in sliced]

    def get_defect_breakdown(self) -> list[dict]:
        with self._lock:
            total = len(self._defects)
            if total == 0:
                return []
            counts: dict[str, int] = {}
            for d in self._defects:
                counts[d.type] = counts.get(d.type, 0) + 1
            return [
                {
                    "type": dtype,
                    "count": count,
                    "percentage": round(count / total * 100, 1),
                }
                for dtype, count in sorted(
                    counts.items(), key=lambda x: x[1], reverse=True
                )
            ]

    def register_event_callback(self, callback) -> None:
        self._event_callbacks.append(callback)

    def unregister_event_callback(self, callback) -> None:
        try:
            self._event_callbacks.remove(callback)
        except ValueError:
            pass
