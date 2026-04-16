# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Universal Eye is an AI-powered web inspection and defect detection system for monitoring product labels on automated flexographic production lines. It consists of a **Next.js frontend dashboard** and a **Python/FastAPI backend** that captures video from a USB HDMI capture card, detects label motion/stability, and compares stable frames against a golden reference using SSIM.

**Development: MacBook Air M4.** **Production target: NVIDIA Jetson.** Current SSIM-based detection in `inspector.py` is a placeholder — production will use a trained vision model optimized with TensorRT. The threaded capture pipeline, state machine, FastAPI server, and frontend are all designed to carry over. No CUDA/TensorRT tooling is available in the dev environment.

## Commands

### Frontend (Next.js)

```bash
pnpm dev          # Start dev server (port 3000)
pnpm build        # Production build
pnpm start        # Run production server
pnpm lint         # ESLint (flat config, eslint.config.mjs)
```

Package manager is **pnpm** (lock file committed).

### Backend (Python/FastAPI)

```bash
cd backend
pip install -r requirements.txt                          # Install dependencies
uvicorn main:app --host 0.0.0.0 --port 8000 --reload     # Start API server
pytest                                                   # Run full test suite
pytest tests/test_inspector.py                           # Single file
pytest tests/test_inspector.py::test_name -v             # Single test
pytest -k "pattern"                                      # Match by name
```

Both servers must run simultaneously for full functionality.

## Build Configuration

- `next.config.mjs` sets `images.unoptimized: true` — all images served as-is (no Next.js image optimization)
- ESLint uses flat config format (`eslint.config.mjs`) extending `eslint-config-next`

## Tech Stack

### Frontend
- **Next.js 16** with App Router, **React 19**, **TypeScript 5.7**
- **Tailwind CSS 3** with CSS variables for theming (HSL values in `globals.css`), `tailwindcss-animate` plugin
- **shadcn/ui** components in `components/ui/` (configured via `components.json`)
- **Lucide React** for icons
- Fonts: Inter (sans) and JetBrains Mono (mono) via `next/font/google`

### Backend
- **Python 3.12+** (per `backend/pyproject.toml`), **FastAPI**, **uvicorn**
- **OpenCV** (`opencv-python-headless`) for video capture and motion detection
- **scikit-image** for SSIM-based defect comparison
- **NumPy** for image processing
- **sse-starlette** for Server-Sent Events
- **pytest** + **pytest-asyncio** + **httpx** for testing

## Architecture

### Frontend-Backend Communication

All frontend components poll the Python backend at `localhost:8000` (configurable via `NEXT_PUBLIC_API_URL` env var). API constants are in `lib/api.ts`.

| Component | Backend Endpoint | Method |
|-----------|-----------------|--------|
| LiveFeedPanel | `GET /video_feed` | MJPEG `<img>` stream |
| ReferenceComparison | `GET /api/reference_image` + `GET /api/current_capture` | Polling `<img>` tags |
| StatsBar | `GET /api/stats` | Polls every 2s |
| DefectLog | `GET /api/defects` + `GET /api/events` | Polls + SSE |
| DefectBreakdown | `GET /api/defect_breakdown` | Polls every 5s |
| InspectionControls | `POST start/pause/stop`, `PUT sensitivity`, `POST set/reset_reference` | Button clicks |
| DashboardHeader | Props from `page.tsx` | `page.tsx` polls `/api/stats` |

### Backend Architecture

