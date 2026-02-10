"""Motion detection state machine for label inspection.

States:
    MONITORING  - Watching feed, comparing consecutive frames
    MOTION      - Motion detected (labels moving), waiting for stop
    STABILIZING - Motion stopped, counting stable frames
    INSPECT     - Frame locked, ready for SSIM comparison

Transitions:
    MONITORING  -> MOTION       when diff > threshold
    MOTION      -> STABILIZING  when diff drops below threshold
    STABILIZING -> MOTION       when diff spikes again (false stop)
    STABILIZING -> INSPECT      when stable for N consecutive frames
    INSPECT     -> MONITORING   after inspection completes (called externally)
"""

from enum import Enum, auto

import cv2
import numpy as np

from config import InspectionConfig


class State(Enum):
    MONITORING = auto()
    MOTION = auto()
    STABILIZING = auto()
    INSPECT = auto()


class MotionStateMachine:
    def __init__(self, config: InspectionConfig) -> None:
        self.config = config
        self.state = State.MONITORING
        self.prev_gray: np.ndarray | None = None
        self.stable_count: int = 0
        self.locked_frame: np.ndarray | None = None

    def reset(self) -> None:
        self.state = State.MONITORING
        self.prev_gray = None
        self.stable_count = 0
        self.locked_frame = None

    def compute_motion_ratio(self, gray_frame: np.ndarray) -> float:
        """Fraction of pixels that differ between current and previous frame."""
        if self.prev_gray is None:
            return 0.0
        diff = cv2.absdiff(self.prev_gray, gray_frame)
        changed_pixels = np.count_nonzero(diff > self.config.pixel_diff_threshold)
        total_pixels = gray_frame.shape[0] * gray_frame.shape[1]
        return changed_pixels / total_pixels if total_pixels > 0 else 0.0

    def process_frame(self, frame: np.ndarray) -> State:
        """Process a new BGR frame and return the current state.

        If state is INSPECT, caller should read self.locked_frame.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        motion_ratio = self.compute_motion_ratio(gray)
        self.prev_gray = gray

        has_motion = motion_ratio > self.config.motion_threshold

        if self.state == State.MONITORING:
            if has_motion:
                self.state = State.MOTION
                self.stable_count = 0

        elif self.state == State.MOTION:
            if not has_motion:
                self.state = State.STABILIZING
                self.stable_count = 1

        elif self.state == State.STABILIZING:
            if has_motion:
                self.state = State.MOTION
                self.stable_count = 0
            else:
                self.stable_count += 1
                if self.stable_count >= self.config.stability_frames:
                    self.locked_frame = frame.copy()
                    self.state = State.INSPECT

        # INSPECT: stay until acknowledge_inspection() is called

        return self.state

    def acknowledge_inspection(self) -> None:
        """Called after inspection is complete. Returns to MONITORING."""
        self.locked_frame = None
        self.state = State.MONITORING
        self.stable_count = 0
