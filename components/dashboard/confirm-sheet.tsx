"use client"

import { useHoldToConfirm } from "@/lib/use-hold-to-confirm"

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { progress, isHolding, bind } = useHoldToConfirm({ onConfirm, holdMs: 800 })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative bg-card border border-border-strong rounded-xl p-5 w-[460px] max-w-[90vw] shadow-2xl">
        <h4 className="text-base font-semibold mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{body}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 px-3.5 rounded-md bg-sunken hover:bg-lifted border border-border-soft text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            {...bind}
            aria-label={`Hold to ${confirmLabel.toLowerCase()}`}
            className="flex-1 h-11 px-3.5 rounded-md text-sm font-semibold text-white relative overflow-hidden bg-destructive/60 hover:bg-destructive/70"
          >
            <span className="relative z-10">
              {isHolding ? `Hold… ${(progress * 0.8).toFixed(1)}s` : `Hold to ${confirmLabel.toLowerCase()}`}
            </span>
            <div
              className="absolute inset-y-0 left-0 bg-destructive transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
