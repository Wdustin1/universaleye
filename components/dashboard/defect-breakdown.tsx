"use client"

import { useCallback, useState } from "react"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

interface BreakdownItem {
  type: string
  count: number
  percentage: number
}

export function DefectBreakdown() {
  const [defectData, setDefectData] = useState<BreakdownItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBreakdown = useCallback(async () => {
    try {
      const res = await apiFetch(API.defectBreakdown)
      if (res.ok) {
        setDefectData(await res.json())
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }, [])

  usePolling(fetchBreakdown, 5000, true)

  const totalCount = defectData.reduce((sum, d) => sum + d.count, 0)
  const maxCount = defectData.length > 0 ? Math.max(...defectData.map((d) => d.count)) : 1

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
          Defect Classification
        </h2>
        <span className="text-[10px] font-mono text-muted-foreground">
          {totalCount} total
        </span>
      </div>
      <div className="flex-1 px-3 py-1 flex flex-col justify-center gap-1">
        {loading && defectData.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center">Loading...</p>
        ) : defectData.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center">No defects detected</p>
        ) : (
          defectData.map((item) => {
            const color =
              item.count >= 5
                ? "hsl(var(--destructive))"
                : item.count >= 3
                  ? "hsl(var(--warning))"
                  : "hsl(var(--primary))"
            return (
              <div key={item.type} className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-20 text-right truncate">
                  {item.type}
                </span>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(item.count / maxCount) * 100}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5 w-16">
                  <span className="text-[10px] font-mono font-semibold text-foreground w-4 text-right">
                    {item.count}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
