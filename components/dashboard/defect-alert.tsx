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

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, X } from "lucide-react"
import { API } from "@/lib/api"

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
  const [connected, setConnected] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 5
  const baseDelay = 1000

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      const es = new EventSource(API.events)
      esRef.current = es

      es.onopen = () => {
        setConnected(true)
        retryCountRef.current = 0
      }

      es.addEventListener("defect", (e) => {
        try {
          const data = JSON.parse(e.data) as DefectEvent
          // Update persistent banner (show latest, accumulate count)
          setActiveAlert(data)
          setAlertCount((c) => c + 1)

          // Trigger flash
          setFlash(true)
          if (flashTimer.current) clearTimeout(flashTimer.current)
          flashTimer.current = setTimeout(() => setFlash(false), 650)
        } catch (err) {
          console.error("Failed to parse SSE defect event:", err)
        }
      })

      es.onerror = () => {
        setConnected(false)
        es.close()
        esRef.current = null

        // Exponential backoff
        if (retryCountRef.current < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCountRef.current)
          retryCountRef.current++
          console.log(`SSE connection lost. Retrying in ${delay}ms (attempt ${retryCountRef.current})`)
          retryTimer = setTimeout(connect, delay)
        } else {
          console.error("SSE max retries exceeded")
        }
      }
    }

    connect()

    return () => {
      esRef.current?.close()
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (retryTimer) clearTimeout(retryTimer)
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
