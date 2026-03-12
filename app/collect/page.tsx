"use client"

/**
 * /collect — Training Data Labeling
 *
 * Operators (or you) come here after a collection run to label captured
 * label frames as "good" or "bad".  Labeled frames become the training
 * dataset for the Tier 2 ML classifier.
 *
 * Keyboard shortcuts: G = good, B = bad, Space = skip to next
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Trash2, RefreshCw } from "lucide-react"
import { API } from "@/lib/api"
import { ErrorBoundary } from "@/components/error-boundary"

/**
 * Validates that a value is a safe integer for use in URLs.
 * Prevents XSS via path traversal or malicious IDs.
 */
function validateFrameId(id: unknown): number | null {
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1 || id > Number.MAX_SAFE_INTEGER) {
    return null
  }
  return id
}

interface CollectedFrame {
  id: number
  timestamp: string
  imagePath: string | null
  label: "good" | "bad" | null
}

interface CollectionStats {
  total: number
  good: number
  bad: number
  unlabeled: number
  collecting: boolean
}

type FilterMode = "all" | "unlabeled" | "good" | "bad"

const FILTER_OPTS: { key: FilterMode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unlabeled", label: "Unlabeled" },
  { key: "good", label: "Good" },
  { key: "bad", label: "Bad" },
]

const PAGE_SIZE = 24

