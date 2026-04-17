import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { GoldenReference } from '@/components/dashboard/golden-reference'

describe('GoldenReference', () => {
  it('renders the panel header', () => {
    render(<GoldenReference />)
    expect(screen.getByText(/golden reference/i)).toBeInTheDocument()
  })

  it('renders the reference image with an alt text', () => {
    render(<GoldenReference />)
    expect(screen.getByRole('img', { name: /reference golden master label/i })).toBeInTheDocument()
  })
})
