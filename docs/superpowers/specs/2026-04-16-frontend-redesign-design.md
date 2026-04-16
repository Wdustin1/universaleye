# Universal Eye — Frontend Redesign Design

**Date:** 2026-04-16
**Status:** Spec for review
**Owner:** Dustin

## Goal

Redesign the Universal Eye operator dashboard to look and feel premium while keeping critical information glanceable. Production target is a 27" landscape touchscreen at arm's reach; development target stays a MacBook in the browser.

## Non-goals

- No backend changes. The frontend talks to the existing FastAPI surface.
- No new product capabilities. Everything operators do today, they still do.
- No multi-tenant / multi-line work. Single inspection station, single operator.
- No mobile / portrait layouts. The kiosk is landscape, full stop.

## Constraints

- **Hardware**: 27" landscape touchscreen, ~1920×1080 or 2560×1440. Operator stands within arm's reach and taps frequently.
- **Touch only in production**, mouse + keyboard in dev. Hover affordances are forbidden.
- **Stack**: stay on Next.js 16 App Router + React 19 + Tailwind 3 + shadcn/ui. No new design-system dependency.
- **Always-on kiosk**: never refresh, never log out. Burn-in protection matters.

## Visual identity

### Style direction

Industrial precision (instrument-cluster density, restrained color, monospaced numerics, status semantics) blended with SaaS calm (refined typography, generous breathing room inside dense panels, soft ambient depth). The reference points are Linear's typography paired with a Bloomberg terminal's information density.

### Color tokens

Five surface levels, replacing today's three. All values in HSL so we can tune in `globals.css`.

| Token | HSL | Use |
|---|---|---|
| `--canvas` | `225 20% 4%` | Page background, the deepest layer |
| `--card` | `225 18% 7%` | Panel surface |
| `--sunken` | `225 14% 11%` | Inner sub-panel (slider track, button rest) |
| `--lifted` | `225 14% 15%` | Button hover/active, sheet surface |
| `--border-soft` | `225 12% 13%` | Default panel border |
| `--border-strong` | `225 12% 18%` | Active panel border, divider |
| `--accent` | `168 75% 42%` | Primary teal (unchanged from today) |
| `--accent-glow` | `168 75% 42% / 0.15` | Halos around live elements |
| `--success` | `142 71% 45%` | Camera live, pipeline healthy (unchanged) |
| `--warning` | `38 92% 50%` | Major defects, alignment poor (unchanged) |
| `--destructive` | `0 72% 51%` | Critical defects (unchanged) |

### Typography

Stack stays the same (Inter sans + JetBrains Mono via `next/font`). What changes is how we use it:

| Role | Font | Size | Weight | Casing |
|---|---|---|---|---|
| Display numeric | JetBrains Mono | 32px | 600 | tabular-nums |
| Stat numeric | JetBrains Mono | 22px | 600 | tabular-nums |
| Section title | Inter | 11px | 500 | UPPERCASE, tracking 0.08em |
| Body | Inter | 13px | 400 | normal |
| Caption | Inter | 11px | 400 | normal, muted |

All numeric output uses `font-variant-numeric: tabular-nums` so counters don't shift width when ticking.

### Panel chrome

- Background `--card`, 1px border `--border-soft`, 8px radius
- Panel header: 11px uppercase title with 0.08em tracking, 6px "live" dot when actively updating, 1px bottom divider on `--border-soft`
- Live dot uses `--accent` with a 4px halo at 15% opacity that pulses subtly (`--ease-pulse`)
- No drop shadows in normal state. Modal sheets get `0 16px 48px rgba(0,0,0,0.7)` for elevation.

## Layout (Cockpit)

3-column landscape grid with thin top/bottom strips. Reference wireframe in `.superpowers/brainstorm/.../layout-cockpit.html`.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOP STRIP                                                                │
│  Inspected · Defects · Rate · Run · ─────────── Status chip · ≡ · ⛶     │
├──────┬──────────────────────────────────────────────┬────────────────────┤
│ CTRL │              LIVE FEED                       │  GOLDEN REFERENCE  │
│      │                                              │                    │
│ Start│           (MJPEG, full panel)                │                    │
│ Pause│                                              ├────────────────────┤
│ Stop │                                              │   LAST DEFECT      │
│      │  bottom-center: slide-up alert when defect   │   (auto-promoted)  │
│ Sens │                                              │                    │
│ Ref  │                                              │                    │
├──────┴──────────────────────────────────────────────┴────────────────────┤
│ BOTTOM STRIP                                                             │
│  Camera · FPS · Alignment · State · Pipeline ─── Defect mix summary      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Top strip

