"use client"

import { useState, useCallback } from "react"
import { API } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

export function GoldenReference() {
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(async () => {
    setRefreshKey((k) => k + 1)
  }, [])
  usePolling(refresh, 5000, true)

  return (
    <div className="bg-card border border-border-soft rounded-lg p-2.5 flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-1.5 pb-1.5 mb-2 border-b border-border-soft">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        <h4 className="m-0 text-[11px] uppercase tracking-wider text-foreground/75 font-medium">Golden Reference</h4>
      </div>
      <div className="flex-1 rounded-md border border-border-soft overflow-hidden bg-background flex items-center justify-center min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${API.referenceImage}?t=${refreshKey}`}
          alt="Reference golden master label"
          className="w-full h-full object-contain"
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />
      </div>
    </div>
  )
}
