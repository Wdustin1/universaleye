"use client"

import { useEffect, useRef, useState } from "react"
import { Hash, AlertTriangle, Timer } from "lucide-react"

type Accent = "default" | "destructive" | "success" | "warning"

const STATS_CONFIG: { label: string; key: string; icon: typeof Hash; accent: Accent }[] = [
  { label: "Labels Inspected", key: "labelsInspected", icon: Hash, accent: "default" },
  { label: "Defects Found", key: "defectsFound", icon: AlertTriangle, accent: "destructive" },
  { label: "Run Time", key: "runTime", icon: Timer, accent: "default" },
]

export function StatsBar() {
  const counterRef = useRef(0)
  const [labelsInspected, setLabelsInspected] = useState(12847)

  const values: Record<string, string> = {
    labelsInspected: labelsInspected.toLocaleString(),
    defectsFound: "10",
    runTime: "02:34:18",
  }

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      counterRef.current += 1
      const increment = (counterRef.current % 3) + 1
      setLabelsInspected((prev) => prev + increment)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-stretch border-b border-border bg-card">
      {STATS_CONFIG.map((stat, i) => {
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
      })}
    </div>
  )
}
