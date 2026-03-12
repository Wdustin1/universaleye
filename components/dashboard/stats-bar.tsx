"use client"

import { useEffect, useState, useCallback } from "react"
import { Hash, AlertTriangle, Timer } from "lucide-react"
import { API } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

type Accent = "default" | "destructive" | "success" | "warning"

const STATS_CONFIG: { label: string; key: string; icon: typeof Hash; accent: Accent }[] = [
  { label: "Labels Inspected", key: "labelsInspected", icon: Hash, accent: "default" },
  { label: "Defects Found", key: "defectsFound", icon: AlertTriangle, accent: "destructive" },
  { label: "Run Time", key: "runTime", icon: Timer, accent: "default" },
]

export function StatsBar() {
  const [stats, setStats] = useState({
    labelsInspected: 0,
    defectsFound: 0,
    runTime: "00:00:00",
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(API.stats)
      if (res.ok) {
        const data = await res.json()
        setStats({
          labelsInspected: data.labelsInspected ?? 0,
          defectsFound: data.defectsFound ?? 0,
          runTime: data.runTime ?? "00:00:00",
        })
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }, [])

  usePolling(fetchStats, 2000, true)

  const values: Record<string, string> = {
    labelsInspected: stats.labelsInspected.toLocaleString(),
    defectsFound: String(stats.defectsFound),
    runTime: stats.runTime,
  }

  return (
    <div className="flex items-stretch border-b border-border bg-card" role="status" aria-live="polite" aria-atomic="false">
      {loading && stats.labelsInspected === 0 && stats.defectsFound === 0 ? (
        <div className="flex-1 flex items-center justify-center py-3 text-xs text-muted-foreground">
          Connecting to inspection system...
        </div>
      ) : (
        STATS_CONFIG.map((stat, i) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className={`flex-1 flex items-center gap-3 px-5 py-2.5 ${
                i < STATS_CONFIG.length - 1 ? "border-r border-border" : ""
              }`}
            >
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                  stat.accent === "destructive"
                    ? "bg-destructive/10 text-destructive"
                    : stat.accent === "success"
                      ? "bg-success/10 text-success"
                      : stat.accent === "warning"
                        ? "bg-warning/10 text-warning"
                        : "bg-secondary text-muted-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none mb-1">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-base font-semibold font-mono leading-none ${
                      stat.accent === "destructive"
                        ? "text-destructive"
                        : stat.accent === "success"
                          ? "text-success"
                          : stat.accent === "warning"
                            ? "text-warning"
                            : "text-foreground"
                    }`}
                  >
                    {values[stat.key]}
                  </span>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
