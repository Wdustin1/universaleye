"use client"

/**
 * DefectAlertOverlay
 *
 * Listens to the backend SSE stream and fires two visual alerts when a
 * defect is detected:
 *   1. A full-viewport red flash (600 ms, CSS animation)
 *   2. A persistent banner at the top of the screen with defect details
 *
 * The banner accumulates counts if multiple defects arrive before the
 * operator dismisses it.  The SSE connection auto-reconnects on drop.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, X } from "lucide-react"
import { API } from "@/lib/api"
import { useSSE } from "@/hooks/use-polling"

interface DefectEvent {
  id: number
  timestamp: string
  type: string
  severity: "critical" | "major" | "minor"
  aiVerdict: string
  ssimScore: number | null
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-700 border-red-500",
  major: "bg-destructive border-red-400",
  minor: "bg-orange-600 border-orange-400",
}

export function DefectAlertOverlay() {
  const [flash, setFlash] = useState(false)
  const [activeAlert, setActiveAlert] = useState<DefectEvent | null>(null)
  const [alertCount, setAlertCount] = useState(0)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onDefectEvent = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw) as DefectEvent
      setActiveAlert(data)
      setAlertCount((c) => c + 1)

      setFlash(true)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlash(false), 650)
    } catch (err) {
      console.error("Failed to parse SSE defect event:", err)
    }
  }, [])
  useSSE(API.events, { events: { defect: onDefectEvent } })

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

  const dismiss = () => {
    setActiveAlert(null)
    setAlertCount(0)
  }

  const severityBg = activeAlert
    ? (SEVERITY_COLOR[activeAlert.severity] ?? SEVERITY_COLOR.major)
    : ""

  return (
    <>
      {/* Full-viewport red flash */}
      {flash && (
        <div
          className="fixed inset-0 z-[60] pointer-events-none"
          style={{
            background: "hsl(0 72% 45% / 0.5)",
            animation: "defect-flash 650ms ease-out forwards",
          }}
        />
      )}

      {/* Persistent alert banner — sits above everything except flash */}
      {activeAlert && (
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className={`fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3
            border-b text-white shadow-xl ${severityBg}`}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-pulse" />

          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold uppercase tracking-wide">
              Defect Detected
            </span>
            <span className="opacity-60 text-xs">·</span>
            <span className="text-sm font-medium">{activeAlert.type}</span>
            <span className="opacity-60 text-xs">·</span>
            <span className="text-sm capitalize font-medium">
              {activeAlert.severity}
            </span>
            {activeAlert.ssimScore != null && (
              <>
                <span className="opacity-60 text-xs">·</span>
                <span className="text-xs font-mono opacity-80">
                  SSIM {activeAlert.ssimScore.toFixed(3)}
                </span>
              </>
            )}
            {alertCount > 1 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold">
                +{alertCount - 1} more
              </span>
            )}
          </div>

          <span className="text-xs opacity-70 font-mono flex-shrink-0">
            {activeAlert.timestamp}
          </span>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss alert"
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  )
}
