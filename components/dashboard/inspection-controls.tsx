"use client"

import React from "react"

import { useState } from "react"
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  SlidersHorizontal,
  Camera,
  Lightbulb,
  Focus,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export function InspectionControls() {
  const [isInspecting, setIsInspecting] = useState(true)
  const [sensitivity, setSensitivity] = useState(75)
  const [autoReject, setAutoReject] = useState(true)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
          Controls
        </h2>
      </div>

      <div className="flex-1 p-3 flex flex-col gap-4">
        {/* Transport Controls */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Inspection
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant={isInspecting ? "default" : "ghost"}
              size="sm"
              className={`flex-1 h-8 gap-1.5 text-xs ${
                isInspecting
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => setIsInspecting(true)}
            >
              <Play className="w-3 h-3" />
              Start
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={() => setIsInspecting(false)}
            >
              <Pause className="w-3 h-3" />
              Pause
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={() => setIsInspecting(false)}
            >
              <Square className="w-3 h-3" />
              Stop
            </Button>
          </div>
        </div>

        {/* Sensitivity Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              Detection Sensitivity
            </p>
            <span className="text-[10px] font-mono text-foreground">{sensitivity}%</span>
          </div>
          <div className="relative h-1.5 bg-secondary rounded-full">
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
              style={{ width: `${sensitivity}%` }}
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

        {/* Quick Settings */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Quick Settings
          </p>
          <div className="flex flex-col gap-1.5">
            <ToggleSetting
              icon={<RotateCcw className="w-3 h-3" />}
              label="Auto-Reject"
              description="Automatically reject flagged labels"
              enabled={autoReject}
              onChange={setAutoReject}
            />
            <ToggleSetting
              icon={<Lightbulb className="w-3 h-3" />}
              label="LED Strobe"
              description="High-frequency LED illumination"
              enabled={true}
              onChange={() => {}}
            />
            <ToggleSetting
              icon={<Focus className="w-3 h-3" />}
              label="Auto-Focus"
              description="Dynamic focus adjustment"
              enabled={true}
              onChange={() => {}}
            />
            <ToggleSetting
              icon={<Camera className="w-3 h-3" />}
              label="Multi-Camera"
              description="Enable all camera inputs"
              enabled={false}
              onChange={() => {}}
            />
          </div>
        </div>

        {/* Reference Actions */}
        <div className="mt-auto">
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

function ToggleSetting({
  icon,
  label,
  description,
  enabled,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  description: string
  enabled: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left ${
        enabled ? "bg-secondary" : "bg-transparent hover:bg-secondary/50"
      }`}
    >
      <div className={`${enabled ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-foreground">{label}</p>
        <p className="text-[9px] text-muted-foreground leading-tight">{description}</p>
      </div>
      <div
        className={`w-7 h-4 rounded-full transition-colors flex items-center ${
          enabled ? "bg-primary justify-end" : "bg-muted justify-start"
        }`}
      >
        <div className="w-3 h-3 rounded-full bg-foreground mx-0.5" />
      </div>
    </button>
  )
}
