"use client"

import { useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { API } from "@/lib/api"
import { useFocusTrap } from "@/hooks/use-focus-trap"

interface Defect {
  id: number
  timestamp: string
  type: string
  severity: "critical" | "major" | "minor"
  aiVerdict: "reject" | "accept" | "review"
  ssimScore: number | null
}

interface DefectDetailProps {
  defect: Defect
  onClose: () => void
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return iso
  }
}

export function DefectDetail({ defect, onClose }: DefectDetailProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const containerRef = useFocusTrap(true)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="defect-detail-title">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div 
        ref={containerRef}
        className="relative z-10 w-[90vw] max-w-4xl max-h-[85vh] bg-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <span id="defect-detail-title" className="text-sm font-medium text-foreground">
              Defect #{defect.id}
            </span>
            <span className="text-xs text-muted-foreground">{defect.type}</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                defect.severity === "critical"
                  ? "bg-destructive/10 text-destructive"
                  : defect.severity === "major"
                    ? "bg-warning/10 text-warning"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              {defect.severity}
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                defect.aiVerdict === "reject"
                  ? "bg-destructive/10 text-destructive"
                  : defect.aiVerdict === "accept"
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning"
              }`}
            >
              {defect.aiVerdict}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
            aria-label="Close detail view"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Image */}
        <div className="flex-1 min-h-0 bg-background flex items-center justify-center overflow-auto p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={API.defectImage(defect.id)}
            alt={`Defect #${defect.id} — ${defect.type}`}
            className="max-w-full max-h-full object-contain rounded"
            draggable={false}
          />
        </div>

        {/* Footer metadata */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border flex-shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {formatTimestamp(defect.timestamp)}
          </span>
          {defect.ssimScore !== null && (
            <span className="text-[10px] font-mono text-muted-foreground">
              SSIM {(defect.ssimScore * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
