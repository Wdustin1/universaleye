# ORB Feature Matching Alignment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace template matching alignment with ORB feature matching + homography to handle large frame jitter from camera timing, and add Gaussian blur to state machine motion detection to reduce jitter sensitivity.

**Architecture:** ORB detects keypoints in both reference and captured frames, matches them, computes a homography matrix via RANSAC, and warps the frame to align. A validity mask (created by warping a white image with the same homography) replaces the old dx/dy-based border masking. The state machine gets a Gaussian blur before pixel diff to smooth out jitter.

**Tech Stack:** OpenCV (ORB, BFMatcher, findHomography, warpPerspective), already installed.

---

### Task 1: Add ORB config fields to `config.py`

**Files:**
- Modify: `backend/config.py:29` (replace `alignment_max_shift` with ORB params)
- Test: `backend/tests/test_config.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_config.py`:

```python
def test_orb_config_defaults():
    from config import InspectionConfig
    cfg = InspectionConfig()
    assert cfg.orb_features == 500
    assert cfg.orb_min_matches == 10
    assert cfg.motion_blur_kernel == 5
    assert not hasattr(cfg, 'alignment_max_shift')
```

**Step 2: Run test to verify it fails**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_config.py::test_orb_config_defaults -v`
Expected: FAIL — `orb_features` doesn't exist yet

**Step 3: Update config.py**

In `backend/config.py`, replace line 29:
```python
    alignment_max_shift: int = 200  # px; labels can drift significantly on the web
```
with:
```python
    # ORB feature matching alignment
    orb_features: int = 500         # max ORB keypoints to detect
    orb_min_matches: int = 10       # minimum good matches for homography
    # State machine motion blur
    motion_blur_kernel: int = 5     # Gaussian blur kernel for jitter suppression
```

**Step 4: Run test to verify it passes**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_config.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/config.py backend/tests/test_config.py
git commit -m "feat: add ORB alignment and motion blur config, remove alignment_max_shift"
```

---

### Task 2: Add Gaussian blur to state machine motion detection

**Files:**
- Modify: `backend/state_machine.py:46-53`
- Test: `backend/tests/test_capture.py` (state machine tests live here)

**Step 1: Write the failing test**

Add to `backend/tests/test_capture.py` (or create a new test class):

```python
class TestMotionBlur:
    def test_jitter_does_not_trigger_motion(self, test_config: InspectionConfig):
        """Small pixel shifts from jitter should not register as motion."""
        from state_machine import MotionStateMachine
        test_config.motion_blur_kernel = 5
        sm = MotionStateMachine(test_config)

        # Create a base frame with content
        base = np.full((100, 100, 3), 128, dtype=np.uint8)
        base[20:80, 20:80] = 200

        # First frame
        sm.process_frame(base)

        # Shift by 1-2 pixels (jitter) using warpAffine
        M = np.float32([[1, 0, 2], [0, 1, 1]])
        jittered = cv2.warpAffine(base, M, (100, 100), borderMode=cv2.BORDER_REPLICATE)

        gray_base = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY)
        gray_jit = cv2.cvtColor(jittered, cv2.COLOR_BGR2GRAY)

        ratio = sm.compute_motion_ratio(gray_jit)
        assert ratio < test_config.motion_threshold, (
            f"Jitter motion ratio {ratio} should be below threshold {test_config.motion_threshold}"
        )
```

