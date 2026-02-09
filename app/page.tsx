"use client"

import { useState } from "react"
import { DashboardHeader } from "@/components/dashboard/header"
import { StatsBar } from "@/components/dashboard/stats-bar"
import { LiveFeedPanel } from "@/components/dashboard/live-feed"
import { ReferenceComparison } from "@/components/dashboard/reference-comparison"
import { DefectLog } from "@/components/dashboard/defect-log"
import { InspectionControls } from "@/components/dashboard/inspection-controls"
import { DefectBreakdown } from "@/components/dashboard/defect-breakdown"

export default function Page() {
  const [defectLogOpen, setDefectLogOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <DashboardHeader
        defectCount={10}
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
