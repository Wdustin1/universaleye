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

// Module-level broker: multiple useSSE callers on the same URL share one
// EventSource. Previously every component that subscribed to /api/events opened
// its own connection, which doubled reconnect traffic whenever the backend was
// down (DefectLog + DefectAlertOverlay both logged every retry).
interface SSEBroker {
  source: EventSource | null
  retryCount: number
  retryTimer: ReturnType<typeof setTimeout> | null
  // name → handlers. Broker attaches exactly one addEventListener per name.
  namedHandlers: Map<string, Set<SSEHandler>>
  messageHandlers: Set<SSEHandler>
  // Names we've already bound on the live EventSource (reset on reconnect).
  boundNames: Set<string>
}

const brokers = new Map<string, SSEBroker>()
const SSE_MAX_RETRIES = 5
const SSE_BASE_DELAY = 1000

function getBroker(url: string): SSEBroker {
  let b = brokers.get(url)
  if (!b) {
    b = {
      source: null,
      retryCount: 0,
      retryTimer: null,
      namedHandlers: new Map(),
      messageHandlers: new Set(),
      boundNames: new Set(),
    }
    brokers.set(url, b)
  }
  return b
}

function bindListeners(url: string, b: SSEBroker) {
  const src = b.source
  if (!src) return
  src.onmessage = (event) => {
    b.messageHandlers.forEach((h) => h(event.data))
  }
  for (const name of b.namedHandlers.keys()) {
    if (b.boundNames.has(name)) continue
    src.addEventListener(name, (e) => {
      b.namedHandlers.get(name)?.forEach((h) => h((e as MessageEvent).data))
    })
    b.boundNames.add(name)
  }
}

function connectSSE(url: string, b: SSEBroker) {
  b.source?.close()
  b.boundNames = new Set()
  const src = new EventSource(url)
  b.source = src
  src.onopen = () => { b.retryCount = 0 }
  src.onerror = () => {
    src.close()
    b.source = null
    if (b.namedHandlers.size === 0 && b.messageHandlers.size === 0) return
    if (b.retryCount < SSE_MAX_RETRIES) {
      const delay = SSE_BASE_DELAY * Math.pow(2, b.retryCount)
      b.retryCount++
      console.log(`SSE connection lost. Retrying in ${delay}ms (attempt ${b.retryCount})`)
      b.retryTimer = setTimeout(() => {
        if (b.namedHandlers.size > 0 || b.messageHandlers.size > 0) {
          connectSSE(url, b)
        }
      }, delay)
    } else {
      console.error("SSE max retries exceeded")
    }
  }
  bindListeners(url, b)
}

function subscribeSSE(
  url: string,
  events: Record<string, SSEHandler> | undefined,
  onMessage: SSEHandler | undefined,
): () => void {
  const b = getBroker(url)
  const added: Array<[string, SSEHandler]> = []
  if (events) {
    for (const [name, handler] of Object.entries(events)) {
      let set = b.namedHandlers.get(name)
      if (!set) { set = new Set(); b.namedHandlers.set(name, set) }
      set.add(handler)
      added.push([name, handler])
    }
  }
  if (onMessage) b.messageHandlers.add(onMessage)

  if (!b.source) {
    connectSSE(url, b)
  } else {
    // New event names may need binding on the already-open source.
    bindListeners(url, b)
  }

  return () => {
    for (const [name, handler] of added) {
      const set = b.namedHandlers.get(name)
      set?.delete(handler)
      if (set && set.size === 0) b.namedHandlers.delete(name)
    }
    if (onMessage) b.messageHandlers.delete(onMessage)
    if (b.namedHandlers.size === 0 && b.messageHandlers.size === 0) {
      b.source?.close()
      b.source = null
      if (b.retryTimer) { clearTimeout(b.retryTimer); b.retryTimer = null }
      b.retryCount = 0
      b.boundNames = new Set()
      brokers.delete(url)
    }
  }
}

/**
 * Hook for SSE connections with exponential backoff retry. Multiple callers
 * subscribing to the same URL share one underlying EventSource.
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
  // Stash handlers in refs so the subscribe effect doesn't resubscribe on
  // every parent render when callers pass fresh object/function references.
  const eventsRef = useRef(events)
  const onMessageRef = useRef(onMessage)
  useEffect(() => { eventsRef.current = events }, [events])
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

  useEffect(() => {
    if (!enabled) return
    // Build wrapper handlers that always defer to the latest refs. Event
    // names are snapshotted from first mount; callers are expected to declare
    // every name they care about up front.
    const initialEvents = eventsRef.current
    const wrapperEvents: Record<string, SSEHandler> | undefined = initialEvents
      ? Object.fromEntries(
          Object.keys(initialEvents).map((name) => [
            name,
            (data: string) => eventsRef.current?.[name]?.(data),
          ]),
        )
      : undefined
    const wrapperMessage = onMessageRef.current
      ? (data: string) => onMessageRef.current?.(data)
      : undefined
    return subscribeSSE(url, wrapperEvents, wrapperMessage)
  }, [url, enabled])
}
