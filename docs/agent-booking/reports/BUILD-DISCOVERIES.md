# Fresh implementation discoveries

All observed against local source/reviewed partial synthetic SQL baseline; deployed parity unknown.

1. Atomic authority is create_marketplace_booking, not plan shorthand rent_create_booking_atomic.
2. Both17arg/18arg source overloads retained. In real local PostgreSQL, omitted-return typed17 and required14 calls ambiguous42725; explicit18 works. Later request hardening must reconcile obsolete17 signature with exact callers and default behavior, no cascading drop/deployed changes.
3. Partial source exclusion allows mixed direct/marketplace overlaps:20concurrent inserts accepted11; INSERT-only blocked-date trigger allows UPDATE bypass. Universal database guard must cover all sources/update/blocked edits and lock old/new vehicle IDs in order.
4. Exact booking CHECK source20260724015013 and expiry20260725045744 use payment_expired, not stored expired. Unverified holds store cancelled+cancellation_reason. refunded is actual booking state in CHECK and rent-refund/rent-cancel functions. API next_action may say expired but must not invent backend state.
5. User explicitly confirmed no hosted staging/payment/identity sandbox yet; continue isolated local tests. Full provider/deployed parity/end-to-end release proof remains gated, no production fallback.

Evidence: STAGING-FEASIBILITY.md and plan summaries. Follow actual source/schema over stale planning shorthand, document compatibility deviations and regression tests.

## Migration timestamp allocation
Root reserves20261007090500 for09 external lifecycle reconciliation, required by payment/identity fault tests.14 customer_handoff_nonces moved to20261007090600 to avoid duplicate version; downstream10/11/14 references reconciled. No original source migrations renamed.
15 external_rollout_flags likewise allocated20261007090700 after14 nonce090600; all plan references reconciled.

## Runtime database deadlines
Migration SET LOCAL timeouts do not establish runtime RPC deadlines. Function SET lock_timeout can bound row waits directly; function SET statement_timeout is hoisted by PostgREST12.2+ for the HTTP RPC transaction, documented by [Supabase](https://supabase.com/blog/postgrest-12-2) and [timeout guidance](https://supabase.com/docs/guides/database/postgres/timeouts).09 adds narrow function settings and actual lock fault tests; real PostgREST version/hoisting and cancellation remain release evidence gates. HTTP AbortSignal alone does not prove database cancellation. No global shared service-role timeout mutation is assumed.

## Low-value payment capability
09 source review found existing hosted checkout rejects zero operator charge while readonly price authority can return zero. API enablement must reject unsupported charge capability before customer consent/request or14 implement an explicit supported zero settlement path. Never invent a price floor or mutate canonical source pricing. Stripe provider minimums/settlement must be tested in dedicated provider staging.
