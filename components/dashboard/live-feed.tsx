"use client"

import { useState, useEffect } from "react"
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid3X3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { API } from "@/lib/api"

export function LiveFeedPanel() {
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const [defectCount, setDefectCount] = useState(0)
  const [timestamp, setTimestamp] = useState("--:--:--")

  // Poll stats for defect count and update timestamp
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(API.stats)
        if (res.ok) {
          const data = await res.json()
          setDefectCount(data.defectsFound ?? 0)
        }
      } catch { /* backend not available */ }
      setTimestamp(new Date().toLocaleTimeString("en-GB"))
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

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
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Maximize2 className="w-3 h-3 text-muted-foreground" />
            <span className="sr-only">Fullscreen</span>
          </Button>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden bg-background">
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
        {/* Camera info overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1.5 rounded bg-card/80 border border-border backdrop-blur-sm">
          <span className="text-[10px] font-mono text-muted-foreground">CAM-01</span>
          <div className="w-px h-3 bg-border" />
          <span className="text-[10px] font-mono text-muted-foreground">1920px</span>
          <div className="w-px h-3 bg-border" />
          <span className="text-[10px] font-mono text-muted-foreground">30fps</span>
        </div>
        {/* Timestamp overlay */}
        <div className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded bg-card/80 border border-border backdrop-blur-sm">
          <span className="text-[10px] font-mono text-muted-foreground">{timestamp}</span>
        </div>
      </div>
    </div>
  )
}