**Step 2: Run test to verify it fails**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_capture.py::TestMotionBlur -v`
Expected: FAIL — jitter triggers motion because no blur is applied

**Step 3: Update state_machine.py**

In `backend/state_machine.py`, modify `compute_motion_ratio`:

```python
    def compute_motion_ratio(self, gray_frame: np.ndarray) -> float:
        """Fraction of pixels that differ between current and previous frame."""
        if self.prev_gray is None:
            return 0.0
        k = self.config.motion_blur_kernel
        if k > 1:
            blurred_prev = cv2.GaussianBlur(self.prev_gray, (k, k), 0)
            blurred_curr = cv2.GaussianBlur(gray_frame, (k, k), 0)
        else:
            blurred_prev = self.prev_gray
            blurred_curr = gray_frame
        diff = cv2.absdiff(blurred_prev, blurred_curr)
        changed_pixels = np.count_nonzero(diff > self.config.pixel_diff_threshold)
        total_pixels = gray_frame.shape[0] * gray_frame.shape[1]
        return changed_pixels / total_pixels if total_pixels > 0 else 0.0
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_capture.py -v`
Expected: ALL PASS (new test + existing state machine tests)

**Step 5: Commit**

```bash
git add backend/state_machine.py backend/tests/test_capture.py
git commit -m "feat: add Gaussian blur to motion detection for jitter suppression"
```

---

### Task 3: Replace alignment functions in `inspector.py`

**Files:**
- Modify: `backend/inspector.py:34-102` (replace `locate_label` and `align_frame`)
- Modify: `backend/inspector.py:206-252` (update `inspect_frame` to use new alignment)

**Step 1: Write the failing alignment test**

Replace the `TestAlignFrame` class in `backend/tests/test_inspector.py`:

```python
class TestAlignFrame:
    def _make_textured(self, h: int = 200, w: int = 400) -> np.ndarray:
        """Create a textured grayscale image with enough features for ORB."""
        rng = np.random.default_rng(42)
        img = np.full((h, w), 180, dtype=np.uint8)
        # Text-like dark bars (strong corners for ORB)
        img[40:80, 50:150] = 30
        img[40:80, 200:350] = 30
        img[120:160, 80:320] = 30
        # Small features
        img[20:25, 100:105] = 60
        img[20:25, 200:205] = 60
        img[20:25, 300:305] = 60
        img[170:175, 100:105] = 60
        img[170:175, 200:205] = 60
        img[170:175, 300:305] = 60
        noise = rng.integers(-5, 6, size=img.shape, dtype=np.int16)
        return np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    def test_detects_horizontal_shift(self) -> None:
        ref = self._make_textured()
        M = np.float32([[1, 0, 8], [0, 1, 0]])
        shifted = cv2.warpAffine(ref, M, (ref.shape[1], ref.shape[0]),
                                 borderMode=cv2.BORDER_REPLICATE)
        aligned, _, conf = align_frame(shifted, ref)
        from skimage.metrics import structural_similarity
        score = structural_similarity(ref, aligned)
        assert score > 0.85, f"Aligned SSIM {score} too low after horizontal shift"

    def test_detects_vertical_shift(self) -> None:
        ref = self._make_textured()
        M = np.float32([[1, 0, 0], [0, 1, 6]])
        shifted = cv2.warpAffine(ref, M, (ref.shape[1], ref.shape[0]),
                                 borderMode=cv2.BORDER_REPLICATE)
        aligned, _, conf = align_frame(shifted, ref)
        from skimage.metrics import structural_similarity
        score = structural_similarity(ref, aligned)
        assert score > 0.85, f"Aligned SSIM {score} too low after vertical shift"

    def test_alignment_recovers_ssim(self) -> None:
        from skimage.metrics import structural_similarity
        ref = self._make_textured()
        M = np.float32([[1, 0, 10], [0, 1, 5]])
        shifted = cv2.warpAffine(ref, M, (ref.shape[1], ref.shape[0]),
                                 borderMode=cv2.BORDER_REPLICATE)
        raw_score = structural_similarity(ref, shifted)
        aligned, _, conf = align_frame(shifted, ref)
        aligned_score = structural_similarity(ref, aligned)
        assert aligned_score > raw_score, "alignment should improve SSIM"

    def test_large_shift_handled(self) -> None:
        """ORB should handle 50px+ shifts that template matching struggled with."""
        from skimage.metrics import structural_similarity
        ref = self._make_textured()
        M = np.float32([[1, 0, 60], [0, 1, 30]])
        shifted = cv2.warpAffine(ref, M, (ref.shape[1], ref.shape[0]),
                                 borderMode=cv2.BORDER_REPLICATE)
        aligned, _, conf = align_frame(shifted, ref)
        score = structural_similarity(ref, aligned)
        assert score > 0.70, f"Large shift alignment SSIM {score} too low"

    def test_rotation_handled(self) -> None:
        """ORB + homography should compensate small rotation."""
        from skimage.metrics import structural_similarity
        ref = self._make_textured()
        h, w = ref.shape
        center = (w // 2, h // 2)
        R = cv2.getRotationMatrix2D(center, 2.0, 1.0)  # 2 degree rotation
        rotated = cv2.warpAffine(ref, R, (w, h), borderMode=cv2.BORDER_REPLICATE)
        raw_score = structural_similarity(ref, rotated)
        aligned, _, conf = align_frame(rotated, ref)
        aligned_score = structural_similarity(ref, aligned)
        assert aligned_score > raw_score, "alignment should improve SSIM after rotation"

    def test_low_feature_frame_returns_unchanged(self) -> None:
        """A blank/featureless frame should return unchanged with low confidence."""
        ref = self._make_textured()
        blank = np.full_like(ref, 128)
        aligned, _, conf = align_frame(blank, ref)
        assert conf < 0.3
        np.testing.assert_array_equal(aligned, blank)
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_inspector.py::TestAlignFrame -v`
Expected: FAIL — `align_frame` has wrong signature (returns 4 values, tests expect 3)

**Step 3: Replace alignment functions in inspector.py**

Replace lines 34-102 in `backend/inspector.py` (everything from `# ------ Alignment via template matching ------` through end of `align_frame`) with:

```python
# ------ Alignment via ORB feature matching ------

def align_frame(
    frame_gray: np.ndarray,
    ref_gray: np.ndarray,
    orb_features: int = 500,
    min_matches: int = 10,
) -> tuple[np.ndarray, np.ndarray | None, float]:
    """Align *frame_gray* to *ref_gray* using ORB feature matching + homography.

    Returns (aligned_frame, homography_matrix, confidence).
    - confidence is the ratio of RANSAC inliers to total matches (0-1).
    - If not enough matches, returns (frame_gray, None, 0.0).
    """
    orb = cv2.ORB_create(nfeatures=orb_features)
    kp1, des1 = orb.detectAndCompute(ref_gray, None)
    kp2, des2 = orb.detectAndCompute(frame_gray, None)

    if des1 is None or des2 is None or len(des1) < min_matches or len(des2) < min_matches:
        logger.debug("Not enough ORB features: ref=%s, frame=%s",
                      len(des1) if des1 is not None else 0,
                      len(des2) if des2 is not None else 0)
        return frame_gray, None, 0.0

    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    raw_matches = bf.knnMatch(des1, des2, k=2)

    # Lowe's ratio test
    good = []
    for m_pair in raw_matches:
        if len(m_pair) == 2:
            m, n = m_pair
            if m.distance < 0.75 * n.distance:
                good.append(m)

    if len(good) < min_matches:
        logger.debug("Only %d good matches (need %d)", len(good), min_matches)
        return frame_gray, None, 0.0

    src_pts = np.float32([kp1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst_pts = np.float32([kp2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

    H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)

    if H is None:
        logger.debug("Homography computation failed")
        return frame_gray, None, 0.0

    inliers = int(mask.sum()) if mask is not None else 0
    confidence = inliers / len(good) if good else 0.0

    if confidence < 0.3:
        logger.debug("Homography confidence %.2f too low", confidence)
        return frame_gray, None, confidence

    h, w = ref_gray.shape
    aligned = cv2.warpPerspective(frame_gray, H, (w, h),
                                  borderMode=cv2.BORDER_REPLICATE)

    return aligned, H, confidence
```

**Step 4: Update `inspect_frame` to use new alignment**

Replace lines 206-335 of `backend/inspector.py` with:

```python
def inspect_frame(
    frame: np.ndarray,
    reference: np.ndarray,
    config: InspectionConfig,
    sensitivity: int,
) -> InspectionResult:
    """Compare a captured frame against the golden reference.

    1. ORB feature matching aligns the frame to the reference.
    2. A validity mask excludes border pixels affected by the warp.
    3. Local block SSIM detects spatial defects; per-channel global
       SSIM detects colour-plane defects.
    """
    if frame.shape[:2] != reference.shape[:2]:
        frame = cv2.resize(frame, (reference.shape[1], reference.shape[0]))

    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_ref = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)

    # --- Align frame to reference via ORB ---
    gray_frame, H, confidence = align_frame(
        gray_frame, gray_ref,
        orb_features=config.orb_features,
        min_matches=config.orb_min_matches,
    )

    if H is None:
        logger.info(
            "ORB alignment failed (confidence=%.2f) — skipping inspection",
            confidence,
        )
        return _SKIP

    logger.debug("ORB aligned frame: confidence=%.2f", confidence)

    # Build validity mask — warp a white image to find valid pixels
    h, w = gray_ref.shape
    ones = np.ones((h, w), dtype=np.uint8) * 255
    valid_mask = cv2.warpPerspective(ones, H, (w, h)) > 128
    valid_ratio = valid_mask.sum() / valid_mask.size

    if valid_ratio < 0.5:
        logger.info("Valid area ratio %.2f too small — skipping inspection", valid_ratio)
        return _SKIP

    # --- Grayscale SSIM for local detection (spatial defects) ---
    gray_global, gray_map = ssim(gray_ref, gray_frame, full=True)

    # Mask out invalid border pixels from alignment warp
    gray_map[~valid_mask] = 1.0

    worst_block, worst_pos = find_worst_block(
        gray_map, config.ssim_block_size, config.ssim_block_stride,
    )
    bad_pixel_count = int(np.sum(gray_map[valid_mask] < 0.5))

    local_threshold = config.ssim_local_threshold_for_sensitivity(sensitivity)
    local_defect = (
        worst_block < local_threshold and bad_pixel_count >= config.ssim_bad_pixel_floor
    )

    # --- Per-channel SSIM for global detection (colour-plane defects) ---
    aligned_color = frame.copy()
    for c in range(3):
        aligned_color[:, :, c] = cv2.warpPerspective(
            frame[:, :, c], H, (w, h),
            borderMode=cv2.BORDER_REPLICATE,
        )

    # Crop to valid region for channel comparison
    ys, xs = np.where(valid_mask)
    if len(ys) == 0:
        return _SKIP
    y1, y2 = ys.min(), ys.max() + 1
    x1, x2 = xs.min(), xs.max() + 1

    ref_crop = reference[y1:y2, x1:x2]
    frm_crop = aligned_color[y1:y2, x1:x2]

    channel_scores = []
    for c in range(3):
        ch_score, _ = ssim(ref_crop[:, :, c], frm_crop[:, :, c], full=True)
        channel_scores.append(ch_score)

    global_score = float(min(channel_scores))

    global_threshold = config.ssim_global_threshold_for_sensitivity(sensitivity)
    global_defect = global_score < global_threshold

    is_defect = local_defect or global_defect

    # Build diff image from grayscale map for defect classification
    diff_uint8 = (255 - (gray_map * 255)).astype(np.uint8)

    if is_defect:
        severity = classify_severity(worst_block, config)
        defect_type = classify_defect_type(diff_uint8)
        if severity == Severity.critical or severity == Severity.major:
            ai_verdict = AIVerdict.reject
        else:
            ai_verdict = AIVerdict.review
        logger.info(
            "Defect detected: worst_block=%.3f at %s, bad_px=%d, global=%.3f, "
            "conf=%.2f, type=%s, severity=%s",
            worst_block, worst_pos, bad_pixel_count, global_score,
            confidence, defect_type, severity.value,
        )
    else:
        severity = None
        defect_type = ""
        ai_verdict = AIVerdict.accept

    return InspectionResult(
        is_defect=is_defect,
        ssim_score=global_score,
        worst_block_score=worst_block,
        defect_type=defect_type,
        severity=severity,
        ai_verdict=ai_verdict,
        diff_image=diff_uint8 if is_defect else None,
    )
```

**Step 5: Run all alignment and inspection tests**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_inspector.py -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/inspector.py backend/tests/test_inspector.py
git commit -m "feat: replace template matching with ORB feature matching + homography"
```

---

### Task 4: Fix any remaining references to `alignment_max_shift`

**Files:**
- Search: all `backend/` files for `alignment_max_shift` or `max_shift` or `locate_label`

**Step 1: Search for stale references**

Run: `grep -rn "alignment_max_shift\|locate_label" backend/`

**Step 2: Remove any found references**

Update any imports, config usages, or test references that still mention the old API.

**Step 3: Run full test suite**

Run: `cd backend && source .venv/bin/activate && pytest -v`
Expected: ALL PASS

**Step 4: Commit (if any changes)**

```bash
git add -A backend/
git commit -m "chore: remove stale template matching references"
```

---

### Task 5: Update CLAUDE.md docs

**Files:**
- Modify: `CLAUDE.md` (alignment section in Backend Architecture)

**Step 1: Update alignment description**

In the Backend Architecture section, update the Inspector bullet to mention ORB + homography instead of template matching.

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect ORB alignment"
```
