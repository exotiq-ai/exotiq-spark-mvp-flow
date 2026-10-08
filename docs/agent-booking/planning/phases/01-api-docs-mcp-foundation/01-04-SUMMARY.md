---
phase: 01-api-docs-mcp-foundation
plan: "04"
subsystem: backend-quotes
status: implemented-local-sql-verified-hosted-proof-gated
tags: [quotes, consent, postgres, supabase, immutability]
requires:
  - phase: "01-02"
    provides: canonical contracts and structured errors
  - phase: "01-03"
    provides: verified operator-customer links and one-use consent receipts
  - phase: "01-05"
    provides: shared agent_inventory_available predicate
provides:
  - internal persisted principal-bound immutable quote migration
  - SupabaseQuoteStore durable RPC adapter
  - exact-value quote and consent preflight validation
affects: ["01-06", "01-07", "01-08", "01-11"]
tech-stack:
  added: []
  patterns: [single pricing authority, database immutability, principal-scoped consent, fail-closed prerequisites]
key-files:
  created:
    - supabase/migrations/20261007090100_external_quote_snapshots.sql
    - supabase/functions/_shared/external-booking/quotes.ts
    - supabase/functions/_shared/external-booking/quote-validation.ts
    - tests/agent-booking/quote-consent.test.ts
    - tests/agent-booking/quote-consent-unit.test.ts
    - tests/agent-booking/quote-validation.test.ts
  modified: []
key-decisions:
  - Reuse exact public_vehicle_quote arithmetic without a new pricing engine.
  - Use operator-scoped verified customer links; bind issuer subject audience client and customer.
  - Quotes never hold inventory and expire no later than 15 minutes after availability observation.
  - Share the inventory predicate owned by plan05 rather than copy booking overlap logic.
  - SQL JSONB SHA256 revisions and TS normalized fingerprints have separate codecs.
requirements-covered: [QUOTE-01, FAIL-01, PAY-01]
requirements-completed: []
duration: 15 min
completed: 2026-10-07
---

# Phase 1 Plan 4: Immutable quote snapshots and consent-bound terms

**Durable server-priced snapshots bind the complete price, rental window, policy and customer delegation; changed or expired consent cannot silently authorize a replacement quote.**

Both task implementations are committed. Offline and genuine local PostgreSQL verification passed; hosted parity proof is still required. This summary does not mark the phase requirements complete.

## Changes

`external_quotes` stores opaque quote UUIDs, issuer/subject/audience/client/customer/operator/vehicle, UTC intervals and tenant timezone, selected protection, the full source quote result, readable policy snapshots, SHA256 price and complete consent revisions, availability observation, creation/expiry, and a unique consumed-booking reference. Foreign keys bind tenant customer links and consent receipts. RLS and explicit privileges deny public/authenticated access and direct service-role inserts/updates/deletes; internal RPC creation is service-only.

The immutable trigger permits only first consumption, refuses expired consumption, and verifies that the booking has the same customer, operator, vehicle and dates. Other updates, repeated consumption and deletion fail. Request plan06 must additionally lock both quote and receipt, recheck authority and perform all booking/consumption changes in one transaction; the TypeScript preflight is explicitly not an atomic guarantee.

`external_quote_authority` locks the relevant configuration rows, calls plan05's shared `agent_inventory_available`, and calls the exact existing `public_vehicle_quote`. The snapshot includes source cents/tax/protection/platform/state/processing amounts and preserves operator versus Exotiq totals. Cancellation, pickup, mileage, deposit disclosure, timezone, buffer and payment schedule are also captured. It rejects unknown inventory, failed/missing state-fee prerequisites, unsupported currency, invalid options, unsafe cents and unverified tenant-customer bindings before insertion. It creates no booking or inventory hold.

`createQuote` validates customer scope/input, calls the injected durable store and returns a deeply frozen snapshot. `SupabaseQuoteStore` uses the configured server client; it discovers no credentials and has no in-memory production ledger. Canonical normalization preserves integer cents without rounding. SQL generates persisted hashes from JSONB text; JavaScript compares normalized complete values using a separate codec and must never recompute a SQL revision with its codec.

`validateQuoteForRequest(snapshot,currentAuthority,principal,consent,now)` returns `valid` with the original snapshot, `quote_changed`, `quote_expired`, `consent_mismatch`, or `upstream_unavailable`. It rejects cross-customer/operator/client consent, used/expired receipts, expired/consumed quotes, changed prices/policy/windows, stale/unknown availability and malformed records. It never inserts, consumes, extends a hold, creates a replacement quote, or renews consent automatically.

## Verification

