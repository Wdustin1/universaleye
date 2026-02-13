/**
 * Backend API configuration.
 * In development, the Python backend runs on port 8000.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
} as const
