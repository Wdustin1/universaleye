"use client"

import { useState, useEffect } from "react"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API } from "@/lib/api"

export function ReferenceComparison() {
  const [activeTab, setActiveTab] = useState<"overlay" | "side-by-side">("side-by-side")
  const [captureKey, setCaptureKey] = useState(0)

  // Refresh current capture image periodically
  useEffect(() => {
    const interval = setInterval(() => setCaptureKey((k) => k + 1), 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
          Reference Comparison
        </h2>
        <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
          <button
            onClick={() => setActiveTab("side-by-side")}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              activeTab === "side-by-side"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setActiveTab("overlay")}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              activeTab === "overlay"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Overlay
          </button>
        </div>
      </div>

      <div className="flex-1 p-3">
        {activeTab === "side-by-side" ? (
          <div className="flex flex-col gap-2 h-full">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Reference (Golden Master)
                </span>
              </div>
              <div className="flex-1 rounded-md border border-border overflow-hidden bg-background flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={API.referenceImage}
                  alt="Reference golden master label"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Current Capture
                </span>
              </div>
              <div className="flex-1 rounded-md border border-destructive/30 overflow-hidden bg-background flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API.currentCapture}?t=${captureKey}`}
                  alt="Current label capture"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Overlay Comparison
              </span>
            </div>
            <div className="flex-1 rounded-md border border-border overflow-hidden bg-background flex items-center justify-center">
              <p className="text-xs text-muted-foreground">
                Overlay mode highlights pixel differences between reference and current label
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-destructive/[0.03]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Verdict</span>
          <span className="text-[10px] font-semibold text-destructive flex items-center gap-1 bg-destructive/10 px-2 py-0.5 rounded">
            <X className="w-3 h-3" />
            Reject
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-success gap-1 px-2 hover:bg-success/10"
          >
            <Check className="w-3 h-3" />
            Accept
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-destructive gap-1 px-2 hover:bg-destructive/10"
          >
            <X className="w-3 h-3" />
            Confirm
          </Button>
        </div>
      </div>
    </div>
  )
}
