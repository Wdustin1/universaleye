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

/**
 * Hook for SSE connections with exponential backoff retry.
 */
export function useSSE(
  url: string,
  onMessage: (data: string) => void,
  enabled: boolean = true
) {
  const sourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxRetries = 5
  const baseDelay = 1000

  const connect = useCallback(() => {
    if (!enabled) return

    // Clean up existing connection
    sourceRef.current?.close()

    const source = new EventSource(url)
    sourceRef.current = source

    source.onopen = () => {
      retryCountRef.current = 0
    }

    source.onerror = () => {
      source.close()
      sourceRef.current = null

      // Exponential backoff
      if (retryCountRef.current < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCountRef.current)
        retryCountRef.current++
        console.log(`SSE connection lost. Retrying in ${delay}ms (attempt ${retryCountRef.current})`)
        retryTimerRef.current = setTimeout(connect, delay)
      } else {
        console.error("SSE max retries exceeded")
      }
    }

    // Handle messages generically - components can add specific listeners
    source.onmessage = (event) => {
      onMessage(event.data)
    }
  }, [url, onMessage, enabled])

  useEffect(() => {
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
