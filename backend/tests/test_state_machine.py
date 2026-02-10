"""Tests for the motion detection state machine."""

import numpy as np

from config import InspectionConfig
from state_machine import MotionStateMachine, State


class TestMotionStateMachine:
    def test_initial_state_is_monitoring(self, test_config: InspectionConfig) -> None:
        sm = MotionStateMachine(test_config)
        assert sm.state == State.MONITORING

    def test_first_frame_stays_monitoring(
        self, test_config: InspectionConfig, blank_frame: np.ndarray
    ) -> None:
        sm = MotionStateMachine(test_config)
        result = sm.process_frame(blank_frame)
        assert result == State.MONITORING

    def test_identical_frames_stay_monitoring(
        self, test_config: InspectionConfig, blank_frame: np.ndarray
    ) -> None:
        sm = MotionStateMachine(test_config)
        sm.process_frame(blank_frame)
        result = sm.process_frame(blank_frame.copy())
        assert result == State.MONITORING

    def test_motion_detected(
        self,
        test_config: InspectionConfig,
        blank_frame: np.ndarray,
        shifted_frame: np.ndarray,
    ) -> None:
        sm = MotionStateMachine(test_config)
        sm.process_frame(blank_frame)
        result = sm.process_frame(shifted_frame)
        assert result == State.MOTION

    def test_motion_to_stabilizing(
        self,
        test_config: InspectionConfig,
        blank_frame: np.ndarray,
        shifted_frame: np.ndarray,
    ) -> None:
        sm = MotionStateMachine(test_config)
        sm.process_frame(blank_frame)
        sm.process_frame(shifted_frame)  # -> MOTION
        sm.process_frame(shifted_frame)  # identical = no motion -> STABILIZING
        assert sm.state == State.STABILIZING

    def test_stabilizing_to_inspect(
        self, test_config: InspectionConfig, blank_frame: np.ndarray, shifted_frame: np.ndarray
    ) -> None:
        sm = MotionStateMachine(test_config)
        sm.process_frame(blank_frame)
        sm.process_frame(shifted_frame)  # MOTION
        # Feed identical shifted frames to stabilize (stability_frames=3)
        for _ in range(test_config.stability_frames):
            result = sm.process_frame(shifted_frame)
        assert result == State.INSPECT
        assert sm.locked_frame is not None

    def test_stabilizing_interrupted_by_motion(
        self,
        test_config: InspectionConfig,
        blank_frame: np.ndarray,
        shifted_frame: np.ndarray,
    ) -> None:
        sm = MotionStateMachine(test_config)
        sm.process_frame(blank_frame)
        sm.process_frame(shifted_frame)  # MOTION
        sm.process_frame(shifted_frame)  # -> STABILIZING
        # Interrupt with a different frame
        different = shifted_frame.copy()
        different[:50, :50] = 255
        sm.process_frame(different)
        assert sm.state == State.MOTION

    def test_acknowledge_returns_to_monitoring(
        self, test_config: InspectionConfig, blank_frame: np.ndarray, shifted_frame: np.ndarray
    ) -> None:
        sm = MotionStateMachine(test_config)
        sm.process_frame(blank_frame)
        sm.process_frame(shifted_frame)
        for _ in range(test_config.stability_frames):
            sm.process_frame(shifted_frame)
        assert sm.state == State.INSPECT
        sm.acknowledge_inspection()
        assert sm.state == State.MONITORING
        assert sm.locked_frame is None

    def test_reset(self, test_config: InspectionConfig, blank_frame: np.ndarray) -> None:
        sm = MotionStateMachine(test_config)
        sm.process_frame(blank_frame)
        sm.reset()
        assert sm.state == State.MONITORING
        assert sm.prev_gray is None
