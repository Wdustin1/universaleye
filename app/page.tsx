import { DashboardHeader } from "@/components/dashboard/header"
import { StatsBar } from "@/components/dashboard/stats-bar"
import { LiveFeedPanel } from "@/components/dashboard/live-feed"
import { ReferenceComparison } from "@/components/dashboard/reference-comparison"
import { DefectLog } from "@/components/dashboard/defect-log"
import { DefectTimeline } from "@/components/dashboard/defect-timeline"
import { InspectionControls } from "@/components/dashboard/inspection-controls"
import { DefectBreakdown } from "@/components/dashboard/defect-breakdown"

export default function Page() {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <DashboardHeader />

      {/* Stats Bar */}
      <StatsBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Controls */}
        <aside className="w-56 flex-shrink-0 border-r border-border bg-card overflow-y-auto">
          <InspectionControls />
        </aside>

        {/* Center: Main viewport */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Live feed and reference */}
          <div className="flex-1 flex overflow-hidden">
            {/* Live Feed - takes majority of space */}
            <div className="flex-[3] border-r border-border bg-card">
              <LiveFeedPanel />
            </div>
            {/* Reference Comparison */}
            <div className="flex-[2] bg-card">
              <ReferenceComparison />
            </div>
          </div>

          {/* Bottom bar: Timeline and Breakdown */}
          <div className="h-36 flex border-t border-border">
            <div className="flex-[3] border-r border-border bg-card">
              <DefectTimeline />
            </div>
            <div className="flex-[2] bg-card">
              <DefectBreakdown />
            </div>
          </div>
        </main>

        {/* Right Column: Defect Log */}
        <aside className="w-72 flex-shrink-0 border-l border-border bg-card overflow-hidden">
          <DefectLog />
        </aside>
      </div>
    </div>
  )
}
