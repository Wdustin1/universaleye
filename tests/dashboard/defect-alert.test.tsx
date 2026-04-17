import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DefectAlertOverlay } from '@/components/dashboard/defect-alert'

class FakeEventSource {
  public readyState = 1
  public onopen: (() => void) | null = null
  public onerror: (() => void) | null = null
  private listeners: Record<string, ((e: MessageEvent) => void)[]> = {}
  constructor(public url: string) { (FakeEventSource as unknown as { latest: FakeEventSource }).latest = this }
  addEventListener(name: string, cb: (e: MessageEvent) => void) {
    this.listeners[name] ??= []
    this.listeners[name].push(cb)
  }
  emit(name: string, data: unknown) {
    (this.listeners[name] ?? []).forEach((cb) => cb({ data: JSON.stringify(data) } as MessageEvent))
  }
  close() {}
}

beforeEach(() => {
  vi.stubGlobal('EventSource', FakeEventSource)
  vi.useFakeTimers()
})

describe('DefectAlertOverlay', () => {
  it('renders nothing when no defect has arrived', () => {
    render(<DefectAlertOverlay />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a critical alert card when a critical defect event arrives', async () => {
    render(<DefectAlertOverlay />)
    const es = (FakeEventSource as unknown as { latest: FakeEventSource }).latest
    act(() => {
      es.emit('defect', { id: 1, type: 'Hickey', severity: 'critical', timestamp: '2026-04-16T14:32:07', ssimScore: 0.42, aiVerdict: 'reject' })
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/hickey/i)).toBeInTheDocument()
    expect(screen.getByText(/critical/i)).toBeInTheDocument()
  })

  it('auto-dismisses after 5s for critical/major', async () => {
    render(<DefectAlertOverlay />)
    const es = (FakeEventSource as unknown as { latest: FakeEventSource }).latest
    act(() => {
      es.emit('defect', { id: 1, type: 'Hickey', severity: 'critical', timestamp: 't', ssimScore: 0.42, aiVerdict: 'reject' })
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(5500) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('auto-dismisses after 3s for minor', async () => {
    render(<DefectAlertOverlay />)
    const es = (FakeEventSource as unknown as { latest: FakeEventSource }).latest
    act(() => {
      es.emit('defect', { id: 2, type: 'Color shift', severity: 'minor', timestamp: 't', ssimScore: 0.78, aiVerdict: 'review' })
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3500) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('DefectAlertOverlay — expand', () => {
  it('expands and cancels timer on tap', () => {
    render(<DefectAlertOverlay />)
    const es = (FakeEventSource as unknown as { latest: FakeEventSource }).latest
    act(() => {
      es.emit('defect', { id: 1, type: 'Hickey', severity: 'critical', timestamp: 't', ssimScore: 0.42, aiVerdict: 'reject' })
    })
    fireEvent.click(screen.getByRole('alert'))
    expect(screen.getByRole('button', { name: /acknowledge/i })).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('dismisses when Acknowledge is tapped', () => {
    render(<DefectAlertOverlay />)
    const es = (FakeEventSource as unknown as { latest: FakeEventSource }).latest
    act(() => {
      es.emit('defect', { id: 1, type: 'Hickey', severity: 'critical', timestamp: 't', ssimScore: 0.42, aiVerdict: 'reject' })
    })
    fireEvent.click(screen.getByRole('alert'))
    fireEvent.click(screen.getByRole('button', { name: /acknowledge/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
