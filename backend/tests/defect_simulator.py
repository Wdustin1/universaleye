"""Simulate realistic flexographic printing defects on captured frames.

Each function takes a BGR frame and returns a damaged copy. These are
used by test_flexo_defects.py to validate the inspection pipeline
against the kinds of defects that actually appear on flexo presses.
"""

from __future__ import annotations

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ink_mask(frame: np.ndarray, threshold: int = 150) -> np.ndarray:
    """Binary mask (float32 0/1) of dark (printed) pixels."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return (gray < threshold).astype(np.float32)


def _substrate_mask(frame: np.ndarray, threshold: int = 170) -> np.ndarray:
    """Binary mask (float32 0/1) of light (substrate) pixels."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return (gray > threshold).astype(np.float32)


# ---------------------------------------------------------------------------
# 1. Hickey — circular ink contamination spot
# ---------------------------------------------------------------------------

def hickey(
    frame: np.ndarray,
    center: tuple[int, int],
    radius: int = 12,
    kind: str = "negative",
) -> np.ndarray:
    """Negative hickey = white void + dark ring.  Positive = dark blob + light halo."""
    out = frame.copy().astype(np.float32)
    h, w = frame.shape[:2]
    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((X - center[0]) ** 2 + (Y - center[1]) ** 2).astype(np.float32)

    inner_r = radius * 0.4
    outer_r = float(radius)

    if kind == "negative":
        # White void centre
        void = np.clip(1.0 - dist / inner_r, 0, 1)
        for c in range(3):
            out[:, :, c] += (255 - out[:, :, c]) * void * 0.8
        # Dark ring
        ring = np.exp(-((dist - inner_r * 1.3) ** 2) / (2 * (radius * 0.25) ** 2))
        ring *= ((dist >= inner_r) & (dist < outer_r)).astype(np.float32)
        out *= (1 - ring[..., None] * 0.45)
    else:
        blob = np.clip(1.0 - dist / inner_r, 0, 1)
        out *= (1 - blob[..., None] * 0.55)
        halo = np.exp(-((dist - inner_r) ** 2) / (2 * (radius * 0.3) ** 2))
        halo *= ((dist >= inner_r) & (dist < outer_r)).astype(np.float32)
        for c in range(3):
            out[:, :, c] += (255 - out[:, :, c]) * halo * 0.35

    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 2. Misregister — one colour plate shifted
# ---------------------------------------------------------------------------

def misregister(
    frame: np.ndarray,
    channel: int = 0,
    dx: int = 6,
    dy: int = 0,
) -> np.ndarray:
    """Shift a single colour channel to simulate plate misalignment."""
    out = frame.copy()
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    out[:, :, channel] = cv2.warpAffine(
        frame[:, :, channel], M,
        (frame.shape[1], frame.shape[0]),
        borderMode=cv2.BORDER_REFLECT_101,
    )
    return out


# ---------------------------------------------------------------------------
# 3. Ink smear — directional drag from printed areas
# ---------------------------------------------------------------------------

def smear(
    frame: np.ndarray,
    direction: str = "down",
    length: int = 25,
    intensity: float = 0.5,
) -> np.ndarray:
    """Directional ink smearing in the machine direction."""
    out = frame.copy().astype(np.float32)
    ink = _ink_mask(frame)

    ksize = length
    kernel = np.zeros((ksize, ksize), dtype=np.float32)
    mid = ksize // 2
    if direction == "down":
        kernel[mid:, mid] = np.linspace(1, 0.1, ksize - mid)
    elif direction == "up":
        kernel[: mid + 1, mid] = np.linspace(0.1, 1, mid + 1)
    elif direction == "right":
        kernel[mid, mid:] = np.linspace(1, 0.1, ksize - mid)
    else:
        kernel[mid, : mid + 1] = np.linspace(0.1, 1, mid + 1)
    kernel /= kernel.sum() + 1e-8

    # Smear a normalised darkness map so the trail is visible on substrate
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32)
    darkness = np.clip((150 - gray) / 150, 0, 1) * ink
    smeared_darkness = cv2.filter2D(darkness, -1, kernel)
    trail = np.clip(smeared_darkness * (1 - ink), 0, 1)

    for c in range(3):
        out[:, :, c] = out[:, :, c] * (1 - trail * intensity)

    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 4. Density shift — uniform colour gets lighter or darker
