"use client"

import { useState } from "react"
import {
  Play,
  Pause,
  Square,
  SlidersHorizontal,
  Camera,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type InspectionState = "running" | "paused" | "stopped"

export function InspectionControls() {
  const [state, setState] = useState<InspectionState>("running")
  const [sensitivity, setSensitivity] = useState(75)

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
              onClick={() => setState("running")}
              className={`relative flex items-center justify-center gap-2.5 w-full h-11 rounded-lg text-sm font-medium transition-all ${
                state === "running"
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

            {/* Pause / Stop row */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setState("paused")}
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
                onClick={() => setState("stopped")}
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
              onChange={(e) => setSensitivity(Number(e.target.value))}
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
            <Button variant="ghost" size="sm" className="justify-start h-7 text-xs text-muted-foreground gap-2 px-2">
              <Camera className="w-3 h-3" />
              Capture New Reference
            </Button>
            <Button variant="ghost" size="sm" className="justify-start h-7 text-xs text-muted-foreground gap-2 px-2">
              <RotateCcw className="w-3 h-3" />
              Reset to Original
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
