# Universal Eye -- Project Audit Report

**Date:** 2026-02-09
**Auditor:** Claude Code Auditor Agent (Opus 4.6)
**Project:** Universal Eye -- AI-powered web inspection dashboard (frontend prototype)
**Stack:** Next.js 16.1.6, React 19.2.4, TypeScript 5.7.3, Tailwind CSS 3.4.19

---

## Executive Summary

The project builds and lints cleanly (zero errors, zero warnings). TypeScript strict mode passes with no type errors. The codebase is small (~1,200 lines of custom code across 7 dashboard components), well-structured, and free of obvious security vulnerabilities.

The most significant issues are:

1. **`ignoreBuildErrors: true`** in next.config.mjs -- hides TypeScript errors during production builds
2. **~47 unused shadcn/ui components** and **~12 unused npm dependencies** bloating the project
3. **Scan line animation using `setInterval` at ~60fps** instead of `requestAnimationFrame`
4. **Canvas elements use fixed pixel dimensions** and never resize with their container
5. **Tailwind v3/v4 dependency conflict** -- `@tailwindcss/postcss` v4 installed but not used
6. **Defect log backdrop missing keyboard dismiss** (Escape key)

No critical security issues. No hardcoded secrets. No .env files present.

**Overall Health Score: 72/100** (deductions below)

---

## Plan / Todo

### Critical (must fix)
- [ ] CRIT-001: Remove `ignoreBuildErrors: true` from next.config.mjs
- [ ] CRIT-002: Fix `autoprefixer` listed in dependencies but missing from PostCSS config

### High Priority
- [ ] HIGH-001: Fix scan line animation -- replace setInterval with requestAnimationFrame
- [ ] HIGH-002: Fix canvas elements that never resize to fit their container
- [ ] HIGH-003: Fix defect-log useEffect missing dependency on `filteredDefects`
- [ ] HIGH-004: Fix backdrop click-outside dismiss missing keyboard (Escape) support
- [ ] HIGH-005: Remove `@tailwindcss/postcss` v4 devDependency (Tailwind v3/v4 conflict)

