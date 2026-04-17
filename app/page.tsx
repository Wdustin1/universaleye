"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { TopStrip } from "@/components/dashboard/top-strip"
import { HealthStrip } from "@/components/dashboard/health-strip"
import { LiveFeedPanel } from "@/components/dashboard/live-feed"
import { GoldenReference } from "@/components/dashboard/golden-reference"
import { LastDefect } from "@/components/dashboard/last-defect"
import { DefectDetail } from "@/components/dashboard/defect-detail"
import { DefectLog } from "@/components/dashboard/defect-log"
import { InspectionControls } from "@/components/dashboard/inspection-controls"
import { DefectAlertOverlay } from "@/components/dashboard/defect-alert"
import { SettingsSheet } from "@/components/dashboard/settings-sheet"
import { ErrorBoundary } from "@/components/error-boundary"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

export default function Page() {
  const [defectLogOpen, setDefectLogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [stats, setStats] = useState({ labelsInspected: 0, defectsFound: 0, runTime: "00:00:00", status: "stopped" as "running" | "paused" | "stopped" })
  const [hasReference, setHasReference] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [selectedDefectId, setSelectedDefectId] = useState<number | null>(null)
  const [selectedDefect, setSelectedDefect] = useState<{ id: number; type: string; severity: "critical" | "major" | "minor"; timestamp: string; ssimScore: number | null; aiVerdict: "reject" | "accept" | "review" } | null>(null)
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
        setInitialLoaded(true)
      }
    } catch { /* backend not available */ }
  }, [])
  usePolling(pollStats, 2000, true)

  /* eslint-disable react-hooks/set-state-in-effect -- syncing selected defect to the id, which is an external-like input */
  useEffect(() => {
    if (selectedDefectId === null) {
      setSelectedDefect(null)
      return
    }
    apiFetch(`${API.defects}?limit=200`).then(async (r) => {
      if (!r.ok) return
      const list = await r.json()
      const found = list.find((d: { id: number }) => d.id === selectedDefectId)
      if (found) setSelectedDefect(found)
    }).catch(() => {})
  }, [selectedDefectId])
  /* eslint-enable react-hooks/set-state-in-effect */

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
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenLog={() => setDefectLogOpen(true)}
          onToggleFullscreen={toggleFullscreen}
          loading={!initialLoaded}
        />
      </ErrorBoundary>

      <div className="grid gap-2.5 min-h-0" style={{ gridTemplateColumns: "110px 1fr 280px" }}>
        <ErrorBoundary>
          <InspectionControls hasReference={hasReference} status={stats.status} />
        </ErrorBoundary>
        <ErrorBoundary>
          <LiveFeedPanel hasReference={hasReference} defectCount={stats.defectsFound} onReferenceSet={() => setHasReference(true)} />
        </ErrorBoundary>
        <div className="flex flex-col gap-2.5 min-h-0">
          <ErrorBoundary>
            <GoldenReference />
          </ErrorBoundary>
          <ErrorBoundary>
            <LastDefect onSelect={setSelectedDefectId} />
          </ErrorBoundary>
        </div>
      </div>

      <ErrorBoundary>
        <HealthStrip />
      </ErrorBoundary>

      <ErrorBoundary>
        <DefectLog open={defectLogOpen} onOpenChange={setDefectLogOpen} />
      </ErrorBoundary>

      <ErrorBoundary>
        <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} onOpenLog={() => setDefectLogOpen(true)} />
      </ErrorBoundary>

      {selectedDefect && (
        <DefectDetail defect={selectedDefect} onClose={() => setSelectedDefectId(null)} />
      )}
    </div>
  )
}
