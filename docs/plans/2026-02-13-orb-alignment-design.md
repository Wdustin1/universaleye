# ORB Feature Matching Alignment Design

## Problem

The camera feed has timing jitter — the camera occasionally misses by milliseconds, causing the label image to jump position on-screen then snap back. The label is physically still on the web but shifts in the frame. This causes:

1. **False defects**: Template matching alignment can't handle large shifts or rotation, so SSIM comparison fails on a perfectly good label
2. **State machine thrashing**: Raw pixel diff in motion detection treats jitter as "motion", bouncing between MOTION/STABILIZING states

## Solution

### 1. Replace template matching with ORB + homography in `inspector.py`

Replace `locate_label()` and `align_frame()` with:

- Detect ORB keypoints + descriptors on both reference and captured frame
- Match descriptors using `BFMatcher` with Hamming distance
- Filter with Lowe's ratio test
- Compute homography via `findHomography` with RANSAC (>= 10 good matches)
- Warp frame using `warpPerspective`
- Fallback: if not enough matches, return frame unchanged and skip inspection

Handles translation, rotation, scale, and perspective. Works with 50%+ shifts.

### 2. Add Gaussian blur to state machine motion detection in `state_machine.py`

- Apply `GaussianBlur` (5x5 kernel) before `absdiff` in `compute_motion_ratio()`
- Smooths pixel-level jitter so only real web movement triggers MOTION state

### 3. Config changes in `config.py`

- Add `orb_features: int = 500`
- Add `orb_min_matches: int = 10`
- Add `motion_blur_kernel: int = 5`
- Remove `alignment_max_shift` (homography handles any shift)

### 4. Test updates in `test_inspector.py`

- Update `TestAlignFrame` for new ORB function signature
- Add large shift test (50px+)
- Add rotation test
- Existing pipeline tests should pass as-is

## Files Changed

- `backend/inspector.py` — alignment functions replaced
- `backend/state_machine.py` — Gaussian blur added to motion detection
- `backend/config.py` — new ORB/blur params, remove alignment_max_shift
- `backend/tests/test_inspector.py` — updated alignment tests

## No New Dependencies

ORB, BFMatcher, findHomography, warpPerspective are all in OpenCV (already installed).
