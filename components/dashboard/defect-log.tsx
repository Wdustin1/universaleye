"use client"

import { useState, useRef, useEffect } from "react"
import { Filter, ChevronDown, X, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Defect {
  id: number
  timestamp: string
  type: string
  severity: "critical" | "major" | "minor"
  labelNumber: number
  lane: number
  aiVerdict: "reject" | "accept" | "review"
  selected?: boolean
}

const DEFECT_TYPES = [
  "Smudge",
  "Misregister",
  "Hickey",
  "Color Shift",
  "Scratch",
  "Splash/Spot",
  "Missing Print",
  "Web Crease",
]

const MOCK_DEFECTS: Defect[] = [
  { id: 23, timestamp: "14:32:07", type: "Smudge", severity: "major", labelNumber: 12847, lane: 3, aiVerdict: "reject" },
  { id: 22, timestamp: "14:31:54", type: "Color Shift", severity: "minor", labelNumber: 12841, lane: 1, aiVerdict: "accept" },
  { id: 21, timestamp: "14:31:22", type: "Hickey", severity: "critical", labelNumber: 12835, lane: 2, aiVerdict: "reject" },
  { id: 20, timestamp: "14:30:48", type: "Misregister", severity: "major", labelNumber: 12822, lane: 3, aiVerdict: "reject" },
  { id: 19, timestamp: "14:29:33", type: "Scratch", severity: "minor", labelNumber: 12798, lane: 1, aiVerdict: "review" },
  { id: 18, timestamp: "14:28:12", type: "Splash/Spot", severity: "minor", labelNumber: 12770, lane: 2, aiVerdict: "accept" },
  { id: 17, timestamp: "14:27:55", type: "Smudge", severity: "major", labelNumber: 12761, lane: 1, aiVerdict: "reject" },
  { id: 16, timestamp: "14:26:41", type: "Missing Print", severity: "critical", labelNumber: 12742, lane: 3, aiVerdict: "reject" },
  { id: 15, timestamp: "14:25:18", type: "Color Shift", severity: "minor", labelNumber: 12718, lane: 2, aiVerdict: "accept" },
  { id: 14, timestamp: "14:24:02", type: "Web Crease", severity: "major", labelNumber: 12695, lane: 1, aiVerdict: "reject" },
]

export function DefectLog() {
  const [open, setOpen] = useState(false)
  const [defects] = useState<Defect[]>(MOCK_DEFECTS)
  const [selectedDefect, setSelectedDefect] = useState<number>(23)
  const [filterType, setFilterType] = useState<string>("All")
  const thumbnailCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())

  const filteredDefects = filterType === "All"
    ? defects
    : defects.filter((d) => d.type === filterType)

  const criticalCount = defects.filter((d) => d.severity === "critical").length

  useEffect(() => {
    for (const defect of filteredDefects) {
      const canvas = thumbnailCanvasRefs.current.get(defect.id)
      if (canvas) {
        drawThumbnail(canvas, defect)
      }
    }
  }, [filteredDefects])

  return (
    <>
      {/* Toggle button - always visible on right edge */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5 bg-card border border-border border-r-0 rounded-l-lg px-2 py-3 hover:bg-accent transition-colors shadow-lg"
        aria-label="Open defect history"
      >
        <History className="w-4 h-4 text-muted-foreground" />
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-medium text-foreground leading-none">{defects.length}</span>
          {criticalCount > 0 && (
            <span className="text-[9px] text-destructive font-medium leading-tight mt-0.5">{criticalCount}</span>
          )}
        </div>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-card border-l border-border shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
              Defect History
            </h2>
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground px-2">
                    <Filter className="w-3 h-3" />
                    {filterType}
                    <ChevronDown className="w-2.5 h-2.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFilterType("All")}>
                    All Types
                  </DropdownMenuItem>
                  {DEFECT_TYPES.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => setFilterType(type)}>
                      {type}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-[10px] font-mono text-muted-foreground">
                {filteredDefects.length}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-1 p-1 rounded hover:bg-secondary transition-colors"
                aria-label="Close defect history"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredDefects.map((defect) => (
              <button
                key={defect.id}
                type="button"
                onClick={() => setSelectedDefect(defect.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-border transition-colors text-left ${
                  selectedDefect === defect.id
                    ? "bg-accent"
                    : "hover:bg-secondary"
                }`}
              >
                <div className="w-10 h-10 rounded overflow-hidden border border-border flex-shrink-0 bg-background">
                  <canvas
                    ref={(el) => {
                      if (el) thumbnailCanvasRefs.current.set(defect.id, el)
                    }}
                    width={40}
                    height={40}
                    className="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">#{defect.id}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        defect.severity === "critical"
                          ? "bg-destructive/10 text-destructive"
                          : defect.severity === "major"
                            ? "bg-warning/10 text-warning"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {defect.severity}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-medium ml-auto ${
                        defect.aiVerdict === "reject"
                          ? "bg-destructive/10 text-destructive"
                          : defect.aiVerdict === "accept"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                      }`}
                    >
                      {defect.aiVerdict}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{defect.type}</span>
                    <span className="text-[10px] text-muted-foreground">L{defect.lane}</span>
                    <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                      {defect.timestamp}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function drawThumbnail(canvas: HTMLCanvasElement, defect: Defect) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  ctx.fillStyle = "#0d0e18"
  ctx.fillRect(0, 0, w, h)

  // Mini label
  ctx.fillStyle = "#1a1c2e"
  ctx.fillRect(3, 3, w - 6, h - 6)

  // Content lines
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "#22243a"
    ctx.fillRect(6, 8 + i * 6, w * 0.5 + Math.random() * 10, 3)
  }

  // Defect mark
  const colors: Record<string, string> = {
    Smudge: "rgba(239, 68, 68, 0.6)",
    Misregister: "rgba(239, 68, 68, 0.5)",
    Hickey: "rgba(239, 68, 68, 0.7)",
    "Color Shift": "rgba(251, 191, 36, 0.5)",
    Scratch: "rgba(239, 68, 68, 0.4)",
    "Splash/Spot": "rgba(239, 68, 68, 0.5)",
    "Missing Print": "rgba(239, 68, 68, 0.6)",
    "Web Crease": "rgba(251, 191, 36, 0.4)",
  }

  ctx.fillStyle = colors[defect.type] || "rgba(239, 68, 68, 0.5)"
  ctx.beginPath()
  ctx.arc(w * 0.6, h * 0.5, 5, 0, Math.PI * 2)
  ctx.fill()

  // Red border indicator
  ctx.strokeStyle = "#ef4444"
  ctx.lineWidth = 1
  ctx.strokeRect(w * 0.6 - 7, h * 0.5 - 7, 14, 14)
}
