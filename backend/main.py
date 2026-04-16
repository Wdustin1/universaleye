"""FastAPI application for Universal Eye backend.

Run with: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from sse_starlette.sse import EventSourceResponse

from capture import CaptureManager
from config import config
from database import DefectDatabase
from models import CollectionLabelRequest, SensitivityRequest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

capture_manager: CaptureManager | None = None
defect_db: DefectDatabase | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global capture_manager, defect_db
    defect_db = DefectDatabase()
    capture_manager = CaptureManager(config, defect_db)
    capture_manager.start_capture()
    logger.info("Application started")
    yield
    capture_manager.stop_capture()
    defect_db.close()
    logger.info("Application shutdown")


app = FastAPI(
    title="Universal Eye Backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------ MJPEG Video Feed ------

async def _mjpeg_generator():
    """Async MJPEG generator - doesn't block the event loop."""
    boundary = b"--frame\r\n"
    while True:
        jpeg = capture_manager.get_latest_frame_jpeg()
        if jpeg:
            yield (
                boundary
                + b"Content-Type: image/jpeg\r\n"
                + f"Content-Length: {len(jpeg)}\r\n".encode()
                + b"\r\n"
                + jpeg
                + b"\r\n"
            )
        await asyncio.sleep(1.0 / config.mjpeg_fps)


@app.get("/video_feed")
async def video_feed():
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ------ Image endpoints ------

@app.get("/api/reference_image")
async def reference_image():
    jpeg = capture_manager.get_reference_jpeg()
    if jpeg is None:
        return Response(status_code=204, headers={"Cache-Control": "no-store"})
    return Response(content=jpeg, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@app.get("/api/current_capture")
async def current_capture():
    jpeg = capture_manager.get_current_capture_jpeg()
    if jpeg is None:
        return Response(status_code=204)
    return Response(content=jpeg, media_type="image/jpeg")


# ------ Stats & Data ------

@app.get("/api/stats")
async def stats():
    return capture_manager.get_stats()


@app.get("/api/defects")
async def defects(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return capture_manager.get_defects(offset=offset, limit=limit)


@app.get("/api/defects/{defect_id}/image")
async def defect_image(defect_id: int):
    path = capture_manager.get_defect_image_path(defect_id)
    if path is None or not path.exists():
        return Response(status_code=404)
    return Response(content=path.read_bytes(), media_type="image/jpeg")


@app.get("/api/defect_breakdown")
async def defect_breakdown():
    return capture_manager.get_defect_breakdown()


# ------ Inspection Control ------

@app.post("/api/inspection/start")
async def inspection_start():
    capture_manager.start_inspection()
    return {"status": "running"}


@app.post("/api/inspection/pause")
async def inspection_pause():
    capture_manager.pause_inspection()
    return {"status": "paused"}


@app.post("/api/inspection/stop")
async def inspection_stop():
    capture_manager.stop_inspection()
    return {"status": "stopped"}


@app.post("/api/defects/clear")
async def defects_clear():
    """Explicit destructive wipe of the defect database + annotated images."""
    capture_manager.clear_defect_history()
    return {"status": "cleared"}


@app.put("/api/inspection/sensitivity")
async def set_sensitivity(body: SensitivityRequest):
    capture_manager.set_sensitivity(body.sensitivity)
    return {"sensitivity": body.sensitivity}


# ------ Reference Control ------

@app.post("/api/set_reference")
async def set_reference():
    success = capture_manager.set_reference()
    if not success:
        return Response(
            content=json.dumps({"error": "No frame available to set as reference"}),
            status_code=400,
            media_type="application/json",
        )
    return {"status": "reference_set"}


@app.post("/api/reset_reference")
async def reset_reference():
    capture_manager.reset_reference()
    return {"status": "reference_cleared"}


# ------ SSE Events ------

@app.get("/api/events")
async def events():
    # Bounded queue gives real backpressure if a slow client falls behind.
    event_queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    loop = asyncio.get_running_loop()

    def _enqueue(defect) -> None:
        # Runs on the event loop; safe to call put_nowait from here.
        try:
            event_queue.put_nowait(defect)
        except asyncio.QueueFull:
            logger.warning("SSE event queue full - defect event dropped")

    def on_defect(defect):
        # Called from the capture thread. asyncio.Queue is NOT thread-safe,
        # so hop back to the event loop before touching it.
        loop.call_soon_threadsafe(_enqueue, defect)

    capture_manager.register_event_callback(on_defect)

    async def event_generator():
        try:
            while True:
                try:
                    defect = await asyncio.wait_for(event_queue.get(), timeout=30.0)
                    yield {
                        "event": "defect",
                        "data": json.dumps(defect.model_dump_frontend()),
                    }
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": ""}
        finally:
            capture_manager.unregister_event_callback(on_defect)

    return EventSourceResponse(event_generator())


# ------ Data Collection ------

@app.post("/api/collection/start")
async def collection_start():
    capture_manager.start_collect_mode()
    return {"collecting": True}


@app.post("/api/collection/stop")
async def collection_stop():
    capture_manager.stop_collect_mode()
    return {"collecting": False}


@app.get("/api/collection/stats")
async def collection_stats():
    return capture_manager.get_collection_stats()


@app.get("/api/collection/frames")
async def collection_frames(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    label: str | None = Query(None),  # 'good' | 'bad' | 'unlabeled' | None
):
    return capture_manager.get_collected_frames(
        offset=offset, limit=limit, label_filter=label
    )


@app.put("/api/collection/frames/{frame_id}/label")
async def label_frame(frame_id: int, body: CollectionLabelRequest):
    if body.label not in (None, "good", "bad"):
        return Response(
            content=json.dumps({"error": "label must be 'good', 'bad', or null"}),
            status_code=400,
            media_type="application/json",
        )
    found = capture_manager.label_collected_frame(frame_id, body.label)
    if not found:
        return Response(status_code=404)
    return {"id": frame_id, "label": body.label}


@app.get("/api/collection/frames/{frame_id}/image")
async def collected_frame_image(frame_id: int):
    path = capture_manager.get_collected_frame_path(frame_id)
    if path is None or not path.exists():
        return Response(status_code=404)
    return Response(content=path.read_bytes(), media_type="image/jpeg")


@app.delete("/api/collection/clear")
async def collection_clear():
    capture_manager.clear_collected_frames()
    return {"status": "cleared"}


# ------ Health Check ------

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "camera_available": capture_manager._camera_available,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=config.host,
        port=config.port,
        reload=True,
    )
