# refactors.md — Pre-screened candidates (architect-reviewer)

Gate: behavior-preserving · test-coverable · real value (dedup / bug-risk
reduction, not cosmetics) · reviewable <15 min. Tags: **KEEP** (do it) /
**FLAG-ONLY** (structural, needs a human decision before touching).

---

## R1 — Extract a single shared overlap predicate — **KEEP**
- Files: `src/lib/conflictDetection.ts:59-63`, `src/components/dialogs/NewBookingDialog.tsx:179`.
- Two independent overlap implementations exist (one dead, one inline). Both should
  call one exported helper, e.g. `rangesOverlap(aStart,aEnd,bStart,bEnd)` returning
  `aStart < bEnd && aEnd > bStart`. Directly pre-conditions the BUG-1 fix and is
  trivially unit-testable (boundary-touching, contained, identical ranges).
- Value: removes divergent copies of safety-critical math; <15 min; pure function.

## R2 — Centralize the platform-fee calculation — **KEEP** (paired with bugs.md BUG-2)
- Files: `supabase/functions/stripe-create-hold/index.ts:69-70`,
  `supabase/functions/create-payment-checkout/index.ts:110-113`,
  `supabase/migrations/*fn_snapshot_platform_fee`.
- A shared `computePlatformFee(base, teamPercent, source)` (TS for edge fns mirrored
  by the SQL trigger) eliminates the 20%-vs-10% and `marketplace`-vs-`drive_exotiq`
  divergence. Test-coverable with table-driven cases. KEEP, but land the behavior
  decision (which base? which %?) from BUG-2 first.

## R3 — De-duplicate the partner-payout share math across 3 SQL functions — **FLAG-ONLY**
- Files: `fn_generate_partner_payout` and `fn_transition_payout` (recompute branch)
  in migrations `20260528180850`, `20260529001701:49-53,174-179`.
- The percentage/flat split block is copy-pasted in 3 places. A single
  `compute_partner_share(split_type, split_value, v_net, v_days)` SQL function would
  prevent the next inversion bug (BUG-3 was exactly this kind of drift). FLAG-ONLY
  because it's a schema migration touching money triggers — needs DB review + a
  recompute/backfill plan, not a casual edit.

## R4 — Extract statement aggregation row-membership predicates — **KEEP**
- Files: `src/lib/partnerStatement.ts:32,49-51`, `src/lib/payoutTransitions.ts:32-37`.
- `isPaid` is defined locally in partnerStatement while `isOutstanding`/`isVoided`
  live in payoutTransitions. Move `isPaid` next to the others so the three status
  predicates are co-located and consistently reused (statement, export, margin all
  classify the same statuses). Small, covered by existing `partnerStatement.test.ts`.

## R5 — Generalize `usePresence` subscription effect (split fetch from subscribe) — **KEEP** (paired with bugs.md BUG-5)
- File: `src/hooks/usePresence.ts:103-124`.
- Subscribe-once effect with `fetchPresence` accessed via a ref (mirror the
  `onUpdateRef` pattern already used in `useRealtimeTable.ts:20-21`), plus a unique
  channel name. Removes resubscribe churn on conversation switch. Behavior-preserving
  for the happy path; testable via a mocked channel.

## R6 — Unify Realtime channel naming/cleanup into one helper — **FLAG-ONLY**
- Files: `useRealtimeTable.ts`, `usePresence.ts`, `useTeamMessaging.ts:313-337`.
- Three hooks each hand-roll `channel()/subscribe()/removeChannel()` with different
  naming conventions (one uses `Date.now()`, one static, one per-id). A shared
  `useRealtimeChannel(name, config, handler)` would standardize cleanup and naming.
  FLAG-ONLY: spans 3 hooks and realtime semantics; larger than 15 min and needs
  manual verification of presence/typing/messaging behavior.

## R7 — Replace `chargeIdToUuid` hash with Web Crypto SHA-1 v5 UUID — **KEEP** (paired with bugs.md BUG-6)
- File: `supabase/functions/stripe-webhook/index.ts:457-471`.
- Swap the bespoke 64-bit hash for a real namespaced UUID v5 (Deno `crypto.subtle`).
  The function is isolated and the idempotency key is the only consumer; covered by a
  determinism + uniqueness test. KEEP.

## R8 — Consolidate `formatCurrency`/`formatPercent` — **KEEP**
- File: `src/lib/marginCsv.ts:25-29` defines currency/percent formatters also
  re-implemented ad hoc in print/export and dialogs (`$${(x/100).toFixed(2)}` in
  `stripe-webhook` notifications, etc.).
- A single money-format util used by UI + exports avoids `.toFixed` rounding
  inconsistencies. Low-risk; snapshot-testable.

## R9 — Delete or wire up `checkBookingConflicts` — **FLAG-ONLY**
- File: `src/lib/conflictDetection.ts`.
- It is fully dead (zero importers). Either delete it (reduces false sense of
  safety) or — preferably — wire it into the booking submit path as part of BUG-1.
  FLAG-ONLY because the right answer is "wire it up", which is a behavior change, not
  a pure refactor.

---

### Skipped (failed a gate)
- Mass framer-motion removal — real value but behavior-affecting (animations) and
  spans 76 files; belongs in performance, not a behavior-preserving refactor.
- `select('*')` → column projection across 28 sites — valuable but each is a
  behavior-adjacent data change; do per-hook with the perf work, not as one sweep.
