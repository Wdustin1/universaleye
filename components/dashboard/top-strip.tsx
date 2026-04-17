"use client"

import { Menu, Maximize2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

type Status = "running" | "paused" | "stopped"

interface Stats {
  labelsInspected: number
  defectsFound: number
  runTime: string
  status: Status
}

const STATUS_CHIP: Record<Status, { label: string; className: string }> = {
  running: { label: "Running", className: "bg-primary/12 text-primary border-primary/25" },
  paused:  { label: "Paused",  className: "bg-warning/12 text-warning border-warning/25" },
  stopped: { label: "Stopped", className: "bg-sunken text-muted-foreground border-border-strong" },
}

export function TopStrip({
  stats,
  onOpenSettings,
  onOpenLog,
  onToggleFullscreen,
  loading,
}: {
  stats: Stats
  onOpenSettings: () => void
  onOpenLog: () => void
  onToggleFullscreen: () => void
  loading?: boolean
}) {
  const rate = stats.labelsInspected > 0
    ? (stats.defectsFound / stats.labelsInspected) * 100
    : 0
  const chip = STATUS_CHIP[stats.status]

  return (
    <div
      className="h-[38px] bg-card border border-border-soft rounded-lg px-4 flex items-center gap-7"
      role="status"
      aria-live="polite"
    >
      <Stat label="Inspected" value={stats.labelsInspected.toLocaleString()} loading={loading} />
      <button
        type="button"
        onClick={onOpenLog}
        className="flex items-baseline gap-1.5 hover:opacity-80 transition-opacity"
        aria-label={`Defects: ${stats.defectsFound}. Tap to open defect history.`}
      >
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Defects</span>
        {loading
          ? <Skeleton className="h-3 w-6 inline-block" />
          : <span className="font-mono text-sm font-semibold tabular-nums text-destructive">{stats.defectsFound}</span>
        }
      </button>
      <Stat
        label="Rate"
        value={`${rate.toFixed(2)}%`}
        valueClass={rate > 0.5 ? "text-warning" : undefined}
        loading={loading}
      />
      <Stat label="Run" value={stats.runTime} loading={loading} />
      <div className="ml-auto flex items-center gap-2.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium font-mono border ${chip.className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {chip.label}
        </span>
        <IconButton onClick={onOpenSettings} label="Open settings"><Menu className="w-3.5 h-3.5" /></IconButton>
        <IconButton onClick={onToggleFullscreen} label="Toggle fullscreen"><Maximize2 className="w-3.5 h-3.5" /></IconButton>
      </div>
    </div>
  )
}

function Stat({ label, value, valueClass, loading }: { label: string; value: string; valueClass?: string; loading?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {loading
        ? <Skeleton className="h-3 w-12" />
        : <span className={`font-mono text-sm font-semibold tabular-nums ${valueClass ?? "text-foreground"}`}>{value}</span>
      }
    </div>
  )
}

function IconButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-[30px] h-[30px] bg-sunken border border-border-soft rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </button>
  )
}
