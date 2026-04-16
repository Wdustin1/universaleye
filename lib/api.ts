/**
 * Backend API configuration.
 * In development, the Python backend runs on port 8000.
 */

/**
 * Validates that a URL is safe for use in the frontend.
 * Ensures it uses http/https protocol and has a valid hostname.
 */
function validateApiUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      console.warn(`Invalid API URL protocol: ${parsed.protocol}. Defaulting to http://localhost:8000`)
      return "http://localhost:8000"
    }
    return url
  } catch {
    console.warn(`Invalid API URL: ${url}. Defaulting to http://localhost:8000`)
    return "http://localhost:8000"
  }
}

const API_BASE = validateApiUrl(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")

/**
 * Fetch with a request timeout. Default 5s — long enough for a healthy backend,
 * short enough that a hung backend doesn't pin requests open forever.
 *
 * If the caller passes their own `signal`, we still apply the timeout via
 * AbortSignal.any() so existing AbortController flows keep working.
 */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const signal = init.signal
    // AbortSignal.any merges multiple signals; falls back to timeout-only when none was supplied.
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal
  return fetch(input, { ...init, signal })
}

export const API = {
  videoFeed: `${API_BASE}/video_feed`,
  referenceImage: `${API_BASE}/api/reference_image`,
  currentCapture: `${API_BASE}/api/current_capture`,
  stats: `${API_BASE}/api/stats`,
  defects: `${API_BASE}/api/defects`,
  defectImage: (id: number) => `${API_BASE}/api/defects/${id}/image`,
  defectBreakdown: `${API_BASE}/api/defect_breakdown`,
  inspectionStart: `${API_BASE}/api/inspection/start`,
  inspectionPause: `${API_BASE}/api/inspection/pause`,
  inspectionStop: `${API_BASE}/api/inspection/stop`,
  sensitivity: `${API_BASE}/api/inspection/sensitivity`,
  setReference: `${API_BASE}/api/set_reference`,
  resetReference: `${API_BASE}/api/reset_reference`,
  events: `${API_BASE}/api/events`,
  health: `${API_BASE}/api/health`,
  // Data collection
  collectionStart: `${API_BASE}/api/collection/start`,
  collectionStop: `${API_BASE}/api/collection/stop`,
  collectionStats: `${API_BASE}/api/collection/stats`,
  collectionFrames: `${API_BASE}/api/collection/frames`,
  collectionFrameImage: (id: number) => `${API_BASE}/api/collection/frames/${id}/image`,
  collectionFrameLabel: (id: number) => `${API_BASE}/api/collection/frames/${id}/label`,
  collectionClear: `${API_BASE}/api/collection/clear`,
} as const
