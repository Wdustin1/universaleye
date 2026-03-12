"use client"

import { useState, useEffect, useRef } from "react"
import {
  Play,
  Pause,
  Square,
  SlidersHorizontal,
  Camera,
  RotateCcw,
  Database,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { API } from "@/lib/api"

type InspectionState = "running" | "paused" | "stopped"

export function InspectionControls({
  hasReference = true,
  status = "stopped",
}: {
  hasReference?: boolean
  status?: InspectionState
}) {
  // Local state gives instant feedback on button clicks; the useEffect below
  // corrects it whenever the backend-polled `status` prop changes.
  const [state, setState] = useState<InspectionState>(status)
  const [sensitivity, setSensitivity] = useState(75)
  const [collecting, setCollecting] = useState(false)
  const sensitivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local state in sync with backend truth (polled every 2 s from page.tsx)
  useEffect(() => {
    setState(status)
  }, [status])

  const handleStart = async () => {
    setState("running") // optimistic
    try {
      await fetch(API.inspectionStart, { method: "POST" })
    } catch { /* backend not available */ }
  }

  const handlePause = async () => {
    setState("paused") // optimistic
    try {
      await fetch(API.inspectionPause, { method: "POST" })
    } catch { /* backend not available */ }
  }

  const handleStop = async () => {
    setState("stopped") // optimistic
    try {
      await fetch(API.inspectionStop, { method: "POST" })
    } catch { /* backend not available */ }
  }

  const handleCollectToggle = async () => {
    const next = !collecting
    setCollecting(next)
    try {
      await fetch(next ? API.collectionStart : API.collectionStop, { method: "POST" })
    } catch { /* backend not available */ }
  }

  const handleSensitivity = (value: number) => {
    setSensitivity(value)
    // Debounce — only fire the API call 200 ms after the slider settles
    if (sensitivityTimer.current) clearTimeout(sensitivityTimer.current)
    sensitivityTimer.current = setTimeout(async () => {
      try {
        await fetch(API.sensitivity, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sensitivity: value }),
        })
      } catch { /* backend not available */ }
    }, 200)
  }

  const handleNewReference = async () => {
    try {
      await fetch(API.setReference, { method: "POST" })
    } catch { /* backend not available */ }
  }

  const handleResetReference = async () => {
    try {
      await fetch(API.resetReference, { method: "POST" })
    } catch { /* backend not available */ }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
          Controls
        </h2>
      </div>

      <div className="flex-1 p-3 flex flex-col gap-5">
        {/* Transport Controls */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
            Inspection
          </p>
          <div className="flex flex-col gap-2">
            {/* Start / Resume */}
            <button
              type="button"
              onClick={handleStart}
              disabled={!hasReference && state !== "running"}
              className={`relative flex items-center justify-center gap-2.5 w-full h-11 rounded-lg text-sm font-medium transition-all ${
                !hasReference && state !== "running"
                  ? "bg-secondary text-muted-foreground opacity-50 cursor-not-allowed"
                  : state === "running"
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(168_75%_42%/0.3)]"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {state === "running" && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
              )}
              <Play className="w-4 h-4" />
              {state === "paused" ? "Resume" : "Start"}
            </button>
            {!hasReference && state !== "running" && (
              <p className="text-[9px] text-warning text-center">Set a reference image first</p>
            )}

            {/* Pause / Stop row */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePause}
                className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-all ${
                  state === "paused"
                    ? "bg-warning/15 text-warning border border-warning/30"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>

              <button
                type="button"
                onClick={handleStop}
                className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-all ${
                  state === "stopped"
                    ? "bg-destructive/15 text-destructive border border-destructive/30"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                Stop
              </button>
            </div>
          </div>

          {/* State indicator */}
          <div className="flex items-center gap-2 mt-3 px-1">
            <div
              className={`w-2 h-2 rounded-full ${
                state === "running"
                  ? "bg-primary animate-pulse"
                  : state === "paused"
                    ? "bg-warning"
                    : "bg-muted-foreground"
              }`}
            />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {state === "running"
                ? "Inspecting"
                : state === "paused"
                  ? "Paused"
                  : "Stopped"}
            </span>
          </div>
        </div>

        <div className="h-px bg-border -mx-3" />

        {/* Sensitivity Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              Detection Sensitivity
            </p>
            <span className="text-[10px] font-mono text-foreground">{sensitivity}%</span>
          </div>
          <div className="relative h-1.5 bg-secondary rounded-full group">
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
              style={{ width: `${sensitivity}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-primary-foreground shadow-sm transition-all"
              style={{ left: `calc(${sensitivity}% - 6px)` }}
            />
            <input
              type="range"
              min="0"
              max="100"
              value={sensitivity}
              onChange={(e) => handleSensitivity(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              aria-label="Detection sensitivity"
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">Low</span>
            <span className="text-[9px] text-muted-foreground">High</span>
          </div>
        </div>

        {/* Reference Actions */}
        <div className="mt-auto pt-4 border-t border-border -mx-3 px-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Reference
          </p>
          <div className="flex flex-col gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-7 text-[11px] text-muted-foreground gap-1.5 px-2"
              onClick={handleNewReference}
            >
              <Camera className="w-3 h-3 flex-shrink-0" />
              New Reference
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-7 text-[11px] text-muted-foreground gap-1.5 px-2"
              onClick={handleResetReference}
            >
              <RotateCcw className="w-3 h-3 flex-shrink-0" />
              Reset to Original
            </Button>
          </div>
        </div>

        {/* Data Collection */}
        <div className="pt-4 border-t border-border -mx-3 px-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Training Data
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleCollectToggle}
              className={`flex items-center gap-1.5 h-7 px-2 rounded text-[11px] font-medium transition-all w-full ${
                collecting
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${collecting ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
              {collecting ? "Collecting…" : "Collect Frames"}
            </button>
            <Link href="/collect" target="_blank">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start h-7 text-[11px] text-muted-foreground gap-1.5 px-2 w-full"
              >
                <Database className="w-3 h-3 flex-shrink-0" />
                Label Frames
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
