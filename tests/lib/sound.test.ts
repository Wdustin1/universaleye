import { describe, it, expect, vi } from 'vitest'
import { playCriticalChime, isSoundEnabled } from '@/lib/sound'

describe('sound', () => {
  it('isSoundEnabled returns false by default', () => {
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: () => null, setItem: () => {} },
      configurable: true,
    })
    expect(isSoundEnabled()).toBe(false)
  })

  it('isSoundEnabled returns true when key is "1"', () => {
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: () => '1', setItem: () => {} },
      configurable: true,
    })
    expect(isSoundEnabled()).toBe(true)
  })

  it('playCriticalChime is a no-op when audio context is unavailable', () => {
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true })
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true })
    expect(() => playCriticalChime()).not.toThrow()
  })

  it('playCriticalChime starts an oscillator when audio is available and sound is enabled', () => {
    const start = vi.fn()
    const stop = vi.fn()
    const exponentialRampToValueAtTime = vi.fn()
    const setValueAtTime = vi.fn()
    const gainConnect = vi.fn()
    const oscConnect = vi.fn(() => ({ connect: gainConnect }))
    const gain = { gain: { value: 0, setValueAtTime, exponentialRampToValueAtTime }, connect: gainConnect }
    const fakeCtx = {
      currentTime: 0,
      destination: {},
      createOscillator: () => ({ type: '', frequency: { value: 0 }, connect: oscConnect, start, stop }),
      createGain: () => gain,
    }
    const FakeAudioContext = vi.fn(function () {
      return fakeCtx
    })
    Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true })
    Object.defineProperty(window, 'localStorage', { value: { getItem: () => '1' }, configurable: true })
    playCriticalChime()
    expect(start).toHaveBeenCalled()
  })
})
