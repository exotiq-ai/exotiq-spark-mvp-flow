# Pre-Launch Work Order Review — Feedback + Plan

I read both docs against the code. The audit's diagnosis of **B1** is accurate — verified in `BookEnhanced.tsx:255`, `FleetContext.tsx:950-951`, and `rent-approve-booking/index.ts:81`. The other items also line up with what's actually in the repo. Below is the plan I'd execute, in priority order, plus questions where the audit leaves a real choice.

---

## 1. B1 — Marketplace approval blocker (LAUNCH BLOCKER)

Root cause is exactly what the audit says: three layers gate on `status === 'pending'`, but marketplace bookings are only ever `requested` or `pending_documents`. The dashboard alert was updated, the action surfaces were not, and the generic `updateBookingStatus` fall-through silently confirms without payment.

**Fix (all four together, so no path stays broken):**

1. `src/components/dashboard/BookEnhanced.tsx:254-255` — expand `pendingBookings` filter to include marketplace request statuses. Direct-booking `'pending'` continues to appear as today. `pending_documents` shows in the list as **"Awaiting renter ID"** (non-actionable badge), `requested` shows as **"Approve"** (actionable).
2. `src/contexts/FleetContext.tsx:950-955` — change `isMarketplaceApproval` guard from `status === 'pending'` to `status === 'requested'`. Route those to `rent-approve-booking`.
3. `src/contexts/FleetContext.tsx` generic branch — **hard guard**: if `booking_source === 'marketplace'` and current status ∈ {`requested`, `pending_documents`} and target status is `confirmed`, throw. The confirmed transition belongs to the payment webhook only. This is the actual damage-preventer.
4. `supabase/functions/rent-approve-booking/index.ts:81` — accept `status === 'requested'` (not `'pending'`). Keep the 409 for anything else. Do NOT accept `pending_documents` (matches audit recommendation — ID stays a precondition).
5. Booking detail modal (`EnhancedBookingDialog.tsx`) — add **Approve** and **Decline** actions when `booking_source === 'marketplace' && status === 'requested'`. Decline uses the existing `rent-cancel-booking` path with `reason: 'operator_declined'`.
6. Dashboard "marketplace request awaiting review" alert — deep-link to the Bookings page with the specific booking pre-opened (query param, same pattern already used for global search).

**DB belt-and-braces (recommended, matches audit item 5):** add a trigger that rejects `requested|pending_documents → confirmed` for `booking_source = 'marketplace'`. Prevents any future UI regression from re-introducing free cars.

**Verification (audit §7):** approve BK-03456 in Command Center → must become `pending_payment` with `payment_due_at ≈ +48h` and the renter must receive the approval email with a working pay link.

## 2. H1 — Hero-image signed URLs

Code today at `generate-hero-image/index.ts:216` signs for **365 days** and persists into `vehicles.image_url` — the audit measured 3650 days, so either the value drifted at some point or `public_team_fleet` re-signs; either way the fix is the same: **stop persisting long-lived signed URLs**.

**Recommended path (audit-preferred, simpler):** make the `vehicle-photos` bucket public for marketing images and store the public URL instead. Trade-off: anyone with the URL can view; these are marketing shots so acceptable. Alternative is to serve every hero through `rent-public-media` (1h), which needs a small renter-repo change.

**→ Question for you:** flip the bucket public, or keep private and route through `rent-public-media`?

## 3. H3 — Hide "Record Payment" on marketplace bookings

`EnhancedBookingDialog.tsx:1206`, `DashboardBottomActionBar.tsx`, `FloatingActionMenu.tsx`. Hide the action when `booking_source === 'marketplace'`. This is what caused the BK-03447 reconciliation confusion.

## 4. M6 — Rate limiter tuning

Small updates to `check_rate_limit` and `_shared/rateLimit.ts`:
- Only increment on **accepted** requests (check-then-increment, not increment-then-check).
- Move from tumbling to a two-bucket sliding window (current + previous, weighted) to kill the boundary 2× burst.
- Raise per-IP cap on `rent-create-booking` from 20 → 40/hr to survive NAT (Turnstile is the real bot control once the widget ships).

## 5. Renter-side ask — `identity_verified` on `public_booking_by_ref`

Add a boolean derived from `identity_verifications` by customer email (verified + unexpired), so the renter app stops inferring identity from booking status. Cheap, correct, unblocks their PR.

## 6. Out of scope (call out, don't touch)
- Renter-app PRs #35–#38 (already shipped).
- Decline-terms legal copy and M6e live flip (Gregory).
- Command Center password rotation (Gregory).

---

## Questions before I build

1. **Hero-image fix:** flip `vehicle-photos` bucket to public, or route through `rent-public-media` (1h)?
2. **DB trigger on marketplace confirm transition:** add it as belt-and-braces, or trust the app-level guard alone?
3. **Decline action** on a `requested` marketplace booking — use `rent-cancel-booking` with `reason: 'operator_declined'` and send the renter the existing decline email, correct?
