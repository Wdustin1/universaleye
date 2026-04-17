import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LastDefect } from '@/components/dashboard/last-defect'

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve([
      { id: 42, type: 'Hickey', severity: 'critical', timestamp: '2026-04-16T14:32:07', ssimScore: 0.421, aiVerdict: 'reject' },
    ]),
  }) as unknown as Response) as unknown as typeof fetch
})

describe('LastDefect', () => {
  it('renders the panel header', () => {
    render(<LastDefect onSelect={() => {}} />)
    expect(screen.getByText(/last defect/i)).toBeInTheDocument()
  })

  it('shows the latest defect type when one exists', async () => {
    render(<LastDefect onSelect={() => {}} />)
    expect(await screen.findByText(/hickey/i)).toBeInTheDocument()
  })

  it('shows empty state when no defects exist', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    }) as unknown as Response) as unknown as typeof fetch
    render(<LastDefect onSelect={() => {}} />)
    expect(await screen.findByText(/no defects detected/i)).toBeInTheDocument()
  })

  it('calls onSelect with the defect id when the image is tapped', async () => {
    const onSelect = vi.fn()
    render(<LastDefect onSelect={onSelect} />)
    const img = await screen.findByRole('img', { name: /last detected defect/i })
    fireEvent.click(img)
    expect(onSelect).toHaveBeenCalledWith(42)
  })
})
