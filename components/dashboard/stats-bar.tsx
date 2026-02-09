"use client"

import React from "react"
import { useEffect, useState } from "react"
import { Hash, AlertTriangle, Timer } from "lucide-react"

interface StatItem {
  label: string
  value: string
  unit?: string
  icon: React.ReactNode
  trend?: "up" | "down" | "neutral"
  accent?: "default" | "destructive" | "success" | "warning"
}

export function StatsBar() {
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<StatItem[]>([
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
      label: "Run Time",
      value: "02:34:18",
      icon: <Timer className="w-3.5 h-3.5" />,
      accent: "default",
    },

  ])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Simulate live data updates
  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      setStats((prev) =>
        prev.map((stat) => {
          if (stat.label === "Labels Inspected") {
            const current = Number.parseInt(stat.value.replace(/,/g, ""))
            const next = current + Math.floor(Math.random() * 3) + 1
            return { ...stat, value: next.toLocaleString() }
          }

          return stat
        }),
      )
    }, 2000)
    return () => clearInterval(interval)
  }, [mounted])

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
