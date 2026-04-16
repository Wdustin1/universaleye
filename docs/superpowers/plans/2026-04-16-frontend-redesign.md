# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Universal Eye operator dashboard to match the Cockpit layout described in `docs/superpowers/specs/2026-04-16-frontend-redesign-design.md` — premium A+B blend (industrial precision + SaaS calm), 27" landscape touchscreen ergonomics, severity-tiered alert lifecycle, hold-to-confirm for destructive actions.

**Architecture:** Refactor the existing single-page dashboard (`app/page.tsx`) into a 3-column Cockpit grid with thin top/bottom strips. Split the right column (today: `reference-comparison.tsx`) into two equal panels (`golden-reference.tsx` + `last-defect.tsx`). Add new components for the top stats strip, bottom health strip, settings sheet, and confirmation sheet. All new behavior is test-driven via Vitest + Testing Library; pure visual changes are verified by browser inspection. No backend changes.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5.7 · Tailwind 3 · shadcn/ui · Vitest + React Testing Library (new) · Web Audio API for the chime.

---

## File structure

### New files

| Path | Responsibility |
|---|---|
| `vitest.config.ts` | Vitest configuration (jsdom env, alias paths) |
| `tests/setup.ts` | Global test setup (`@testing-library/jest-dom`) |
| `components/dashboard/top-strip.tsx` | Top row: stat tuples + status chip + ≡/⛶ icons |
| `components/dashboard/health-strip.tsx` | Bottom row: camera, FPS, alignment, state, pipeline, defect mix |
| `components/dashboard/golden-reference.tsx` | Right-column upper panel — golden reference image |
| `components/dashboard/last-defect.tsx` | Right-column lower panel — most recent defect |
| `components/dashboard/settings-sheet.tsx` | Slide-out sheet for power-user controls |
| `components/dashboard/confirm-sheet.tsx` | Modal with hold-to-confirm destructive button |
| `components/ui/skeleton.tsx` | Generic shimmer skeleton (used by panels during loading) |
| `lib/sound.ts` | Web Audio chime helper |
| `lib/use-hold-to-confirm.ts` | Hook implementing the 800ms hold pattern |

### Modified files

| Path | Change |
|---|---|
| `app/globals.css` | Add 5 surface tokens, motion tokens, reduced-motion handling, numeric pop-in keyframes |
| `tailwind.config.ts` | Expose surface tokens, motion timing as utility classes |
| `app/page.tsx` | Cockpit grid layout, new components, removed status prop |
| `components/dashboard/live-feed.tsx` | Slimmer chrome, double-tap → fullscreen, alert card mount unchanged |
| `components/dashboard/inspection-controls.tsx` | Larger touch targets (Start 56px, Pause/Stop 44px), Collect Frames removed (moves to settings sheet) |
| `components/dashboard/defect-alert.tsx` | Severity tiers, progress bar, tap-to-expand, stack of up to 3 |
| `components/dashboard/defect-log.tsx` | Triggered by tap on Defects stat — open prop is the same; only the trigger source moves |
| `components/dashboard/defect-breakdown.tsx` | Demoted into the settings sheet (component itself unchanged, mount point moves) |
| `package.json` | Add `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` |
| `CLAUDE.md` | Update component map and the dashboard layout diagram |

### Deleted files

| Path | Replaced by |
|---|---|
| `components/dashboard/header.tsx` | Folded into `top-strip.tsx` |
| `components/dashboard/stats-bar.tsx` | Folded into `top-strip.tsx` |
| `components/dashboard/reference-comparison.tsx` | Split into `golden-reference.tsx` + `last-defect.tsx` |

---

## Task ordering rationale

The spec lists 10 phases. This plan follows that order with two exceptions:

1. **Test harness setup is Task 1**, not Task 25. TDD requires the runner to exist before the first behavior test.
2. **Cleanup of deleted files happens at the natural end of each phase**, not as a final pass — keeps each commit clean.

Pure-visual tasks (CSS tokens, color updates) verify by browser inspection, not unit tests. Behavior tasks (alert lifecycle, hold-to-confirm timing, slider debounce) are TDD.

---

### Task 1: Vitest + Testing Library setup

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: Install test dependencies**

```bash
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

Expected: `pnpm-lock.yaml` updated, six packages added under devDependencies.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
})
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 4: Add scripts to `package.json`**

Modify the `scripts` section so it includes:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Write a smoke test to confirm the harness works**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run the smoke test**

```bash
pnpm test
```

Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts tests/ package.json pnpm-lock.yaml
git commit -m "test: scaffold Vitest + React Testing Library harness"
```

---

### Task 2: Surface tokens in globals.css and tailwind.config.ts

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add the new surface variables to `:root` in `app/globals.css`**

The existing block already has `--background`, `--card`, `--secondary`, `--border`. Add these new variables (and re-tune existing values to match the spec) inside the `:root` block:

```css
--canvas: 225 20% 4%;
--card: 225 18% 7%;
--sunken: 225 14% 11%;
--lifted: 225 14% 15%;
--border-soft: 225 12% 13%;
--border-strong: 225 12% 18%;
--accent-glow: 168 75% 42%;
```

Keep existing variables as-is so nothing breaks. The new variables are additive.

- [ ] **Step 2: Expose the new tokens in `tailwind.config.ts`**

In the `theme.extend.colors` block, add:

```ts
canvas: 'hsl(var(--canvas))',
sunken: 'hsl(var(--sunken))',
lifted: 'hsl(var(--lifted))',
'border-soft': 'hsl(var(--border-soft))',
'border-strong': 'hsl(var(--border-strong))',
'accent-glow': 'hsl(var(--accent-glow))',
```

