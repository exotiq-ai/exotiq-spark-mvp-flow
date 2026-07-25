# Pre-Launch Plan (Refreshed 2026-07-25)

Handoff is current. Your rulings collapse a lot of the open questions. Below is what's **must-have for launch**, what's **nice-to-have**, and what belongs to Claude in the `exotiq-rent` repo.

---

## MUST HAVE (launch blockers)

### Phase 1 — Cluster A: money integrity (single PR)
The same bug in four costumes: renter payment can capture on the operator's Connect account while the booking row still says `pending_payment` / `payment_expired` / `cancelled`. Fix once, reuse everywhere.

1. SQL helper `booking_has_captured_leg(b)` + TS `isPaidOrCaptured(booking)`.
2. `rent-payment-webhook`: always persist `operator_payment_intent_id`, fire `opsAlert` on any partial-failure, auto-refund on terminal-fail.
3. `expire_overdue_payment_bookings()`: exclude rows where `operator_payment_intent_id IS NOT NULL` → route to ops queue instead of expiring.
4. `rent-cancel-booking` + `rent-refund-booking`: refund by PI presence, not `paid_at`.
5. `PaymentTracker` + `CancelBookingCard`: read captured state via the shared helper.
6. **Reconciliation sweep** (one-time): scan existing `pending_payment` / `payment_expired` / `cancelled` marketplace bookings for orphaned captured PIs; auto-refund or flag for ops.
7. **Payments-table backfill from webhook**: booking fields stay authoritative for UI, but webhook also writes a `payments` row for audit / margin / partner-payout continuity.

### Phase 2 — Cluster C: identity & security
8. `identity-create-session`: gate with `booking_ref + confirmation_token`, `.eq` email lookup, persistent rate limit.
9. `rent-create-booking`: strict email regex + `.eq` email lookup (no `ilike`).

### Phase 3 — Command Center money integrity
10. Decline/cancel of a paid marketplace booking → routes through `rent-refund-booking` (never manual).
11. Single `booking_source='marketplace'` edit lock in `EnhancedBookingDialog` + the underlying update mutation (no divergent guards).
12. Fleet batch-delete: **DB-level `ON DELETE RESTRICT`** on `bookings.vehicle_id` first (structural guard), then soft-delete UI on top.
13. `useMarginData`: exclude `payment_stripe_mode='test'` + `requested` / `pending_*` / `expired` / `refunded` states (already partly fixed in `PaymentTracker` / `FleetContext` — this is the missed query).

### Phase 4 — Schema & deploy hygiene
14. Explicit migration for `operator_payment_intent_id` / `exotiq_payment_intent_id` columns; regen types.
15. Land the 5 deployed money functions (`rent-checkout`, `rent-payment-webhook`, `rent-cancel-booking`, `rent-refund-booking`, `rent-approve-booking`) into the SPARK repo — right now a redeploy from `main` would silently revert M6b. **This is the real fix**; the DEFAULT-0 removal on money params is belt-and-suspenders.
16. Fix `payment_due_at` double-tz-shift bug.
17. Backfill `teams.platform_fee_percent`; default 10.00; reject 0 for marketplace-visible teams.

### Phase 5 — Deposit hold config (your new requirement)
18. Migration:
    - `teams.default_deposit_cents` (tenant-wide default)
    - `vehicles.deposit_override_cents` (nullable per-vehicle override)
    - Resolution: vehicle override → tenant default → platform fallback.
19. Command Center UI:
    - Tenant Settings → new "Security deposit" field (with reply-to / support email).
    - Vehicle rate card → optional "Override deposit for this vehicle."
20. `stripe-capture-hold` / hold-creation path reads the resolved amount instead of a hardcoded value.

### Phase 6 — ID verify AFTER payment (your ruling on #7)
21. Once webhook marks `paid`, promote `pending_payment → pending_documents`.
22. Fire renter drip email: "Payment received — next, verify your ID + insurance."
23. Existing `identity-*` functions already work; just wire the promotion + email trigger. **Insurance verification tool ships tomorrow** (Claude) — leave a stub email that says "Your ID link is ready; insurance upload coming."

### Phase 7 — Observability
24. Fix ops-alert schema so partial-failure alerts actually persist (this is what surfaces Cluster A failures live).
25. Uptime check: real assertion + schedule (20 min job).

---

## NICE TO HAVE (post-launch)
- Deposit-hold Command Center Capture/Release controls beyond the amount config.
- Test-mode banner across Payments / Margin surfaces.
- Weekly finance digest email.

---

## HAND BACK TO CLAUDE (`exotiq-rent` repo)
- **#16** — "$150 delivery pre-selected" in checkout extras. Your ruling: don't auto-select any extras. Claude to fix.
- **#26** — misleading "Final payment" copy in `PayStep`.
- **#17 / #24 resolution** — server quote is authoritative: `public_vehicle_quote` returns `platform_fee_cents`, `protection_cents`, `deposit_cents`, `total_cents`; frontend renders as-is, no local math, no `?? 10` fallback. I'll do the SPARK-side data fix (#17 backfill); Claude does the frontend fix (#24).
- Confirm insurance-verification flow so Phase 6's stub email can become the real drip.

---

## Technical details

**Cluster A helper (SQL):**
```sql
create or replace function public.booking_has_captured_leg(b public.bookings)
returns boolean language sql immutable as $$
  select b.operator_payment_intent_id is not null
      or b.exotiq_payment_intent_id is not null
      or b.paid_at is not null;
$$;
```

**Deposit resolution (SQL helper):**
```sql
create or replace function public.resolve_deposit_cents(_vehicle_id uuid)
returns bigint language sql stable as $$
  select coalesce(
    v.deposit_override_cents,
    t.default_deposit_cents,
    100000  -- $1,000 platform fallback
  )
  from vehicles v join teams t on t.id = v.team_id
  where v.id = _vehicle_id;
$$;
```

**Reconciliation sweep:** one-time script — query marketplace bookings with `status in ('pending_payment','payment_expired','cancelled')` and non-null PI, then either auto-refund via `rent-refund-booking` or insert an ops-queue row. Report count before executing.

**Rollout order:** Phase 1 → 2 → 5 (deposit) → 6 (ID drip) → 3 → 4 → 7. Phases 1 and 2 are independent PRs; 5 and 6 can go in parallel after Phase 1 lands.

---

## What I need from you to start
1. Approve this plan (or reorder).
2. Confirm SPARK-side commits of the 5 money functions happen here (I'll do it in Phase 4) vs. via a Claude pass.
3. Any objection to `ON DELETE RESTRICT` on `bookings.vehicle_id` — it means fleet delete will hard-error on vehicles with historical bookings until you soft-delete instead. That's the intended safety, just want it confirmed.
