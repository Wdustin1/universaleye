# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Universal Eye is an AI-powered web inspection and defect detection dashboard for monitoring product labels on automated production lines. It is currently a frontend prototype with simulated data — no backend API or database yet.

## Commands

```bash
pnpm dev          # Start dev server (Next.js)
pnpm build        # Production build
pnpm start        # Run production server
pnpm lint         # ESLint (flat config, eslint.config.mjs)
```

Package manager is **pnpm** (lock file committed). No test framework is configured.

## Build Configuration

- `next.config.mjs` sets `typescript.ignoreBuildErrors: true` — TypeScript errors won't fail the build
- `images.unoptimized: true` — all images served as-is (no Next.js image optimization)
- ESLint uses flat config format (`eslint.config.mjs`) extending `eslint-config-next`

## Tech Stack

- **Next.js 16** with App Router, **React 19**, **TypeScript 5.7**
- **Tailwind CSS 3** with CSS variables for theming (HSL values in `globals.css`), `tailwindcss-animate` plugin
- **shadcn/ui** components in `components/ui/` (configured via `components.json`)
- **Recharts** for data visualization, **Lucide React** for icons
- **Canvas 2D API** for live feed rendering and reference comparison overlays
- Fonts: Inter (sans) and JetBrains Mono (mono) via `next/font/google`

## Architecture

### Path Aliases

`@/*` maps to the project root (e.g., `@/components/dashboard/header`).

### Layout Structure

Single-page dashboard in `app/page.tsx` (client component). The layout is a fixed viewport (`h-screen`, `overflow-hidden`) with:

```
+-------------------------------------------------+
| DashboardHeader (job info, status, defect count) |
+-------------------------------------------------+
| StatsBar (labels inspected, defects, run time)   |
+--------+--------------------+--------------------+
|Controls| LiveFeedPanel      | ReferenceComparison|
|(w-44)  | (flex-[5])         | (flex-[2])         |
|        +--------------------+                    |
|        | DefectBreakdown (h-28)                  |
+--------+--------------------+--------------------+
          DefectLog -> slide-out panel from right edge
```

### State Management

React hooks only (useState/useEffect). Page-level state manages the defect log open/close toggle; all other state is component-local. No external state library.

### Data

All data is mock/simulated inline in components. Defect types: Smudge, Misregister, Hickey, Color Shift, Scratch, Splash/Spot, Missing Print, Web Crease. Severity levels: critical, major, minor. AI verdicts: reject, accept, review.

### Theming

Dark-only design using CSS variables in `app/globals.css` (no `:root` light theme defined). Key brand colors: primary teal (`168 75% 42%`), destructive red, success green, warning amber. A `ThemeProvider` component wrapping `next-themes` exists at `components/theme-provider.tsx` but is **not wired into the layout** — the app is dark-only for now.

Tailwind colors reference CSS variables via `hsl(var(--name))` pattern (see `tailwind.config.ts`).

## Conventions

- shadcn/ui components are added via `npx shadcn@latest add <component>` — do not manually edit files in `components/ui/`
- Use the `cn()` utility from `@/lib/utils` for conditional class merging (clsx + tailwind-merge)
- Canvas rendering uses direct 2D context API with `useEffect` for setup and cleanup
- The app uses `"use client"` for interactive components; the root layout (`app/layout.tsx`) is a server component
- No environment variables are needed to run the app currently