# ---------------------------------------------------------------------------

def density_shift(
    frame: np.ndarray,
    factor: float = 0.25,
    direction: str = "under",
) -> np.ndarray:
    """Lighten or darken all printed areas uniformly."""
    out = frame.copy().astype(np.float32)
    ink = _ink_mask(frame)
    if direction == "under":
        for c in range(3):
            out[:, :, c] += (255 - out[:, :, c]) * ink * factor
    else:
        out *= (1 - ink[..., None] * factor * 0.5)
    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 5. Missing print / void
# ---------------------------------------------------------------------------

def missing_print(
    frame: np.ndarray,
    center: tuple[int, int],
    size: int = 40,
) -> np.ndarray:
    """Irregular void where ink failed to transfer."""
    out = frame.copy().astype(np.float32)
    h, w = frame.shape[:2]
    ink = _ink_mask(frame)

    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((X - center[0]) ** 2 + (Y - center[1]) ** 2).astype(np.float32)
    void = np.clip(1.0 - dist / (size / 2), 0, 1)
    # Roughen the edges
    rng = np.random.default_rng(7)
    noise = cv2.GaussianBlur(
        rng.standard_normal((h, w)).astype(np.float32), (9, 9), 4,
    )
    noise = (noise - noise.min()) / (noise.max() - noise.min() + 1e-8)
    void *= np.clip(noise + 0.3, 0, 1)
    void *= ink  # only erase ink, not substrate

    for c in range(3):
        out[:, :, c] = out[:, :, c] * (1 - void * 0.9) + 255 * void * 0.9

    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 6. Doctor blade streak — thin horizontal line across the full width
# ---------------------------------------------------------------------------

