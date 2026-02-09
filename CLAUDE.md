# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Universal Eye is an AI-powered web inspection and defect detection dashboard for monitoring product labels on automated production lines. It is currently a frontend prototype with simulated data — no backend API or database yet.

## Commands

```bash
pnpm dev          # Start dev server (Next.js)
pnpm build        # Production build (note: TypeScript errors are ignored via next.config.mjs)
pnpm start        # Run production server
pnpm lint         # ESLint
```

Package manager is **pnpm** (lock file committed).

## Tech Stack

- **Next.js 16** with App Router, **React 19**, **TypeScript 5.7**
- **Tailwind CSS 3** with CSS variables for theming (dark-first design, HSL color values)
- **shadcn/ui** components in `components/ui/` (49 Radix-based components, configured via `components.json`)
- **Recharts** for data visualization, **Lucide React** for icons
- **Canvas 2D API** for live feed rendering and reference comparison overlays
- Fonts: Inter (sans) and JetBrains Mono (mono) via `next/font/google`

## Architecture

### Path Aliases

`@/*` maps to the project root (e.g., `@/components/dashboard/header`).

### Layout Structure

Single-page dashboard in `app/page.tsx` (client component). The layout is a fixed viewport (`h-screen`, `overflow-hidden`) with:

```
┌──────────────────────────────────────────────────┐
│  DashboardHeader (job info, status, defect count)│
├──────────────────────────────────────────────────┤
│  StatsBar (labels inspected, defects, run time)  │
├────────┬────────────────────┬────────────────────┤
│Controls│  LiveFeedPanel     │ReferenceComparison │
│(w-44)  │  (flex-[5])        │(flex-[2])          │
│        ├────────────────────┤                    │
│        │DefectBreakdown(h-28)                    │
└────────┴────────────────────┴────────────────────┘
         DefectLog → slide-out panel from right edge
```

### Key Components (`components/dashboard/`)

- **header.tsx** — Logo, active job ID, product name, status indicator (pulse animation), defect history toggle
- **live-feed.tsx** — Canvas-rendered label grid (3x2) with simulated defect highlighting, scan line animation, zoom controls, grid overlay
- **reference-comparison.tsx** — Side-by-side and overlay modes comparing reference vs. current label; AI verdict badges (reject/accept/review)
- **inspection-controls.tsx** — Transport buttons (play/pause/stop), detection sensitivity slider, reference capture actions
- **stats-bar.tsx** — Auto-incrementing metrics (labels inspected count ticks every 2s)
- **defect-log.tsx** — Slide-out panel with filterable defect history, thumbnail previews, severity badges
- **defect-breakdown.tsx** — Horizontal bar chart of defect types with color-coded counts

### State Management

React hooks only (useState/useEffect). Page-level state manages the defect log open/close toggle; all other state is component-local. No external state library.

### Data

All data is currently mock/simulated inline in components. Defect types: Smudge, Misregister, Hickey, Color Shift, Scratch, Splash/Spot, Missing Print, Web Crease. Severity levels: critical, major, minor. AI verdicts: reject, accept, review.

### Theming

Dark-first design using CSS variables in `app/globals.css`. Key brand colors: primary teal (`#168d6a`), destructive red, success green, warning amber. Theme toggle uses `next-themes` with class-based dark mode in Tailwind config.

## Conventions

- shadcn/ui components are added via `npx shadcn@latest add <component>` — do not manually edit files in `components/ui/`
- Use the `cn()` utility from `@/lib/utils` for conditional class merging (clsx + tailwind-merge)
- Canvas rendering uses direct 2D context API with `useEffect` for setup and cleanup
- The app uses `"use client"` for interactive components; the root layout (`app/layout.tsx`) is a server component