- **CaptureManager** (`backend/capture.py`) — central coordinator, runs a background daemon thread for OpenCV VideoCapture (blocking C calls can't use asyncio)
- **State Machine** (`backend/state_machine.py`) — MONITORING → MOTION → STABILIZING → INSPECT cycle; only inspects when labels stop moving
- **Inspector** (`backend/inspector.py`) — ORB feature matching alignment + SSIM comparison against golden reference, defect type classification via contour analysis
- **Database** (`backend/database.py`) — SQLite persistence for defect records + annotated JPEG storage in `backend/data/`
- **Config** (`backend/config.py`) — all tunable thresholds (camera, motion, SSIM, sensitivity)
- **Models** (`backend/models.py`) — Pydantic models with `model_dump_frontend()` for camelCase serialization
- **Main** (`backend/main.py`) — FastAPI app with routes, MJPEG streaming, SSE events, lifespan management

### Path Aliases

`@/*` maps to the project root (e.g., `@/components/dashboard/header`).

### Backend Structure

```
backend/
├── main.py           # FastAPI app, all API endpoints, MJPEG streaming
├── models.py         # Pydantic models (Defect, Severity, AIVerdict, InspectionState)
├── config.py         # InspectionConfig (camera, SSIM thresholds, motion detection)
├── capture.py        # CaptureManager — threaded video capture + inspection orchestration
├── inspector.py      # SSIM comparison, defect classification by type/severity
├── database.py       # SQLite defect persistence + annotated image storage
├── state_machine.py  # Motion detection state machine (MONITORING→MOTION→STABILIZING→INSPECT)
└── tests/
    ├── defect_simulator.py     # Synthetic defect injection harness
    ├── test_flexo_defects.py   # Integration tests using the simulator against Inspector
    └── test_*.py               # Unit tests (API, capture, config, database, inspector, models, state machine)
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/video_feed` | GET | MJPEG stream (15 FPS, 80% JPEG quality) |
| `/api/reference_image` | GET | Golden reference image (JPEG), 204 if unset |
| `/api/current_capture` | GET | Last inspected frame (JPEG), 204 if none |
| `/api/stats` | GET | Inspection metrics (labelsInspected, defectsFound, runTime, status) |
| `/api/defects` | GET | Paginated defect list (offset/limit params) |
| `/api/defects/{id}/image` | GET | Annotated defect image (JPEG with red highlight overlay) |
| `/api/defect_breakdown` | GET | Defect type distribution with percentages |
| `/api/inspection/start` | POST | Start/resume inspection |
| `/api/inspection/pause` | POST | Pause inspection |
| `/api/inspection/stop` | POST | Stop inspection, reset run-time stats. Defect history is **preserved**. |
| `/api/defects/clear` | POST | Explicit destructive wipe of defect rows + annotated images |
| `/api/inspection/sensitivity` | PUT | Set detection sensitivity (0–100) |
| `/api/set_reference` | POST | Capture current frame as golden reference |
| `/api/reset_reference` | POST | Clear reference image |
| `/api/events` | GET | SSE endpoint for real-time defect notifications |
| `/api/health` | GET | Health check with camera availability |

### Inspection Pipeline

1. **Video Capture** — threaded OpenCV loop at 30 FPS (`CaptureManager`)
2. **Frame Preprocessing** — crop ELSCAN UI overlay, mask ROI marker lines
3. **Motion Detection** — state machine detects label arrival and stabilization
4. **Alignment** — ORB feature matching + homography corrects camera jitter (handles translation, rotation, scale)
5. **SSIM Inspection** — dual detection: local block scan (spatial defects) + per-channel global (color-plane defects)
6. **Defect Classification** — determines type (8 categories) via contour analysis, severity via worst-block SSIM score
7. **Persistence** — defect metadata to SQLite, annotated JPEG (red highlight overlay) to disk
8. **Notification** — SSE push to frontend

### State Machine Flow

```
MONITORING → (motion detected) → MOTION → (motion stops) → STABILIZING → (5 stable frames) → INSPECT → (acknowledged) → MONITORING
```

### Frontend Layout

Single-page dashboard in `app/page.tsx` (client component). Fixed viewport (`h-screen`, `overflow-hidden`):

```
+-------------------------------------------------+
| DashboardHeader (job info, status, defect count) |
+-------------------------------------------------+
| StatsBar (labels inspected, defects, run time)   |
+--------+--------------------+--------------------+
|Controls| LiveFeedPanel      | ReferenceComparison|
|(w-44)  | (flex-[5])         | (flex-[2])         |
|        +--------------------+                    |
|        | DefectBreakdown (h-36)                  |
+--------+--------------------+--------------------+
          DefectLog -> slide-out panel from right edge
          DefectDetail -> modal overlay on defect click
```

### Onboarding Flow

When no golden reference image is set:
- An overlay appears on the live feed: "No Reference Image Set" with a "Capture Reference" button
- The Start inspection button is disabled with a "Set a reference image first" warning
- Operator positions a known good label → clicks Capture Reference → overlay dismisses → Start becomes available

### State Management

React hooks only (useState/useEffect). `page.tsx` owns top-level polling (stats, reference status) and passes props down. Component-local state for everything else. No external state library.

- **`hooks/use-polling.ts`** — shared polling abstraction used across dashboard components; prefer it over ad-hoc `setInterval` when adding new polled endpoints.
- **`components/error-boundary.tsx`** — top-level React error boundary wrapping the dashboard; catches render errors so the app doesn't white-screen on a component crash.

### Routes

- **`app/page.tsx`** — main inspection dashboard (client component).
- **`app/collect/page.tsx`** — separate reference-collection / data-gathering route.

### Data

Defect types: Smudge, Misregister, Hickey, Color Shift, Scratch, Splash/Spot, Missing Print, Web Crease. Severity levels: critical, major, minor. AI verdicts: reject, accept, review. Severity classification is based on SSIM score thresholds configured in `backend/config.py`.

### Theming

Dark-only design using CSS variables in `app/globals.css` (no light theme). Key brand colors: primary teal (`168 75% 42%`), destructive red, success green, warning amber.

Tailwind colors reference CSS variables via `hsl(var(--name))` pattern (see `tailwind.config.ts`).

## Environment Variables

**Frontend:**
- `NEXT_PUBLIC_API_URL` — backend base URL (default `http://localhost:8000`).

**Backend** (all read in `backend/config.py`):
- `DATA_DIR` — absolute path for SQLite + image storage. Defaults to `backend/data/`. Useful when pointing at an external drive (e.g. `DATA_DIR=/Volumes/UniversalEye uvicorn main:app …`).
- `VIDEO_FILE` — absolute path to a video file used in place of a live camera. Loops on EOF. Handy for offline development and reproducible test runs.
- `CORS_ORIGINS` — comma-separated allowlist (e.g. `CORS_ORIGINS="http://kiosk.local:3000,http://10.0.1.42:3000"`). Defaults to `localhost:3000` + `127.0.0.1:3000`.

**Backend defaults worth knowing:**
- `camera_index = 1` (not 0). On a MacBook the internal webcam claims index 0, and a USB HDMI capture card lands at index 1. On other hardware you may need to override this in `backend/config.py`.

## Conventions

- shadcn/ui components are added via `npx shadcn@latest add <component>` — do not manually edit files in `components/ui/`
- Use the `cn()` utility from `@/lib/utils` for conditional class merging (clsx + tailwind-merge)
- The app uses `"use client"` for interactive components; the root layout (`app/layout.tsx`) is a server component
- Backend uses `threading.Lock` for shared state between capture thread and API routes
- Backend CORS is hardcoded for `localhost:3000` — update `config.py` for production
- Camera fallback: if no camera available, backend generates a placeholder frame (app still works)

## Task Workflow

The parent `~/Projects/CLAUDE.md` mandates a plan-first workflow: for non-trivial changes, write a checklist to `tasks/todo.md`, get it approved, then check items off as you work, and append a review section at the end. The `tasks/` directory at the repo root is where these live.
