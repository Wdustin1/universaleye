"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid3X3,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// Deterministic line widths for consistent rendering across re-draws
const LABEL_LINE_WIDTHS = [
  [0.82, 0.71, 0.88, 0.65],
  [0.75, 0.90, 0.68, 0.78],
  [0.85, 0.62, 0.93, 0.72],
  [0.70, 0.88, 0.76, 0.84],
  [0.91, 0.67, 0.80, 0.73],
  [0.78, 0.85, 0.69, 0.92],
]

const DEFECT_COUNT = 1

export function LiveFeedPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const drawContent = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    // Dark background for camera feed
    ctx.fillStyle = "#0d0e18"
    ctx.fillRect(0, 0, w, h)

    // Draw simulated label grid (3x2 labels on web)
    const labelCols = 3
    const labelRows = 2
    const gap = 8
    const labelW = (w - gap * (labelCols + 1)) / labelCols
    const labelH = (h - gap * (labelRows + 1)) / labelRows

    for (let row = 0; row < labelRows; row++) {
      for (let col = 0; col < labelCols; col++) {
        const labelIdx = row * labelCols + col
        const x = gap + col * (labelW + gap)
        const y = gap + row * (labelH + gap)

        // Label background
        ctx.fillStyle = "#1a1c2e"
        ctx.fillRect(x, y, labelW, labelH)

        // Label border
        ctx.strokeStyle = "#2a2d42"
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, labelW, labelH)

        // Simulated label content area
        const padding = 12
        const innerX = x + padding
        const innerY = y + padding
        const innerW = labelW - padding * 2
        const innerH = labelH - padding * 2

        // Header bar on label
        ctx.fillStyle = "#252840"
        ctx.fillRect(innerX, innerY, innerW, 16)

        // Body content lines (deterministic widths)
        for (let line = 0; line < 4; line++) {
          ctx.fillStyle = line % 2 === 0 ? "#1e2035" : "#22243a"
          const lineY = innerY + 22 + line * 10
          const lineW = innerW * LABEL_LINE_WIDTHS[labelIdx][line]
          ctx.fillRect(innerX, lineY, lineW, 6)
        }

        // Simulated image block in label
        ctx.fillStyle = "#191b2d"
        ctx.fillRect(
          innerX + innerW * 0.55,
          innerY + 22,
          innerW * 0.42,
          innerH * 0.45
        )

        // Color bar at bottom
        const colors = ["#3a5a8c", "#5a3a6c", "#3a6c5a", "#6c5a3a"]
        const barW = innerW / colors.length
        for (let c = 0; c < colors.length; c++) {
          ctx.fillStyle = colors[c]
          ctx.fillRect(
            innerX + c * barW,
            innerY + innerH - 10,
            barW - 2,
            8
          )
        }

        // Lane dividers
        ctx.strokeStyle = "#168d6a"
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        if (col < labelCols - 1) {
          const lineX = x + labelW + gap / 2
          ctx.beginPath()
          ctx.moveTo(lineX, 0)
          ctx.lineTo(lineX, h)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }
    }

    // Draw grid overlay
    if (showGrid) {
      ctx.strokeStyle = "rgba(22, 141, 106, 0.15)"
      ctx.lineWidth = 0.5
      for (let gx = 0; gx < w; gx += 40) {
        ctx.beginPath()
        ctx.moveTo(gx, 0)
        ctx.lineTo(gx, h)
        ctx.stroke()
      }
      for (let gy = 0; gy < h; gy += 40) {
        ctx.beginPath()
        ctx.moveTo(0, gy)
        ctx.lineTo(w, gy)
        ctx.stroke()
      }
    }

    // Simulate defect box on one label
    const defect = {
      x: gap + 2 * (labelW + gap) + labelW * 0.3,
      y: gap + 1 * (labelH + gap) + labelH * 0.25,
      w: labelW * 0.2,
      h: labelH * 0.18,
      type: "Smudge",
    }

    // Outer glow
    ctx.shadowColor = "rgba(239, 68, 68, 0.4)"
    ctx.shadowBlur = 8
    ctx.strokeStyle = "#ef4444"
    ctx.lineWidth = 2
    ctx.strokeRect(defect.x, defect.y, defect.w, defect.h)
    ctx.shadowBlur = 0

    // Corner markers
    const cornerLen = 6
    ctx.strokeStyle = "#ef4444"
    ctx.lineWidth = 2
    // Top-left
    ctx.beginPath()
    ctx.moveTo(defect.x, defect.y + cornerLen)
    ctx.lineTo(defect.x, defect.y)
    ctx.lineTo(defect.x + cornerLen, defect.y)
    ctx.stroke()
    // Top-right
    ctx.beginPath()
    ctx.moveTo(defect.x + defect.w - cornerLen, defect.y)
    ctx.lineTo(defect.x + defect.w, defect.y)
    ctx.lineTo(defect.x + defect.w, defect.y + cornerLen)
    ctx.stroke()
    // Bottom-left
    ctx.beginPath()
    ctx.moveTo(defect.x, defect.y + defect.h - cornerLen)
    ctx.lineTo(defect.x, defect.y + defect.h)
    ctx.lineTo(defect.x + cornerLen, defect.y + defect.h)
    ctx.stroke()
    // Bottom-right
    ctx.beginPath()
    ctx.moveTo(defect.x + defect.w - cornerLen, defect.y + defect.h)
    ctx.lineTo(defect.x + defect.w, defect.y + defect.h)
    ctx.lineTo(defect.x + defect.w, defect.y + defect.h - cornerLen)
    ctx.stroke()

    // Label
    ctx.fillStyle = "rgba(239, 68, 68, 0.9)"
    const labelText = defect.type
    ctx.font = "10px Inter, system-ui"
    const textWidth = ctx.measureText(labelText).width
    ctx.fillRect(
      defect.x,
      defect.y - 16,
      textWidth + 8,
      14
    )
    ctx.fillStyle = "#ffffff"
    ctx.fillText(labelText, defect.x + 4, defect.y - 5)
  }, [showGrid])

  // Draw static content on the main canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawContent(canvas)
  }, [showGrid, drawContent])

  // Scan line animation on a separate overlay canvas
  useEffect(() => {
    const scanCanvas = scanCanvasRef.current
    if (!scanCanvas) return

    const ctx = scanCanvas.getContext("2d")
    if (!ctx) return

    const w = scanCanvas.width
    const h = scanCanvas.height

    let scanY = 0
    const animateScan = () => {
      ctx.clearRect(0, 0, w, h)

      scanY = (scanY + 1) % h

      const gradient = ctx.createLinearGradient(0, 0, w, 0)
      gradient.addColorStop(0, "rgba(22, 141, 106, 0)")
      gradient.addColorStop(0.3, "rgba(22, 141, 106, 0.3)")
      gradient.addColorStop(0.7, "rgba(22, 141, 106, 0.3)")
      gradient.addColorStop(1, "rgba(22, 141, 106, 0)")
      ctx.fillStyle = gradient
      ctx.fillRect(0, scanY, w, 1)
    }

    const scanInterval = setInterval(animateScan, 16)
    return () => clearInterval(scanInterval)
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
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-background">
        <canvas
          ref={canvasRef}
          width={720}
          height={400}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        />
        <canvas
          ref={scanCanvasRef}
          width={720}
          height={400}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        />
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
            {DEFECT_COUNT} defect{DEFECT_COUNT !== 1 ? "s" : ""} detected
          </span>
        </div>
        {/* Camera info overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1.5 rounded bg-card/80 border border-border backdrop-blur-sm">
          <span className="text-[10px] font-mono text-muted-foreground">CAM-01</span>
          <div className="w-px h-3 bg-border" />
          <span className="text-[10px] font-mono text-muted-foreground">4000px</span>
          <div className="w-px h-3 bg-border" />
          <span className="text-[10px] font-mono text-muted-foreground">60fps</span>
        </div>
        {/* Timestamp overlay */}
        <div className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded bg-card/80 border border-border backdrop-blur-sm">
          <span className="text-[10px] font-mono text-muted-foreground">14:32:07</span>
        </div>
      </div>
    </div>
  )
}