- Genuine RED: quote suite failed because the quote implementation did not exist (`d02ac637`); validator suite failed because its implementation did not exist (`2b13d6cb`).
- GREEN: `npm run test:agent:unit -- --run tests/agent-booking/quote-consent-unit.test.ts tests/agent-booking/quote-validation.test.ts` — **22 passed**.
- Existing contract suite — **15 passed** against the branch's upstream02 base.
- Targeted strict TypeScript check of both production files and both offline test files — **passed**.
- `git diff --check` — **passed**; owner branch clean at `2edbd86dfa14cc4b361e41a746da4bc90927423a` when self-checked.
- Planned hosted command refused with **Dedicated staging evidence is required; no production fallback**. This is the intended gate, not successful hosted verification.
- Root-reviewed PostgreSQL migration and `integration-lab/quote-check.sql`: **passed**, with all synthetic writes rolled back. Real source arithmetic passed the $100 premium split (21,200 operator / 62,387 Exotiq / 83,587 grand cents), zero-rate decline (442 cents), large rate99,999,999.99 (23,669,659,916 grand cents), and included-tax (1,132 disclosed tax / 82,387 grand cents) cases. Actual triggers rejected mutation, deletion, extension and repeat consumption; quoting left inventory available. Real anon/authenticated access failed; service narrow RPC worked with direct DML denied. Missing fee and wrong-principal/customer prerequisites produced zero quotes. Terms/window and bounded TTL checks passed. Root corrected the synthetic fixture's state-address field to exact source `region`; implementation was unchanged. Evidence: laboratory `quote-check-evidence.txt`, reflected by the root into final output reports. The dependency schema remains partial, not hosted/deployed parity.
- Plan07 integration correction: actual PostgreSQL fault assertions first failed RED because oversized terms persisted. After `cf8796ae` and the PL/pgSQL expression correction `fa574088`, parent reran the authority function and quote checks GREEN. Laboratory evidence explicitly confirms oversized pickup disclosure, unsupported decimal precision and negative mileage are rejected **before quote INSERT**. All fixtures rolled back.

## Commits

| Commit | Change |
|---|---|
| `d02ac637` | Quote boundary TDD RED |
| `2b13d6cb` | Consent/renewal preconditions TDD RED |
| `a1b63bed` | Durable quote migration, RPC store and normalization |
| `a2284865` | Exact-value quote and one-use consent preconditions |
| `be4cd5b0` | Fail closed on malformed stored quote metadata |
| `2edbd86d` | Strictly typed regression fixtures |
| `cf8796ae` | Pre-insert customer-readable bounds and itemization invariants, on plan07 branch |
| `fa574088` | Parenthesized PL/pgSQL tax consistency expression, on plan07 branch |

## Deviations from Plan

1. **[Rule 2 — Missing critical]** Source inventory semantics were reconciled with plan05's shared predicate. The initial duplicated symmetric-buffer/source-history query was removed before committing, ensuring the quote interface uses the same inventory policy as writes.
2. **[Rule 2 — Missing critical]** Customer identity is tenant-scoped in actual source. Added composite verified-link FK and active-link checks, plus audience/client binding, rather than infer ownership from email or a global customer entity.
3. **[Rule 3 — Blocking]** No hosted staging/provider environment exists, as confirmed by the user. Split meaningful offline tests into `quote-consent-unit.test.ts`; preserve the planned staging suite as an explicitly skipped parity gate. The original harness correctly refused hosted execution. A temporary offline config outside the repository was used only to establish the initial RED; the final GREEN uses the existing guarded unit runner.
4. **[Rule 2 — Missing critical]** Missing customer-readable quote policy was reported to the root contract owner, who added canonical `terms` and `pricing_details` fields in root commit `7f4e0f1e`. This executor did not modify shared contract files.
5. **[Rule 1 — Bug]** During plan07 API integration, source SQL needed canonical disclosure bounds before persistence, not solely post-persistence API validation. Added conservative UTF8 byte limits (safely stricter than UTF16 contracts), exact numeric decimal text without rounding, mileage/rental-day/cents/itemization checks and customer row locking. Actual PostgreSQL fault tests proved zero inserts on shape disagreement. Correction commits are on the plan07 continuation branch to preserve plan04 branch history.

## Integration handoff

- Plan06 must use SQL `external_quote_authority(uuid,uuid,timestamptz,timestamptz,text,jsonb)` within the same inventory-serialized transaction as insertion. Compare the full `pricing`, `terms`, `window` and `selected_options` JSONB (ignore only the fresh observation time); verify stored hashes and exact receipt identity/scope/expiry/one-use state. Insert using the immutable stored values and atomically consume quote and receipt. No quote-consumption setter is exposed here.
- Plan07 should project the source quote into the canonical API result. Internal window timestamps are UTC; convert them into tenant wall-clock offsets for API contracts. `terms.mileage_overage_rate` maps to `mileage_overage_rate_usd`; `pricing.operator_tax_rate` maps to the decimal-string `operator_tax_rate_percent`. Preserve all labels and exact cents.
- Plan08 must render full itemized pricing, separate charge legs, deposit disclosure, cancellation/mileage/pickup policy and approval semantics before issuing a receipt. Receipt PK is `id`; all binding fields match plan03.
- Applying090100 before090300 is safe for function compilation, but no quote can execute until the shared inventory predicate exists. No fallback availability is supplied.

## Known Stubs and remaining gates

`tests/agent-booking/quote-consent.test.ts` intentionally skips hosted deployment-parity proof. There are **no production quote/pricing stubs**. Real local SQL assertions proved migration compilation, immutability, role access, safe refusal and no hold, including zero/large-cent and inclusive-tax fixtures against actual source arithmetic. Full Supabase Auth/PostgREST, provider, deployment, concurrent operator edits, receipt issuance and atomic request-consumption proof remain downstream acceptance gates. Do not enable renter writes or claim production readiness from local tests.

## Self-Check: PASSED

All six created files exist; all six recorded commit objects exist. Changes are limited to the assigned quote migration/module/test ownership in the isolated plan04 branch. Original source repositories, other worktrees, shared audit fixtures, planning STATE/ROADMAP, credentials and global configuration were not changed by this executor.
