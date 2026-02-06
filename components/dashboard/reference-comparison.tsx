"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowLeftRight, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ReferenceComparison() {
  const [activeTab, setActiveTab] = useState<"overlay" | "side-by-side">("side-by-side")
  const referenceCanvasRef = useRef<HTMLCanvasElement>(null)
  const currentCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    drawLabel(referenceCanvasRef.current, false)
    drawLabel(currentCanvasRef.current, true)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
          Reference Comparison
        </h2>
        <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
          <button
            onClick={() => setActiveTab("side-by-side")}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              activeTab === "side-by-side"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setActiveTab("overlay")}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              activeTab === "overlay"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Overlay
          </button>
        </div>
      </div>

      <div className="flex-1 p-3">
        {activeTab === "side-by-side" ? (
          <div className="flex gap-3 h-full">
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Reference (Golden Master)
                </span>
              </div>
              <div className="flex-1 rounded-md border border-border overflow-hidden bg-background">
                <canvas
                  ref={referenceCanvasRef}
                  width={280}
                  height={200}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <div className="flex items-center">
              <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Current (Defect #23)
                </span>
              </div>
              <div className="flex-1 rounded-md border border-destructive/30 overflow-hidden bg-background">
                <canvas
                  ref={currentCanvasRef}
                  width={280}
                  height={200}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Overlay Comparison
              </span>
              <span className="text-[10px] text-destructive font-mono">
                3 differences highlighted
              </span>
            </div>
            <div className="flex-1 rounded-md border border-border overflow-hidden bg-background flex items-center justify-center">
              <p className="text-xs text-muted-foreground">
                Overlay mode highlights pixel differences between reference and current label
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">AI Verdict:</span>
          <span className="text-[10px] font-medium text-destructive flex items-center gap-1">
            <X className="w-3 h-3" />
            Reject
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-success gap-1 px-2"
          >
            <Check className="w-3 h-3" />
            Override: Accept
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-destructive gap-1 px-2"
          >
            <X className="w-3 h-3" />
            Confirm Reject
          </Button>
        </div>
      </div>
    </div>
  )
}

function drawLabel(canvas: HTMLCanvasElement | null, hasDefect: boolean) {
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  // Background
  ctx.fillStyle = "#0d0e18"
  ctx.fillRect(0, 0, w, h)

  // Label container
  const pad = 16
  ctx.fillStyle = "#1a1c2e"
  ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2)
  ctx.strokeStyle = "#2a2d42"
  ctx.lineWidth = 1
  ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2)

  // Header
  ctx.fillStyle = "#252840"
  ctx.fillRect(pad + 8, pad + 8, w - pad * 2 - 16, 18)

  // "Brand text"
  ctx.fillStyle = "#6b7194"
  ctx.font = "bold 10px Inter, system-ui"
  ctx.fillText("PREMIUM RESERVE", pad + 14, pad + 20)

  // Content lines
  const lineY = pad + 34
  for (let i = 0; i < 5; i++) {
    const lw = (w - pad * 2 - 32) * (0.5 + Math.random() * 0.4)
    ctx.fillStyle = i % 2 === 0 ? "#1e2035" : "#22243a"
    ctx.fillRect(pad + 8, lineY + i * 10, lw, 5)
  }

  // Simulated image area
  ctx.fillStyle = "#191b2d"
  const imgX = pad + 8 + (w - pad * 2 - 16) * 0.55
  const imgY = lineY
  const imgW = (w - pad * 2 - 16) * 0.38
  const imgH = 50
  ctx.fillRect(imgX, imgY, imgW, imgH)

  // Color registration bar
  const colors = ["#3a5a8c", "#8c3a5a", "#3a8c5a", "#8c7a3a"]
  const barY = h - pad - 18
  const barW = (w - pad * 2 - 16) / colors.length
  for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = colors[i]
    ctx.fillRect(pad + 8 + i * barW, barY, barW - 2, 10)
  }

  // Draw defect if needed
  if (hasDefect) {
    // Smudge defect
    ctx.fillStyle = "rgba(90, 50, 50, 0.6)"
    ctx.beginPath()
    ctx.ellipse(w * 0.45, h * 0.42, 18, 10, 0.3, 0, Math.PI * 2)
    ctx.fill()

    // Defect highlight box
    ctx.strokeStyle = "#ef4444"
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.strokeRect(w * 0.45 - 24, h * 0.42 - 16, 48, 32)
    ctx.setLineDash([])

    // Difference highlight area
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)"
    ctx.fillRect(w * 0.45 - 24, h * 0.42 - 16, 48, 32)
  }
}
