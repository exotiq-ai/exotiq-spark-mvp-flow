## Mobile & Tablet UI Sweep

Goal: on every viewport (375 / 414 / 768 / 1024), nothing spills the frame, every sheet/dialog scrolls internally, and recently-changed surfaces (Booking + Extend dialogs, Customers, Mobile More menu) feel right on a phone.

---

### 1. Mobile "More" sheet — scrollable + Customers reachable

`src/components/mobile/MobileMoreMenu.tsx`

- Sheet content is currently a fixed `SheetContent side="bottom"` with `pb-8 pt-2 px-4` — no max-height, no overflow. On short phones the Management + Secondary items get pushed off-screen and Customers isn't tappable.
- Fix:
  - Wrap `SheetContent` with `max-h-[85vh] flex flex-col`.
  - Move header + location selector into a non-scrolling top region.
  - Wrap `menuItems` + `secondaryItems` in a single `overflow-y-auto overscroll-contain flex-1 -mx-4 px-4` scroll region.
  - Add `Customers` to the menu (it's currently missing from `operationsItems` — that's why the user can't reach it) and drop the duplicate `TrendingUp` icon on FleetCopilot (use `Brain`).
  - Ensure `isActive` list includes `"customers"`.

### 2. Customers module — mobile defaults + top-card sizing

`src/components/dashboard/CRMSection.tsx`, `src/components/dashboard/CustomerListRow.tsx`

- Default `viewMode` to `list` on mobile (first-load only, still user-overridable and still persisted):
  - Use `useIsMobile()`; if no stored preference and mobile, initialize to `'list'`.
- Top KPI/highlight cards: switch the grid to `grid-cols-2 gap-3 md:grid-cols-4`, shrink numbers to `text-xl md:text-2xl`, tighten padding `p-3 md:p-5`, truncate labels.
- Toggle group + search + filter row: stack to `flex-col gap-2 sm:flex-row`, make search full-width on mobile.
- Cards grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` so nothing overflows at 375.
- `CustomerListRow`: enforce single-line truncation on name/email columns; hide low-priority columns under `sm:` / `md:` breakpoints so the row fits without horizontal scroll.
- `CustomerProfileDialog`: `max-w-[calc(100vw-1rem)] sm:max-w-2xl`, body `max-h-[85vh] overflow-y-auto`, sticky header.

### 3. Booking + Extend dialogs — fit-to-screen

`src/components/dialogs/EnhancedBookingDialog.tsx`, `src/components/dialogs/ExtendBookingDialog.tsx`

- Current width is 900px — on tablets and small laptops this butts the edges; on mobile it overflows.
- Change to `w-[95vw] max-w-[900px] max-h-[90vh] flex flex-col`, body region `flex-1 overflow-y-auto`, header + footer sticky.
- Tab strip: `overflow-x-auto` with `flex-nowrap` so 4-5 tabs scroll horizontally instead of wrapping ugly.
- Header icon row (Edit, Calendar-add, Close): collapse labels to icon-only under `sm:`, add `aria-label`s.
- Extend dialog line-items: switch two-column receipt to single column stacked under `sm:`.

### 4. Booking calendar day popover — already scrollable, verify

`src/components/dashboard/BookingCalendar.tsx` (previously fixed). Re-verify at 375/414 that:
- Popover `max-h-[70vh] overflow-y-auto` still applies.
- Reservation cards use `min-w-0` + truncation so long vehicle names don't push width.

### 5. Global sweep — dialogs, sheets, cards

Repo-wide pass with a small checklist applied per surface:
- `DialogContent`: `max-w-[calc(100vw-1rem)]`, `max-h-[90vh]`, body `overflow-y-auto`.
- `SheetContent side="bottom"`: `max-h-[85vh]`, internal scroll region.
- Horizontal card rows/tables: `overflow-x-auto` on the wrapper, `min-w-0` on flex children with truncation.
- Any hardcoded `w-[...px]` over 360 gets a `max-w-[calc(100vw-1rem)]` sibling.

Surfaces to walk (based on recent changes):
- `FleetPageEnhanced` (Inspections tab moved in)
- `PaymentTracker`, `PaymentsSection`
- `VaultEnhanced`, `MarginEnhanced` (VehiclePnLTable already tightened — re-check phone)
- `DashboardBottomActionBar` — make sure it never overlaps the More sheet
- `RariSidebar` on mobile

### 6. Verification (Playwright, headless)

Script drives localhost at three viewports: 375×812 (iPhone), 768×1024 (iPad portrait), 1024×1366 (iPad landscape). For each:
- Open More menu → confirm Customers is visible + tappable, scroll to bottom of sheet.
- Navigate to Customers → confirm list view is default on 375, cards on 1024.
- Open a customer → dialog fits, scrolls.
- Open a booking → Booking + Extend dialogs fit, tabs scroll horizontally, no body clipping.
- Screenshot each state, view screenshots, confirm no clipped content.

### Out of scope
- No business-logic changes (extension math, RLS, edge functions untouched).
- No visual redesign — spacing, sizing, and scroll only.

### Technical notes
- Prefer Tailwind responsive prefixes over JS branching; only use `useIsMobile()` where behavior differs (view-mode default, header collapse).
- Preserve existing `data-testid` selectors used by Playwright tests.
- Keep semantic tokens (no hardcoded colors).
