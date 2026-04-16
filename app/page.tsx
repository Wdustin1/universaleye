"use client"

import { useState, useCallback } from "react"
import { DashboardHeader } from "@/components/dashboard/header"
import { StatsBar } from "@/components/dashboard/stats-bar"
import { LiveFeedPanel } from "@/components/dashboard/live-feed"
import { ReferenceComparison } from "@/components/dashboard/reference-comparison"
import { DefectLog } from "@/components/dashboard/defect-log"
import { InspectionControls } from "@/components/dashboard/inspection-controls"
import { DefectBreakdown } from "@/components/dashboard/defect-breakdown"
import { DefectAlertOverlay } from "@/components/dashboard/defect-alert"
import { ErrorBoundary } from "@/components/error-boundary"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

export default function Page() {
  const [defectLogOpen, setDefectLogOpen] = useState(false)
  const [defectCount, setDefectCount] = useState(0)
  const [status, setStatus] = useState<"running" | "paused" | "stopped">("stopped")
  const [hasReference, setHasReference] = useState(false)

  const pollStats = useCallback(async () => {
    try {
      const res = await apiFetch(API.stats)
      if (res.ok) {
        const data = await res.json()
        setDefectCount(data.defectsFound ?? 0)
        setStatus(data.status ?? "stopped")
        setHasReference(data.hasReference ?? false)
      }
    } catch { /* backend not available */ }
  }, [])

  usePolling(pollStats, 2000, true)

  return (
    <div className="flex flex-col h-screen bg-background">
      <DefectAlertOverlay />
      {/* Header */}
      <DashboardHeader
        defectCount={defectCount}
        onDefectHistoryClick={() => setDefectLogOpen(true)}
      />

      {/* Stats Bar */}
      <ErrorBoundary>
        <StatsBar />
      </ErrorBoundary>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Column: Controls */}
        <aside className="w-44 flex-shrink-0 border-r border-border bg-card overflow-y-auto">
          <InspectionControls hasReference={hasReference} status={status} />
        </aside>

        {/* Center: Main viewport */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Live feed and reference */}
          <div className="flex-1 flex min-h-0">
            {/* Live Feed - dominant panel */}
            <div className="flex-[5] min-w-0 border-r border-border bg-card overflow-hidden">
              <ErrorBoundary>
                <LiveFeedPanel hasReference={hasReference} defectCount={defectCount} onReferenceSet={() => setHasReference(true)} />
              </ErrorBoundary>
            </div>
            {/* Reference Comparison */}
            <div className="flex-[2] min-w-0 bg-card overflow-hidden">
              <ErrorBoundary>
                <ReferenceComparison />
              </ErrorBoundary>
            </div>
          </div>

          {/* Bottom bar: Breakdown */}
          <div className="h-36 flex-shrink-0 border-t border-border bg-card overflow-hidden">
            <ErrorBoundary>
              <DefectBreakdown />
            </ErrorBoundary>
          </div>
        </main>

        {/* Defect Log - slide-out panel */}
        <ErrorBoundary>
          <DefectLog open={defectLogOpen} onOpenChange={setDefectLogOpen} />
        </ErrorBoundary>
      </div>
    </div>
  )
}