A single row consolidating today's `DashboardHeader` + `StatsBar`. Contents:

- Stat tuple × 4: Inspected, Defects, Rate (defects ÷ inspected), Run timer
- Inspection status chip (running / paused / stopped, color-coded)
- `≡` icon → opens settings sheet (Collect Frames toggle, sensitivity numeric, sound toggle, defect history shortcut)
- `⛶` icon → native browser fullscreen toggle

The Defects stat is itself a tap target — tapping it opens the existing slide-out defect log. No separate "Defect History" button.

### Center column — live feed

Full panel for the MJPEG stream. Existing zoom/grid/fullscreen controls move into a corner cluster. Existing onboarding overlay (no-reference state) stays. Existing "REC" / time / defect-count corner badges stay but settle to opacity 0.7.

### Right column — reference + last defect

Two stacked panels of equal height:

- **Golden Reference** — same as today's reference image, refreshed on a 5s polling beat (cache-busting via timestamp param can be removed — backend already sends `Cache-Control: no-store`, so the param is dead bytes).
- **Last Defect** — newly promoted to a permanent panel. Shows the most recent annotated defect image, type chip, severity, SSIM score, timestamp. Tapping enlarges in a modal (existing `DefectDetail`).

Today's `ReferenceComparison` component handles both — split it.

### Left column — controls

Vertical stack, 110px wide:

- **Transport group**: Start (primary, 56px tall), Pause + Stop (44px each, in a 2-up grid)
- **Sensitivity group**: numeric label + horizontal slider (visual knob 14px, hit zone 44px tall, debounce 200ms — already in code)
- **Reference group**: New Reference + Reset (icon-only buttons with text labels, 36px tall each)

The Collect Frames toggle and "Label Frames" link move out of this column into the settings sheet. They're power-user controls, not daily-use.

### Bottom strip

A single row of six health readouts:

- Camera (live / no signal — color)
- FPS (capture rate)
- Alignment (last ORB confidence, 0-1)
- State (state-machine state: monitoring / motion / stabilizing / inspect)
- Pipeline (healthy / degraded / down — derived from health + recent inspection success)
- Defect mix (one-line summary like `3H · 2S · 1M · 1Sc`)

