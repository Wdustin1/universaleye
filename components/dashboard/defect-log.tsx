"use client"

import { useState, useEffect, useMemo } from "react"
import { Filter, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { API } from "@/lib/api"
import { DefectDetail } from "./defect-detail"

interface Defect {
  id: number
  timestamp: string
  type: string
  severity: "critical" | "major" | "minor"
  aiVerdict: "reject" | "accept" | "review"
  ssimScore: number | null
}

const DEFECT_TYPES = [
  "Smudge",
  "Misregister",
  "Hickey",
  "Color Shift",
  "Scratch",
  "Splash/Spot",
  "Missing Print",
  "Web Crease",
]

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString("en-GB")
  } catch {
    return iso
  }
}

export function DefectLog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [defects, setDefects] = useState<Defect[]>([])
  const [selectedDefect, setSelectedDefect] = useState<number | null>(null)
  const [filterType, setFilterType] = useState<string>("All")

  const filteredDefects = useMemo(
    () => filterType === "All" ? defects : defects.filter((d) => d.type === filterType),
    [defects, filterType]
  )

  const selectedDefectData = useMemo(
    () => defects.find((d) => d.id === selectedDefect) ?? null,
    [defects, selectedDefect]
  )

  // Fetch defects when panel opens, poll every 3s
  useEffect(() => {
    if (!open) return
    const fetchDefects = async () => {
      try {
        const res = await fetch(API.defects)
        if (res.ok) {
          const data = await res.json()
          setDefects(data)
        }
      } catch { /* backend not available */ }
    }
    fetchDefects()
    const interval = setInterval(fetchDefects, 3000)
    return () => clearInterval(interval)
  }, [open])

  // SSE for real-time defect notifications
  useEffect(() => {
    const source = new EventSource(API.events)
    source.addEventListener("defect", (e) => {
      try {
        const newDefect = JSON.parse(e.data) as Defect
        setDefects((prev) => {
          if (prev.some((d) => d.id === newDefect.id)) return prev
          return [newDefect, ...prev]
        })
      } catch { /* parse error */ }
    })
    return () => source.close()
  }, [])

  // Escape key to close (only when detail modal is not open)
  useEffect(() => {
    if (!open || selectedDefect !== null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onOpenChange, selectedDefect])

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-card border-l border-border shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
              Defect History
            </h2>
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground px-2">
                    <Filter className="w-3 h-3" />
                    {filterType}
                    <ChevronDown className="w-2.5 h-2.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFilterType("All")}>
                    All Types
                  </DropdownMenuItem>
                  {DEFECT_TYPES.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => setFilterType(type)}>
                      {type}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-[10px] font-mono text-muted-foreground">
                {filteredDefects.length}
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="ml-1 p-1 rounded hover:bg-secondary transition-colors"
                aria-label="Close defect history"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredDefects.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground">No defects recorded</p>
              </div>
            ) : (
              filteredDefects.map((defect) => (
                <button
                  key={defect.id}
                  type="button"
                  onClick={() => setSelectedDefect(defect.id)}
                  className={`w-full flex items-center gap-3 py-2.5 pr-3 border-b border-border transition-colors text-left ${
                    selectedDefect === defect.id
                      ? "bg-accent border-l-2 border-l-primary pl-2.5"
                      : "hover:bg-secondary border-l-2 border-l-transparent pl-2.5"
                  }`}
                >
                  <div className="w-10 h-10 rounded overflow-hidden border border-border flex-shrink-0 bg-background">
                    <img
                      src={API.defectImage(defect.id)}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">#{defect.id}</span>
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
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium ml-auto ${
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{defect.type}</span>
                      <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                        {formatTime(defect.timestamp)}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Summary footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
            <span>{defects.filter((d) => d.severity === "critical").length} critical</span>
            <span>{defects.filter((d) => d.aiVerdict === "reject").length} rejected</span>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selectedDefectData && (
        <DefectDetail
          defect={selectedDefectData}
          onClose={() => setSelectedDefect(null)}
        />
      )}
    </>
  )
}