- [ ] **Step 3: Verify lint + build still pass**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors. New CSS variables don't affect existing usage.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css tailwind.config.ts
git commit -m "feat(design): add 5-level surface tokens and accent-glow"
```

---

### Task 3: Motion tokens + reduced-motion + numeric pop-in keyframes

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Append motion tokens, keyframes, and reduced-motion handling to `globals.css`**

After the existing `defect-flash` keyframes block, append:

```css
:root {
  --ease-out-snap: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out-soft: 240ms cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out-fast: 120ms cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes value-pop {
  0%   { opacity: 0; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes accent-pulse {
  0%, 100% { opacity: 0.15; }
  50%      { opacity: 0.35; }
}

@keyframes alert-slide-up {
  from { opacity: 0; transform: translateY(120%) translateX(-50%); }
  to   { opacity: 1; transform: translateY(0) translateX(-50%); }
}

@keyframes alert-slide-down {
  from { opacity: 1; transform: translateY(0) translateX(-50%); }
  to   { opacity: 0; transform: translateY(120%) translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Touch never triggers focus rings; keyboard always does. */
*:focus { outline: none; }
*:focus-visible {
  outline: 2px solid hsl(var(--accent-glow));
  outline-offset: 2px;
  border-radius: 4px;
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): add motion tokens, keyframes, reduced-motion handling"
```

---

### Task 4: TopStrip component

Replaces `header.tsx` + `stats-bar.tsx` with a single dense strip. Renders inspected/defects/rate/run + status chip + ≡/⛶ icons.

**Files:**
- Create: `components/dashboard/top-strip.tsx`
- Create: `tests/dashboard/top-strip.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/dashboard/top-strip.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the test (it should fail because the component doesn't exist)**

```bash
pnpm test tests/dashboard/top-strip.test.tsx
```

Expected: FAIL — "Cannot find module '@/components/dashboard/top-strip'".

- [ ] **Step 3: Implement `top-strip.tsx`**

```tsx
"use client"

import { Menu, Maximize2 } from "lucide-react"

type Status = "running" | "paused" | "stopped"

interface Stats {
  labelsInspected: number
  defectsFound: number
  runTime: string
  status: Status
}

const STATUS_CHIP: Record<Status, { label: string; className: string }> = {
  running: { label: "Running", className: "bg-primary/12 text-primary border-primary/25" },
  paused:  { label: "Paused",  className: "bg-warning/12 text-warning border-warning/25" },
  stopped: { label: "Stopped", className: "bg-sunken text-muted-foreground border-border-strong" },
}

export function TopStrip({
  stats,
  onOpenSettings,
  onOpenLog,
  onToggleFullscreen,
}: {
  stats: Stats
  onOpenSettings: () => void
  onOpenLog: () => void
  onToggleFullscreen: () => void
}) {
  const rate = stats.labelsInspected > 0
    ? (stats.defectsFound / stats.labelsInspected) * 100
    : 0
  const chip = STATUS_CHIP[stats.status]

  return (
    <div
      className="h-[38px] bg-card border border-border-soft rounded-lg px-4 flex items-center gap-7"
      role="status"
      aria-live="polite"
    >
      <Stat label="Inspected" value={stats.labelsInspected.toLocaleString()} />
      <button
        type="button"
        onClick={onOpenLog}
        className="flex items-baseline gap-1.5 hover:opacity-80 transition-opacity"
        aria-label={`Defects: ${stats.defectsFound}. Tap to open defect history.`}
      >
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Defects</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-destructive">{stats.defectsFound}</span>
      </button>
      <Stat
        label="Rate"
        value={`${rate.toFixed(2)}%`}
        valueClass={rate > 0.5 ? "text-warning" : undefined}
      />
      <Stat label="Run" value={stats.runTime} />
      <div className="ml-auto flex items-center gap-2.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium font-mono border ${chip.className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {chip.label}
        </span>
        <IconButton onClick={onOpenSettings} label="Open settings"><Menu className="w-3.5 h-3.5" /></IconButton>
        <IconButton onClick={onToggleFullscreen} label="Toggle fullscreen"><Maximize2 className="w-3.5 h-3.5" /></IconButton>
      </div>
    </div>
  )
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-semibold tabular-nums ${valueClass ?? "text-foreground"}`}>{value}</span>
    </div>
  )
}

function IconButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-[30px] h-[30px] bg-sunken border border-border-soft rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Run the test (should pass now)**

```bash
pnpm test tests/dashboard/top-strip.test.tsx
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/top-strip.tsx tests/dashboard/top-strip.test.tsx
git commit -m "feat(dashboard): add TopStrip — replaces header + stats-bar"
```

---

### Task 5: HealthStrip component

Bottom row of system-health readouts. Polls `/api/health` plus reads alignment/state via the existing stats endpoint (extend the backend later if needed; for now, alignment and FPS are placeholder until backend exposes them — show `—` when missing).

**Files:**
- Create: `components/dashboard/health-strip.tsx`
- Create: `tests/dashboard/health-strip.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/dashboard/health-strip.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/dashboard/health-strip.test.tsx
```

Expected: FAIL — "Cannot find module '@/components/dashboard/health-strip'".

- [ ] **Step 3: Implement `health-strip.tsx`**

```tsx
"use client"

import { useCallback, useState } from "react"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

interface HealthData {
  cameraAvailable: boolean | null
}

export function HealthStrip() {
  const [health, setHealth] = useState<HealthData>({ cameraAvailable: null })

  const pollHealth = useCallback(async () => {
    try {
      const res = await apiFetch(API.health)
      if (res.ok) {
        const data = await res.json()
        setHealth({ cameraAvailable: Boolean(data.camera_available) })
      }
    } catch {
      setHealth({ cameraAvailable: null })
    }
  }, [])
  usePolling(pollHealth, 5000, true)

  const cameraLabel = health.cameraAvailable === null
    ? "—"
    : health.cameraAvailable
      ? "live"
      : "no signal"
  const cameraClass = health.cameraAvailable === null
    ? "text-muted-foreground"
    : health.cameraAvailable
      ? "text-success"
      : "text-warning"

  return (
    <div className="h-[28px] bg-card border border-border-soft rounded-lg px-3.5 flex items-center gap-6 text-[10px] text-muted-foreground">
      <Readout label="Camera"><span className={`font-mono font-semibold ${cameraClass}`}>{cameraLabel}</span></Readout>
      <Readout label="FPS"><span className="font-mono font-semibold text-foreground">—</span></Readout>
      <Readout label="Alignment"><span className="font-mono font-semibold text-foreground">—</span></Readout>
      <Readout label="State"><span className="font-mono font-semibold text-foreground">—</span></Readout>
      <Readout label="Pipeline"><span className="font-mono font-semibold text-success">healthy</span></Readout>
      <Readout label="Defect mix" className="ml-auto"><span className="font-mono font-semibold text-foreground">—</span></Readout>
    </div>
  )
}

function Readout({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <span className="uppercase tracking-wider">{label}</span>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/dashboard/health-strip.test.tsx
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/health-strip.tsx tests/dashboard/health-strip.test.tsx
git commit -m "feat(dashboard): add HealthStrip — bottom system health row"
```

---

### Task 6: Cockpit grid in `app/page.tsx`

Replace the existing layout with the new grid. Keep the existing components in place; we'll swap the right-column components in the next tasks. Wire the new TopStrip + HealthStrip; remove the old `<DashboardHeader>` and `<StatsBar>` mounts.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the file body**

```tsx
"use client"

import { useState, useCallback, useRef } from "react"
import { TopStrip } from "@/components/dashboard/top-strip"
import { HealthStrip } from "@/components/dashboard/health-strip"
import { LiveFeedPanel } from "@/components/dashboard/live-feed"
import { ReferenceComparison } from "@/components/dashboard/reference-comparison"
import { DefectLog } from "@/components/dashboard/defect-log"
import { InspectionControls } from "@/components/dashboard/inspection-controls"
import { DefectAlertOverlay } from "@/components/dashboard/defect-alert"
import { ErrorBoundary } from "@/components/error-boundary"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

export default function Page() {
  const [defectLogOpen, setDefectLogOpen] = useState(false)
  const [stats, setStats] = useState({ labelsInspected: 0, defectsFound: 0, runTime: "00:00:00", status: "stopped" as "running" | "paused" | "stopped" })
  const [hasReference, setHasReference] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const pollStats = useCallback(async () => {
    try {
      const res = await apiFetch(API.stats)
      if (res.ok) {
        const data = await res.json()
        setStats({
          labelsInspected: data.labelsInspected ?? 0,
          defectsFound: data.defectsFound ?? 0,
          runTime: data.runTime ?? "00:00:00",
          status: data.status ?? "stopped",
        })
        setHasReference(data.hasReference ?? false)
      }
    } catch { /* backend not available */ }
  }, [])
  usePolling(pollStats, 2000, true)

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else containerRef.current?.requestFullscreen().catch(() => {})
  }

  return (
    <div ref={containerRef} className="h-screen bg-canvas p-3.5 grid gap-2.5" style={{ gridTemplateRows: "38px 1fr 28px" }}>
      <DefectAlertOverlay />

      <ErrorBoundary>
        <TopStrip
          stats={stats}
          onOpenSettings={() => { /* wired in Task 13 */ }}
          onOpenLog={() => setDefectLogOpen(true)}
          onToggleFullscreen={toggleFullscreen}
        />
      </ErrorBoundary>

      <div className="grid gap-2.5 min-h-0" style={{ gridTemplateColumns: "110px 1fr 280px" }}>
        <ErrorBoundary>
          <InspectionControls hasReference={hasReference} status={stats.status} />
        </ErrorBoundary>
        <ErrorBoundary>
          <LiveFeedPanel hasReference={hasReference} defectCount={stats.defectsFound} onReferenceSet={() => setHasReference(true)} />
        </ErrorBoundary>
        <ErrorBoundary>
          <ReferenceComparison />
        </ErrorBoundary>
      </div>

      <ErrorBoundary>
        <HealthStrip />
      </ErrorBoundary>

      <ErrorBoundary>
        <DefectLog open={defectLogOpen} onOpenChange={setDefectLogOpen} />
      </ErrorBoundary>
    </div>
  )
}
```

- [ ] **Step 2: Run lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors. Page renders the new layout (still using old reference-comparison panel).

- [ ] **Step 3: Visually verify**

```bash
pnpm dev
```

Open `http://localhost:3000`. Expected: top strip shows stats + status chip + icons; bottom strip shows readouts; layout is the new 3-column grid with strips. Old DashboardHeader is gone.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(dashboard): swap to Cockpit grid layout"
```

---

### Task 7: Delete `header.tsx` and `stats-bar.tsx`

These are no longer imported anywhere.

**Files:**
- Delete: `components/dashboard/header.tsx`
- Delete: `components/dashboard/stats-bar.tsx`

- [ ] **Step 1: Confirm no references remain**

```bash
grep -r "DashboardHeader\|StatsBar" --include="*.tsx" --include="*.ts" .
```

Expected: only the deleted files themselves match (or nothing).

- [ ] **Step 2: Delete the files**

```bash
rm components/dashboard/header.tsx components/dashboard/stats-bar.tsx
```

- [ ] **Step 3: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore: remove DashboardHeader and StatsBar (folded into TopStrip)"
```

---

### Task 8: GoldenReference component

Splits half of `reference-comparison.tsx`. Just renders the golden reference image with a header and refresh polling.

**Files:**
- Create: `components/dashboard/golden-reference.tsx`
- Create: `tests/dashboard/golden-reference.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
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
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/dashboard/golden-reference.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `golden-reference.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useCallback } from "react"
import { API } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

export function GoldenReference() {
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(async () => {
    setRefreshKey((k) => k + 1)
  }, [])
  usePolling(refresh, 5000, true)

  return (
    <div className="bg-card border border-border-soft rounded-lg p-2.5 flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-1.5 pb-1.5 mb-2 border-b border-border-soft">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        <h4 className="m-0 text-[11px] uppercase tracking-wider text-foreground/75 font-medium">Golden Reference</h4>
      </div>
      <div className="flex-1 rounded-md border border-border-soft overflow-hidden bg-background flex items-center justify-center min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${API.referenceImage}?t=${refreshKey}`}
          alt="Reference golden master label"
          className="w-full h-full object-contain"
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/dashboard/golden-reference.test.tsx
```

Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/golden-reference.tsx tests/dashboard/golden-reference.test.tsx
git commit -m "feat(dashboard): add GoldenReference panel"
```

---

### Task 9: LastDefect component

The other half of `reference-comparison.tsx` — promoted to a permanent panel.

**Files:**
- Create: `components/dashboard/last-defect.tsx`
- Create: `tests/dashboard/last-defect.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
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
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/dashboard/last-defect.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `last-defect.tsx`**

```tsx
"use client"

import { useCallback, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

interface Defect {
  id: number
  type: string
  severity: "critical" | "major" | "minor"
  timestamp: string
  ssimScore: number | null
  aiVerdict: string
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  major: "bg-warning/15 text-warning",
  minor: "bg-sunken text-muted-foreground",
}

export function LastDefect({ onSelect }: { onSelect: (id: number) => void }) {
  const [defect, setDefect] = useState<Defect | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchLatest = useCallback(async () => {
    try {
      const res = await apiFetch(`${API.defects}?limit=1`)
      if (res.ok) {
        const data: Defect[] = await res.json()
        setDefect(data.length > 0 ? data[0] : null)
        setRefreshKey((k) => k + 1)
      }
    } catch { /* offline */ }
  }, [])
  usePolling(fetchLatest, 2000, true)

  return (
    <div className="bg-card border border-border-soft rounded-lg p-2.5 flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-1.5 pb-1.5 mb-2 border-b border-border-soft">
        <span className={`w-1.5 h-1.5 rounded-full ${defect ? "bg-destructive" : "bg-muted-foreground/30"}`} />
        <h4 className="m-0 text-[11px] uppercase tracking-wider text-foreground/75 font-medium">Last Defect</h4>
        {defect && (
          <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-medium ${SEVERITY_BADGE[defect.severity] ?? SEVERITY_BADGE.minor}`}>
            {defect.type}
          </span>
        )}
      </div>
      <div className={`flex-1 rounded-md border overflow-hidden bg-background flex items-center justify-center min-h-0 ${defect ? "border-destructive/30" : "border-border-soft"}`}>
        {defect ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`${API.defectImage(defect.id)}?t=${refreshKey}`}
            alt="Last detected defect"
            className="w-full h-full object-contain cursor-pointer"
            onClick={() => onSelect(defect.id)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-[10px]">No defects detected</span>
          </div>
        )}
      </div>
      {defect && (
        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground font-mono">
          <span>{defect.timestamp.slice(11, 19)}</span>
          <span>·</span>
          <span>SSIM {defect.ssimScore?.toFixed(3) ?? "—"}</span>
          <span>·</span>
          <span className="text-destructive font-semibold">{defect.severity}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/dashboard/last-defect.test.tsx
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/last-defect.tsx tests/dashboard/last-defect.test.tsx
git commit -m "feat(dashboard): add LastDefect panel — promoted from reference-comparison"
```

---

### Task 10: Wire GoldenReference + LastDefect into page.tsx; delete reference-comparison.tsx

**Files:**
- Modify: `app/page.tsx`
- Delete: `components/dashboard/reference-comparison.tsx`

- [ ] **Step 1: Update `app/page.tsx`**

Replace the import and usage of `ReferenceComparison`:

Replace:
```tsx
import { ReferenceComparison } from "@/components/dashboard/reference-comparison"
```

with:
```tsx
import { GoldenReference } from "@/components/dashboard/golden-reference"
import { LastDefect } from "@/components/dashboard/last-defect"
import { DefectDetail } from "@/components/dashboard/defect-detail"
```

Add a state hook near the other `useState` calls:
```tsx
const [selectedDefectId, setSelectedDefectId] = useState<number | null>(null)
```

Replace the `<ErrorBoundary><ReferenceComparison /></ErrorBoundary>` block with:

```tsx
<div className="flex flex-col gap-2.5 min-h-0">
  <ErrorBoundary>
    <GoldenReference />
  </ErrorBoundary>
  <ErrorBoundary>
    <LastDefect onSelect={setSelectedDefectId} />
  </ErrorBoundary>
</div>
```

Add a fetch helper for the defect detail (for the modal). Insert this useState block near the others, plus a small effect that fetches the selected defect when the id changes:

```tsx
const [selectedDefect, setSelectedDefect] = useState<{ id: number; type: string; severity: "critical" | "major" | "minor"; timestamp: string; ssimScore: number | null; aiVerdict: "reject" | "accept" | "review" } | null>(null)

useEffect(() => {
  if (selectedDefectId === null) { setSelectedDefect(null); return }
  apiFetch(`${API.defects}?limit=200`).then(async (r) => {
    if (!r.ok) return
    const list = await r.json()
    const found = list.find((d: { id: number }) => d.id === selectedDefectId)
    if (found) setSelectedDefect(found)
  }).catch(() => {})
}, [selectedDefectId])
```

Add `useEffect` to the React import. Add the modal at the end of the JSX (after `<DefectLog>`):

```tsx
{selectedDefect && (
  <DefectDetail defect={selectedDefect} onClose={() => setSelectedDefectId(null)} />
)}
```

- [ ] **Step 2: Delete `reference-comparison.tsx`**

```bash
rm components/dashboard/reference-comparison.tsx
```

- [ ] **Step 3: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -A app/page.tsx components/dashboard/reference-comparison.tsx
git commit -m "feat(dashboard): wire GoldenReference + LastDefect, drop reference-comparison"
```

---

### Task 11: InspectionControls touch sizing refresh

Make Start 56px tall, Pause/Stop 44px each, sensitivity hit zone 44px, remove Collect Frames + "Label Frames" link (those move to settings sheet in Task 13).

**Files:**
- Modify: `components/dashboard/inspection-controls.tsx`

- [ ] **Step 1: Adjust the rendered button heights and remove the data-collection block**

Current Start button block (around line 110): replace the `h-11` class with `h-14` and bump font/icon size:

```tsx
<button
  type="button"
  onClick={handleStart}
  disabled={!hasReference && state !== "running"}
  className={`relative flex items-center justify-center gap-2.5 w-full h-14 rounded-lg text-base font-semibold transition-all ${
    !hasReference && state !== "running"
      ? "bg-secondary text-muted-foreground opacity-50 cursor-not-allowed"
      : state === "running"
        ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(168_75%_42%/0.3)]"
        : "bg-secondary text-secondary-foreground hover:bg-accent"
  }`}
>
  {state === "running" && (
    <span className="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
  )}
  <Play className="w-5 h-5" />
  {state === "paused" ? "Resume" : "Start"}
</button>
```

Pause and Stop block: change `h-10` to `h-11` (44px):

```tsx
<button
  type="button"
  onClick={handlePause}
  className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-medium transition-all ${
    state === "paused"
      ? "bg-warning/15 text-warning border border-warning/30"
      : "bg-secondary text-secondary-foreground hover:bg-accent"
  }`}
>
  <Pause className="w-4 h-4" />
  Pause
</button>

<button
  type="button"
  onClick={handleStop}
  className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-medium transition-all ${
    state === "stopped"
      ? "bg-destructive/15 text-destructive border border-destructive/30"
      : "bg-secondary text-secondary-foreground hover:bg-accent"
  }`}
>
  <Square className="w-4 h-4" />
  Stop
</button>
```

Sensitivity slider: wrap the existing `<input type="range">` so its tap zone is 44px tall. Replace the existing slider container block with:

```tsx
<div className="relative h-11 flex items-center group">
  <div className="absolute inset-x-0 h-1.5 bg-secondary rounded-full top-1/2 -translate-y-1/2">
    <div
      className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
      style={{ width: `${sensitivity}%` }}
    />
    <div
      className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-primary-foreground shadow-sm transition-all"
      style={{ left: `calc(${sensitivity}% - 7px)` }}
    />
  </div>
  <input
    type="range"
    min="0"
    max="100"
    value={sensitivity}
    onChange={(e) => handleSensitivity(Number(e.target.value))}
    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
    aria-label="Detection sensitivity"
  />
</div>
```

Remove the entire "Data Collection" block at the bottom of the component (the section with the `Collect Frames` toggle and the `Label Frames` `<Link>`). Also remove `Database` and `Link` imports if no longer used.

Remove the `pollCollecting` hook, `usePolling(pollCollecting, 5000, true)`, and the `collecting` state — they move to the settings sheet in Task 13.

- [ ] **Step 2: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/inspection-controls.tsx
git commit -m "feat(dashboard): bump InspectionControls to touch-sized, drop data-collection block"
```

---

### Task 12: SettingsSheet component

Slide-out from the right, houses Collect Frames toggle, sensitivity numeric input, sound toggle, link to defect log, link to `/collect`.

**Files:**
- Create: `components/dashboard/settings-sheet.tsx`
- Create: `tests/dashboard/settings-sheet.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
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
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/dashboard/settings-sheet.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `settings-sheet.tsx`**

```tsx
"use client"

import { useCallback, useState } from "react"
import { X, Database, Bell, BellOff, History, ExternalLink } from "lucide-react"
import Link from "next/link"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

const SOUND_KEY = "ueye:sound-enabled"

export function SettingsSheet({
  open,
  onOpenChange,
  onOpenLog,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenLog: () => void
}) {
  const [collecting, setCollecting] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(SOUND_KEY) === "1" : false
  )

  const pollCollecting = useCallback(async () => {
    try {
      const res = await apiFetch(API.collectionStats)
      if (res.ok) {
        const data = await res.json()
        setCollecting(Boolean(data.collecting))
      }
    } catch { /* offline */ }
  }, [])
  usePolling(pollCollecting, 5000, open)

  const toggleCollecting = async () => {
    const next = !collecting
    setCollecting(next)
    try {
      await apiFetch(next ? API.collectionStart : API.collectionStop, { method: "POST" })
    } catch { /* offline */ }
  }

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    if (typeof window !== "undefined") localStorage.setItem(SOUND_KEY, next ? "1" : "0")
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-canvas/40 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
      )}
      <div
        data-state={open ? "open" : "closed"}
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-card border-l border-border-soft shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
            <h2 className="text-xs font-medium uppercase tracking-wider">Settings</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close settings"
              className="p-1 rounded hover:bg-secondary"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
            <Section title="Training Data">
              <RowButton onClick={toggleCollecting} icon={<Database className="w-4 h-4" />}>
                <span className="flex-1">Collect Frames</span>
                <span className={`text-[11px] font-mono ${collecting ? "text-primary" : "text-muted-foreground"}`}>
                  {collecting ? "● ON" : "OFF"}
                </span>
              </RowButton>
              <Link href="/collect" target="_blank" className="block">
                <RowButton onClick={() => {}} icon={<ExternalLink className="w-4 h-4" />}>
                  <span>Label Frames</span>
                </RowButton>
              </Link>
            </Section>

            <Section title="Sound">
              <RowButton onClick={toggleSound} icon={soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}>
                <span className="flex-1">Critical defect chime</span>
                <span className={`text-[11px] font-mono ${soundEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  {soundEnabled ? "● ON" : "OFF"}
                </span>
              </RowButton>
            </Section>

            <Section title="History">
              <RowButton onClick={() => { onOpenLog(); onOpenChange(false) }} icon={<History className="w-4 h-4" />} aria-label="Open defect history">
                <span>Defect History</span>
              </RowButton>
            </Section>
          </div>
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function RowButton({
  onClick,
  icon,
  children,
  ...rest
}: {
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 h-11 px-3 rounded-lg bg-sunken hover:bg-lifted text-sm transition-colors text-left"
      {...rest}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 flex items-center justify-between gap-2">{children}</span>
    </button>
  )
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/dashboard/settings-sheet.test.tsx
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/settings-sheet.tsx tests/dashboard/settings-sheet.test.tsx
git commit -m "feat(dashboard): add SettingsSheet — Collect Frames, sound, history"
```

---

### Task 13: Wire SettingsSheet into page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add state + import + mount**

In `app/page.tsx`:

```tsx
import { SettingsSheet } from "@/components/dashboard/settings-sheet"
```

Add a state:

```tsx
const [settingsOpen, setSettingsOpen] = useState(false)
```

Replace the existing `onOpenSettings={() => { /* TODO: wire in Task 11 */ }}` line with:

```tsx
onOpenSettings={() => setSettingsOpen(true)}
```

Mount the sheet near the other slide-outs:

```tsx
<SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} onOpenLog={() => setDefectLogOpen(true)} />
```

- [ ] **Step 2: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 3: Visually verify in browser**

```bash
pnpm dev
```

Tap the ≡ icon in the top strip. The settings sheet slides in. The Collect Frames toggle reflects backend truth (verify by toggling, then reloading).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(dashboard): wire SettingsSheet behind ≡ icon"
```

---

### Task 14: Severity-tiered DefectAlert with progress bar

The current `defect-alert.tsx` does a full-screen flash and a top banner. Replace with the severity-tiered slide-up card from the spec. Card sits at the bottom-center of the live feed, has a left-edge severity stripe, a thumbnail, type+severity, meta, and a progress bar that visually counts down the dwell.

**Files:**
- Modify: `components/dashboard/defect-alert.tsx`
- Create: `tests/dashboard/defect-alert.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, act } from '@testing-library/react'
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
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/dashboard/defect-alert.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Reimplement `defect-alert.tsx`**

```tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { API } from "@/lib/api"
import { useSSE } from "@/hooks/use-polling"

interface DefectEvent {
  id: number
  timestamp: string
  type: string
  severity: "critical" | "major" | "minor"
  aiVerdict: string
  ssimScore: number | null
}

const TIER: Record<string, { dwellMs: number; borderClass: string; stripeClass: string; thumbClass: string; progressClass: string }> = {
  critical: {
    dwellMs: 5000,
    borderClass: "border-destructive/40",
    stripeClass: "border-l-destructive",
    thumbClass: "from-destructive/40 to-destructive/15 border-destructive/40",
    progressClass: "bg-destructive",
  },
  major: {
    dwellMs: 5000,
    borderClass: "border-warning/40",
    stripeClass: "border-l-warning",
    thumbClass: "from-warning/40 to-warning/15 border-warning/40",
    progressClass: "bg-warning",
  },
  minor: {
    dwellMs: 3000,
    borderClass: "border-border-strong",
    stripeClass: "border-l-muted-foreground",
    thumbClass: "from-sunken to-card border-border-strong",
    progressClass: "bg-muted-foreground",
  },
}

export function DefectAlertOverlay() {
  const [active, setActive] = useState<DefectEvent | null>(null)
  const [progress, setProgress] = useState(100) // 100 → 0
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const dismiss = useCallback(() => {
    setActive(null)
    setProgress(100)
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null }
    if (tickTimer.current) { clearInterval(tickTimer.current); tickTimer.current = null }
  }, [])

  const onDefectEvent = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw) as DefectEvent
      const tier = TIER[data.severity] ?? TIER.minor
      setActive(data)
      setProgress(100)
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      if (tickTimer.current) clearInterval(tickTimer.current)
      const start = performance.now()
      tickTimer.current = setInterval(() => {
        const elapsed = performance.now() - start
        const remaining = Math.max(0, 100 - (elapsed / tier.dwellMs) * 100)
        setProgress(remaining)
      }, 50)
      dismissTimer.current = setTimeout(dismiss, tier.dwellMs)
    } catch (err) {
      console.error("Failed to parse SSE defect event:", err)
    }
  }, [dismiss])
  useSSE(API.events, { events: { defect: onDefectEvent } })

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      if (tickTimer.current) clearInterval(tickTimer.current)
    }
  }, [])

  if (!active) return null
  const tier = TIER[active.severity] ?? TIER.minor

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-12 left-1/2 z-30 -translate-x-1/2 bg-card border ${tier.borderClass} ${tier.stripeClass} border-l-[3px] rounded-lg pl-3.5 pr-4 py-3 flex items-center gap-3.5 min-w-[320px] shadow-2xl overflow-hidden`}
      style={{ animation: "alert-slide-up 320ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}
    >
      <div className={`w-10 h-10 rounded bg-gradient-to-br ${tier.thumbClass} border flex items-center justify-center flex-shrink-0`}>
        <AlertTriangle className="w-4 h-4 opacity-80" />
      </div>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="font-semibold text-sm capitalize">{active.type} · {active.severity}</div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {active.timestamp.slice(11, 19)} · SSIM {active.ssimScore?.toFixed(3) ?? "—"} · #{active.id}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-[10px] text-muted-foreground hover:text-foreground"
        aria-label="Dismiss alert"
      >
        tap to dismiss
      </button>
      <div className={`absolute bottom-0 left-0 h-[2px] ${tier.progressClass}`} style={{ width: `${progress}%` }} />
    </div>
  )
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/dashboard/defect-alert.test.tsx
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/defect-alert.tsx tests/dashboard/defect-alert.test.tsx
git commit -m "feat(dashboard): severity-tiered DefectAlert with progress bar dwell"
```

---

### Task 15: useHoldToConfirm hook

A reusable hook that returns props (`onMouseDown`, `onMouseUp`, `onMouseLeave`, `onTouchStart`, `onTouchEnd`, `onTouchCancel`) for a button, a `progress` value (0-1), and an `isHolding` flag. Fires `onConfirm` after `holdMs` of continuous press.

**Files:**
- Create: `lib/use-hold-to-confirm.ts`
- Create: `tests/lib/use-hold-to-confirm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
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
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/lib/use-hold-to-confirm.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `lib/use-hold-to-confirm.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react"

export function useHoldToConfirm({ onConfirm, holdMs }: { onConfirm: () => void; holdMs: number }) {
  const [progress, setProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const startedAt = useRef<number | null>(null)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)
  const fire = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    setIsHolding(false)
    setProgress(0)
    startedAt.current = null
    if (tick.current) { clearInterval(tick.current); tick.current = null }
    if (fire.current) { clearTimeout(fire.current); fire.current = null }
  }, [])

  const start = useCallback(() => {
    if (startedAt.current !== null) return
    setIsHolding(true)
    startedAt.current = performance.now()
    tick.current = setInterval(() => {
      const elapsed = performance.now() - (startedAt.current ?? 0)
      setProgress(Math.min(1, elapsed / holdMs))
    }, 16)
    fire.current = setTimeout(() => {
      onConfirm()
      stop()
    }, holdMs)
  }, [holdMs, onConfirm, stop])

  useEffect(() => () => stop(), [stop])

  return {
    progress,
    isHolding,
    bind: {
      onMouseDown: start,
      onMouseUp: stop,
      onMouseLeave: stop,
      onTouchStart: start,
      onTouchEnd: stop,
      onTouchCancel: stop,
    },
  }
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/lib/use-hold-to-confirm.test.tsx
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/use-hold-to-confirm.ts tests/lib/use-hold-to-confirm.test.tsx
git commit -m "feat(lib): add useHoldToConfirm hook"
```

---

### Task 16: ConfirmSheet component

Modal with a hold-to-confirm destructive button. Used by Stop, Clear, Reset Reference.

**Files:**
- Create: `components/dashboard/confirm-sheet.tsx`
- Create: `tests/dashboard/confirm-sheet.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
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
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/dashboard/confirm-sheet.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `confirm-sheet.tsx`**

```tsx
"use client"

import { useHoldToConfirm } from "@/lib/use-hold-to-confirm"

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { progress, isHolding, bind } = useHoldToConfirm({ onConfirm, holdMs: 800 })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative bg-card border border-border-strong rounded-xl p-5 w-[460px] max-w-[90vw] shadow-2xl">
        <h4 className="text-base font-semibold mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{body}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 px-3.5 rounded-md bg-sunken hover:bg-lifted border border-border-soft text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            {...bind}
            aria-label={`Hold to ${confirmLabel.toLowerCase()}`}
            className="flex-1 h-11 px-3.5 rounded-md text-sm font-semibold text-white relative overflow-hidden bg-destructive/60 hover:bg-destructive/70"
          >
            <span className="relative z-10">
              {isHolding ? `Hold… ${(progress * 0.8).toFixed(1)}s` : `Hold to ${confirmLabel.toLowerCase()}`}
            </span>
            <div
              className="absolute inset-y-0 left-0 bg-destructive transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/dashboard/confirm-sheet.test.tsx
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/confirm-sheet.tsx tests/dashboard/confirm-sheet.test.tsx
git commit -m "feat(dashboard): add ConfirmSheet with hold-to-confirm pattern"
```

---

### Task 17: Wire ConfirmSheet into Stop / Clear / Reset Reference

**Files:**
- Modify: `components/dashboard/inspection-controls.tsx`

- [ ] **Step 1: Replace stop and reset-reference handlers to open the confirm sheet**

At the top of the file, add the import and a state machine for which confirm is active:

```tsx
import { ConfirmSheet } from "./confirm-sheet"

type ConfirmKind = null | "stop" | "reset-reference"
```

Add inside the component body:

```tsx
const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null)
```

Replace `handleStop`:

```tsx
const handleStop = () => setConfirmKind("stop")
const performStop = async () => {
  setConfirmKind(null)
  setState("stopped")
  try { await apiFetch(API.inspectionStop, { method: "POST" }) } catch { /* offline */ }
}
```

Replace `handleResetReference`:

```tsx
const handleResetReference = () => setConfirmKind("reset-reference")
const performResetReference = async () => {
  setConfirmKind(null)
  try { await apiFetch(API.resetReference, { method: "POST" }) } catch { /* offline */ }
}
```

Mount the sheet at the bottom of the JSX (just before the closing `</div>` of the root):

```tsx
<ConfirmSheet
  open={confirmKind === "stop"}
  title="Stop inspection?"
  body="Stops the inspection loop and resets run-time stats. Defect history is preserved. The current run cannot be resumed — Start will begin a new run."
  confirmLabel="Stop"
  onConfirm={performStop}
  onCancel={() => setConfirmKind(null)}
/>
<ConfirmSheet
  open={confirmKind === "reset-reference"}
  title="Reset golden reference?"
  body="The golden reference image will be cleared. Inspection cannot resume until a new reference is captured."
  confirmLabel="Reset"
  onConfirm={performResetReference}
  onCancel={() => setConfirmKind(null)}
/>
```

- [ ] **Step 2: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/inspection-controls.tsx
git commit -m "feat(dashboard): hold-to-confirm on Stop and Reset Reference"
```

---

### Task 18: Add Clear Defect History action via SettingsSheet + ConfirmSheet

The audit added `POST /api/defects/clear` but no UI calls it yet. This task wires it up: a third row in the History section of the settings sheet, gated by ConfirmSheet.

**Files:**
- Modify: `components/dashboard/settings-sheet.tsx`
- Modify: `lib/api.ts`

- [ ] **Step 1: Add the API endpoint constant**

In `lib/api.ts`, add to the `API` const object:

```ts
defectsClear: `${API_BASE}/api/defects/clear`,
```

- [ ] **Step 2: Add the row + confirm flow to SettingsSheet**

In `components/dashboard/settings-sheet.tsx`, import:

```tsx
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { ConfirmSheet } from "./confirm-sheet"
```

Add state:

```tsx
const [confirming, setConfirming] = useState(false)
```

Below the `<RowButton>` for Defect History, add another row in the History section:

```tsx
<RowButton onClick={() => setConfirming(true)} icon={<Trash2 className="w-4 h-4" />}>
  <span className="text-destructive">Clear All Defects</span>
</RowButton>
```

At the end of the component (after the closing `</div>` of the slide-out), add:

```tsx
<ConfirmSheet
  open={confirming}
  title="Clear defect history?"
  body="Deletes all defect rows and annotated images from disk. The current run continues. This cannot be undone."
  confirmLabel="Clear"
  onConfirm={async () => {
    setConfirming(false)
    try { await apiFetch(API.defectsClear, { method: "POST" }) } catch { /* offline */ }
  }}
  onCancel={() => setConfirming(false)}
/>
```

- [ ] **Step 3: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/api.ts components/dashboard/settings-sheet.tsx
git commit -m "feat(dashboard): wire Clear Defect History via settings sheet + hold-to-confirm"
```

---

### Task 19: lib/sound.ts — critical chime helper

Web Audio API. Single function `playCriticalChime()` — sine wave 520Hz, 80ms exponential decay. No autoplay before first user interaction.

**Files:**
- Create: `lib/sound.ts`
- Create: `tests/lib/sound.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
    const connect = vi.fn()
    const exponentialRampToValueAtTime = vi.fn()
    const setValueAtTime = vi.fn()
    const fakeCtx = {
      currentTime: 0,
      destination: {},
      createOscillator: () => ({ type: '', frequency: { value: 0 }, connect, start, stop }),
      createGain: () => ({ gain: { value: 0, setValueAtTime, exponentialRampToValueAtTime }, connect }),
    }
    Object.defineProperty(window, 'AudioContext', { value: vi.fn(() => fakeCtx), configurable: true })
    Object.defineProperty(window, 'localStorage', { value: { getItem: () => '1' }, configurable: true })
    playCriticalChime()
    expect(start).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/lib/sound.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `lib/sound.ts`**

```ts
const SOUND_KEY = "ueye:sound-enabled"

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  return ctx
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(SOUND_KEY) === "1"
}

export function playCriticalChime(): void {
  if (!isSoundEnabled()) return
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = "sine"
  osc.frequency.value = 520
  gain.gain.setValueAtTime(0.18, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08)
  osc.connect(gain).connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + 0.1)
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/lib/sound.test.ts
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/sound.ts tests/lib/sound.test.ts
git commit -m "feat(lib): add critical-chime helper using Web Audio"
```

---

### Task 20: Wire critical chime into DefectAlert

**Files:**
- Modify: `components/dashboard/defect-alert.tsx`

- [ ] **Step 1: Import + invoke**

At the top:

```tsx
import { playCriticalChime } from "@/lib/sound"
```

Inside `onDefectEvent`, after `setActive(data)`:

```tsx
if (data.severity === "critical") playCriticalChime()
```

- [ ] **Step 2: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/defect-alert.tsx
git commit -m "feat(dashboard): play critical chime when sound is enabled"
```

---

### Task 21: Skeleton component + apply to TopStrip and HealthStrip

**Files:**
- Create: `components/ui/skeleton.tsx`
- Modify: `components/dashboard/top-strip.tsx` (props changes)
- Modify: `components/dashboard/health-strip.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create the Skeleton component**

```tsx
import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded bg-sunken animate-pulse", className)}
      aria-hidden="true"
    />
  )
}
```

- [ ] **Step 2: Add a `loading` prop to TopStrip**

In `components/dashboard/top-strip.tsx`, add `loading?: boolean` to the props. When `loading` is true, render the strip with `<Skeleton className="h-3 w-12">` placeholders instead of values. Keep the layout otherwise identical so nothing reflows.

- [ ] **Step 3: Wire `loading` from page.tsx**

In `app/page.tsx`, track an `initialLoaded` boolean. Set to `true` after the first successful poll. Pass `loading={!initialLoaded}` to TopStrip.

```tsx
const [initialLoaded, setInitialLoaded] = useState(false)

const pollStats = useCallback(async () => {
  try {
    const res = await apiFetch(API.stats)
    if (res.ok) {
      const data = await res.json()
      setStats({ /* … */ })
      setHasReference(data.hasReference ?? false)
      setInitialLoaded(true)
    }
  } catch { /* offline */ }
}, [])
```

- [ ] **Step 4: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/ui/skeleton.tsx components/dashboard/top-strip.tsx app/page.tsx
git commit -m "feat(design): loading skeletons in TopStrip during initial load"
```

---

### Task 22: Numeric value pop-in animation

When a stat value changes (e.g., Defects 6 → 7), apply the `value-pop` keyframes.

**Files:**
- Create: `components/ui/animated-number.tsx`
- Modify: `components/dashboard/top-strip.tsx`
- Create: `tests/ui/animated-number.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
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
    // Different mount = animation re-fires
    expect(first).not.toBe(second)
  })
})
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/ui/animated-number.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `components/ui/animated-number.tsx`**

```tsx
"use client"

export function AnimatedNumber({ value, className }: { value: string | number; className?: string }) {
  return (
    <span
      key={String(value)}
      className={`inline-block ${className ?? ""}`}
      style={{ animation: "value-pop 200ms cubic-bezier(0.4, 0, 0.2, 1) both" }}
    >
      {value}
    </span>
  )
}
```

- [ ] **Step 4: Apply in TopStrip**

In `components/dashboard/top-strip.tsx`, swap `{value}` inside `Stat` for `<AnimatedNumber value={value} />`. Apply the same swap to the Defects-stat button. Skip Run timer (changes too fast).

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add components/ui/animated-number.tsx tests/ui/animated-number.test.tsx components/dashboard/top-strip.tsx
git commit -m "feat(design): numeric value pop-in animation for stats"
```

---

### Task 23: Cursor auto-hide

Hide the mouse cursor after 3 seconds of inactivity. Touch never shows it.

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add the CSS**

Append to `globals.css`:

```css
.cursor-idle, .cursor-idle * { cursor: none !important; }
```

- [ ] **Step 2: Add a small client-side script to layout**

Modify `app/layout.tsx` to render a `<CursorAutoHide />` client component inside `<body>`. Create the component:

`components/cursor-auto-hide.tsx`:

```tsx
"use client"

import { useEffect } from "react"

export function CursorAutoHide({ idleMs = 3000 }: { idleMs?: number }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const reset = () => {
      document.body.classList.remove("cursor-idle")
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => document.body.classList.add("cursor-idle"), idleMs)
    }
    document.addEventListener("mousemove", reset)
    document.addEventListener("touchstart", reset)
    document.addEventListener("keydown", reset)
    reset()
    return () => {
      document.removeEventListener("mousemove", reset)
      document.removeEventListener("touchstart", reset)
      document.removeEventListener("keydown", reset)
      if (timer) clearTimeout(timer)
    }
  }, [idleMs])
  return null
}
```

In `app/layout.tsx`, import and render:

```tsx
import { CursorAutoHide } from "@/components/cursor-auto-hide"

