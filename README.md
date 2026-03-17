# Universal Eye 👁️

AI-powered web inspection dashboard for automated production line quality control. Captures live video from a USB HDMI capture card, detects label defects in real-time using computer vision, and surfaces results on a modern dashboard.

**Development target:** MacBook Air M4  
**Production target:** NVIDIA Jetson (TensorRT vision model)

![Universal Eye Dashboard](docs/screenshot.png)

---

## What It Does

Universal Eye monitors labels on a flexographic production line. A camera feeds live video into the system, which:

1. Watches for labels to arrive and stabilize (motion detection state machine)
2. Aligns each stable frame against a golden reference (ORB feature matching + homography)
3. Compares for defects using SSIM analysis
4. Classifies defects by type and severity
5. Logs everything to SQLite and pushes real-time alerts to the dashboard

**Defect types detected:** Smudge, Misregister, Hickey, Color Shift, Scratch, Splash/Spot, Missing Print, Web Crease  
**Severity levels:** Critical, Major, Minor

---

## Tech Stack

### Frontend
- **Next.js 16** + React 19 + TypeScript
- **Tailwind CSS** + shadcn/ui components
- Real-time updates via polling + Server-Sent Events

### Backend
- **Python / FastAPI** + uvicorn
- **OpenCV** for video capture and motion detection
- **scikit-image** SSIM for defect comparison
- **SQLite** for defect persistence
- MJPEG streaming endpoint for live feed

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Next.js Dashboard (port 3000)                       │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │ Live Feed│ │  Ref Compare │ │  Defect Log     │  │
│  │ (MJPEG)  │ │  (polling)   │ │  (SSE + poll)   │  │
│  └──────────┘ └──────────────┘ └─────────────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────▼─────────────────────────────┐
│  FastAPI Backend (port 8000)                         │
│                                                      │
│  CaptureManager ──► StateMachine ──► Inspector       │
│       │                                    │         │
│  OpenCV thread                        DefectDB       │
│  (30 FPS)                             (SQLite)       │
└─────────────────────────────────────────────────────┘
```

**Inspection state machine:**
```
MONITORING → (motion detected) → MOTION → (motion stops) 
  → STABILIZING → (5 stable frames) → INSPECT → MONITORING
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.9+
- USB HDMI capture card (app runs in demo mode without one)

### Install & Run

```bash
# Clone
git clone https://github.com/Wdustin1/universaleye.git
cd universaleye

# Frontend
pnpm install
pnpm dev        # http://localhost:3000

# Backend (separate terminal)
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Both servers must run simultaneously. The frontend polls the backend at `localhost:8000` by default.

### Environment

```bash
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Backend config (camera index, SSIM thresholds, sensitivity) lives in `backend/config.py`.

---

## Dashboard Layout

```
┌─────────────────────────────────────────────┐
│ Header: job info · status · defect count    │
├─────────────────────────────────────────────┤
│ StatsBar: labels inspected · defects · time │
├──────────┬──────────────────┬───────────────┤
│ Controls │ Live Feed        │ Reference     │
│          │ (MJPEG stream)   │ Comparison    │
│          ├──────────────────┤               │
│          │ Defect Breakdown │               │
└──────────┴──────────────────┴───────────────┘
  Defect Log  →  slide-out panel (right edge)
  Defect Detail  →  modal on click
```

---

## First Run

1. Start both servers
2. Open `http://localhost:3000`
3. Position a known-good label in the camera view
4. Click **Capture Reference** to set the golden reference image
5. Click **Start** — inspection begins

If no camera is connected, the backend generates a placeholder frame so the dashboard still functions.

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/video_feed` | GET | MJPEG stream (15 FPS) |
| `/api/stats` | GET | Labels inspected, defect count, run time |
| `/api/defects` | GET | Paginated defect list |
| `/api/defects/{id}/image` | GET | Annotated defect JPEG |
| `/api/defect_breakdown` | GET | Defect type distribution |
| `/api/inspection/start` | POST | Start inspection |
| `/api/inspection/pause` | POST | Pause |
| `/api/inspection/stop` | POST | Stop + reset |
| `/api/inspection/sensitivity` | PUT | Set sensitivity (0–100) |
| `/api/set_reference` | POST | Capture current frame as reference |
| `/api/reset_reference` | POST | Clear reference |
| `/api/events` | GET | SSE — real-time defect notifications |
| `/api/health` | GET | Health check + camera status |

---

## Roadmap

- [ ] Replace SSIM with trained vision model (TensorRT on Jetson)
- [ ] Multi-camera support
- [ ] Export defect reports (CSV/PDF)
- [ ] Email/webhook alerts on critical defects
- [ ] Historical trend analysis

---

## Development

```bash
# Run backend tests
cd backend && pytest

# Lint frontend
pnpm lint
```

---

## License

MIT
