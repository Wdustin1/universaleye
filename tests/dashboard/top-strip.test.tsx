import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TopStrip } from '@/components/dashboard/top-strip'

describe('TopStrip', () => {
  const baseStats = { labelsInspected: 1248, defectsFound: 7, runTime: '02:14:33', status: 'running' as const }

  it('renders the four stat tuples with tabular numerics', () => {
    render(<TopStrip stats={baseStats} onOpenSettings={() => {}} onOpenLog={() => {}} onToggleFullscreen={() => {}} />)
    expect(screen.getByText('1,248')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('0.56%')).toBeInTheDocument()
    expect(screen.getByText('02:14:33')).toBeInTheDocument()
  })

  it('shows status chip with the current status', () => {
    render(<TopStrip stats={baseStats} onOpenSettings={() => {}} onOpenLog={() => {}} onToggleFullscreen={() => {}} />)
    expect(screen.getByText(/Running/i)).toBeInTheDocument()
  })

  it('calls onOpenLog when the Defects stat is tapped', () => {
    const onOpenLog = vi.fn()
    render(<TopStrip stats={baseStats} onOpenSettings={() => {}} onOpenLog={onOpenLog} onToggleFullscreen={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /defects/i }))
    expect(onOpenLog).toHaveBeenCalledOnce()
  })

  it('calls onOpenSettings when the menu icon is tapped', () => {
    const onOpenSettings = vi.fn()
    render(<TopStrip stats={baseStats} onOpenSettings={onOpenSettings} onOpenLog={() => {}} onToggleFullscreen={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })

  it('shows 0.00% rate when no labels are inspected', () => {
    render(<TopStrip stats={{ ...baseStats, labelsInspected: 0, defectsFound: 0 }} onOpenSettings={() => {}} onOpenLog={() => {}} onToggleFullscreen={() => {}} />)
    expect(screen.getByText('0.00%')).toBeInTheDocument()
  })
})
