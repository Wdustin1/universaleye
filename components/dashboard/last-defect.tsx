"use client"

import { useCallback, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

interface Defect {
  id: number
  type: string
  severity: "critical" | "major" | "minor"
  timestamp: string
  ssimScore: number | null
  aiVerdict: string
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  major: "bg-warning/15 text-warning",
  minor: "bg-sunken text-muted-foreground",
}

export function LastDefect({ onSelect }: { onSelect: (id: number) => void }) {
  const [defect, setDefect] = useState<Defect | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchLatest = useCallback(async () => {
    try {
      const res = await apiFetch(`${API.defects}?limit=1`)
      if (res.ok) {
        const data: Defect[] = await res.json()
        setDefect(data.length > 0 ? data[0] : null)
        setRefreshKey((k) => k + 1)
      }
    } catch { /* offline */ }
  }, [])
  usePolling(fetchLatest, 2000, true)

  return (
    <div className="bg-card border border-border-soft rounded-lg p-2.5 flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-1.5 pb-1.5 mb-2 border-b border-border-soft">
        <span className={`w-1.5 h-1.5 rounded-full ${defect ? "bg-destructive" : "bg-muted-foreground/30"}`} />
        <h4 className="m-0 text-[11px] uppercase tracking-wider text-foreground/75 font-medium">Last Defect</h4>
        {defect && (
          <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-medium ${SEVERITY_BADGE[defect.severity] ?? SEVERITY_BADGE.minor}`}>
            {defect.type}
          </span>
        )}
      </div>
      <div className={`flex-1 rounded-md border overflow-hidden bg-background flex items-center justify-center min-h-0 ${defect ? "border-destructive/30" : "border-border-soft"}`}>
        {defect ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`${API.defectImage(defect.id)}?t=${refreshKey}`}
            alt="Last detected defect"
            className="w-full h-full object-contain cursor-pointer"
            onClick={() => onSelect(defect.id)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-[10px]">No defects detected</span>
          </div>
        )}
      </div>
      {defect && (
        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground font-mono">
          <span>{defect.timestamp.slice(11, 19)}</span>
          <span>·</span>
          <span>SSIM {defect.ssimScore?.toFixed(3) ?? "—"}</span>
          <span>·</span>
          <span className="text-destructive font-semibold">{defect.severity}</span>
        </div>
      )}
    </div>
  )
}
