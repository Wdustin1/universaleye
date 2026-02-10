"use client"

import { useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard/header"
import { StatsBar } from "@/components/dashboard/stats-bar"
import { LiveFeedPanel } from "@/components/dashboard/live-feed"
import { ReferenceComparison } from "@/components/dashboard/reference-comparison"
import { DefectLog } from "@/components/dashboard/defect-log"
import { InspectionControls } from "@/components/dashboard/inspection-controls"
import { DefectBreakdown } from "@/components/dashboard/defect-breakdown"
import { API } from "@/lib/api"

export default function Page() {
  const [defectLogOpen, setDefectLogOpen] = useState(false)
  const [defectCount, setDefectCount] = useState(0)
  const [status, setStatus] = useState<"running" | "paused" | "stopped">("stopped")

  // Poll stats for header defect count and status
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(API.stats)
        if (res.ok) {
          const data = await res.json()
          setDefectCount(data.defectsFound ?? 0)
          setStatus(data.status ?? "stopped")
        }
      } catch { /* backend not available */ }
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <DashboardHeader
        defectCount={defectCount}
        status={status}
        onDefectHistoryClick={() => setDefectLogOpen(true)}
      />

      {/* Stats Bar */}
      <StatsBar />

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Column: Controls */}
        <aside className="w-44 flex-shrink-0 border-r border-border bg-card overflow-y-auto">
          <InspectionControls />
        </aside>

        {/* Center: Main viewport */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Live feed and reference */}
          <div className="flex-1 flex min-h-0">
            {/* Live Feed - dominant panel */}
            <div className="flex-[5] min-w-0 border-r border-border bg-card overflow-hidden">
              <LiveFeedPanel />
            </div>
            {/* Reference Comparison */}
            <div className="flex-[2] min-w-0 bg-card overflow-hidden">
              <ReferenceComparison />
            </div>
          </div>

          {/* Bottom bar: Breakdown */}
          <div className="h-36 flex-shrink-0 border-t border-border bg-card overflow-hidden">
            <DefectBreakdown />
          </div>
        </main>

        {/* Defect Log - slide-out panel */}
        <DefectLog open={defectLogOpen} onOpenChange={setDefectLogOpen} />
      </div>
    </div>
  )
}
