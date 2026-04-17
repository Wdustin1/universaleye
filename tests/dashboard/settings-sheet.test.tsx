import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsSheet } from '@/components/dashboard/settings-sheet'

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ collecting: false, total: 0, good: 0, bad: 0, unlabeled: 0 }),
  }) as unknown as Response) as unknown as typeof fetch
})

describe('SettingsSheet', () => {
  it('does not render its body when closed', () => {
    const { container } = render(<SettingsSheet open={false} onOpenChange={() => {}} onOpenLog={() => {}} />)
    expect(container.querySelector('[data-state="closed"]')).toBeTruthy()
  })

  it('renders settings sections when open', () => {
    render(<SettingsSheet open={true} onOpenChange={() => {}} onOpenLog={() => {}} />)
    expect(screen.getByText(/training data/i)).toBeInTheDocument()
    expect(screen.getByText(/sound/i)).toBeInTheDocument()
    expect(screen.getByText(/defect history/i)).toBeInTheDocument()
  })

  it('calls onOpenChange(false) when the close button is tapped', () => {
    const onOpenChange = vi.fn()
    render(<SettingsSheet open={true} onOpenChange={onOpenChange} onOpenLog={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /close settings/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenLog when defect history is tapped', () => {
    const onOpenLog = vi.fn()
    render(<SettingsSheet open={true} onOpenChange={() => {}} onOpenLog={onOpenLog} />)
    fireEvent.click(screen.getByRole('button', { name: /open defect history/i }))
    expect(onOpenLog).toHaveBeenCalledOnce()
  })
})
