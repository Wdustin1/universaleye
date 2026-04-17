import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AnimatedNumber } from '@/components/ui/animated-number'

describe('AnimatedNumber', () => {
  it('renders the value', () => {
    render(<AnimatedNumber value="42" />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('uses a key based on the value to re-trigger animation', () => {
    const { container, rerender } = render(<AnimatedNumber value="42" />)
    const first = container.querySelector('span')!
    rerender(<AnimatedNumber value="43" />)
    const second = container.querySelector('span')!
    expect(first).not.toBe(second)
  })
})
