# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Universal Eye is an AI-powered web inspection and defect detection system for monitoring product labels on automated flexographic production lines. It consists of a **Next.js frontend dashboard** and a **Python/FastAPI backend** that captures video from a USB HDMI capture card, detects label motion/stability, and compares stable frames against a golden reference using SSIM.

## Commands

```bash
# Frontend (Next.js)
pnpm dev          # Start dev server (port 3000)
pnpm build        # Production build
pnpm start        # Run production server
pnpm lint         # ESLint (flat config, eslint.config.mjs)

# Backend (Python/FastAPI)
cd backend && source .venv/bin/activate && python main.py   # Start backend (port 8000)
cd backend && source .venv/bin/activate && pytest -v         # Run backend tests (51 tests)
```

Package manager is **pnpm** (lock file committed). Backend uses **pip** with a venv.

## Build Configuration

- `next.config.mjs` sets `typescript.ignoreBuildErrors: true` — TypeScript errors won't fail the build
- `images.unoptimized: true` — all images served as-is (no Next.js image optimization)
- ESLint uses flat config format (`eslint.config.mjs`) extending `eslint-config-next`

## Tech Stack

### Frontend
- **Next.js 16** with App Router, **React 19**, **TypeScript 5.7**
- **Tailwind CSS 3** with CSS variables for theming (HSL values in `globals.css`), `tailwindcss-animate` plugin
- **shadcn/ui** components in `components/ui/` (configured via `components.json`)
- **Lucide React** for icons
- Fonts: Inter (sans) and JetBrains Mono (mono) via `next/font/google`

### Backend
- **Python 3.12+**, **FastAPI**, **uvicorn**
- **OpenCV** (headless) for video capture and motion detection
- **scikit-image** for SSIM-based defect comparison
- **sse-starlette** for Server-Sent Events
- **numpy** for image processing

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
- **Inspector** (`backend/inspector.py`) — SSIM comparison against golden reference, defect type classification via contour analysis
- **Config** (`backend/config.py`) — all tunable thresholds (camera, motion, SSIM, sensitivity)
- **Models** (`backend/models.py`) — Pydantic models with `model_dump_frontend()` for camelCase serialization
- **Main** (`backend/main.py`) — FastAPI app with 14 routes, MJPEG streaming, SSE events, lifespan management

### Path Aliases

`@/*` maps to the project root (e.g., `@/components/dashboard/header`).

### Layout Structure

Single-page dashboard in `app/page.tsx` (client component). The layout is a fixed viewport (`h-screen`, `overflow-hidden`) with:

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
```

### Onboarding Flow

When no golden reference image is set:
- An overlay appears on the live feed: "No Reference Image Set" with a "Capture Reference" button
- The Start inspection button is disabled with a "Set a reference image first" warning
- Operator positions a known good label → clicks Capture Reference → overlay dismisses → Start becomes available

### State Management

React hooks only (useState/useEffect). `page.tsx` owns top-level polling (stats, reference status) and passes props down. Component-local state for everything else. No external state library.

### Data

Defect types: Smudge, Misregister, Hickey, Color Shift, Scratch, Splash/Spot, Missing Print, Web Crease. Severity levels: critical, major, minor. AI verdicts: reject, accept, review.

### Theming

Dark-only design using CSS variables in `app/globals.css` (no `:root` light theme defined). Key brand colors: primary teal (`168 75% 42%`), destructive red, success green, warning amber.

Tailwind colors reference CSS variables via `hsl(var(--name))` pattern (see `tailwind.config.ts`).

## Conventions

- shadcn/ui components are added via `npx shadcn@latest add <component>` — do not manually edit files in `components/ui/`
- Use the `cn()` utility from `@/lib/utils` for conditional class merging (clsx + tailwind-merge)
- The app uses `"use client"` for interactive components; the root layout (`app/layout.tsx`) is a server component
- Backend uses `threading.Lock` for shared state between capture thread and API routes
- Set `NEXT_PUBLIC_API_URL` env var to point frontend at a different backend host
