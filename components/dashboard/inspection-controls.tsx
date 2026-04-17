"use client"

import { useState, useEffect, useRef } from "react"
import {
  Play,
  Pause,
  Square,
  SlidersHorizontal,
  Camera,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { API, apiFetch } from "@/lib/api"
import { ConfirmSheet } from "./confirm-sheet"

type InspectionState = "running" | "paused" | "stopped"
type ConfirmKind = null | "stop" | "reset-reference"

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
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null)
  const sensitivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local state in sync with backend truth (polled every 2 s from page.tsx)
  useEffect(() => {
    setState(status)
  }, [status])

  const handleStart = async () => {
    setState("running") // optimistic
    try {
      await apiFetch(API.inspectionStart, { method: "POST" })
    } catch { /* backend not available */ }
  }

  const handlePause = async () => {
    setState("paused") // optimistic
    try {
      await apiFetch(API.inspectionPause, { method: "POST" })
    } catch { /* backend not available */ }
  }

  const handleStop = () => setConfirmKind("stop")
  const performStop = async () => {
    setConfirmKind(null)
    setState("stopped")
    try {
      await apiFetch(API.inspectionStop, { method: "POST" })
    } catch { /* offline */ }
  }

  const handleSensitivity = (value: number) => {
    setSensitivity(value)
    // Debounce — only fire the API call 200 ms after the slider settles
    if (sensitivityTimer.current) clearTimeout(sensitivityTimer.current)
    sensitivityTimer.current = setTimeout(async () => {
      try {
        await apiFetch(API.sensitivity, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sensitivity: value }),
        })
      } catch { /* backend not available */ }
    }, 200)
  }

  const handleNewReference = async () => {
    try {
      await apiFetch(API.setReference, { method: "POST" })
    } catch { /* backend not available */ }
  }

  const handleResetReference = () => setConfirmKind("reset-reference")
  const performResetReference = async () => {
    setConfirmKind(null)
    try {
      await apiFetch(API.resetReference, { method: "POST" })
    } catch { /* offline */ }
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
              className={`relative flex items-center justify-center gap-2.5 w-full h-14 rounded-lg text-base font-semibold transition-all ${
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
              <Play className="w-5 h-5" />
              {state === "paused" ? "Resume" : "Start"}
            </button>
            {!hasReference && state !== "running" && (
              <p className="text-[9px] text-warning text-center">Set a reference image first</p>
            )}

            {/* Pause / Stop — stacked so both fit in the narrow column */}
            <button
              type="button"
              onClick={handlePause}
              className={`flex items-center justify-center gap-2 w-full h-11 rounded-lg text-sm font-medium transition-all ${
                state === "paused"
                  ? "bg-warning/15 text-warning border border-warning/30"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>

            <button
              type="button"
              onClick={handleStop}
              className={`flex items-center justify-center gap-2 w-full h-11 rounded-lg text-sm font-medium transition-all ${
                state === "stopped"
                  ? "bg-destructive/15 text-destructive border border-destructive/30"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
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
          <div className="relative h-11 flex items-center group">
            <div className="absolute inset-x-0 h-1.5 bg-secondary rounded-full top-1/2 -translate-y-1/2">
              <div
                className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                style={{ width: `${sensitivity}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-primary-foreground shadow-sm transition-all"
                style={{ left: `calc(${sensitivity}% - 7px)` }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sensitivity}
              onChange={(e) => handleSensitivity(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
              New
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-7 text-[11px] text-muted-foreground gap-1.5 px-2"
              onClick={handleResetReference}
            >
              <RotateCcw className="w-3 h-3 flex-shrink-0" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      <ConfirmSheet
        open={confirmKind === "stop"}
        title="Stop inspection?"
        body="Stops the inspection loop and resets run-time stats. Defect history is preserved. The current run cannot be resumed — Start will begin a new run."
        confirmLabel="Stop"
        onConfirm={performStop}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmSheet
        open={confirmKind === "reset-reference"}
        title="Reset golden reference?"
        body="The golden reference image will be cleared. Inspection cannot resume until a new reference is captured."
        confirmLabel="Reset"
        onConfirm={performResetReference}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  )
}
