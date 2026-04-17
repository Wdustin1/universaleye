"use client"

import { useCallback, useState } from "react"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

interface HealthData {
  cameraAvailable: boolean | null
}

export function HealthStrip() {
  const [health, setHealth] = useState<HealthData>({ cameraAvailable: null })

  const pollHealth = useCallback(async () => {
    try {
      const res = await apiFetch(API.health)
      if (res.ok) {
        const data = await res.json()
        setHealth({ cameraAvailable: Boolean(data.camera_available) })
      }
    } catch {
      setHealth({ cameraAvailable: null })
    }
  }, [])
  usePolling(pollHealth, 5000, true)

  const cameraLabel = health.cameraAvailable === null
    ? "—"
    : health.cameraAvailable
      ? "live"
      : "no signal"
  const cameraClass = health.cameraAvailable === null
    ? "text-muted-foreground"
    : health.cameraAvailable
      ? "text-success"
      : "text-warning"

  return (
    <div className="h-[28px] bg-card border border-border-soft rounded-lg px-3.5 flex items-center gap-6 text-[10px] text-muted-foreground">
      <Readout label="Camera"><span className={`font-mono font-semibold ${cameraClass}`}>{cameraLabel}</span></Readout>
      <Readout label="FPS"><span className="font-mono font-semibold text-foreground">—</span></Readout>
      <Readout label="Alignment"><span className="font-mono font-semibold text-foreground">—</span></Readout>
      <Readout label="State"><span className="font-mono font-semibold text-foreground">—</span></Readout>
      <Readout label="Pipeline"><span className="font-mono font-semibold text-success">healthy</span></Readout>
      <Readout label="Defect mix" className="ml-auto"><span className="font-mono font-semibold text-foreground">—</span></Readout>
    </div>
  )
}

function Readout({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <span className="uppercase tracking-wider">{label}</span>
      {children}
    </div>
  )
}
