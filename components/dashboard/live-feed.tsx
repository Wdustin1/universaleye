"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid3X3,
  Camera,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

export function LiveFeedPanel({
  hasReference = true,
  defectCount = 0,
  onReferenceSet,
}: {
  hasReference?: boolean
  defectCount?: number
  onReferenceSet?: () => void
}) {
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const [timestamp, setTimestamp] = useState("--:--:--")
  const [captureReady, setCaptureReady] = useState(false)
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Update timestamp from local clock — no extra API poll needed.
  // defectCount is now passed in from page.tsx which already polls /stats.
  /* eslint-disable react-hooks/set-state-in-effect -- syncing to wall clock IS the external system */
  useEffect(() => {
    setTimestamp(new Date().toLocaleTimeString("en-GB"))
    const interval = setInterval(
      () => setTimestamp(new Date().toLocaleTimeString("en-GB")),
      1000,
    )
    return () => clearInterval(interval)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Poll /api/health so the chrome reflects whether a real camera is attached
  // (vs. backend running in placeholder mode).
  const pollHealth = useCallback(async () => {
    try {
      const res = await apiFetch(API.health)
      if (res.ok) {
        const data = await res.json()
        setCameraAvailable(Boolean(data.camera_available))
      }
    } catch {
      setCameraAvailable(null)
    }
  }, [])
  usePolling(pollHealth, 5000, true)

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      el.requestFullscreen().catch(() => {})
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
            Live Feed
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid3X3 className={`w-3 h-3 ${showGrid ? "text-primary" : "text-muted-foreground"}`} />
            <span className="sr-only">Toggle grid</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
          >
            <ZoomOut className="w-3 h-3 text-muted-foreground" />
            <span className="sr-only">Zoom out</span>
          </Button>
          <span className="text-[10px] font-mono text-muted-foreground w-8 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          >
            <ZoomIn className="w-3 h-3 text-muted-foreground" />
            <span className="sr-only">Zoom in</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setZoom(1)}
          >
            <RotateCcw className="w-3 h-3 text-muted-foreground" />
            <span className="sr-only">Reset zoom</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleFullscreen}>
            <Maximize2 className="w-3 h-3 text-muted-foreground" />
            <span className="sr-only">Fullscreen</span>
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-background">
        {/* MJPEG stream from Python backend */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={API.videoFeed}
          alt="Live camera feed"
          className="absolute inset-0 w-full h-full object-contain"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        />
        {/* Grid overlay */}
        {showGrid && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(22, 141, 106, 0.15)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        )}
        {/* Corner vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 60px rgba(0,0,0,0.4)" }} />
        {/* REC indicator */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded bg-destructive/15 border border-destructive/20 backdrop-blur-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
          <span className="text-[9px] font-mono font-semibold text-destructive tracking-wider">REC</span>
        </div>
        {/* Defect count overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1.5 rounded bg-card/80 border border-border backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-[10px] font-mono text-foreground">
            {defectCount} defect{defectCount !== 1 ? "s" : ""} detected
          </span>
        </div>
        {/* Camera info overlay — driven by /api/health so placeholder mode is honest */}
        <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1.5 rounded bg-card/80 border border-border backdrop-blur-sm">
          <span className="text-[10px] font-mono text-muted-foreground">CAM</span>
          <div className="w-px h-3 bg-border" />
          <span className={`text-[10px] font-mono ${
            cameraAvailable === null
              ? "text-muted-foreground"
              : cameraAvailable
                ? "text-success"
                : "text-warning"
          }`}>
            {cameraAvailable === null
              ? "…"
              : cameraAvailable
                ? "live"
                : "no signal"}
          </span>
        </div>
        {/* Timestamp overlay */}
        <div className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded bg-card/80 border border-border backdrop-blur-sm">
          <span className="text-[10px] font-mono text-muted-foreground">{timestamp}</span>
        </div>
        {/* Onboarding overlay — no golden reference set */}
        {!hasReference && !captureReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-4 max-w-xs text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">No Reference Image Set</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Position a known good label under the camera, then capture it as the golden reference.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCaptureReady(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Camera className="w-4 h-4" />
                Set Reference
              </button>
            </div>
          </div>
        )}
        {/* Capture button — overlay cleared, waiting for operator to grab the frame */}
        {!hasReference && captureReady && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await apiFetch(API.setReference, { method: "POST" })
                  if (res.ok) {
                    setCaptureReady(false)
                    onReferenceSet?.()
                  }
                } catch { /* */ }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
            >
              <Camera className="w-4 h-4" />
              Capture
            </button>
            <button
              type="button"
              onClick={() => setCaptureReady(false)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