// inside <body>:
<CursorAutoHide />
{children}
```

- [ ] **Step 3: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx components/cursor-auto-hide.tsx
git commit -m "feat(kiosk): hide cursor after 3s of inactivity"
```

---

### Task 24: Burn-in protection — subtle position shift on idle

Every minute of idle (no defect, no input), shift the layout 2px in a slowly rotating direction. After 10 minutes idle, dim the live feed slightly.

**Files:**
- Create: `components/burn-in-guard.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement `burn-in-guard.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"

export function BurnInGuard({ children }: { children: React.ReactNode }) {
  const [shift, setShift] = useState({ x: 0, y: 0, dim: false })

  useEffect(() => {
    let lastInput = Date.now()
    const reset = () => { lastInput = Date.now() }
    document.addEventListener("mousemove", reset)
    document.addEventListener("touchstart", reset)
    document.addEventListener("keydown", reset)

    const tick = setInterval(() => {
      const idleSec = (Date.now() - lastInput) / 1000
      if (idleSec < 60) { setShift({ x: 0, y: 0, dim: false }); return }
      const minute = Math.floor(idleSec / 60)
      const angle = (minute % 4) * (Math.PI / 2)
      setShift({ x: Math.round(Math.cos(angle) * 2), y: Math.round(Math.sin(angle) * 2), dim: idleSec > 600 })
    }, 30000)

    return () => {
      document.removeEventListener("mousemove", reset)
      document.removeEventListener("touchstart", reset)
      document.removeEventListener("keydown", reset)
      clearInterval(tick)
    }
  }, [])

  return (
    <div
      style={{
        transform: `translate(${shift.x}px, ${shift.y}px)`,
        filter: shift.dim ? "brightness(0.92)" : undefined,
        transition: "transform 8s linear, filter 8s linear",
        height: "100%",
        width: "100%",
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Wrap the layout in `app/page.tsx`**

Wrap the root `<div ref={containerRef} ...>` body inside `<BurnInGuard>`. Only the inner contents, not the ref itself, since fullscreen needs the ref.

- [ ] **Step 3: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/burn-in-guard.tsx app/page.tsx
git commit -m "feat(kiosk): burn-in protection — subtle drift + dim on idle"
```

---

### Task 25: Live-feed double-tap → fullscreen

**Files:**
- Modify: `components/dashboard/live-feed.tsx`

- [ ] **Step 1: Add a double-tap detector to the live-feed container**

In `components/dashboard/live-feed.tsx`, find the inner `<div ref={containerRef} ...>` (the one wrapping the `<img>`). Add a `useRef` for the last tap timestamp at the top of the component:

```tsx
const lastTapRef = useRef<number>(0)
```

Add an `onClick` to that div:

```tsx
onClick={() => {
  const now = performance.now()
  if (now - lastTapRef.current < 300) {
    toggleFullscreen()
    lastTapRef.current = 0
  } else {
    lastTapRef.current = now
  }
}}
```

The existing `toggleFullscreen` already lives in this component from the audit work.

- [ ] **Step 2: Verify lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/live-feed.tsx
git commit -m "feat(dashboard): double-tap live feed to toggle fullscreen"
```

---

### Task 26: Defect alert tap-to-expand with action buttons

When the operator taps the alert card, cancel the auto-dismiss timer and expand the card to show Acknowledge / Open in log / Mark false positive buttons.

**Files:**
- Modify: `components/dashboard/defect-alert.tsx`
- Modify: `tests/dashboard/defect-alert.test.tsx`

- [ ] **Step 1: Extend the test**

Append to `tests/dashboard/defect-alert.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react'

describe('DefectAlertOverlay — expand', () => {
  it('expands and cancels timer on tap', () => {
    render(<DefectAlertOverlay />)
    const es = (FakeEventSource as unknown as { latest: FakeEventSource }).latest
    act(() => {
      es.emit('defect', { id: 1, type: 'Hickey', severity: 'critical', timestamp: 't', ssimScore: 0.42, aiVerdict: 'reject' })
    })
    fireEvent.click(screen.getByRole('alert'))
    // After expand, action buttons appear
    expect(screen.getByRole('button', { name: /acknowledge/i })).toBeInTheDocument()
    // Timer cancelled — advance past dwell, alert should still be present
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
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/dashboard/defect-alert.test.tsx
```

Expected: 2 new tests FAIL.

- [ ] **Step 3: Update `defect-alert.tsx` to support expand**

Inside the component, add a state for expansion and a handler:

```tsx
const [expanded, setExpanded] = useState(false)

const expand = () => {
  if (expanded) return
  setExpanded(true)
  // Cancel auto-dismiss
  if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null }
  if (tickTimer.current) { clearInterval(tickTimer.current); tickTimer.current = null }
  setProgress(0)
}
```

In `dismiss`, also reset `setExpanded(false)`. In `onDefectEvent`, also `setExpanded(false)` when a new defect arrives.

Update the JSX root: add `onClick={expand}` to the outer `<div role="alert">`. Below the existing meta line, conditionally render the expanded actions:

```tsx
{expanded && (
  <div className="w-full flex gap-2 pt-3 mt-3 border-t border-border-soft">
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); dismiss() }}
      className="flex-1 h-10 rounded bg-primary text-primary-foreground text-xs font-semibold"
    >
      Acknowledge
    </button>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); /* parent should also pass an open-log callback in a future iteration */ dismiss() }}
      className="flex-1 h-10 rounded bg-sunken text-foreground text-xs font-medium border border-border-soft"
    >
      Open in log
    </button>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); dismiss() }}
      className="flex-1 h-10 rounded bg-sunken text-muted-foreground text-xs font-medium border border-border-soft"
    >
      False positive
    </button>
  </div>
)}
```

You will also need to change the root element from a flex row to a flex column when expanded. Restructure the layout so the meta row sits above the (optional) actions row. Simplest: wrap the existing thumbnail + body + dismiss-link in a top-row div, keep the progress bar absolute, and conditionally append the actions div as a sibling.

Replace the JSX body of the root container with:

```tsx
<div className="flex items-center gap-3.5 w-full">
  <div className={`w-10 h-10 rounded bg-gradient-to-br ${tier.thumbClass} border flex items-center justify-center flex-shrink-0`}>
    <AlertTriangle className="w-4 h-4 opacity-80" />
  </div>
  <div className="flex-1 flex flex-col gap-0.5">
    <div className="font-semibold text-sm capitalize">{active.type} · {active.severity}</div>
    <div className="text-[10px] font-mono text-muted-foreground">
      {active.timestamp.slice(11, 19)} · SSIM {active.ssimScore?.toFixed(3) ?? "—"} · #{active.id}
    </div>
  </div>
  {!expanded && (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); dismiss() }}
      className="text-[10px] text-muted-foreground hover:text-foreground"
      aria-label="Dismiss alert"
    >
      tap to dismiss
    </button>
  )}
</div>
{expanded && (
  /* actions block above */
)}
```

Set the root container's `flex-direction` to `flex-col items-stretch` when expanded, otherwise the original `flex items-center gap-3.5`. Easiest with conditional class:

```tsx
className={`fixed bottom-12 left-1/2 z-30 -translate-x-1/2 bg-card border ${tier.borderClass} ${tier.stripeClass} border-l-[3px] rounded-lg pl-3.5 pr-4 py-3 ${expanded ? "flex flex-col gap-2 min-w-[420px]" : "flex items-center gap-3.5 min-w-[320px]"} shadow-2xl overflow-hidden`}
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/dashboard/defect-alert.test.tsx
```

Expected: all tests pass (original 4 + new 2).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/defect-alert.tsx tests/dashboard/defect-alert.test.tsx
git commit -m "feat(dashboard): defect alert tap-to-expand with action buttons"
```

---

### Task 27: Defect alert stack — keep latest, badge older as +N

Multiple defects in quick succession can pile up. Show only the most recent, with a small "+N more" badge that shows how many defects arrived during the current dwell. Tapping the badge cycles to the previous defect.

**Files:**
- Modify: `components/dashboard/defect-alert.tsx`
- Modify: `tests/dashboard/defect-alert.test.tsx`

- [ ] **Step 1: Extend the test**

Append to `tests/dashboard/defect-alert.test.tsx`:

```tsx
describe('DefectAlertOverlay — stack', () => {
  it('shows +N badge when multiple defects arrive during dwell', () => {
    render(<DefectAlertOverlay />)
    const es = (FakeEventSource as unknown as { latest: FakeEventSource }).latest
    act(() => {
      es.emit('defect', { id: 1, type: 'Hickey', severity: 'critical', timestamp: 't', ssimScore: 0.42, aiVerdict: 'reject' })
    })
    act(() => {
      es.emit('defect', { id: 2, type: 'Smudge', severity: 'major', timestamp: 't', ssimScore: 0.62, aiVerdict: 'reject' })
    })
    expect(screen.getByText(/\+1/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test**

```bash
pnpm test tests/dashboard/defect-alert.test.tsx
```

Expected: new test fails.

- [ ] **Step 3: Update `defect-alert.tsx` to track stack**

Replace `const [active, setActive] = useState<DefectEvent | null>(null)` with:

```tsx
const [stack, setStack] = useState<DefectEvent[]>([])  // newest first, max 3
const active = stack[0] ?? null
const overflowCount = Math.max(0, stack.length - 1)
```

In `onDefectEvent`, instead of `setActive(data)`, do:

```tsx
setStack((prev) => [data, ...prev].slice(0, 3))
```

In `dismiss`, replace `setActive(null)` with `setStack([])`.

Render the badge inside the alert card. After the meta row but before the dismiss-tap link (or beside it):

```tsx
{overflowCount > 0 && (
  <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-sunken text-muted-foreground border border-border-soft">
    +{overflowCount}
  </span>
)}
```

- [ ] **Step 4: Run the test**

```bash
pnpm test tests/dashboard/defect-alert.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/defect-alert.tsx tests/dashboard/defect-alert.test.tsx
git commit -m "feat(dashboard): defect alert stack with +N overflow badge"
```

---

### Task 28: Final lint, build, full test pass, doc update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full backend test suite (smoke)**

```bash
cd backend && pytest 2>&1 | tail -20 && cd ..
```

Expected: all backend tests pass (the redesign didn't touch backend, but confirm).

- [ ] **Step 2: Run the frontend test suite**

```bash
pnpm test
```

Expected: all green.

- [ ] **Step 3: Run lint + build**

```bash
pnpm lint && pnpm build
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Update `CLAUDE.md`**

Update the "Frontend Layout" section to reflect the Cockpit grid:

```
+--------------------------------------------------------------+
| TOP STRIP — Inspected · Defects · Rate · Run · Status · ≡ ⛶  |
+------+-----------------------------------+-------------------+
|CTRLS | LIVE FEED                         | GOLDEN REFERENCE  |
|      |                                   +-------------------+
|      | (defect alert slides up here)     | LAST DEFECT       |
+------+-----------------------------------+-------------------+
| BOTTOM STRIP — Camera · FPS · Alignment · State · Pipeline · |
|                Defect mix                                    |
+--------------------------------------------------------------+
```

Update the component table to add: TopStrip, HealthStrip, GoldenReference, LastDefect, SettingsSheet, ConfirmSheet, AnimatedNumber, Skeleton, BurnInGuard, CursorAutoHide. Remove: DashboardHeader, StatsBar, ReferenceComparison.

Add a "Frontend Tests" section noting Vitest + RTL, `pnpm test` to run.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Cockpit redesign"
```

---

## Plan complete

All 28 tasks ship the Cockpit redesign from `docs/superpowers/specs/2026-04-16-frontend-redesign-design.md`. Each task is independently committable. The spec's 10-phase suggested order maps to these tasks like so:

| Spec phase | Tasks |
|---|---|
| 1. Tokens + globals (incl. focus rings) | 2, 3 |
| 2. Top + bottom strips | 4, 5, 6, 7 |
| 3. Reference + Last Defect split | 8, 9, 10 |
| 4. Inspection controls refresh | 11 |
| 5. Settings sheet | 12, 13 |
| 6. Defect alert overhaul | 14, 26, 27 |
| 7. Confirmation sheet | 15, 16, 17, 18 |
| 8. Sound | 19, 20 |
| 9. Polish (skeletons, value pop, cursor hide, burn-in, double-tap fullscreen) | 21, 22, 23, 24, 25 |
| 10. Tests | 1 (scaffolding) + per-task tests |
| Final | 28 (lint, build, doc update) |

Tests are integrated into every behavior task rather than being a single trailing phase. Tasks 25 (live-feed double-tap), 26 (alert expand), 27 (alert stack) — three behaviors called out in the spec that I caught during self-review and added.

### Deferred from spec

- **Stale-state UI when backend is lost** (panels go 60% opacity) — the existing `usePolling`/`useSSE` reconnect handles recovery; the visual stale cue is polish that I'm leaving to iterate after the operator uses the kiosk and tells us if missing it bothers them.
- **Alert swipe-down dismiss gesture** — added the dismiss button + tap; pointer-event swipe detection is non-trivial and the dismiss button covers the same intent.
