"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { API } from "@/lib/api"
import { useSSE } from "@/hooks/use-polling"

interface DefectEvent {
  id: number
  timestamp: string
  type: string
  severity: "critical" | "major" | "minor"
  aiVerdict: string
  ssimScore: number | null
}

const TIER: Record<string, { dwellMs: number; borderClass: string; stripeClass: string; thumbClass: string; progressClass: string }> = {
  critical: {
    dwellMs: 5000,
    borderClass: "border-destructive/40",
    stripeClass: "border-l-destructive",
    thumbClass: "from-destructive/40 to-destructive/15 border-destructive/40",
    progressClass: "bg-destructive",
  },
  major: {
    dwellMs: 5000,
    borderClass: "border-warning/40",
    stripeClass: "border-l-warning",
    thumbClass: "from-warning/40 to-warning/15 border-warning/40",
    progressClass: "bg-warning",
  },
  minor: {
    dwellMs: 3000,
    borderClass: "border-border-strong",
    stripeClass: "border-l-muted-foreground",
    thumbClass: "from-sunken to-card border-border-strong",
    progressClass: "bg-muted-foreground",
  },
}

export function DefectAlertOverlay() {
  const [active, setActive] = useState<DefectEvent | null>(null)
  const [progress, setProgress] = useState(100) // 100 → 0
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const dismiss = useCallback(() => {
    setActive(null)
    setProgress(100)
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null }
    if (tickTimer.current) { clearInterval(tickTimer.current); tickTimer.current = null }
  }, [])

  const onDefectEvent = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw) as DefectEvent
      const tier = TIER[data.severity] ?? TIER.minor
      setActive(data)
      setProgress(100)
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      if (tickTimer.current) clearInterval(tickTimer.current)
      const start = performance.now()
      tickTimer.current = setInterval(() => {
        const elapsed = performance.now() - start
        const remaining = Math.max(0, 100 - (elapsed / tier.dwellMs) * 100)
        setProgress(remaining)
      }, 50)
      dismissTimer.current = setTimeout(dismiss, tier.dwellMs)
    } catch (err) {
      console.error("Failed to parse SSE defect event:", err)
    }
  }, [dismiss])
  useSSE(API.events, { events: { defect: onDefectEvent } })

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      if (tickTimer.current) clearInterval(tickTimer.current)
    }
  }, [])

  if (!active) return null
  const tier = TIER[active.severity] ?? TIER.minor

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-12 left-1/2 z-30 -translate-x-1/2 bg-card border ${tier.borderClass} ${tier.stripeClass} border-l-[3px] rounded-lg pl-3.5 pr-4 py-3 flex items-center gap-3.5 min-w-[320px] shadow-2xl overflow-hidden`}
      style={{ animation: "alert-slide-up 320ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}
    >
      <div className={`w-10 h-10 rounded bg-gradient-to-br ${tier.thumbClass} border flex items-center justify-center flex-shrink-0`}>
        <AlertTriangle className="w-4 h-4 opacity-80" />
      </div>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="font-semibold text-sm capitalize">{active.type} · {active.severity}</div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {active.timestamp.slice(11, 19)} · SSIM {active.ssimScore?.toFixed(3) ?? "—"} · #{active.id}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-[10px] text-muted-foreground hover:text-foreground"
        aria-label="Dismiss alert"
      >
        tap to dismiss
      </button>
      <div className={`absolute bottom-0 left-0 h-[2px] ${tier.progressClass}`} style={{ width: `${progress}%` }} />
    </div>
  )
}
