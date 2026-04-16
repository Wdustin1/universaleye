import { useCallback, useEffect, useRef } from "react"

/**
 * Custom hook for polling an API endpoint with proper cleanup.
 * Handles AbortController to prevent memory leaks from pending fetches.
 */
export function usePolling(
  fetchFn: () => Promise<void>,
  intervalMs: number,
  enabled: boolean = true
) {
  const abortControllerRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)

  const poll = useCallback(async () => {
    // Cancel any pending request from previous poll
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    try {
      await fetchFn()
    } catch (err) {
      // Ignore abort errors - they're expected when cancelling
      if (err instanceof Error && err.name === "AbortError") return
      console.error("Polling error:", err)
    }
  }, [fetchFn])

  useEffect(() => {
    isMountedRef.current = true

    if (!enabled) return

    // Initial fetch
    poll()

    // Set up interval
    intervalRef.current = setInterval(poll, intervalMs)

    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [poll, intervalMs, enabled])

  return { poll }
}

type SSEHandler = (data: string) => void

/**
 * Hook for SSE connections with exponential backoff retry.
 *
 * Pass `events` to subscribe to named events (the backend uses `event: defect`
 * and `event: ping`). Pass `onMessage` for unnamed `data:` lines.
 */
export function useSSE(
  url: string,
  options: {
    events?: Record<string, SSEHandler>
    onMessage?: SSEHandler
    enabled?: boolean
  } = {}
) {
  const { events, onMessage, enabled = true } = options
  // Stash handlers in refs so the connect callback doesn't have to depend on
  // them (which would tear down and reconnect on every parent render).
  const eventsRef = useRef(events)
  const onMessageRef = useRef(onMessage)
  useEffect(() => { eventsRef.current = events }, [events])
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

  const sourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Holds the current `connect` function so the onerror handler can reschedule
  // itself without forming an illegal self-reference inside useCallback.
  const connectRef = useRef<() => void>(() => {})
  const maxRetries = 5
  const baseDelay = 1000

  const connect = useCallback(() => {
    if (!enabled) return

    sourceRef.current?.close()

    const source = new EventSource(url)
    sourceRef.current = source

    source.onopen = () => {
      retryCountRef.current = 0
    }

    source.onerror = () => {
      source.close()
      sourceRef.current = null

      if (retryCountRef.current < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCountRef.current)
        retryCountRef.current++
        console.log(`SSE connection lost. Retrying in ${delay}ms (attempt ${retryCountRef.current})`)
        retryTimerRef.current = setTimeout(() => connectRef.current(), delay)
      } else {
        console.error("SSE max retries exceeded")
      }
    }

    if (onMessageRef.current) {
      source.onmessage = (event) => onMessageRef.current?.(event.data)
    }
    if (eventsRef.current) {
      for (const [name, handler] of Object.entries(eventsRef.current)) {
        source.addEventListener(name, (e) => handler((e as MessageEvent).data))
      }
    }
  }, [url, enabled])

  useEffect(() => {
    connectRef.current = connect
    connect()

    return () => {
      sourceRef.current?.close()
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
    }
  }, [connect])

  return sourceRef
}
