import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useHoldToConfirm } from '@/lib/use-hold-to-confirm'

describe('useHoldToConfirm', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('does not fire when released early', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useHoldToConfirm({ onConfirm, holdMs: 800 }))
    act(() => { result.current.bind.onMouseDown() })
    act(() => { vi.advanceTimersByTime(400) })
    act(() => { result.current.bind.onMouseUp() })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('fires after holdMs of continuous press', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useHoldToConfirm({ onConfirm, holdMs: 800 }))
    act(() => { result.current.bind.onMouseDown() })
    act(() => { vi.advanceTimersByTime(900) })
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('reports progress between 0 and 1 during a hold', () => {
    const { result } = renderHook(() => useHoldToConfirm({ onConfirm: () => {}, holdMs: 800 }))
    expect(result.current.progress).toBe(0)
    act(() => { result.current.bind.onMouseDown() })
    act(() => { vi.advanceTimersByTime(400) })
    expect(result.current.progress).toBeGreaterThan(0.4)
    expect(result.current.progress).toBeLessThan(0.6)
  })

  it('resets progress when released early', () => {
    const { result } = renderHook(() => useHoldToConfirm({ onConfirm: () => {}, holdMs: 800 }))
    act(() => { result.current.bind.onMouseDown() })
    act(() => { vi.advanceTimersByTime(300) })
    act(() => { result.current.bind.onMouseUp() })
    act(() => { vi.advanceTimersByTime(50) })
    expect(result.current.progress).toBe(0)
  })
})
