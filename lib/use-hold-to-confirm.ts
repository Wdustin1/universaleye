import { useCallback, useEffect, useRef, useState } from "react"

export function useHoldToConfirm({ onConfirm, holdMs }: { onConfirm: () => void; holdMs: number }) {
  const [progress, setProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const startedAt = useRef<number | null>(null)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)
  const fire = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    setIsHolding(false)
    setProgress(0)
    startedAt.current = null
    if (tick.current) { clearInterval(tick.current); tick.current = null }
    if (fire.current) { clearTimeout(fire.current); fire.current = null }
  }, [])

  const start = useCallback(() => {
    if (startedAt.current !== null) return
    setIsHolding(true)
    startedAt.current = Date.now()
    tick.current = setInterval(() => {
      const elapsed = Date.now() - (startedAt.current ?? 0)
      setProgress(Math.min(1, elapsed / holdMs))
    }, 16)
    fire.current = setTimeout(() => {
      onConfirm()
      stop()
    }, holdMs)
  }, [holdMs, onConfirm, stop])

  useEffect(() => () => stop(), [stop])

  return {
    progress,
    isHolding,
    bind: {
      onMouseDown: start,
      onMouseUp: stop,
      onMouseLeave: stop,
      onTouchStart: start,
      onTouchEnd: stop,
      onTouchCancel: stop,
    },
  }
}
