

# Mobile UI/UX Audit — Findings & Improvement Plan

## Issues Found

### 1. Team Chat panel overflows on mobile
`TeamMessaging.tsx` line 90-91: Fixed at `bottom-4 right-4` with `w-[400px]` — this exceeds mobile viewport width (typically 375px). The `md:w-[700px]` is fine for desktop but the base `w-[400px]` clips off-screen on phones.

**Fix**: Change to `w-[calc(100vw-2rem)] md:w-[400px] lg:w-[700px]` so it fills available width on mobile with gutters.

### 2. Team Chat overlaps bottom nav bar
The chat panel sits at `bottom-4 right-4` (line 90) but the mobile bottom nav is `fixed bottom-0` with ~80px height. The chat panel hides behind or collides with the nav bar on mobile.

**Fix**: On mobile, make the chat panel full-screen (`inset-0`) instead of a floating card. This matches the iOS/Android messaging pattern and avoids nav overlap entirely.

### 3. Dashboard Banner too tall on mobile
`DashboardBanner.tsx` uses `h-48 md:h-56` for `standard` height. On a 667px-tall phone, 192px is 29% of the viewport — excessive. The glass text box with `px-6 py-5` and `bottom-6 left-8` also clips on narrow screens.

**Fix**: Add `h-32 sm:h-48 md:h-56` and adjust glass text position to `bottom-3 left-4 right-4 sm:bottom-6 sm:left-8`.

### 4. FloatingActionMenu position conflicts with bottom nav
`FloatingActionMenu.tsx` line 37: `bottom: calc(6rem + env(safe-area-inset-bottom))` — This works but is fragile. On shorter phones the FAB + expanded actions can overlap content or the top nav.

**Fix**: Minor — acceptable as-is, but add `max-h-[60vh] overflow-y-auto` to the expanded action list to prevent it from going off-screen on short devices.

### 5. Booking cards lack tap affordance on mobile
`BookEnhanced.tsx` line 476-529: Today's Schedule booking rows use `hover:bg-muted/50` but no `active:` state. On touch devices, there's no visual feedback when tapping a booking card.

**Fix**: Add `active:bg-muted/70 active:scale-[0.99]` for press feedback on the booking row divs.

### 6. "New Booking" button forces `size="lg"` on mobile
`BookEnhanced.tsx` line 371: The "New Booking" button uses `size="lg"` unconditionally. On mobile this takes up too much horizontal space next to the "Booking Overview" heading.

**Fix**: Change to `size="default"` or `size="sm"` with responsive sizing: `className="shadow-md text-xs sm:text-sm"`.

### 7. Module Navigation Cards grid cramped on small phones
`DashboardOverviewEnhanced.tsx` line 564: `grid-cols-2 gap-3` with `p-4` works but the text `text-xs` can truncate on 320px-wide devices.

**Fix**: Acceptable. No change needed — already has `sm:p-6` and `sm:text-sm`.

### 8. Revenue Analytics heading oversized on mobile
Line 510: `text-lg font-semibold` — this is fine but the section heading hierarchy is inconsistent (Quick Stats uses `text-sm`, Revenue uses `text-lg`, Fleet Status uses `text-sm`).

**Fix**: Normalize to `text-sm sm:text-lg` for Revenue heading to match the compact mobile style.

## Implementation Plan

### Files Changed

| File | Change |
|------|--------|
| `src/components/messaging/TeamMessaging.tsx` | Full-screen on mobile, proper sizing |
| `src/components/dashboard/DashboardBanner.tsx` | Shorter on mobile, responsive text position |
| `src/components/dashboard/BookEnhanced.tsx` | Active states on booking rows, smaller CTA on mobile |
| `src/components/dashboard/DashboardOverviewEnhanced.tsx` | Consistent heading sizes |

### Not Changing
- Bottom nav (already well-built with safe-area support)
- ModuleTabs (already has responsive `shortLabel` + icon stacking)
- FloatingActionMenu (positioning is acceptable)
- RariSidebar (already full-width on mobile with swipe-to-dismiss)

