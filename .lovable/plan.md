## Goals

1. Prioritize new marketplace booking requests in the Daily Brief for human review.
2. Stop the calendar reservation card from jumping to FleetCopilot when the customer name is clicked, and confirm every other tap target on the card goes to the right place.

---

## 1. Daily Brief — surface new bookings

**File:** `src/hooks/useDailyBrief.ts`

Today the brief only flags `status === 'pending'` as "bookings need confirming". Marketplace bookings arrive as `requested` (and can sit at `pending_documents` / `pending_payment`), so they never surface as an issue even though the bell icon fires.

Changes:
- Add a new **high-severity** issue at the top of the ranked list:
  - `id: 'marketplace-requests'`
  - Filter: `status === 'requested'` (source = marketplace).
  - Title: `"N marketplace request(s) awaiting review"`.
  - Detail: first 3 vehicle + customer names.
  - `module: 'book'`, `meta.bookingId` = first request id (deep-links straight into the booking).
- Keep the existing `pending-confirmations` issue but broaden it to also count `pending_documents` and `pending_payment` (still medium severity) so the operator sees the full "needs a human" queue.
- No metric-row changes needed — the existing "New (24h)" tile already reflects fresh volume.

No edge-function changes; the narrative function already consumes `pendingConfirmations` and will naturally reflect the new count.

---

## 2. Calendar card navigation

**File:** `src/components/dashboard/BookingCalendar.tsx`

Root cause: the customer-name click on both card variants calls `goToCustomerProfile(customer_id)` from `useModuleNavigation`, which routes to `/dashboard/fleetcopilot?view=crm&customerId=...`. That is the "jump to FleetCopilot" the user is seeing — CRM is hosted inside the FleetCopilot module.

Fix (keeps user in Bookings context):
- Replace the customer-name click on the calendar cards with an in-place `CustomerProfileDialog` (already used by `CRMSection`). Open it as a modal overlay above the calendar; do not navigate.
- Wire it in both card variants:
  - Mobile/desktop popover card (lines ~95–115).
  - Day-detail list card (lines ~200–255).
- Leave all other touch targets unchanged — they are already correct:
  - Card body / vehicle name / Details button → `handleBookingClick` opens the booking dialog in place.
  - Phone / Email buttons → `tel:` / `mailto:`.
  - External-link icon → booking details.

Audit pass to confirm no regressions:
- `BookEnhanced.tsx`, `PaymentTracker.tsx`, `UpcomingBookingsCard` — customer clicks there still route via `goToCustomerProfile` (which is fine on non-calendar surfaces). Out of scope for this change unless we later decide to standardize on the dialog everywhere.

---

## Technical notes

- `CustomerProfileDialog` needs the customer record; the calendar already loads customers via `useCustomers` (used elsewhere in the same file) — reuse that hook and look up by `booking.customer_id`. If not present, gracefully skip.
- Add local state `[profileCustomerId, setProfileCustomerId]` in the `BookingCalendar` component and pass a `openCustomerProfile` callback down to `DayDetailContent` and the popover card in place of `goToCustomerProfile`.
- No routing, RLS, or edge-function changes.

## Verification

- Create/receive a booking with `status='requested'` → confirm it appears as the top high-severity issue in the Daily Brief and deep-links to the booking.
- On the calendar, click a reservation card's customer name → CustomerProfileDialog opens over the calendar (no route change, no FleetCopilot jump).
- Click vehicle image, vehicle name, card body, Details button → booking dialog opens.
- Click Phone / Email → native handlers fire.