export default function CollectPage() {
  const [frames, setFrames] = useState<CollectedFrame[]>([])
  const [stats, setStats] = useState<CollectionStats | null>(null)
  const [filter, setFilter] = useState<FilterMode>("unlabeled")
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const pendingLabel = useRef<Record<number, string>>({})

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(API.collectionStats)
      if (res.ok) setStats(await res.json())
    } catch { /* offline */ }
  }, [])

  const fetchFrames = useCallback(async (f: FilterMode, o: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(o),
        ...(f !== "all" ? { label: f } : {}),
      })
      const res = await fetch(`${API.collectionFrames}?${params}`)
      if (res.ok) {
        const data: CollectedFrame[] = await res.json()
        setFrames(data)
        // Estimate total from what we got (backend doesn't paginate-count yet)
        if (data.length === PAGE_SIZE) {
          setTotal(o + PAGE_SIZE + 1) // at least one more page
        } else {
          setTotal(o + data.length)
        }
      }
    } catch { /* offline */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()
    fetchFrames(filter, offset)
  }, [filter, offset, fetchStats, fetchFrames])

  const applyLabel = useCallback(
    async (frameId: number, label: "good" | "bad" | null) => {
      // Optimistic update
      setFrames((prev) =>
        prev.map((f) => (f.id === frameId ? { ...f, label } : f))
      )
      try {
        await fetch(API.collectionFrameLabel(frameId), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label }),
        })
      } catch { /* offline */ }
      fetchStats()
    },
    [fetchStats]
  )

  // Keyboard shortcuts when a frame is selected
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selected === null) return
      if (e.key === "g" || e.key === "G") applyLabel(selected, "good")
      if (e.key === "b" || e.key === "B") applyLabel(selected, "bad")
      if (e.key === " ") {
        e.preventDefault()
        const idx = frames.findIndex((f) => f.id === selected)
        const next = frames[idx + 1]
        if (next) setSelected(next.id)
      }
      if (e.key === "Escape") setSelected(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected, frames, applyLabel])

  const handleClear = async () => {
    if (!confirm("Delete all collected frames? This cannot be undone.")) return
    try {
      await fetch(API.collectionClear, { method: "DELETE" })
      setFrames([])
      setStats(null)
      fetchStats()
    } catch { /* offline */ }
  }

  const hasPrev = offset > 0
  const hasNext = frames.length === PAGE_SIZE

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Training Data — Label Frames</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Press <kbd className="px-1 py-0.5 rounded bg-secondary text-xs font-mono">G</kbd> good ·{" "}
              <kbd className="px-1 py-0.5 rounded bg-secondary text-xs font-mono">B</kbd> bad ·{" "}
              <kbd className="px-1 py-0.5 rounded bg-secondary text-xs font-mono">Space</kbd> next
            </p>
          </div>

        {/* Stats pill row */}
        {stats && (
          <div className="flex items-center gap-3 text-xs">
            <span className="px-2 py-1 rounded-full bg-secondary text-muted-foreground">
              {stats.total} total
            </span>
            <span className="px-2 py-1 rounded-full bg-success/15 text-success font-medium">
              {stats.good} good
            </span>
            <span className="px-2 py-1 rounded-full bg-destructive/15 text-destructive font-medium">
              {stats.bad} bad
            </span>
            <span className="px-2 py-1 rounded-full bg-warning/15 text-warning font-medium">
              {stats.unlabeled} unlabeled
            </span>
            {stats.collecting && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Collecting
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { fetchStats(); fetchFrames(filter, offset) }}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="p-2 rounded-lg hover:bg-destructive/15 transition-colors text-muted-foreground hover:text-destructive"
            title="Clear all frames"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-border bg-card px-6 flex gap-1 pt-2">
        {FILTER_OPTS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => { setFilter(opt.key); setOffset(0) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
              filter === opt.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
            {stats && opt.key !== "all" && (
              <span className="ml-1.5 text-[10px] opacity-70">
                ({opt.key === "unlabeled" ? stats.unlabeled : stats[opt.key as "good" | "bad"]})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Frame grid */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : frames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <p className="text-sm">No frames yet.</p>
            <p className="text-xs">
              Enable <strong>Collect Frames</strong> in the controls panel while an inspection is running.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 lg:grid-cols-6 xl:grid-cols-8">
            {frames.map((frame) => {
              const safeId = validateFrameId(frame.id)
              if (safeId === null) return null
              return (
                <div
                  key={frame.id}
                  onClick={() => setSelected(selected === frame.id ? null : frame.id)}
                  className={`group relative rounded-lg overflow-hidden border cursor-pointer transition-all ${
                    selected === frame.id
                      ? "border-primary ring-1 ring-primary"
                      : frame.label === "good"
                        ? "border-success/50"
                        : frame.label === "bad"
                          ? "border-destructive/50"
                          : "border-border hover:border-accent-foreground/30"
                  }`}
                >
                  {/* Thumbnail */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={API.collectionFrameImage(safeId)}
                    alt={`Frame ${safeId} captured at ${frame.timestamp.slice(0, 19).replace("T", " ")}`}
                    className="w-full aspect-video object-cover bg-muted"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90' viewBox='0 0 160 90'%3E%3Crect fill='%23333' width='160' height='90'/%3E%3Ctext fill='%23666' font-family='sans-serif' font-size='12' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage unavailable%3C/text%3E%3C/svg%3E"
                    }}
                  />

                {/* Label badge */}
                {frame.label && (
                  <div
                    className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                      frame.label === "good"
                        ? "bg-success text-white"
                        : "bg-destructive text-white"
                    }`}
                  >
                    {frame.label}
                  </div>
                )}

                {/* Frame ID */}
                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-black/60 text-[9px] font-mono text-white/70">
                  #{frame.id} · {frame.timestamp.slice(11, 19)}
                </div>

                {/* Quick-label buttons on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); applyLabel(frame.id, "good") }}
                    title="Mark Good (G)"
                    className="p-1.5 rounded-lg bg-success/90 hover:bg-success text-white transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); applyLabel(frame.id, "bad") }}
                    title="Mark Bad (B)"
                    className="p-1.5 rounded-lg bg-destructive/90 hover:bg-destructive text-white transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}

        {/* Pagination */}
        {(hasPrev || hasNext) && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-secondary-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <span className="text-xs text-muted-foreground">
              {offset + 1}–{offset + frames.length}
            </span>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-secondary-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  )
}
