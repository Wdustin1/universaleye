"use client"

import { useState, useEffect, useCallback } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { API } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

export function ReferenceComparison() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastDefectId, setLastDefectId] = useState<number | null>(null)
  const [lastDefectType, setLastDefectType] = useState<string | null>(null)
  const [lastDefectSeverity, setLastDefectSeverity] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDefects = useCallback(async () => {
    setRefreshKey((k) => k + 1)
    try {
      const res = await fetch(`${API.defects}?limit=1`)
      if (res.ok) {
        const data = await res.json()
        if (data.length > 0) {
          setLastDefectId(data[0].id)
          setLastDefectType(data[0].type ?? null)
          setLastDefectSeverity(data[0].severity ?? null)
        } else {
          setLastDefectId(null)
          setLastDefectType(null)
          setLastDefectSeverity(null)
        }
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }, [])

  usePolling(fetchDefects, 2000, true)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
          Reference / Last Defect
        </h2>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex-1 p-3">
        <div className="flex flex-col gap-2 h-full">
          {/* Golden reference */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Reference (Golden Master)
              </span>
            </div>
            <div className="flex-1 rounded-md border border-border overflow-hidden bg-background flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${API.referenceImage}?t=${refreshKey}`}
                alt="Reference golden master label"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.currentTarget
                  target.style.display = "none"
                }}
              />
            </div>
          </div>

          {/* Last defect */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${lastDefectId ? "bg-destructive" : "bg-muted-foreground/30"}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Last Defect
              </span>
              {lastDefectType && (
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                  lastDefectSeverity === "critical"
                    ? "bg-destructive/15 text-destructive"
                    : lastDefectSeverity === "major"
                      ? "bg-warning/15 text-warning"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {lastDefectType}
                </span>
              )}
            </div>
            <div className={`flex-1 rounded-md border overflow-hidden bg-background flex items-center justify-center ${
              lastDefectId ? "border-destructive/30" : "border-border"
            }`}>
              {lastDefectId ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`${API.defectImage(lastDefectId)}?t=${refreshKey}`}
                  alt="Last detected defect"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-[10px]">No defects detected</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
