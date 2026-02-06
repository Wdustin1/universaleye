"use client"

import React from "react"

import { useEffect, useState } from "react"
import {
  Gauge,
  Hash,
  AlertTriangle,
  TrendingUp,
  Timer,
  Layers,
} from "lucide-react"

interface StatItem {
  label: string
  value: string
  unit?: string
  icon: React.ReactNode
  trend?: "up" | "down" | "neutral"
  accent?: "default" | "destructive" | "success" | "warning"
}

export function StatsBar() {
  const [stats, setStats] = useState<StatItem[]>([
    {
      label: "Line Speed",
      value: "194",
      unit: "m/min",
      icon: <Gauge className="w-3.5 h-3.5" />,
      accent: "default",
    },
    {
      label: "Labels Inspected",
      value: "12,847",
      icon: <Hash className="w-3.5 h-3.5" />,
      accent: "default",
    },
    {
      label: "Defects Found",
      value: "23",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      accent: "destructive",
    },
    {
      label: "Yield Rate",
      value: "99.82",
      unit: "%",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      trend: "up",
      accent: "success",
    },
    {
      label: "Run Time",
      value: "02:34:18",
      icon: <Timer className="w-3.5 h-3.5" />,
      accent: "default",
    },
    {
      label: "Waste",
      value: "4",
      unit: "labels",
      icon: <Layers className="w-3.5 h-3.5" />,
      accent: "warning",
    },
  ])

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) =>
        prev.map((stat) => {
          if (stat.label === "Labels Inspected") {
            const current = Number.parseInt(stat.value.replace(/,/g, ""))
            const next = current + Math.floor(Math.random() * 3) + 1
            return { ...stat, value: next.toLocaleString() }
          }
          if (stat.label === "Line Speed") {
            const base = 194
            const variance = Math.floor(Math.random() * 5) - 2
            return { ...stat, value: String(base + variance) }
          }
          return stat
        }),
      )
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-stretch border-b border-border bg-card">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex-1 flex items-center gap-3 px-4 py-2.5 ${
            i < stats.length - 1 ? "border-r border-border" : ""
          }`}
        >
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-md ${
              stat.accent === "destructive"
                ? "bg-destructive/10 text-destructive"
                : stat.accent === "success"
                  ? "bg-success/10 text-success"
                  : stat.accent === "warning"
                    ? "bg-warning/10 text-warning"
                    : "bg-secondary text-muted-foreground"
            }`}
          >
            {stat.icon}
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
                {stat.value}
              </span>
              {stat.unit && (
                <span className="text-[10px] text-muted-foreground">{stat.unit}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
