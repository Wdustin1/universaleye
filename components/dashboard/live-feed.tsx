"use client"

import { useState, useEffect, useRef } from "react"
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid3X3,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export function LiveFeedPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const [defectBoxes, setDefectBoxes] = useState<
    { x: number; y: number; w: number; h: number; type: string }[]
  >([])

  // Draw a simulated label inspection feed
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

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

        // Body content lines
        for (let line = 0; line < 4; line++) {
          ctx.fillStyle = line % 2 === 0 ? "#1e2035" : "#22243a"
          const lineY = innerY + 22 + line * 10
          const lineW = innerW * (0.6 + Math.random() * 0.35)
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
    const defects = [
      {
        x: gap + 2 * (labelW + gap) + labelW * 0.3,
        y: gap + 1 * (labelH + gap) + labelH * 0.25,
        w: labelW * 0.2,
        h: labelH * 0.18,
        type: "Smudge",
      },
    ]
    setDefectBoxes(defects)

    for (const defect of defects) {
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
    }

    // Scan line animation
    let scanY = 0
    const animateScan = () => {
      if (!canvas) return
      const scanCtx = canvas.getContext("2d")
      if (!scanCtx) return

      // Only redraw scan line area
      scanCtx.clearRect(0, scanY - 1, w, 3)

      scanY = (scanY + 1) % h

      // Thin scan line
      const gradient = scanCtx.createLinearGradient(0, 0, w, 0)
      gradient.addColorStop(0, "rgba(22, 141, 106, 0)")
      gradient.addColorStop(0.3, "rgba(22, 141, 106, 0.3)")
      gradient.addColorStop(0.7, "rgba(22, 141, 106, 0.3)")
      gradient.addColorStop(1, "rgba(22, 141, 106, 0)")
      scanCtx.fillStyle = gradient
      scanCtx.fillRect(0, scanY, w, 1)
    }

    const scanInterval = setInterval(animateScan, 16)

    return () => clearInterval(scanInterval)
  }, [showGrid, zoom])

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
        <canvas
          ref={canvasRef}
          width={720}
          height={400}
          className="w-full h-full object-contain"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        />
        {/* Defect count overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card/90 border border-border backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-[10px] font-mono text-foreground">
            {defectBoxes.length} defect{defectBoxes.length !== 1 ? "s" : ""} detected
          </span>
        </div>
        {/* Camera info overlay */}
        <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-md bg-card/90 border border-border backdrop-blur-sm">
          <span className="text-[10px] font-mono text-muted-foreground">
            CAM-01 | 4000px | 60fps
          </span>
        </div>
      </div>
    </div>
  )
}
