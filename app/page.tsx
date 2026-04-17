"use client"

import { useState, useCallback, useRef } from "react"
import { TopStrip } from "@/components/dashboard/top-strip"
import { HealthStrip } from "@/components/dashboard/health-strip"
import { LiveFeedPanel } from "@/components/dashboard/live-feed"
import { ReferenceComparison } from "@/components/dashboard/reference-comparison"
import { DefectLog } from "@/components/dashboard/defect-log"
import { InspectionControls } from "@/components/dashboard/inspection-controls"
import { DefectAlertOverlay } from "@/components/dashboard/defect-alert"
import { ErrorBoundary } from "@/components/error-boundary"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

export default function Page() {
  const [defectLogOpen, setDefectLogOpen] = useState(false)
  const [stats, setStats] = useState({ labelsInspected: 0, defectsFound: 0, runTime: "00:00:00", status: "stopped" as "running" | "paused" | "stopped" })
  const [hasReference, setHasReference] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const pollStats = useCallback(async () => {
    try {
      const res = await apiFetch(API.stats)
      if (res.ok) {
        const data = await res.json()
        setStats({
          labelsInspected: data.labelsInspected ?? 0,
          defectsFound: data.defectsFound ?? 0,
          runTime: data.runTime ?? "00:00:00",
          status: data.status ?? "stopped",
        })
        setHasReference(data.hasReference ?? false)
      }
    } catch { /* backend not available */ }
  }, [])
  usePolling(pollStats, 2000, true)

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else containerRef.current?.requestFullscreen().catch(() => {})
  }

  return (
    <div ref={containerRef} className="h-screen bg-canvas p-3.5 grid gap-2.5" style={{ gridTemplateRows: "38px 1fr 28px" }}>
      <DefectAlertOverlay />

      <ErrorBoundary>
        <TopStrip
          stats={stats}
          onOpenSettings={() => { /* wired in Task 13 */ }}
          onOpenLog={() => setDefectLogOpen(true)}
          onToggleFullscreen={toggleFullscreen}
        />
      </ErrorBoundary>

      <div className="grid gap-2.5 min-h-0" style={{ gridTemplateColumns: "110px 1fr 280px" }}>
        <ErrorBoundary>
          <InspectionControls hasReference={hasReference} status={stats.status} />
        </ErrorBoundary>
        <ErrorBoundary>
          <LiveFeedPanel hasReference={hasReference} defectCount={stats.defectsFound} onReferenceSet={() => setHasReference(true)} />
        </ErrorBoundary>
        <ErrorBoundary>
          <ReferenceComparison />
        </ErrorBoundary>
      </div>

      <ErrorBoundary>
        <HealthStrip />
      </ErrorBoundary>

      <ErrorBoundary>
        <DefectLog open={defectLogOpen} onOpenChange={setDefectLogOpen} />
      </ErrorBoundary>
    </div>
  )
}
