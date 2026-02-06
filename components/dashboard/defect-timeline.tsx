"use client"

import { useRef, useEffect } from "react"

interface TimelinePoint {
  position: number
  severity: "critical" | "major" | "minor"
  lane: number
}

const MOCK_TIMELINE: TimelinePoint[] = [
  { position: 0.05, severity: "minor", lane: 1 },
  { position: 0.12, severity: "major", lane: 3 },
  { position: 0.18, severity: "minor", lane: 2 },
  { position: 0.25, severity: "critical", lane: 2 },
  { position: 0.31, severity: "major", lane: 1 },
  { position: 0.38, severity: "minor", lane: 3 },
  { position: 0.42, severity: "major", lane: 1 },
  { position: 0.48, severity: "critical", lane: 3 },
  { position: 0.55, severity: "minor", lane: 2 },
  { position: 0.6, severity: "minor", lane: 1 },
  { position: 0.68, severity: "major", lane: 2 },
  { position: 0.72, severity: "minor", lane: 3 },
  { position: 0.78, severity: "critical", lane: 1 },
  { position: 0.82, severity: "minor", lane: 2 },
  { position: 0.85, severity: "major", lane: 3 },
  { position: 0.88, severity: "minor", lane: 1 },
  { position: 0.91, severity: "major", lane: 2 },
  { position: 0.94, severity: "critical", lane: 3 },
  { position: 0.96, severity: "minor", lane: 1 },
  { position: 0.98, severity: "major", lane: 3 },
]

export function DefectTimeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = "#0a0b14"
    ctx.fillRect(0, 0, w, h)

    // Lane labels area
    const labelWidth = 28
    const chartLeft = labelWidth
    const chartWidth = w - labelWidth

    // Lane backgrounds
    const lanes = 3
    const laneH = h / lanes
    for (let i = 0; i < lanes; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#0d0e18" : "#0f1020"
      ctx.fillRect(chartLeft, i * laneH, chartWidth, laneH)

      // Lane label
      ctx.fillStyle = "#4a4f6e"
      ctx.font = "9px Inter, system-ui"
      ctx.textAlign = "center"
      ctx.fillText(`L${i + 1}`, labelWidth / 2, i * laneH + laneH / 2 + 3)

      // Lane separator
      if (i < lanes - 1) {
        ctx.strokeStyle = "#1a1c2e"
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(chartLeft, (i + 1) * laneH)
        ctx.lineTo(w, (i + 1) * laneH)
        ctx.stroke()
      }
    }

    // Time grid lines
    const numGridLines = 10
    for (let i = 0; i <= numGridLines; i++) {
      const x = chartLeft + (chartWidth / numGridLines) * i
      ctx.strokeStyle = "#1a1c2e"
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }

    // Plot defect points
    for (const point of MOCK_TIMELINE) {
      const x = chartLeft + point.position * chartWidth
      const y = (point.lane - 1) * laneH + laneH / 2

      const colorMap = {
        critical: "#ef4444",
        major: "#f59e0b",
        minor: "#6b7194",
      }

      const color = colorMap[point.severity]
      const radius = point.severity === "critical" ? 4 : point.severity === "major" ? 3 : 2

      // Glow
      if (point.severity === "critical") {
        ctx.shadowColor = "rgba(239, 68, 68, 0.5)"
        ctx.shadowBlur = 6
      } else if (point.severity === "major") {
        ctx.shadowColor = "rgba(245, 158, 11, 0.3)"
        ctx.shadowBlur = 4
      }

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.shadowBlur = 0
    }

    // Current position indicator
    const currentX = chartLeft + 0.98 * chartWidth
    ctx.strokeStyle = "#168d6a"
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(currentX, 0)
    ctx.lineTo(currentX, h)
    ctx.stroke()
    ctx.setLineDash([])

    // "NOW" label
    ctx.fillStyle = "#168d6a"
    ctx.font = "bold 8px Inter, system-ui"
    ctx.textAlign = "center"
    ctx.fillText("NOW", currentX, 8)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
          Defect Map
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span className="text-[9px] text-muted-foreground">Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-[9px] text-muted-foreground">Major</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">Minor</span>
          </div>
        </div>
      </div>
      <div className="flex-1 p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={90}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}