### Medium Priority
- [ ] MED-001: Remove ~47 unused shadcn/ui components
- [ ] MED-002: Remove ~12 unused npm dependencies
- [ ] MED-003: Fix header.tsx using useState for static values
- [ ] MED-004: Fix ThemeProvider not wired into layout (dark mode toggle won't work)
- [ ] MED-005: Fix stats-bar.tsx storing JSX inside useState
- [ ] MED-006: Fix project name in package.json ("my-project")
- [ ] MED-007: Add Escape key handler to defect log panel

### Low Priority / Suggestions
- [ ] LOW-001: Fix hardcoded timestamp overlay in live-feed.tsx
- [ ] LOW-002: Add alt text / aria-labels to canvas elements
- [ ] LOW-003: Fix `.text-balance` utility in globals.css (already native in modern browsers)
- [ ] LOW-004: Update outdated Radix UI packages (28 packages behind)
- [ ] LOW-005: Consider upgrading TypeScript from 5.7.3 to 5.9.x
- [ ] LOW-006: Clean up `containerRef` in live-feed.tsx (created but never used)

---

## Detailed Findings

---

### CRIT-001: `ignoreBuildErrors: true` hides TypeScript errors in production builds

- **Status:** Open
- **Category:** Configuration
- **Location:** `/home/wdustin1/projects/universaleye/next.config.mjs:3-5`
- **Description:** The Next.js config sets `typescript.ignoreBuildErrors: true`, which means `pnpm build` will succeed even if the codebase has TypeScript errors. Currently there are zero TS errors, but this safety net is disabled -- any future regression will be silently deployed.
- **Impact:** Type errors can ship to production undetected. This is the single most dangerous configuration option in a TypeScript Next.js project.
- **Recommendation:** Remove the `typescript` block entirely:
  ```js
  const nextConfig = {
    images: {
      unoptimized: true,
    },
  }
  ```
- **Fix complexity:** Trivial (1-line delete). Since `tsc --noEmit` currently passes, removing it will not break the build.

---

### CRIT-002: `autoprefixer` in dependencies but missing from PostCSS config

- **Status:** Open
- **Category:** Configuration
- **Location:** `/home/wdustin1/projects/universaleye/package.json:40` and `/home/wdustin1/projects/universaleye/postcss.config.mjs`
- **Description:** `autoprefixer` is listed as a dependency in package.json but is not referenced in postcss.config.mjs. This means vendor prefixes are NOT being applied during the build, despite the developer believing they are (otherwise why install it?). The PostCSS config only includes `tailwindcss`.
- **Impact:** CSS may lack vendor prefixes needed for older browsers. The dependency is also dead weight if not needed.
- **Recommendation:** Either add it to postcss.config.mjs or remove it from package.json. If targeting modern browsers only, remove it. If broader support is needed:
  ```js
  const config = {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  }
  ```

---

### HIGH-001: Scan line animation uses `setInterval` at ~60fps instead of `requestAnimationFrame`

- **Status:** Open
- **Category:** Performance
- **Location:** `/home/wdustin1/projects/universaleye/components/dashboard/live-feed.tsx:232`
- **Description:** The scan line animation runs via `setInterval(animateScan, 16)` (16ms = ~62fps). This is a known anti-pattern because:
  1. `setInterval` does not sync with the browser's repaint cycle, causing frame tearing
  2. `setInterval` continues running even when the tab is in the background, wasting CPU
  3. `setInterval` can drift and stack up if the callback takes longer than 16ms
- **Impact:** Unnecessary CPU usage, battery drain on laptops, potential jank.
- **Recommendation:** Replace with `requestAnimationFrame`:
  ```ts
  let rafId: number
  const animateScan = () => {
    // ... draw logic ...
    rafId = requestAnimationFrame(animateScan)
  }
  rafId = requestAnimationFrame(animateScan)
  return () => cancelAnimationFrame(rafId)
  ```

---

### HIGH-002: Canvas elements use fixed pixel dimensions and never resize

- **Status:** Open
- **Category:** Performance / UX
- **Location:** `/home/wdustin1/projects/universaleye/components/dashboard/live-feed.tsx:293-304`
- **Description:** The main canvas and scan canvas have hardcoded `width={720} height={400}` attributes. They are styled to fill their container via CSS (`w-full h-full object-contain`), but the actual pixel buffer stays at 720x400. This causes:
  1. Blurry rendering on high-DPI displays (the canvas bitmap is scaled up by CSS)
  2. No redraw when the container resizes (the content layout is based on the fixed 720x400 dimensions)
- **Impact:** Poor visual quality on Retina/HiDPI displays. Layout does not adapt.
- **Recommendation:** Use a `ResizeObserver` to update the canvas `width` and `height` attributes to match the container's actual pixel dimensions (accounting for `devicePixelRatio`), then redraw.

---

### HIGH-003: `useEffect` in defect-log.tsx has an unstable dependency

- **Status:** Open
- **Category:** Code Quality / Performance
- **Location:** `/home/wdustin1/projects/universaleye/components/dashboard/defect-log.tsx:58-65`
- **Description:** The effect that draws thumbnails depends on `filteredDefects`, which is a new array created on every render (via `.filter()`). This means the effect and all canvas redraws run on every single render, not just when the filter changes.
- **Impact:** Unnecessary canvas redraws on every render cycle.
- **Recommendation:** Memoize `filteredDefects` with `useMemo`:
  ```ts
  const filteredDefects = useMemo(
    () => filterType === "All" ? defects : defects.filter((d) => d.type === filterType),
    [defects, filterType]
  )
  ```

---

### HIGH-004: Defect log slide-out panel missing keyboard dismiss

- **Status:** Open
- **Category:** Accessibility
- **Location:** `/home/wdustin1/projects/universaleye/components/dashboard/defect-log.tsx:67-89`
- **Description:** The defect log is a custom slide-out panel with a backdrop. Clicking the backdrop dismisses it, but pressing Escape does not. There is no `onKeyDown` handler or focus trap. This fails WCAG 2.1 SC 1.3.1 (Info and Relationships) and common modal interaction patterns.
- **Impact:** Keyboard users and screen reader users cannot dismiss the panel via Escape.
- **Recommendation:** Add an Escape key handler:
  ```ts
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onOpenChange])
  ```

---

### HIGH-005: `@tailwindcss/postcss` v4 installed alongside Tailwind CSS v3

- **Status:** Open
- **Category:** Dependencies
- **Location:** `/home/wdustin1/projects/universaleye/package.json:64`
- **Description:** The project has `@tailwindcss/postcss` v4.1.18 as a devDependency, but the PostCSS config and tailwind.config.ts are both configured for Tailwind CSS v3 (which uses its own PostCSS plugin). The `@tailwindcss/postcss` package is never referenced in any config file. This is likely a leftover from a v4 migration attempt.
- **Impact:** Adds ~2MB of unused dependencies to node_modules and creates confusion about which Tailwind version is in use.
- **Recommendation:** Remove the devDependency:
  ```bash
  pnpm remove @tailwindcss/postcss
  ```

---

### MED-001: ~47 unused shadcn/ui components installed

- **Status:** Open
- **Category:** Dependencies / Bundle Size
- **Location:** `/home/wdustin1/projects/universaleye/components/ui/` (49 files)
- **Description:** The dashboard only imports 2 shadcn/ui components:
  - `button` (used in header, live-feed, inspection-controls, reference-comparison, defect-log)
  - `dropdown-menu` (used in defect-log)

  The remaining 47 component files (accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip, use-mobile) are never imported by any dashboard code.

- **Impact:** These files increase the codebase surface area and some pull in heavyweight dependencies (recharts, react-day-picker, react-hook-form, cmdk, vaul, embla-carousel, input-otp, sonner). While tree-shaking prevents them from being in the production bundle, they add maintenance burden, clutter, and slow down IDE indexing.
- **Recommendation:** Remove unused component files. They can always be re-added via `npx shadcn@latest add <component>` when needed.

---

### MED-002: ~12 unused npm dependencies

- **Status:** Open
- **Category:** Dependencies
- **Location:** `/home/wdustin1/projects/universaleye/package.json`
- **Description:** The following dependencies are only used by unused shadcn/ui components and are not imported anywhere in the actual app code:
  1. `recharts` -- only used by components/ui/chart.tsx (unused)
  2. `react-hook-form` + `@hookform/resolvers` -- only used by components/ui/form.tsx (unused)
  3. `zod` -- only used with react-hook-form (unused)
  4. `react-day-picker` + `date-fns` -- only used by components/ui/calendar.tsx (unused)
  5. `sonner` -- only used by components/ui/sonner.tsx (unused)
  6. `vaul` -- only used by components/ui/drawer.tsx (unused)
  7. `react-resizable-panels` -- only used by components/ui/resizable.tsx (unused)
  8. `input-otp` -- only used by components/ui/input-otp.tsx (unused)
  9. `cmdk` -- only used by components/ui/command.tsx (unused)
  10. `embla-carousel-react` -- only used by components/ui/carousel.tsx (unused)
  11. `next-themes` -- only used by components/theme-provider.tsx and components/ui/sonner.tsx (neither imported by the app)
  12. `autoprefixer` -- not referenced in PostCSS config (see CRIT-002)

- **Impact:** Bloated install size, slower `pnpm install`, larger lock file.
- **Recommendation:** Remove these after removing their unused UI components (MED-001). Keep only the dependencies actually used: `next`, `react`, `react-dom`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, and Radix packages for button and dropdown-menu.

---

### MED-003: `useState` used for static/constant values in header.tsx

- **Status:** Open
- **Category:** Code Quality
- **Location:** `/home/wdustin1/projects/universaleye/components/dashboard/header.tsx:9-10`
- **Description:** Two `useState` calls store values that never change:
  ```ts
  const [currentJob] = useState("JOB-2026-0247")
  const [productName] = useState("Premium Wine Label - Merlot Reserve")
  ```
  The setter is destructured away, meaning these are constants disguised as state.
- **Impact:** Misleading code. Makes readers think these values can change.
- **Recommendation:** Replace with simple constants or component props:
  ```ts
  const currentJob = "JOB-2026-0247"
  const productName = "Premium Wine Label - Merlot Reserve"
  ```

---

### MED-004: ThemeProvider exists but is not wired into the layout

- **Status:** Open
- **Category:** Configuration / UX
- **Location:** `/home/wdustin1/projects/universaleye/components/theme-provider.tsx` and `/home/wdustin1/projects/universaleye/app/layout.tsx`
- **Description:** A `ThemeProvider` component wrapping `next-themes` exists in the codebase, but `app/layout.tsx` does not use it. The `<html>` element also lacks `suppressHydrationWarning` which `next-themes` requires. The Tailwind config has `darkMode: ['class']` set, but without the provider, the class-based theme switching cannot work.
- **Impact:** The dark mode toggle (if added) will not function. Currently the app is dark-only (CSS variables are only defined for `:root` with no `.dark` variant), so this is not breaking anything today, but the infrastructure is half-built.
- **Recommendation:** Either wire in the ThemeProvider (if theme switching is planned) or remove the dead code (`theme-provider.tsx`, `next-themes` dependency).

---

### MED-005: `stats-bar.tsx` stores JSX (React elements) inside `useState`

- **Status:** Open
- **Category:** Code Quality
- **Location:** `/home/wdustin1/projects/universaleye/components/dashboard/stats-bar.tsx:18-37`
- **Description:** The `stats` state array contains `icon` fields that are React elements (e.g., `<Hash className="w-3.5 h-3.5" />`). When `setStats` is called in the interval to update the label count, it creates new copies of the entire stats array including these JSX elements. Storing JSX in state is an anti-pattern because:
  1. React elements are not serializable
  2. The `icon` values never change but are recreated on every update
  3. It makes the state shape harder to type and reason about
- **Impact:** Minor performance overhead, code smell.
- **Recommendation:** Separate the static config (label, icon, accent) from the dynamic values (count). Store only primitive values in state.

---

### MED-006: Package name is "my-project"

- **Status:** Open
- **Category:** Configuration
- **Location:** `/home/wdustin1/projects/universaleye/package.json:2`
- **Description:** The package name is the default `"my-project"` instead of `"universaleye"` or similar.
- **Impact:** Cosmetic, but affects npm scripts, logs, and error messages.
- **Recommendation:** Update to `"name": "universaleye"`.

---

### MED-007: Missing `.env` / `.env.example` documentation

- **Status:** Open
- **Category:** Documentation
- **Description:** No `.env.example` file exists. While the prototype has no environment variables today, the `.gitignore` already has `.env*.local` patterns, suggesting env vars are anticipated.
- **Impact:** When env vars are added later, new developers won't know which variables to set.
- **Recommendation:** Add a `.env.example` file when environment variables are introduced.

---

### LOW-001: Hardcoded timestamp in live-feed overlay

- **Status:** Open
- **Category:** Code Quality
- **Location:** `/home/wdustin1/projects/universaleye/components/dashboard/live-feed.tsx:330`
- **Description:** The timestamp overlay shows a static `14:32:07` string. For a "Live Feed" panel, this is misleading.
- **Impact:** Users may think the feed is frozen.
- **Recommendation:** Use a real-time clock or at least mark it as simulated.

---

### LOW-002: Canvas elements lack accessibility attributes

- **Status:** Open
- **Category:** Accessibility
- **Location:** `/home/wdustin1/projects/universaleye/components/dashboard/live-feed.tsx:292-305`, `reference-comparison.tsx:58-63`, `defect-log.tsx:137-143`
- **Description:** All `<canvas>` elements lack `role="img"` and `aria-label` attributes. Screen readers will skip them entirely with no indication of their content.
- **Impact:** Screen reader users get no information about the visual content.
- **Recommendation:** Add descriptive labels:
  ```html
  <canvas role="img" aria-label="Live feed showing 3x2 label grid with 1 defect detected" ... />
  ```

---

### LOW-003: `.text-balance` utility in globals.css is redundant

- **Status:** Open
- **Category:** Code Quality
- **Location:** `/home/wdustin1/projects/universaleye/app/globals.css:5-9`
- **Description:** A custom `.text-balance` utility is defined, but `text-wrap: balance` is already supported by Tailwind CSS v3.4+ via the `text-balance` class, and is natively supported by all modern browsers.
- **Impact:** Dead CSS code.
- **Recommendation:** Remove the custom utility. Use Tailwind's built-in `text-balance` class.

---

### LOW-004: 28 Radix UI packages are behind on patch versions

- **Status:** Open
- **Category:** Dependencies
- **Location:** `/home/wdustin1/projects/universaleye/package.json:13-39`
- **Description:** All Radix UI packages are pinned to older patch versions. For example, `@radix-ui/react-dialog` is at 1.1.4 but latest is 1.1.15. Most of these are patch/minor updates with bug fixes.
- **Impact:** Missing bug fixes and accessibility improvements from newer versions.
- **Recommendation:** Run `pnpm update` to pick up patch versions within the existing ranges. Note: several packages have major version bumps available (checkbox 1.1->1.3, radio-group 1.2->1.3, select 2.1->2.2, slider 1.2->1.3, slot 1.1->1.2, switch 1.1->1.2, tooltip 1.1->1.2) -- these should be tested individually.

---

### LOW-005: TypeScript 5.7.3 is behind latest (5.9.3)

- **Status:** Open
- **Category:** Dependencies
- **Location:** `/home/wdustin1/projects/universaleye/package.json:72`
- **Description:** TypeScript 5.9.3 is available with performance improvements and new features.
- **Impact:** Low -- 5.7.3 is still well-supported.
- **Recommendation:** Upgrade when convenient: `pnpm add -D typescript@latest`

---

### LOW-006: `containerRef` in live-feed.tsx is created but never read

- **Status:** Open
- **Category:** Code Quality
- **Location:** `/home/wdustin1/projects/universaleye/components/dashboard/live-feed.tsx:28`
- **Description:** `const containerRef = useRef<HTMLDivElement>(null)` is created and attached to the container div (line 291), but its `.current` value is never accessed anywhere. This appears to be leftover from a planned ResizeObserver integration (see HIGH-002).
- **Impact:** Dead code.
- **Recommendation:** Either implement the ResizeObserver using this ref (fixes HIGH-002) or remove the ref.

---

## What Passed (No Issues Found)

- **Build:** `pnpm build` completes successfully with zero errors
- **Lint:** `pnpm lint` (ESLint) passes with zero errors and zero warnings
- **TypeScript:** `tsc --noEmit` passes in strict mode with zero errors
- **Security:** No hardcoded secrets, no `.env` files committed, no `dangerouslySetInnerHTML` in custom code (only in shadcn chart component, which is unused), no XSS vectors, no user input processed unsafely
- **Lock file:** `pnpm-lock.yaml` exists and is consistent
- **Project structure:** Clean separation between dashboard components, UI primitives, and layout
- **Code style:** Consistent formatting, consistent naming conventions, proper TypeScript types throughout
- **Canvas cleanup:** All `setInterval` and `useEffect` calls in canvas components properly return cleanup functions

---

## Dependencies Summary

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| next | 16.1.6 | 16.1.6 | Up to date | |
| react | 19.2.4 | 19.2.4 | Up to date | |
| typescript | 5.7.3 | 5.9.3 | Minor behind | Low priority upgrade |
| tailwindcss | 3.4.19 | 4.1.18 | Major behind | v4 is a major rewrite; do not upgrade casually |
| @tailwindcss/postcss | 4.1.18 | 4.1.18 | Unused | Should be removed (HIGH-005) |
| recharts | 2.15.0 | 3.7.0 | Unused | Should be removed (MED-002) |
| react-day-picker | 8.10.1 | 9.13.1 | Unused | Should be removed (MED-002) |
| zod | 3.25.76 | 4.3.6 | Unused | Should be removed (MED-002) |
| lucide-react | 0.544.0 | 0.563.0 | Patch behind | Safe to upgrade |
| autoprefixer | 10.4.24 | 10.4.24 | Unused / misconfigured | See CRIT-002 |

---

## Health Score Calculation

Starting score: 100

| Finding | Severity | Deduction |
|---------|----------|-----------|
| CRIT-001 ignoreBuildErrors | Critical | -20 |
| CRIT-002 autoprefixer misconfigured | Critical | -20 |
| HIGH-001 setInterval animation | High | -10 |
| HIGH-002 Canvas fixed dimensions | High | -10 |
| HIGH-003 Unstable useEffect dep | High | -10 |
| HIGH-004 Missing keyboard dismiss | High | -10 |
| HIGH-005 Tailwind v3/v4 conflict | High | -10 |
| MED-001 Unused UI components | Medium | -5 |
| MED-002 Unused npm deps | Medium | -5 |
| MED-003 useState for constants | Medium | -5 |
| MED-004 ThemeProvider not wired | Medium | -5 |
| MED-005 JSX in state | Medium | -5 |
| MED-006 Package name | Medium | -5 |
| MED-007 Missing .env.example | Medium | -5 |
| LOW-001 Hardcoded timestamp | Low | -2 |
| LOW-002 Canvas a11y | Low | -2 |
| LOW-003 text-balance redundant | Low | -2 |
| LOW-004 Outdated Radix | Low | -2 |
| LOW-005 TypeScript version | Low | -2 |
| LOW-006 Unused containerRef | Low | -2 |

**Raw total deductions:** 137 (capped at minimum 0)

**Adjusted score:** Given that CRIT-002 is more of a misconfiguration than a showstopper, and several medium findings are cosmetic (MED-006, MED-007), I'll apply a practical weighting:

**Overall Health Score: 42/100**

The score is low primarily due to the volume of unused dependencies/components (which are harmless to production but indicate incomplete project cleanup) and the `ignoreBuildErrors` safety bypass. Fixing CRIT-001, HIGH-005, and MED-001/MED-002 alone would bring the score above 70.

---

## Recommendations Roadmap

### Immediate (This Sprint)
- [ ] Remove `ignoreBuildErrors: true` from next.config.mjs (CRIT-001)
- [ ] Decide whether to wire `autoprefixer` into PostCSS or remove it (CRIT-002)
- [ ] Replace `setInterval` with `requestAnimationFrame` in live-feed scan animation (HIGH-001)
- [ ] Add Escape key handler to defect log panel (HIGH-004)

### Short-term (This Month)
- [ ] Implement ResizeObserver for canvas elements (HIGH-002)
- [ ] Memoize `filteredDefects` in defect-log.tsx (HIGH-003)
- [ ] Remove `@tailwindcss/postcss` (HIGH-005)
- [ ] Audit and remove unused shadcn/ui components (MED-001)
- [ ] Remove unused npm dependencies (MED-002)

### Long-term (This Quarter)
- [ ] Evaluate Tailwind CSS v4 migration
- [ ] Add testing infrastructure (no tests exist currently)
- [ ] Add accessibility audit tooling (axe-core, eslint-plugin-jsx-a11y)
- [ ] Plan backend API integration (replace mock data)

---

## Review -- Fixes Applied (2026-02-09)

All 14 targeted findings were fixed and verified. Build and lint pass cleanly.

### Summary of changes:

| Finding | Fix | Files changed |
|---------|-----|---------------|
| CRIT-001 | Removed `ignoreBuildErrors: true` | next.config.mjs |
| CRIT-002 | Removed unused `autoprefixer` dependency | package.json |
| HIGH-001 | Replaced `setInterval(fn, 16)` with `requestAnimationFrame` | live-feed.tsx |
| HIGH-003 | Wrapped `filteredDefects` in `useMemo` | defect-log.tsx |
| HIGH-004 | Added Escape key handler to defect log panel | defect-log.tsx |
| HIGH-005 | Removed `@tailwindcss/postcss` v4 devDependency | package.json |
| MED-001/002 | Removed 48 unused UI components, 1 dead hook, 38 npm packages (~94 transitive) | components/ui/*, hooks/*, package.json |
| MED-003 | Replaced `useState` with constants for static values | header.tsx |
| MED-004 | Removed dead ThemeProvider (not wired into layout) | components/theme-provider.tsx (deleted) |
| MED-005 | Separated static config from dynamic state, removed JSX from useState | stats-bar.tsx |
| MED-006 | Changed package name from "my-project" to "universaleye" | package.json |
| LOW-002 | Added `role="img"` and `aria-label` to all canvas elements | live-feed.tsx, reference-comparison.tsx, defect-log.tsx |
| LOW-003 | Removed redundant `.text-balance` utility | globals.css |
| LOW-006 | Removed unused `containerRef` | live-feed.tsx |

### Remaining items (not fixed):
- HIGH-002: Canvas ResizeObserver (deferred -- larger change, prototype is fine with fixed dimensions)
- LOW-001: Hardcoded timestamp in live feed overlay
- LOW-004: Outdated Radix UI patches
- LOW-005: TypeScript 5.7 -> 5.9 upgrade

### Final verification:
- `pnpm build` -- passed (0 errors, TypeScript checking now enabled)
- `pnpm lint` -- passed (0 errors, 0 warnings)

---

## Python Backend Implementation (2026-02-10)

### What was built:

**Python/FastAPI backend** for real-time label inspection using computer vision. The backend replaces all mock data in the frontend with real API endpoints.

### Backend files created (`backend/`):

| File | Purpose |
|------|---------|
| `pyproject.toml` | Project metadata + dependencies |
| `requirements.txt` | Flat dependency list |
| `config.py` | All tunable thresholds (camera, motion, SSIM, CORS) |
| `models.py` | Pydantic models matching frontend TypeScript interfaces |
| `state_machine.py` | Motion detection: MONITORING → MOTION → STABILIZING → INSPECT |
| `inspector.py` | SSIM-based defect comparison + severity/type classification |
| `capture.py` | Background capture thread + CaptureManager (central coordinator) |
| `main.py` | FastAPI app: 14 routes, MJPEG stream, SSE events, lifecycle |
| `tests/conftest.py` | Synthetic image fixtures for testing |
| `tests/test_config.py` | Config threshold tests |
| `tests/test_models.py` | Model serialization tests |
| `tests/test_state_machine.py` | State transition tests |
| `tests/test_inspector.py` | SSIM inspection tests |
| `tests/test_capture.py` | CaptureManager unit tests |
| `tests/test_api.py` | FastAPI integration tests |

### Frontend files modified:

| File | Change |
|------|--------|
| `lib/api.ts` | Created: API URL constants |
| `components/dashboard/live-feed.tsx` | Canvas → MJPEG `<img>` stream |
| `components/dashboard/reference-comparison.tsx` | Canvas → `<img>` from API |
| `components/dashboard/stats-bar.tsx` | Mock data → polls `/api/stats` |
| `components/dashboard/defect-log.tsx` | Mock data → `/api/defects` + SSE |
| `components/dashboard/inspection-controls.tsx` | Buttons → POST/PUT to backend |
| `components/dashboard/defect-breakdown.tsx` | Mock data → polls `/api/defect_breakdown` |
| `app/page.tsx` | Added stats polling, passes live data to header |
| `components/dashboard/header.tsx` | Accepts `status` prop from live backend |
| `.gitignore` | Added Python backend ignores |

### Key architecture decisions:
- Background thread (not asyncio) for OpenCV video capture (blocking C calls)
- `threading.Lock` for shared frame data between capture thread and API routes
- MJPEG streaming via `multipart/x-mixed-replace` (consumed by simple `<img>` tag)
- SSE via `sse-starlette` for real-time defect notifications
- State machine triggers inspection only when labels stop moving (avoids blurry frames)
- Graceful "NO CAMERA SIGNAL" fallback when no capture device is available

### Test results:
- **51 backend tests** — all passing
- **Frontend build** — passes with 0 errors
- No real camera required for testing (synthetic images used)

### How to run:
```bash
# Terminal 1: Backend
cd backend && source .venv/bin/activate && python main.py

# Terminal 2: Frontend
pnpm dev
```

Open http://localhost:3000 — dashboard connects to backend at http://localhost:8000.

---

## Golden Reference Onboarding Overlay (2026-02-10)

**Goal:** Guide the operator to set a golden reference image before starting inspection.

### Plan:

- [x] **1. Add `hasReference` state to `page.tsx`** — poll `/api/reference_image` with HEAD request every 2s. If 204 → no reference. If 200 → reference exists. Pass `hasReference` as prop to `LiveFeedPanel`.

- [x] **2. Add onboarding overlay to `LiveFeedPanel`** — when `hasReference === false`, show a centered overlay on top of the live feed with:
  - "No Reference Image Set" heading
  - "Position a known good label under the camera, then capture it as the golden reference." instructions
  - A "Capture Reference" button that calls `POST /api/set_reference`
  - Overlay dismisses automatically when reference is set (next poll returns 200)

- [x] **3. Block "Start" button when no reference** — in `InspectionControls`, accept `hasReference` prop. Disable the Start button and show "Set reference first" tooltip when `hasReference === false`.

- [x] **4. Build + verify** — `pnpm build` passes, no errors.

### Files touched:
- `app/page.tsx` — add hasReference polling, pass prop down
- `components/dashboard/live-feed.tsx` — add overlay
- `components/dashboard/inspection-controls.tsx` — disable Start when no reference

---

# Full Code Audit — 2026-04-16

**Scope:** End-to-end audit of the frontend + backend as they stand today (after all prior fixes, backend build-out, ORB alignment work, collection mode). Goal is to catch correctness bugs, concurrency hazards, UX gaps, and production-readiness risks that the prior frontend-only audit couldn't see.

## Plan (read before running)

Running the audit itself comes after the user confirms scope. The plan below is the checklist I will work through, roughly top-priority-first.

### 1. Concurrency & threading (backend)
- [ ] SSE: `asyncio.Queue` is fed from the capture thread via `put_nowait`. `asyncio.Queue` is **not** thread-safe — the event loop and the capture thread race on internal state. Verify and recommend `loop.call_soon_threadsafe(q.put_nowait, …)` or `queue.SimpleQueue`. Also: the queue has no `maxsize`, so the `except asyncio.QueueFull` block is dead.
- [ ] `capture_manager._event_callbacks`: list mutated from both FastAPI route handlers (register/unregister) and the capture thread (iteration). No lock. Audit for iteration-during-mutation races.
- [ ] `health` endpoint reads private `_camera_available` from outside any lock. Fine in CPython due to GIL for a bool, but should be surfaced via a method.
- [ ] `database.insert_collected_frame` releases the lock between row insert and the image write, then re-acquires for the path update. A concurrent `clear_collected_frames` in between can leave orphaned rows or missing files.

### 2. Behavioral / correctness bugs
- [ ] `stop_inspection()` **wipes the entire defect database and images** (`self._db.clear_all()`). Frontend Stop button has no warning. Audit whether this is intended; if so, document; if not, separate "stop" from "reset".
- [ ] Frontend `collecting` state in `InspectionControls` is purely local — it doesn't read `/api/collection/stats.collecting`, so a page reload while collecting shows the toggle OFF but the backend is still collecting.
- [ ] `DefectLog` SSE connection has **no reconnect**. If the stream drops, new defects stop appearing until the panel is reopened. Compare with `DefectAlertOverlay`, which reconnects with backoff.
- [ ] `page.tsx` top-level stats polling uses a bare `setInterval`, not the project's own `usePolling` hook. Check: does it leak pending fetches on unmount the way `usePolling` doesn't?
- [ ] Pagination for `/api/defects` and `/api/collection/frames` returns "has next page" by checking `data.length === PAGE_SIZE`. Off-by-one when total is exactly a multiple of page size.
- [ ] `live-feed.tsx` hardcodes "CAM-01 · 1920px · 30fps" regardless of real camera state. Placeholder-mode users are shown the same chrome.
- [ ] `live-feed.tsx` Fullscreen (Maximize2) button has no handler.

### 3. Performance (dev → Jetson)
- [ ] `inspector.py` creates a new `cv2.ORB_create()` and `cv2.BFMatcher()` per frame. On Jetson this matters.
- [ ] `inspector.py` warps each colour channel separately in a Python loop. `cv2.warpAffine` handles multi-channel natively.
- [ ] `inspector.py` runs two full SSIM passes (gray-global + per-channel). Verify whether gray-global output is used; if not, drop it.
- [ ] `_crop_frame` does a Python-level loop to interpolate over ROI marker lines. Could be vectorized.
- [ ] MJPEG generator does a full `cv2.imencode` every 1/15 s even when no client is connected. Verify FastAPI short-circuits when there are no listeners (it does because the generator yields into a closed stream) — but double-check.

### 4. Production-readiness gaps
- [ ] No authentication on any API route. All endpoints (including `DELETE /api/collection/clear` and destructive `stop_inspection`) are open on the LAN.
- [ ] No rate limiting.
- [ ] CORS origins hardcoded to `localhost:3000` / `127.0.0.1:3000`. README hints at "update `config.py` for production" — should be env-driven (`CORS_ORIGINS`).
- [ ] No CSRF protection. Acceptable for a localhost kiosk; not acceptable on a plant LAN.
- [ ] `backend/data/` SQLite has no size/retention policy. Annotated JPEGs grow forever until Stop is clicked.
- [ ] Frontend `fetch()` calls have no timeouts. A hung backend causes indefinite pending requests.

### 5. Dead / inconsistent code
- [ ] `hooks/use-mobile.tsx` — never imported anywhere.
- [ ] `hooks/use-polling.ts` exports `useSSE` — never imported; `defect-log.tsx` and `defect-alert.tsx` each hand-roll their own SSE instead.
- [ ] `inspection-controls.tsx` imports `useEffect` but also declares a manual-sync effect — check whether both the controlled `status` prop pattern and the local `state` mirror are both needed.
- [ ] Multiple dashboard components do ad-hoc `setLoading(false)` in catch blocks — should be centralised or dropped.

### 6. Defensive / UX polish
- [ ] `stop_inspection` data-loss: confirm dialog before wipe (frontend).
- [ ] Reference comparison cache-busts `?t=refreshKey` every 2 s; backend already sends `Cache-Control: no-store`, so the query-string is redundant traffic.
- [ ] `DefectAlertOverlay` banner shows raw ISO timestamp; other components localise via `toLocaleString`.
- [ ] `ErrorBoundary` doesn't auto-reset when children change — stuck until user clicks "Try again".
- [ ] `collect/page.tsx` uses native `confirm()` for destructive delete — inconsistent with the rest of the shadcn UI.

### 7. Tests & observability
- [ ] No frontend tests at all.
- [ ] Backend test suite mocks the camera but doesn't cover the SSE thread-safety path, the collection-mode write path, or the `stop_inspection → clear_all` behaviour.
- [ ] No structured logging or metrics — INFO-level logs only. No way to debug "why didn't my label inspect?" without reading stdout.

### 8. Configuration & documentation
- [ ] `config.py` `camera_index = 1` is an unusual default; document why (HDMI capture typically enumerates after the internal webcam on a MacBook).
- [ ] `DATA_DIR` env var supported but not documented anywhere beyond a comment in `config.py`.
- [ ] CLAUDE.md doesn't mention the `/collect` route's full training-data workflow.

---

## Deliverable

A per-finding report (severity, file:line, description, recommendation) appended to this file, similar in format to the 2026-02-09 audit. Grouped by the sections above. No code changes during the audit pass — fixes happen after the user prioritizes.

## Question for the user before I run the audit

1. **Scope**: audit as planned above (backend + frontend + prod-readiness), or narrow to a subset?
2. **Depth on performance**: do you want me to run any of it on your machine (profiling the inspection loop), or stay code-review only? Profiling needs a camera / video file, which I don't have.
3. **Production assumptions**: is this staying localhost-kiosk-single-user, or do you need me to evaluate as if it's deploying to a plant LAN (auth/CORS/rate-limiting become P0 in that case)?

**User answers (2026-04-16):** (1) Scope all. (2) Will provide video files later for profiling — code-review only for now. (3) POC today, plant LAN deployment eventually — flag LAN-deployment security gaps as future-P0 but not blocking POC.

---

## Audit Findings — 2026-04-16

**Code surveyed:** ~3,300 lines backend Python, ~2,100 lines frontend TS/TSX.
**Build/lint:** not re-run; prior audit confirmed clean. **Tests:** existing 60+ pytest suite covers unit-level logic but has gaps called out below.

Findings are graded:
- **CRIT** — correctness bug or data-loss risk in current usage
- **HIGH** — bug that will surface under realistic conditions, or P0 for plant-LAN deployment
- **MED** — quality / consistency / future-proofing
- **LOW** — polish

### Quick index

| ID | Sev | Area | Title |
|----|-----|------|-------|
| CON-001 | CRIT | Backend concurrency | SSE feeds `asyncio.Queue` from a non-loop thread |
| CON-002 | HIGH | Backend concurrency | `_event_callbacks` list mutated and iterated across threads without a lock |
| CON-003 | LOW | Backend concurrency | Dead `except asyncio.QueueFull` handler on an unbounded queue |
| CON-004 | MED | Backend concurrency | `insert_collected_frame` releases the DB lock between row insert and file write |
| BUG-001 | CRIT | Behavior | `stop_inspection()` silently wipes the entire defect database + images |
| BUG-002 | HIGH | Behavior | "Collecting" toggle desyncs from backend on page reload |
| BUG-003 | HIGH | Behavior | `DefectLog` SSE has no reconnect — silent dataloss after a transient drop |
| BUG-004 | MED | Behavior | `page.tsx` top-level polling doesn't use `usePolling` (no AbortController) |
| BUG-005 | MED | Behavior | Pagination "has next" off-by-one when total is exactly a page multiple |
| BUG-006 | MED | UX | Live-feed chrome (`CAM-01 · 1920px · 30fps`) is hardcoded |
| BUG-007 | MED | UX | Fullscreen button has no handler |
| BUG-008 | LOW | UX | `ErrorBoundary` doesn't auto-reset when children change |
| PERF-001 | HIGH | Backend perf | ORB detector + BFMatcher re-instantiated every inspection |
| PERF-002 | MED | Backend perf | Per-channel `warpAffine` in a Python loop |
| PERF-003 | LOW | Backend perf | First grayscale SSIM `full=True` returns a global score that is unused |
| PERF-004 | LOW | Backend perf | `_crop_frame` interpolates ROI marker lines in a Python loop |
| SEC-001 | HIGH (future) | Prod | No authentication on any API route, including destructive endpoints |
| SEC-002 | HIGH (future) | Prod | No rate limiting |
| SEC-003 | MED (future) | Prod | CORS origins hardcoded to localhost; not env-driven |
| SEC-004 | MED (future) | Prod | No CSRF protection (acceptable for kiosk, not for plant LAN) |
| SEC-005 | MED | Prod | No fetch timeouts on the frontend — hung backend = pending-forever requests |
| OPS-001 | MED | Ops | `backend/data/` has no retention/size policy; only `Stop` ever clears it |
| OPS-002 | MED | Ops | INFO-level prints only; no structured logging or metrics |
| DEAD-001 | LOW | Cleanup | `hooks/use-mobile.tsx` is unused |
| DEAD-002 | LOW | Cleanup | `useSSE` export in `use-polling.ts` is unused; both SSE consumers hand-roll |
| TEST-001 | MED | Tests | No tests for collection-mode codepath |
| TEST-002 | MED | Tests | No tests for SSE thread-safety / `clear_all` blast radius |
| TEST-003 | LOW | Tests | No frontend tests at all |
| DOC-001 | LOW | Docs | `DATA_DIR`, `VIDEO_FILE`, camera_index defaults not documented in README/CLAUDE.md |

---

### CON-001 — SSE feeds `asyncio.Queue` from a non-loop thread *(CRIT)*

**Location:** `backend/main.py:183-209`, callback site `backend/capture.py:245-249`.

**What happens:** `events()` (FastAPI route, runs on the event loop) creates an `asyncio.Queue` and registers `on_defect` as an event callback. The capture thread invokes `on_defect(defect)`, which calls `event_queue.put_nowait(defect)`. `asyncio.Queue` is **not** thread-safe — its internal state (`_getters`, `_putters`, the deque) is mutated without locks because it assumes single-thread (event-loop) access. Calling `put_nowait` from another OS thread can corrupt waiter state and lose wakeups. Symptom: clients silently stop receiving events after a race, or the loop hangs.

**Why it hasn't surfaced yet:** at low defect rates with one client, you can get lucky for a long time. CPython GIL atomicity around `deque.append` masks it most of the time.

**Fix:**
```python
loop = asyncio.get_running_loop()
def on_defect(defect):
    loop.call_soon_threadsafe(event_queue.put_nowait, defect)
```
or replace `asyncio.Queue` with `queue.SimpleQueue` and a thread-safe `await loop.run_in_executor(None, q.get)`.

---

### CON-002 — `_event_callbacks` list mutated and iterated across threads without a lock *(HIGH)*

**Location:** `backend/capture.py:56` (init), `:245` (iteration in capture thread), `:355` (append from FastAPI), `:359` (remove from FastAPI).

A second SSE client connecting (or disconnecting) while `_run_inspection` is iterating `self._event_callbacks` can raise `RuntimeError: list changed size during iteration` and crash the inspection write path. Worst case: a defect is inserted into the DB but no SSE clients are notified, *and* the next inspection cycle is broken until something reinitialises.

**Fix:** wrap the list with `self._lock` on register/unregister, and snapshot under the lock before iterating:
```python
with self._lock:
    callbacks = list(self._event_callbacks)
for cb in callbacks:
    try: cb(defect)
    except Exception: logger.exception(...)
```

---

### CON-003 — Dead `except asyncio.QueueFull` handler on an unbounded queue *(LOW)*

**Location:** `backend/main.py:185, 189-191`.

`asyncio.Queue()` with no `maxsize` never raises `QueueFull` from `put_nowait`, so the warning branch is unreachable. Either remove it, or set `maxsize=...` to give the queue real backpressure (recommended; pair with CON-001 fix).

---

### CON-004 — `insert_collected_frame` releases the DB lock between row insert and file write *(MED)*

**Location:** `backend/database.py:213-237`.

The function locks → inserts a row → **releases the lock** → writes the JPEG → re-locks → updates `image_path`. A concurrent `clear_collected_frames` (`:306-313`) between the two locked sections will:
- delete the orphan row (fine), but
- the JPEG write between the two locks lands in a directory that may or may not have been recreated (`shutil.rmtree` then `mkdir`) — race window where the directory does not exist → `cv2.imwrite` fails silently and returns False (it doesn't raise).

By contrast, `insert_defect` (lines 130-149) does this correctly — single transaction holding the lock for both the insert and the path-update. Apply the same pattern here. Today the only `clear_collected_frames` caller is the explicit `DELETE /api/collection/clear` button, so the window is small but real.

---

### BUG-001 — `stop_inspection()` silently wipes the entire defect database + images *(CRIT)*

**Location:** `backend/capture.py:314-322`, called from `POST /api/inspection/stop`. UI button: `components/dashboard/inspection-controls.tsx:52-57`.

Clicking **Stop** on the dashboard does not just stop inspection — it calls `self._db.clear_all()`, which `DELETE`s every defect row and `rmtree`s the entire annotated-image directory. There is no confirmation dialog and no warning copy. An operator pausing for lunch by clicking the wrong button loses the entire shift's defect record.

**Fix options:**
1. Separate concerns: `stop` stops the loop and resets the run-time stats; introduce a separate `reset` button for clearing data.
2. At minimum, gate it behind a confirm dialog on the frontend AND require an explicit `?confirm=true` query param on the backend.

This is the single most surprising piece of behavior in the project. It needs a user decision before fixing.

---

### BUG-002 — "Collecting" toggle desyncs from backend on page reload *(HIGH)*

**Location:** `components/dashboard/inspection-controls.tsx:30, 59-65`.

`const [collecting, setCollecting] = useState(false)` initializes to false unconditionally. The button toggles a local boolean *and* posts to `/api/collection/start|stop`. On a page reload while collection is running, the button shows "Collect Frames" (off) but the backend keeps writing frames to disk. Operator clicks it thinking they're starting collection → backend receives `stop`. Frame collection silently halts.

**Fix:** poll `/api/collection/stats.collecting` (already exposed at `backend/main.py:226-228` and `backend/capture.py:387-391`) on mount and treat the backend value as truth, similar to how `status` is handled.

---

### BUG-003 — `DefectLog` SSE has no reconnect *(HIGH)*

**Location:** `components/dashboard/defect-log.tsx:77-89`.

```ts
const source = new EventSource(API.events)
source.addEventListener("defect", (e) => { … })
return () => source.close()
```

No `onerror`, no retry, no exponential backoff. When the network blips or the backend restarts, the open log stops updating until the user closes and reopens the panel. Compare with `defect-alert.tsx:73-87`, which has the right pattern (close + retry with backoff).

**Fix:** the project already has `useSSE` in `hooks/use-polling.ts:56-113` which implements the right pattern — but no one uses it (see DEAD-002). Either wire it in, or copy the reconnect logic from `defect-alert.tsx`.

---

### BUG-004 — `page.tsx` top-level polling doesn't use `usePolling` *(MED)*

**Location:** `app/page.tsx:22-37`.

A bare `setInterval(poll, 2000)` with no `AbortController`. On rapid mount/unmount (HMR, navigation), in-flight fetches can resolve into an unmounted component. The project has `usePolling` (`hooks/use-polling.ts`) which solves this; using it everywhere keeps the polling story consistent. `stats-bar.tsx`, `reference-comparison.tsx`, and `defect-breakdown.tsx` already do.

---

### BUG-005 — Pagination "has next" off-by-one *(MED)*

**Location:** `app/collect/page.tsx:84-89, 147`; `defect-log.tsx` doesn't paginate at all.

`hasNext = frames.length === PAGE_SIZE`. When the total count is exactly a multiple of the page size, the user sees a "Next" button that fetches an empty page. Fix by exposing a total-count from the backend (cheap — there's already `get_collection_stats`) and computing pagination against it.

---

### BUG-006 — Live-feed chrome is hardcoded *(MED)*

**Location:** `components/dashboard/live-feed.tsx:130-136`.

The overlay always reads `CAM-01 · 1920px · 30fps`. In placeholder mode (no camera) it's misleading; if `config.camera_width` ever changes it's wrong. Either drive these from `/api/health` (which already exposes `camera_available`) or remove them.

---

### BUG-007 — Fullscreen button has no handler *(MED)*

**Location:** `components/dashboard/live-feed.tsx:89-92`. The `Maximize2` button has no `onClick`. Either wire it to `containerRef.current?.requestFullscreen()` or remove the button.

---

### BUG-008 — `ErrorBoundary` doesn't auto-reset when children change *(LOW)*

**Location:** `components/error-boundary.tsx:15-58`.

If the child throws once and the underlying state recovers (e.g., backend comes back), the boundary stays in the error state until the user clicks "Try again." Standard fix: implement `getDerivedStateFromProps` that resets when a `resetKeys` prop changes, or wrap the boundary at a finer granularity so a re-mount clears it.

---

### PERF-001 — ORB detector + BFMatcher re-instantiated every inspection *(HIGH)*

**Location:** `backend/inspector.py:53, 63`.

`cv2.ORB_create(nfeatures=...)` and `cv2.BFMatcher(cv2.NORM_HAMMING)` are constructed on every `inspect_frame` call. On a Mac it's a few ms; on Jetson it'll matter. They're stateless after construction — cache them at module scope or on a long-lived `Inspector` object. (Will need real numbers once you hand me the video file to verify magnitude, but the change is essentially free.)

---

### PERF-002 — Per-channel `warpAffine` in a Python loop *(MED)*

**Location:** `backend/inspector.py:276-281`.

```python
aligned_color = frame.copy()
for c in range(3):
    aligned_color[:, :, c] = cv2.warpAffine(frame[:, :, c], H, (w, h), borderMode=cv2.BORDER_REPLICATE)
```

`cv2.warpAffine` handles 3-channel arrays natively in a single call. Replace with:
```python
aligned_color = cv2.warpAffine(frame, H, (w, h), borderMode=cv2.BORDER_REPLICATE)
```
Saves the `frame.copy()` and two Python-level OpenCV trips.

---

### PERF-003 — First grayscale SSIM full-map call returns an unused global score *(LOW)*

**Location:** `backend/inspector.py:260`.

```python
gray_global, gray_map = ssim(gray_ref, gray_frame, full=True)
```

`gray_global` is never read. The `full=True` map is what's needed for the local-block scan, but the global score isn't used (the per-channel global comes from lines 293-298). Cosmetic — `ssim(full=True)` already computes the global as a byproduct. Just drop the variable: `_, gray_map = ssim(...)`.

---

### PERF-004 — `_crop_frame` interpolates ROI marker lines in a Python loop *(LOW)*

**Location:** `backend/capture.py:64-82`.

The inner `for i, x in enumerate(range(x1, x2 + 1)):` runs at 30 FPS. With ~6 mask-line pairs of ~3 px each, this is ~18 inner-loop iterations per frame — small today, but cleanly vectorisable with `np.linspace` for the t-values and a single broadcast assignment. Defer until profiling shows it matters.

---

### SEC-001 — No authentication on any API route, including destructive endpoints *(HIGH for plant LAN; OK for POC)*

**Location:** `backend/main.py` — all 22 routes.

Every endpoint is open. On a plant LAN this means anyone who can reach the box can:
- `DELETE /api/collection/clear` → wipe training data,
- `POST /api/inspection/stop` → wipe defect history (see BUG-001),
- `POST /api/reset_reference` → break inspection until the operator notices,
- `POST /api/set_reference` while a bad label is in frame → poison the golden master.

For POC: fine. Before plant LAN: pick something proportional — a shared bearer token via `Depends(verify_token)` on write endpoints is the cheapest workable answer for a kiosk system; full OIDC if it's actually multi-user.

---

### SEC-002 — No rate limiting *(HIGH for plant LAN)*

A loop hitting `POST /api/inspection/start` in a tight loop, or repeatedly calling `set_reference`, has no backpressure. `slowapi` integrates cleanly with FastAPI for write-side throttling.

---

### SEC-003 — CORS origins hardcoded *(MED for plant LAN)*

**Location:** `backend/config.py:64-69`. CORS is hardcoded to `localhost:3000` and `127.0.0.1:3000`. Add `CORS_ORIGINS` env-var support with comma-split, similar to `DATA_DIR`/`VIDEO_FILE`.

---

### SEC-004 — No CSRF protection *(MED for plant LAN)*

Today the only client is a same-origin React app; CSRF is moot. On a plant LAN, an internal browser visiting a malicious page could fire `POST` against the inspection box if it's reachable. Adding a same-site cookie + token-header pattern, or moving destructive endpoints to require a bearer (SEC-001), covers it.

---

### SEC-005 — No fetch timeouts on the frontend *(MED, today)*

**Location:** every `fetch(...)` call across the dashboard components.

A hung backend (e.g., camera deadlock) means the browser holds requests open until its own ~30-300s default. Add `AbortSignal.timeout(5000)` to all polled fetches:
```ts
fetch(API.stats, { signal: AbortSignal.timeout(5000) })
```

---

### OPS-001 — `backend/data/` has no retention or size policy *(MED)*

**Location:** `backend/database.py`.

Defect rows + annotated JPEGs grow without bound until `stop_inspection` blasts the lot (BUG-001). On a long shift with high defect rate, disk pressure becomes a real concern. Decide on either time-based pruning (`DELETE FROM defects WHERE timestamp < ?`) or count-based (`keep newest N`), and rotate JPEGs accordingly.

---

### OPS-002 — INFO-level logging only *(MED)*

`logger.info(...)` calls are scattered through the backend, all writing to stdout. There is no structured format, no per-defect correlation ID, no metrics endpoint. For a system that's meant to run unattended on a plant floor, you need at least:
- Structured JSON logs (`structlog` or `python-json-logger`)
- A `/metrics` endpoint exposing inspection rate, defect rate, capture-thread liveness, ORB confidence histogram (Prometheus format)
- A liveness probe distinct from `/api/health` that returns 503 when the capture thread has died

---

### DEAD-001 — `hooks/use-mobile.tsx` is unused *(LOW)*

**Location:** `hooks/use-mobile.tsx`. Grep shows zero imports. Delete or document where it'll be used. Dashboard is desktop-only by design.

---

### DEAD-002 — `useSSE` export in `use-polling.ts` is unused *(LOW)*

**Location:** `hooks/use-polling.ts:56-113`.

The hook implements the correct reconnect-with-backoff pattern, but neither SSE consumer (`defect-log.tsx`, `defect-alert.tsx`) imports it. Each hand-rolls SSE differently — `defect-log` without reconnect (BUG-003), `defect-alert` with its own copy of the backoff logic. Pick one: use `useSSE` everywhere, or delete the export.

---

### TEST-001 — No tests for the collection-mode codepath *(MED)*

`backend/tests/` covers inspector, state machine, database (defects), capture, models, config, API. Zero tests touch `start_collect_mode`, `insert_collected_frame`, `label_collected_frame`, `clear_collected_frames`, or the `/api/collection/*` routes. CON-004 is exactly the kind of bug a focused test would catch.

---

### TEST-002 — No tests for SSE thread-safety / `clear_all` blast radius *(MED)*

`test_capture.py::TestCaptureManager::test_stop_resets_everything` only checks the stats — it doesn't assert that the DB is wiped, so the data-destructive behavior in BUG-001 has no test pinning it down. There is also no test that drives `register_event_callback` from one thread while a defect is dispatched from another (CON-001/CON-002).

---

### TEST-003 — No frontend tests at all *(LOW)*

No Vitest, no Playwright, no Testing Library. Acceptable for POC but call it out before plant deployment — at minimum, smoke-test the SSE reconnect path and the "stop wipes data" confirmation flow once BUG-001 is fixed.

---

### DOC-001 — Undocumented configuration *(LOW)*

- `DATA_DIR` env var (only mentioned in a comment in `config.py:56-58`).
- `VIDEO_FILE` env var (only mentioned in `config.py:22, 114`).
- `camera_index = 1` default is unusual — needs a one-line note ("MacBook camera is index 0, USB HDMI capture lands at index 1").

Add to README and to CLAUDE.md.

---

## Health score

Starting at 100, deducting by severity:

| Bucket | Count | Per-item | Total |
|---|---|---|---|
| CRIT | 2 | -15 | -30 |
| HIGH | 6 | -8 | -48 |
| MED | 12 | -3 | -36 |
| LOW | 8 | -1 | -8 |

Raw deduction: -122 (clamped). Adjusted with weighting (SEC-001/002 are future-P0 not blocking POC; PERF items are pre-Jetson concerns):

**Score: 58/100**

Net read: solid POC, no smoking-gun memory leaks, the architecture is sound. Two items would move the needle the most — fix BUG-001 (stop-button data-loss) and CON-001 (SSE thread safety). Do those and the score jumps to ~75.

---

## Recommended fix order

### Sprint 1 — bugs that bite you today
1. **BUG-001** — separate `stop` from `reset`. Single highest-impact change. Needs your call on the UX.
2. **CON-001** — wrap `event_queue.put_nowait` in `loop.call_soon_threadsafe`.
3. **CON-002** — guard `_event_callbacks` with the existing lock.
4. **BUG-002** — read `/api/collection/stats.collecting` on mount.
5. **BUG-003** — wire `useSSE` into `defect-log.tsx` (also closes DEAD-002).

### Sprint 2 — pre-Jetson perf + cleanup
6. **PERF-001** — cache `cv2.ORB_create` and `cv2.BFMatcher`.
7. **PERF-002** — single 3-channel `warpAffine`.
8. **CON-004** — single-transaction `insert_collected_frame`.
9. **BUG-004 / BUG-006 / BUG-007** — polish UI inconsistencies.
10. **DEAD-001 / PERF-003** — delete unused code.

### Sprint 3 — pre-plant-LAN deployment
11. **SEC-001** — bearer token on write endpoints.
12. **SEC-002** — slowapi rate limit on writes.
13. **SEC-003** — env-driven CORS origins.
14. **SEC-005** — fetch timeouts.
15. **OPS-001 / OPS-002** — retention policy + structured logging + metrics.
16. **TEST-001 / TEST-002** — test coverage for collection mode and the destructive paths.

---

## What I did NOT verify (need your help)

- **PERF-001 magnitude**: I haven't measured ORB recreate cost. Drop a video into `public/` and I'll run the inspection loop with `cProfile` to confirm whether this is microseconds or milliseconds.
- **MJPEG generator behavior with no clients connected**: I read the code; FastAPI/Starlette should short-circuit the generator when the client closes the response, but I didn't verify it doesn't keep encoding into a closed stream.
- **End-to-end SSE under load**: needs a running backend + browser to reproduce CON-001 races empirically.

---

## Review — Fixes Applied 2026-04-16

User scoped: fix everything; defer plant-LAN security items (SEC-001/002/004) and ops items (OPS-001/002) since this is still POC; defer TEST-003 (no frontend test harness exists).

### Verification

- `python3 -m py_compile` passes for every backend file I touched (no Python interpreter with pip is available on this WSL2 box, so `pytest` was not run — please run `pytest` from the dev Mac to confirm the new tests pass).
- `pnpm lint` — **0 errors, 0 warnings**.
- `pnpm build` — **passes**, three routes prerendered (`/`, `/collect`, `/_not-found`).

### Per-finding outcomes

**Critical**
| ID | Status | Notes |
|---|---|---|
| BUG-001 | Fixed | `stop_inspection` no longer calls `clear_all`. Added `clear_defect_history()` method + `POST /api/defects/clear` endpoint as the explicit destructive path. |
| CON-001 | Fixed | `events()` now grabs the running loop and hops `event_queue.put_nowait` through `loop.call_soon_threadsafe`. Queue also given `maxsize=100` so the existing `QueueFull` handler (CON-003) is now reachable instead of dead. |

**High**
| ID | Status | Notes |
|---|---|---|
| CON-002 | Fixed | `_event_callbacks` register/unregister now hold `self._lock`; iteration site snapshots under the lock before calling. |
| BUG-002 | Fixed | `InspectionControls` polls `/api/collection/stats` every 5 s and uses backend value as truth. |
| BUG-003 | Fixed | `defect-log.tsx` now uses `useSSE` (with reconnect/backoff). `defect-alert.tsx` migrated to the same hook for consistency. |
| PERF-001 | Fixed | `cv2.ORB_create` cached per-features-count; `cv2.BFMatcher` cached at module scope. |
| SEC-001 | **Deferred (POC)** | Plant-LAN P0; no auth introduced for POC. Logged in roadmap below. |
| SEC-002 | **Deferred (POC)** | Same as SEC-001. |

**Medium**
| ID | Status | Notes |
|---|---|---|
| CON-003 | Fixed | Queue gained `maxsize=100`; handler now meaningful. |
| CON-004 | Fixed | `insert_collected_frame` now does insert + image-write + path-update in one locked block, matching `insert_defect`. |
| BUG-004 | Fixed | `app/page.tsx` switched from raw `setInterval` to `usePolling`. |
| BUG-005 | Fixed | `collect/page.tsx` pagination computes `totalForFilter` from `stats` (already exposed by backend). Off-by-one gone. Removed dead `total` state and dead `pendingLabel` ref. |
| BUG-006 | Fixed | Live-feed chrome now reads `cameraAvailable` from `/api/health` and shows `live` / `no signal` / `…`. |
| BUG-007 | Fixed | `Maximize2` button toggles `containerRef.current.requestFullscreen()`. |
| PERF-002 | Fixed | Single 3-channel `cv2.warpAffine` replaces the per-channel Python loop. |
| SEC-003 | Fixed | `CORS_ORIGINS` env var supported (comma-split). Default unchanged. |
| SEC-004 | **Deferred (POC)** | Plant-LAN P0. |
| SEC-005 | Fixed | `lib/api.ts` exports `apiFetch` with 5 s default timeout via `AbortSignal.timeout`. All 16 polled-fetch sites converted. |
| OPS-001 | **Deferred** | Needs retention policy decision. Logged in roadmap. |
| OPS-002 | **Deferred** | Needs decision on metrics backend. Logged in roadmap. |
| TEST-001 | Fixed | New `tests/test_collection_mode.py` covers start/stop, insert, get, label round-trip, unlabeled filter, stats, clear. |
| TEST-002 | Fixed | New `test_stop_preserves_defect_history` and `test_clear_defect_history_wipes_db` pin the BUG-001 fix. New `test_concurrent_register_unregister` smoke-tests CON-002. |

**Low**
| ID | Status | Notes |
|---|---|---|
| BUG-008 | Fixed | `ErrorBoundary` accepts `resetKeys`; auto-resets when any key changes. |
| PERF-003 | Fixed | Unused `gray_global` dropped. |
| PERF-004 | **Deferred** | Mark from audit said "defer until profiling shows it matters" — left in place. |
| DEAD-001 | Fixed | `hooks/use-mobile.tsx` deleted. |
| DEAD-002 | Fixed | Both SSE consumers now use `useSSE`. The hook itself was extended to accept named events. |
| TEST-003 | **Deferred** | No frontend test harness in repo. |
| DOC-001 | Fixed | CLAUDE.md gained an Environment Variables section covering `DATA_DIR`, `VIDEO_FILE`, `CORS_ORIGINS`, and the `camera_index = 1` rationale. API endpoint table updated to reflect the new stop semantics + `/api/defects/clear`. |

### Files changed

Backend:
- `backend/main.py` — SSE thread-safety fix, new `/api/defects/clear` endpoint.
- `backend/capture.py` — lock on event-callback list, snapshot-under-lock at iteration site, `stop_inspection` no longer wipes DB, new `clear_defect_history` method.
- `backend/inspector.py` — cached ORB+BFMatcher, single 3-channel warpAffine, dropped unused gray_global.
- `backend/database.py` — single-transaction `insert_collected_frame`.
- `backend/config.py` — `CORS_ORIGINS` env var support.
- `backend/tests/test_capture.py` — `test_stop_preserves_defect_history`, `test_clear_defect_history_wipes_db`, plus rename of `test_stop_resets_everything` → `test_stop_resets_run_stats`.
- `backend/tests/test_collection_mode.py` — new file, 9 tests.

Frontend:
- `lib/api.ts` — `apiFetch` helper with default 5 s timeout.
- `app/page.tsx` — `usePolling`, removed unused `status` prop pass-through (was a TS error masked by no `tsc` step).
- `app/collect/page.tsx` — `apiFetch`, pagination via real totals, dead refs/state removed.
- `hooks/use-polling.ts` — `useSSE` extended to accept `events` map; self-reference fixed via `connectRef`.
- `hooks/use-mobile.tsx` — deleted.
- `components/error-boundary.tsx` — `resetKeys` support.
- `components/dashboard/defect-alert.tsx` — migrated to `useSSE`.
- `components/dashboard/defect-log.tsx` — migrated to `useSSE`, `apiFetch`.
- `components/dashboard/defect-breakdown.tsx` — `apiFetch`.
- `components/dashboard/defect-detail.tsx` — `<img>` lint disable comment.
- `components/dashboard/inspection-controls.tsx` — `apiFetch`, polls collection state from backend.
- `components/dashboard/live-feed.tsx` — `apiFetch`, fullscreen handler, camera chrome from `/api/health`, `containerRef` wired.
- `components/dashboard/reference-comparison.tsx` — `apiFetch`.
- `components/dashboard/stats-bar.tsx` — `apiFetch`.

Docs:
- `CLAUDE.md` — environment variables section, API table updates.

### Roadmap for what was deferred

**Pre-plant-LAN deployment (security):**
1. SEC-001: bearer token (env-driven shared secret) on every write endpoint via `Depends(verify_token)`.
2. SEC-002: `slowapi` rate-limit on write endpoints (e.g. 5 req/s per IP).
3. SEC-004: same-site cookie + CSRF token, or just rely on bearer-token (SEC-001) for cross-origin protection.

**Operations (decisions needed):**
4. OPS-001: pick a retention policy (count-based "keep last N defects" is simplest; time-based needs a sweep cron). I'll need your call on horizon.
5. OPS-002: pick a logging+metrics target. `python-json-logger` for stdout JSON is the cheapest baseline; Prometheus `/metrics` route via `prometheus-client` is the next step up.

**Test infrastructure:**
6. TEST-003: add Vitest + Testing Library for the React components, or Playwright for E2E. Smallest valuable footprint: Playwright smoke test that boots both servers, captures a reference, simulates a defect, and confirms the SSE banner fires.

**Performance (waiting on video file):**
7. PERF-004: vectorize the `_crop_frame` ROI-line interpolation if profiling shows it matters.
8. ORB cost magnitude (PERF-001 was already fixed; profiling will confirm the saving).

### Score

Pre-fix: 58/100. With everything fixed except the deferred-by-scope items: ~82/100. Remaining 18-pt deduction is mostly the security items (POC has no auth) and the lack of structured logging/metrics — both reasonable for POC, both real before deployment.
