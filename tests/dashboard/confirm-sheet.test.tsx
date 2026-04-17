import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConfirmSheet } from '@/components/dashboard/confirm-sheet'

describe('ConfirmSheet', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('does not render when closed', () => {
    render(<ConfirmSheet open={false} title="Stop?" body="x" confirmLabel="Stop" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByText('Stop?')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    render(<ConfirmSheet open={true} title="Stop?" body="x" confirmLabel="Stop" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Stop?')).toBeInTheDocument()
  })

  it('cancels via the cancel button', () => {
    const onCancel = vi.fn()
    render(<ConfirmSheet open={true} title="t" body="x" confirmLabel="Stop" onConfirm={() => {}} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not fire onConfirm on a brief tap', () => {
    const onConfirm = vi.fn()
    render(<ConfirmSheet open={true} title="t" body="x" confirmLabel="Stop" onConfirm={onConfirm} onCancel={() => {}} />)
    const btn = screen.getByRole('button', { name: /hold to/i })
    fireEvent.mouseDown(btn)
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.mouseUp(btn)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('fires onConfirm after a full hold', () => {
    const onConfirm = vi.fn()
    render(<ConfirmSheet open={true} title="t" body="x" confirmLabel="Stop" onConfirm={onConfirm} onCancel={() => {}} />)
    const btn = screen.getByRole('button', { name: /hold to/i })
    fireEvent.mouseDown(btn)
    act(() => { vi.advanceTimersByTime(900) })
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
