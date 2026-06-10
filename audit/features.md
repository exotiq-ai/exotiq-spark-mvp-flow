# features.md — Improvement ideas (architect-reviewer)

Tags: **SMALL-BUILD** (<~1 hr, low-risk, fits existing patterns) · **FLAG**
(larger / needs product or schema decision). Grounded in code actually present.

---

## SMALL-BUILD

### F1 — Submit-time conflict guard with a clear error toast
- Where: `src/components/dialogs/NewBookingDialog.tsx:191` (`handleSubmit`).
- The availability map already exists (`:168`). Add, before `onSubmit`, a check of
  `vehicleAvailability[vehicleId] === false` → `setError('Vehicle is already booked
  for these dates')`. Closes the client half of BUG-1 in minutes (server constraint
  is the FLAG below). Low risk, no schema change.

### F2 — Surface `reconcile_flag` payouts in the Margin UI
- Where: `partner_payouts.reconcile_flag/reconcile_note` exist
  (migration `20260529001701:2-8`) and a partial index is defined, but verify the
  UI renders them. Add a "Needs reconcile" badge/filter in `PartnerPayoutsTab.tsx`
  / `ReviewTab.tsx`. Turns BUG-3's silent flags into an actionable queue.

### F3 — Make the gas fee / platform fee % visible where money is shown
- Where: `pricingUtils.DEFAULT_GAS_FEE` (`:88`) and `teams.platform_fee_percent`.
- Booking/statement views should display the effective fee % used, not just the
  dollar amount, so operators can self-detect the BUG-2 20%/10% mismatch. Read-only
  display; pulls values already in scope.

### F4 — Dynamic-import xlsx behind the import/export buttons
- Where: `src/lib/importUtils.ts:2`, `CRMSection.tsx:33`.
- `const XLSX = await import('xlsx')` in the handlers. Ships as a UX win (faster app
  load) and is essentially the P2 perf fix; small and self-contained.

### F5 — `manualChunks` vendor split in vite.config
- Where: `vite.config.ts` (currently none). Add a `build.rollupOptions.output.manualChunks`
  grouping react/router/supabase/recharts/framer-motion/xlsx. ~20 lines, big caching
  win, zero behavior change.

### F6 — Unit tests for the booking overlap predicate + fee math
- Where: new tests beside `pricingUtils.test.ts`. Once R1/R2 extract shared
  `rangesOverlap` and `computePlatformFee`, add boundary-touch / fee-rounding cases.
  Cheap, locks down the two highest-severity bug classes against regression.

### F7 — ICS UTC correctness + per-event TZID
- Where: `src/lib/calendarExport.ts:16-34`. Emit `…Z` UTC timestamps (or `TZID`).
  Small, fixes BUG-4, and is independently testable on the generated string.

---

## FLAG

### F8 — Server-side double-booking prevention (the real fix for BUG-1)
- Add `btree_gist` + an `EXCLUDE` constraint on
  `bookings (vehicle_id WITH =, tstzrange(start_date,end_date) WITH &&)
  WHERE status NOT IN ('cancelled','completed')`, or a `BEFORE INSERT/UPDATE`
  trigger raising on overlap. FLAG: migration on the core booking table, needs
  decision on inclusive/exclusive boundaries and how to surface the DB error to the
  UI; must handle the buffer window if cleaning gaps are to be enforced too.

### F9 — Reconcile/backfill job for partner payouts written under the inverted split
- Tied to BUG-3. A one-shot recompute (admin-triggered RPC) that recomputes
  `net_to_partner` for rows whose `created_at` falls in the bad window and either
  fixes pending rows or flags paid ones with a delta. FLAG: touches money already
  paid out; needs an audit trail and human sign-off.

### F10 — Single source of truth for "platform fee" across DB + Stripe
- Tied to BUG-2/R2. Decide the canonical base (rental base vs payment amount) and %
  source (`teams.platform_fee_percent`), then make both edge functions read it.
  FLAG: changes real Stripe `application_fee_amount` behavior; needs finance review.

### F11 — Realtime channel abstraction + presence scoping
- Tied to BUG-5/R6. A `useRealtimeChannel` helper plus scoping `user_presence` reads
  to the current team. FLAG: presence/typing UX is easy to regress; verify manually.

### F12 — Denormalize conversation last-message to kill the N+1
- Tied to P7. Add `last_message_at/last_message_preview` to `team_conversations`,
  maintained in the existing `sendMessage` path (`useTeamMessaging.ts:372`). Removes
  one of the three per-conversation queries and gives correct list ordering.
  FLAG: schema + write-path change.
