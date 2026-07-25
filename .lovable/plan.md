## Review of Claude's 2026-07-25 handoff

I read the whole document (29 findings). Overall it is high quality — every item cites a real file:line, the clustering into A/B/C is accurate, and it correctly separates Lovable-owned code from Gregory decisions. Below is what I want to flag before we start executing, followed by the sequence I'd run.

### Things to flag / push back on before we build

1. **#1, #4, #11, #15 are the same bug in four costumes.** All four boil down to "paid state is judged from `paid_at`, ignoring `operator_payment_intent_id`." I'd rather ship one small change — a SQL helper `booking_has_captured_leg(b)` and a shared TS `isPaidOrCaptured(booking)` — and reuse it in `rent-cancel-booking`, `rent-refund-booking`, the expiry sweep, `PaymentTracker`, and `CancelBookingCard`. Treating them as four tickets invites drift.

2. **#2, #3, #4, #8 share one webhook/sweep hole.** Same story — one fix (webhook always persists PI + fires `opsAlert` + auto-refunds on terminal state; sweep excludes `operator_payment_intent_id IS NOT NULL`) closes all four. Handoff sequences them as separate blockers; I'd collapse them into a single Cluster A patch.

3. **#17 vs #24 contradict each other on the frontend fix.** #17 says "expose `platform_fee_percent` from `public_team_by_slug` and drop the `?? 10` fallback." #24 says "stop inventing the rate — call `public_vehicle_quote` and render the server quote." They're both partially right but the frontend can't do both. Recommend: **server quote is authoritative** (#24's fix), and #17 becomes purely a data fix (backfill + default 10.00 + reject 0 for marketplace-visible teams). Worth confirming with Gregory before we touch renter UI.

4. **#20 — "DEFAULT 0 on money params" — is a *symptom* of a deploy-drift problem, not the real fix.** Removing the default helps, but the actual risk is that the five deployed money functions don't live in the SPARK repo (also called out in #27). Until they land in repo, any redeploy from `main` silently reverts M6b. I'd fold #20 into #27 and prioritize getting those functions committed as the real fix; the DEFAULT change is a belt-and-suspenders addition.

5. **#5 (fleet delete cascade) is scope-adjacent to money but the real fix is the DB guard, not the UI.** Handoff proposes both (soft-delete UI + `ON DELETE RESTRICT`). Agree with both, but the RESTRICT/trigger must land first — otherwise any other code path (import cleanup, admin script, future feature) can still cascade a captured booking away. Frame it that way to avoid a UI-only patch.

6. **#7 (`pending_documents` terminal) is genuinely a Gregory decision** — I can't build it until the ordering contradiction between ID_VERIFICATION_PLAN V1 and M6 is resolved. Flag: if Gregory rules "verify-after-payment," #7 becomes trivial; if "verify-before-approval," we need `identity-webhook` to promote `pending_documents → requested` and add a Command Center queue for it. I don't want to guess.

7. **#6 (deposit hold) is a real launch-blocker but the handoff's proposed design (platform-side manual-capture PI using saved PM) is the right call and matches what we already do for `setup_future_usage`.** No pushback — just confirming this is the direction so I can plan the endpoint + Command Center Capture/Release controls in one pass.

8. **#22, #23 (test-mode + expired/refunded revenue) — I already partially fixed test-mode exclusion in `PaymentTracker` / `FleetContext` earlier this week.** Need to verify whether `useMarginData` was missed (it likely was — different query) rather than treat this as fresh work. Small item, but worth calling out so we don't re-do work.

9. **#28 (uptime-check) is real but low-leverage for launch.** Fixing the assertion + scheduling it is 20 minutes; but the more valuable half — "make the ops alert path write to a table whose columns exist" — is the actual gap, because that's what surfaces the Cluster A failure when it happens in production. Would sequence the alert-schema fix higher than the synthetic check.

10. **#16 (pre-selected $150 delivery) and #26 (misleading "Final payment" copy) live in `exotiq-rent`, not this repo.** I'll note them but they belong in a Claude handoff back, not Lovable's queue.

### Missing from the handoff (things I'd add)

- **A reconciliation script.** After we fix Cluster A, we need a one-time sweep over existing `pending_payment` / `payment_expired` / `cancelled` marketplace bookings to detect any that already have `operator_payment_intent_id` set and either auto-refund or route to ops. Otherwise the fix only helps *future* renters.
- **A payments-table backfill from webhook.** #13's fix suggests either "treat booking fields as authoritative" or "have webhook insert payments rows." Handoff picks the first. I'd do **both** — booking fields authoritative for UI, but also write payments rows for audit/margin/partner-payout continuity. Otherwise operator statements stay hollow for marketplace bookings.
- **A `booking_source='marketplace'` edit lock in one place.** #10 and #14 both want edits blocked/re-quoted. Right fix is a single guard in `EnhancedBookingDialog` (and the underlying update mutation), not two divergent patches.

### Proposed execution order

```text
Phase 1 — Cluster A (money integrity) — one PR
  1. SQL helper booking_has_captured_leg + TS isPaidOrCaptured
  2. rent-payment-webhook: always persist PI, opsAlert, auto-refund on terminal
  3. Expiry sweep: exclude captured legs → ops queue
  4. rent-cancel-booking + rent-refund-booking: refund by PI presence
  5. PaymentTracker + CancelBookingCard: read captured state
  6. Reconciliation sweep for existing partial-failure rows

Phase 2 — Cluster C (identity/security) — one PR
  7. identity-create-session: booking_ref+token gate, .eq email, rate limit
  8. rent-create-booking: strict email regex + .eq lookup

Phase 3 — Command Center money integrity — one PR
  9. Decline/cancel of paid marketplace → rent-refund-booking
 10. Marketplace edit lock (or re-quote + re-consent) in one place
 11. Fleet batch delete → soft-delete + DB-level ON DELETE RESTRICT
 12. useMarginData: exclude test-mode + expired/refunded/requested/pending_*

Phase 4 — Schema + deploy hygiene
 13. Add PI columns explicitly in a migration + regen types (#27)
 14. Land the 5 deployed money functions in the SPARK repo (#27/#20)
 15. Drop DEFAULT 0 on create_marketplace_booking money params (#20)
 16. Fix payment_due_at double-tz-shift (#21)
 17. Backfill teams.platform_fee_percent + default 10.00 + reject 0 (#17)

Phase 5 — Observability
 18. Fix ops alert schema so partial-failure alerts actually persist (#28 half)
 19. Uptime check: real assertion + schedule

Deferred (need Gregory)
  - #6 deposit hold mechanism (confirm platform-side design)
  - #7 pending_documents promotion (needs ordering decision)
  - #17/#24 platform_fee_percent frontend approach (server-quote vs prop-through)
  - #16 delivery default, #26 PayStep copy — send back to Claude (exotiq-rent)
```

### What I need from you before I plan implementation in detail

1. Approve the cluster collapses above (esp. Cluster A into one PR).
2. Confirm the phase order or reorder it.
3. Rulings on the three Gregory decisions above so I can plan #6/#7 concretely.
4. Whether the SPARK-repo function commits (#27) happen here or in a separate Claude pass.

Once those are settled I'll come back with a per-phase implementation plan.