def doctor_blade_streak(
    frame: np.ndarray,
    y_pos: int,
    width: int = 3,
    kind: str = "dark",
    intensity: float = 0.55,
) -> np.ndarray:
    """Perfectly straight horizontal line spanning full image width."""
    out = frame.copy().astype(np.float32)
    y0 = max(0, y_pos - width // 2)
    y1 = min(frame.shape[0], y_pos + width // 2 + 1)

    for y in range(y0, y1):
        falloff = 1.0 - abs(y - y_pos) / max(width / 2, 1)
        falloff = max(falloff, 0)
        if kind == "dark":
            out[y, :, :] *= 1 - intensity * falloff * 0.45
        else:
            out[y, :, :] += (255 - out[y, :, :]) * intensity * falloff * 0.5

    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 7. Hazing — faint ink tint on substrate areas
# ---------------------------------------------------------------------------

def hazing(
    frame: np.ndarray,
    ink_bgr: tuple[int, int, int] = (200, 80, 30),
    intensity: float = 0.10,
) -> np.ndarray:
    """Thin ink film deposited on non-image (substrate) areas."""
    out = frame.copy().astype(np.float32)
    sub = _substrate_mask(frame)
    ink = np.array(ink_bgr, dtype=np.float32)
    for c in range(3):
        out[:, :, c] = out[:, :, c] * (1 - sub * intensity) + ink[c] * sub * intensity
    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 8. Dot gain — printed elements thicken / dilate
# ---------------------------------------------------------------------------

def dot_gain(
    frame: np.ndarray,
    gain_px: int = 3,
) -> np.ndarray:
    """Expand ink boundaries to simulate excessive dot gain."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    ink = (gray < 150).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (gain_px * 2 + 1, gain_px * 2 + 1))
    expanded = cv2.dilate(ink, kernel)
    gain_only = (expanded > 0) & (ink == 0)

    blurred = cv2.GaussianBlur(frame, (gain_px * 4 + 1, gain_px * 4 + 1), gain_px)
    mask = cv2.GaussianBlur(gain_only.astype(np.float32), (3, 3), 1)

    out = frame.copy().astype(np.float32)
    for c in range(3):
        out[:, :, c] = out[:, :, c] * (1 - mask) + blurred[:, :, c].astype(np.float32) * mask
    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 9. Web crease — diagonal void line with dark edges
# ---------------------------------------------------------------------------

def web_crease(
    frame: np.ndarray,
    start: tuple[int, int],
    end: tuple[int, int],
    width: int = 6,
    severity: float = 0.8,
) -> np.ndarray:
    """Diagonal crease across the label: white void + dark flanks."""
    out = frame.copy().astype(np.float32)
    h, w_img = frame.shape[:2]

    x1, y1 = start
    x2, y2 = end
    dx, dy = float(x2 - x1), float(y2 - y1)
    line_len_sq = dx * dx + dy * dy + 1e-8

    Y, X = np.mgrid[:h, :w_img]
    t = np.clip(((X - x1) * dx + (Y - y1) * dy) / line_len_sq, 0, 1)
    px = x1 + t * dx
    py = y1 + t * dy
    dist = np.sqrt((X - px) ** 2 + (Y - py) ** 2).astype(np.float32)

    endpoint_fade = np.clip(np.minimum(t / 0.05, 1.0) * np.minimum((1 - t) / 0.05, 1.0), 0, 1).astype(np.float32)

    void_w = width * 0.3
    void = np.exp(-(dist ** 2) / (2 * (void_w / 2) ** 2)) * endpoint_fade * severity
    edge = np.exp(-((dist - void_w) ** 2) / (2 * (width * 0.15) ** 2)) * endpoint_fade * severity * 0.5
    edge = np.clip(edge - void * 0.5, 0, 1)

    for c in range(3):
        out[:, :, c] = out[:, :, c] * (1 - void * 0.85) + 255 * void * 0.85
    out *= (1 - edge[..., None] * 0.4)

    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 10. Splash / ink spatter — random droplets
# ---------------------------------------------------------------------------

def splash_spots(
    frame: np.ndarray,
    center: tuple[int, int],
    num_spots: int = 18,
    spread: int = 120,
    ink_bgr: tuple[int, int, int] = (180, 60, 20),
    seed: int = 42,
) -> np.ndarray:
    """Scatter of ink droplets simulating a splash event."""
    out = frame.copy()
    rng = np.random.default_rng(seed)

    for _ in range(num_spots):
        angle = rng.uniform(0, 2 * np.pi)
        r = rng.exponential(spread / 3)
        sx = int(center[0] + r * np.cos(angle))
        sy = int(center[1] + r * np.sin(angle))
        if sx < 0 or sx >= frame.shape[1] or sy < 0 or sy >= frame.shape[0]:
            continue
        radius = max(1, int(rng.uniform(2, 10) * max(0.3, 1 - r / (spread * 2))))
        color = np.clip(np.array(ink_bgr) + rng.integers(-15, 16, 3), 0, 255).tolist()
        cv2.circle(out, (sx, sy), radius, color, -1)
        # Satellite dots
        if radius > 4:
            for _ in range(rng.integers(1, 3)):
                sa = rng.uniform(0, 2 * np.pi)
                sd = rng.uniform(radius * 1.2, radius * 2.5)
                sv = (int(sx + sd * np.cos(sa)), int(sy + sd * np.sin(sa)))
                if 0 <= sv[0] < frame.shape[1] and 0 <= sv[1] < frame.shape[0]:
                    cv2.circle(out, sv, max(1, radius // 3), color, -1)

    return cv2.GaussianBlur(out, (3, 3), 0.7)
