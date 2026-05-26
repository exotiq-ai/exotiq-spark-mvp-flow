## Goal
White-label the chrome when a customer uploads their logo, keeping Exotiq present as a quiet trust mark.

- **Header**: small Exotiq **D emblem** (no wordmark) + customer logo. If no customer logo uploaded, fall back to today's full Exotiq lockup.
- **Sidebar**: customer logo becomes primary; small Exotiq D emblem shown as a subtle co-brand. If no customer logo, today's Exotiq lockup stays.

## Changes

### 1. `src/components/dashboard/DashboardHeader.tsx` (lines 54–65)
Conditional render:
- If `currentTeam?.logo_url`:
  - Small Exotiq D emblem only (`<ExotiqLogo variant="auto" size="sm" />` — no wordmark)
  - Customer logo: `h-7 sm:h-8 w-auto object-contain max-w-[140px]`
  - Gap `gap-2`, no `<Separator>`
- Else: keep today's `ExotiqLogoBranded` (sm mobile, md desktop)

### 2. `src/components/dashboard/DashboardSidebarEnhanced.tsx` (lines 248–274)
Flip the hierarchy so the customer brand leads:
- **Expanded, logo uploaded**: customer logo prominent on top (`h-10 max-w-[180px] object-contain`), tiny Exotiq D emblem below (`h-4 opacity-70`) — no "Exotiq" wordmark.
- **Expanded, no logo**: today's full Exotiq lockup (`<Logo size="lg" />`).
- **Collapsed, logo uploaded**: customer logo only (`w-9 h-9 rounded-lg object-contain`) — current behavior.
- **Collapsed, no logo**: Exotiq icon only (`<Logo size="sm" iconOnly />`) — current behavior.

### 3. `src/components/dashboard/DashboardSidebar.tsx` (legacy)
If still mounted anywhere, mirror the same flipped pattern. Verify with a quick grep before editing; skip if unused.

## Out of scope
- Settings upload UI, storage, RLS, team context (already working).
- Login / legal / marketing pages — stay Exotiq-only.
- No color or layout changes outside the logo slots.

## Files touched
- `src/components/dashboard/DashboardHeader.tsx`
- `src/components/dashboard/DashboardSidebarEnhanced.tsx`
- `src/components/dashboard/DashboardSidebar.tsx` (only if active)