The full breakdown chart (today's `DefectBreakdown`) moves behind the ≡ menu.

### Z-stack

| Layer | Contents | z-index |
|---|---|---|
| Base | Cockpit layout | 0 |
| Defect alert card (slide-up) | Over live feed | 30 |
| Defect log slide-out panel | From right edge | 40 |
| Settings sheet | From right edge | 40 |
| Modal (defect detail, confirm sheet) | Center, with backdrop | 50 |

Only one of {alert card, slide-out, sheet, modal} can be open at once. Opening any of them dismisses the others except the alert (the alert is meant to coexist).

## Interaction patterns

### Touch gesture matrix

| Action | Gesture | Notes |
|---|---|---|
| Start / Resume | tap | Big primary button |
| Pause | tap | Reversible |
| Stop | tap → confirm sheet | Resets run timer |
| Clear defect history | tap → **hold-to-confirm 800ms** | Fully destructive, no undo |
| Reset reference | tap → confirm sheet | Forces operator to set a new one before resuming |
| Capture new reference | tap | Reversible (re-capture) |
| Sensitivity slider | drag (44px tap zone) | Debounced 200ms |
| Defect alert card | tap to expand · swipe-down to dismiss | Auto-dismiss timer cancels on tap |
| Live feed | double-tap → fullscreen | Existing fullscreen icon also works |
| Reference / Last Defect panels | tap → enlarge in modal | Detail review without leaving page |
| Open settings sheet | tap ≡ icon (top-right) | |
| Open defect history | tap defects count in top strip | The number IS the affordance |

No hover-only behaviors anywhere. `:focus-visible` (keyboard) shows a 2px teal ring; `:focus` from touch shows nothing.

### Defect alert lifecycle

Severity-tiered, all variants of a slide-up card from the bottom-center of the live feed.

| Severity | Border accent | Dwell | Sound |
|---|---|---|---|
| Critical | Red (`--destructive`) | 5s | Chime (if enabled) |
| Major | Amber (`--warning`) | 5s | None |
| Minor | Neutral (`--border-strong`) | 3s | None |

States:

1. **Enter** — `--ease-spring` 320ms slide up + fade in. Progress bar at the bottom of the card visually counts down the dwell.
2. **Idle** — card sits with the progress bar shrinking. Tap to expand → cancels timer, expands inline (40px thumb → 56px, adds Acknowledge / Open in log / Mark false positive buttons).
3. **Dismiss** — `--ease-out-soft` 240ms slide down + fade. Triggered by timer expiry, swipe-down, or Acknowledge tap.
4. **Stack** — if a new defect arrives while one is showing, the existing card collapses to a small "+1" badge at the corner, the new card takes the main slot. Max 3 stacked badges, oldest evicted.

### Confirmation sheet

Replaces native `confirm()`. Used for stop, clear-defects, reset-reference. Modal centered with `rgba(5,7,13,0.7) blur(4px)` backdrop.

- Title in 16px Inter 600
- Body in 12px Inter 400 muted, explains *what* will be deleted and that it can't be undone
- Two buttons: Cancel (ghost) and the destructive action
- The destructive button is **hold-to-confirm** — 800ms hold fills the button background from left to right, completes on full hold, cancels on early release. No accidental single-tap fires the action.

### Empty / failure states

- **Camera lost**: live feed shows existing "no signal" placeholder. Bottom-strip Camera readout flips to amber. Top of live feed shows a thin amber banner: "Capture device not detected — check the connection." No flash, no chime.
- **Backend lost**: top status chip flips to "disconnected" (grey). All panels go 60% opacity. They keep their last-known values (a stale read is more useful than a blank panel during a brief blip). Auto-recovers on reconnect — `useSSE` and `usePolling` already handle this.
- **No reference set**: existing onboarding overlay over the live feed. Start button stays disabled. Bottom strip shows "no reference" in the State column.
- **Alignment failed**: that one inspection is silently skipped (existing behavior). Bottom-strip Alignment value flashes amber once via `--ease-out-snap`. No alert card.

## Motion

### Tokens

```css
--ease-out-snap:  200ms cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring:    320ms cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-out-soft:  240ms cubic-bezier(0.4, 0, 0.2, 1);
--ease-out-fast:  120ms cubic-bezier(0.4, 0, 0.2, 1);
--ease-pulse:     2s ease-in-out infinite;
```

### Where each is used

- `--ease-spring`: alert card entrance, modal open, panel reveal, slide-out drawers
- `--ease-out-soft`: alert card dismiss, sheet close, value-update fade-in
- `--ease-out-snap`: status chip color flips, focus ring, accent value flash on update
- `--ease-out-fast`: button press scale-down, chip pulse on tap
- `--ease-pulse`: live dot halo, REC indicator

### Numeric value updates

When a counter or stat changes (e.g., Defects 6 → 7), the new value cross-fades over `--ease-out-snap` with a 1.05× scale bump. Subtle but signals "this just changed." Not applied to time-of-day or ticking timers (they update too fast for the effect to read).

### Reduced motion

`@media (prefers-reduced-motion: reduce)` — all transitions become instant (`duration: 0ms`). No spring, no overshoot, no scale bump. Layout is identical, motion is gone.

## Sound

**Default: silent.** A single chime fires on critical-severity defects only, and only if the operator opts in via the settings sheet.

The chime is generated via Web Audio API (no audio file) — a sine wave at ~520 Hz with 80ms exponential decay. Quiet, not startling, distinguishable from environmental machine noise.

Browsers refuse autoplay until the user interacts; we play after the operator has tapped Start (their first interaction with the page guarantees the audio context is unlocked).

## Other polish

- **Loading skeletons** instead of spinners. Shimmer across the panel where data will land. 600ms minimum dwell so they don't flicker on fast networks.
- **Cursor auto-hide** after 3s of mouse inactivity (kiosk mode). Mouse still works in dev.
- **Burn-in protection** — at 10 min idle (no defect, no input), live feed dims slightly and the chrome shifts 2px every minute. Prevents OLED retention on permanent-mount displays.
- **Live-feed corner badges** — opacity 0.7 default, 1.0 on touch.

## Component map

The redesign rearranges existing components more than it invents new ones. New / changed components:

| Component | Status | Notes |
|---|---|---|
| `dashboard/top-strip.tsx` | NEW | Replaces `dashboard/header.tsx` + `dashboard/stats-bar.tsx`. |
| `dashboard/live-feed.tsx` | UPDATED | Slimmer chrome, double-tap fullscreen, alert card mount point. |
| `dashboard/golden-reference.tsx` | NEW | Split from `reference-comparison.tsx` — just the golden master. |
| `dashboard/last-defect.tsx` | NEW | Split from `reference-comparison.tsx` — promoted, taps into existing defect modal. |
| `dashboard/inspection-controls.tsx` | UPDATED | Larger touch targets, Collect Frames removed (moves to settings sheet). |
| `dashboard/health-strip.tsx` | NEW | Bottom row. Polls `/api/health` + reads alignment/state from existing endpoints. |
| `dashboard/defect-alert.tsx` | UPDATED | Severity-tiered card with progress bar + tap-to-expand + stack behavior. |
| `dashboard/defect-log.tsx` | UPDATED | Triggered by tapping the Defects stat (was a separate header button). |
| `dashboard/defect-breakdown.tsx` | DEMOTED | Full chart now lives in the settings sheet; one-line summary is in `health-strip`. |
| `dashboard/settings-sheet.tsx` | NEW | Slide-out panel from right with: Collect Frames toggle, sensitivity numeric input, sound toggle, defect history shortcut, link to `/collect`. |
| `dashboard/confirm-sheet.tsx` | NEW | Hold-to-confirm modal for destructive actions. |
| `dashboard/error-boundary.tsx` | KEEP | Already in good shape; resetKeys was added in the recent audit. |
| Tailwind config | UPDATED | Add the 5-level surface tokens, motion tokens. |
| `globals.css` | UPDATED | New CSS variables, prefers-reduced-motion handling. |
| `lib/sound.ts` | NEW | Tiny Web Audio chime helper. ~30 lines. |

`reference-comparison.tsx`, `dashboard/header.tsx`, and `dashboard/stats-bar.tsx` are removed once their replacements are wired in.

## Touch ergonomics summary

- **Minimum tap target**: 44px (WCAG AAA), enforced via `min-height: 44px` on every interactive element.
- **Primary action target**: 56px (Start button).
- **Slider hit zone**: visually 6px track + 14px knob, but a 44px-tall transparent overlay catches the touch.
- **No hover-only affordances** — every action either has a visible label or a tappable icon with `aria-label`.
- **Confirmation for destructive actions** — modal with hold-to-confirm; impossible to mis-fire with a stray tap.

## Accessibility

- All interactive elements have an accessible name (`aria-label` for icon-only buttons).
- Status chips include text, not just color (`aria-live="polite"` for status updates).
- Focus ring (`:focus-visible` only) for keyboard navigation. Touch never triggers it.
- Reduced motion respected.
- Color isn't load-bearing alone — defect severity uses both color and text.

## Out of scope (deferred)

- Authentication — covered separately under SEC-001 in the audit roadmap.
- Multi-camera — single line for the foreseeable future.
- Light theme — dark only by design (industrial environment, kiosk mode).
- Internationalization — single-language for the POC.
- Rich keyboard shortcuts — touch-first; keyboard is dev only.

## Testing strategy

- Existing backend tests are unaffected.
- Frontend has no test harness today (TEST-003 from the audit). Add one alongside the redesign:
  - **Vitest + Testing Library** for component-level tests (alert card states, hold-to-confirm timing, sheet open/close behavior).
  - **Manual touch validation** on a real touchscreen during implementation. (No automated touch testing — Playwright touch emulation is unreliable for hold-to-confirm timing.)
- Visual regression: skip for now. Spec is the source of truth for "does this look right"; eyes are the judge.

## Open questions

None at spec time. The user has decided the visual direction, layout posture, alert tier, sound option (B), and confirmation pattern.

## Implementation phasing (for the writing-plans handoff)

Suggested order — each phase ships standalone so you can use it as you build it:

1. **Tokens + globals** — CSS variable update, Tailwind config tokens, motion tokens, reduced-motion handling.
2. **Top strip + bottom health strip** — replaces the existing header + statsbar, adds health row. Touches the layout grid in `app/page.tsx`.
3. **Golden Reference + Last Defect split** — split `reference-comparison.tsx` into two panels.
4. **Inspection controls refresh** — bigger touch targets, Collect Frames removed.
5. **Settings sheet** — new component, houses Collect Frames + sensitivity numeric + sound toggle + theme + history.
6. **Defect alert card overhaul** — severity tiers, progress bar, expand-on-tap, stack behavior.
7. **Confirmation sheet (hold-to-confirm)** — wire into Stop, Clear, Reset Reference.
8. **Sound** — `lib/sound.ts` + settings toggle.
9. **Polish** — loading skeletons, numeric value updates, cursor auto-hide, burn-in protection, focus rings.
10. **Tests** — Vitest + Testing Library scaffolding, then per-component tests for the new behaviors.
