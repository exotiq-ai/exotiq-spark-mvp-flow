

# Replace Cube Logo with D Emblem + Wordmark Lockup (Theme-Aware)

## Problem
The `Logo` component (used in landing nav, footer, legal pages, dashboard sidebar) currently renders the old cube PNG. Need to replace it with the D emblem + "Exotiq" wordmark that adapts to light/dark themes.

## Current State
- **`Logo` (ui/logo.tsx)** — cube PNG, used in 5 files (Navigation, Footer, LegalPageLayout, Dashboard, DashboardSidebarEnhanced)
- **`ExotiqLogo` / `ExotiqLogoBranded`** — D emblem SVG + programmatic wordmark, used in DashboardHeader and DashboardSidebar
- D emblem SVGs exist at `/brand/logos/svg/` in gulf-blue, white, black, orange, silver variants

## Plan

| # | File | Change |
|---|------|--------|
| 1 | `src/components/ui/logo.tsx` | Rewrite to render D emblem SVG + "Exotiq" wordmark. Use `useTheme()` from `next-themes` to pick gulf-blue emblem in light mode, white emblem in dark mode. Wordmark text color switches accordingly. Keep existing `size` prop API (`sm`/`md`/`lg`). |
| 2 | `src/components/dashboard/DashboardSidebarEnhanced.tsx` | Replace hardcoded `exotiq-d-icon.svg` fallback (line 255) with `<Logo size="sm" />` for consistency. |

## Technical Detail

**Updated `Logo` component** will:
- Import `useTheme` from `next-themes`
- Light mode: `/brand/logos/svg/d-emblem-gulf-blue-transparent.svg` + dark text wordmark
- Dark mode: `/brand/logos/svg/d-emblem-white-transparent.svg` + white text wordmark
- Render emblem + "Exotiq" text side-by-side (same pattern as `ExotiqLogoBranded` but self-contained)
- Size presets control both emblem height and text size

No new assets needed — existing SVGs are sufficient.

