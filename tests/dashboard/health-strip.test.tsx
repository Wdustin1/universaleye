import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HealthStrip } from '@/components/dashboard/health-strip'

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: 'ok', camera_available: true }),
  }) as unknown as Response) as unknown as typeof fetch
})

describe('HealthStrip', () => {
  it('renders all six readouts', async () => {
    render(<HealthStrip />)
    expect(await screen.findByText(/camera/i)).toBeInTheDocument()
    expect(screen.getByText(/fps/i)).toBeInTheDocument()
    expect(screen.getByText(/alignment/i)).toBeInTheDocument()
    expect(screen.getByText(/state/i)).toBeInTheDocument()
    expect(screen.getByText(/pipeline/i)).toBeInTheDocument()
    expect(screen.getByText(/defect mix/i)).toBeInTheDocument()
  })

  it('shows "live" when the camera is available', async () => {
    render(<HealthStrip />)
    expect(await screen.findByText('live')).toBeInTheDocument()
  })

  it('shows em-dashes for unknown values', () => {
    render(<HealthStrip />)
    // FPS, alignment placeholder until backend exposes them
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })
})
