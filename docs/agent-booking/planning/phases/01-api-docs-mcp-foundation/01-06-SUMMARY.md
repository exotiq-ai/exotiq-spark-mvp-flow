---
phase: 01-api-docs-mcp-foundation
plan: "06"
status: partial
subsystem: database
tags: [postgresql, idempotency, consent, outbox, tenant-isolation]
requires:
  - phase: 01-03
    provides: Verified per-operator customer linkage and narrow grants
  - phase: 01-04
    provides: Immutable authoritative quote snapshots
  - phase: 01-05
    provides: Shared inventory lock and read parity
provides:
  - Atomic quote/receipt/request/grant/replay/outbox transaction
  - Bounded full-transaction retry adapter
  - Guest email verification denial and durable notification worker primitives
affects: [01-07, 01-08, 01-09, 01-14, 01-15]
tech-stack:
  added: []
  patterns: [durable replay before expiry validation, post-commit outbox leases, immutable provider message inputs]
key-files:
  created:
    - supabase/migrations/20261007090400_consented_request_transaction.sql
    - supabase/functions/_shared/external-booking/requests.ts
    - supabase/functions/_shared/external-booking/outbox.ts
    - request-lab/setup.mjs
    - tests/agent-booking/idempotency.test.ts
    - tests/agent-booking/request-compatibility.test.ts
  modified: [supabase/functions/rent-create-booking/index.ts]
key-decisions:
  - Source create_marketplace_booking18 remains the sole booking writer; retire only obsolete17 signature without CASCADE.
  - Typed guest email never establishes access to verified tenant customer identity.
  - SMTP cannot share a database transaction; freeze provider inputs and stop ambiguous late retries for review.
requirements-completed: []
duration: 16min after first RED commit; earlier source review not timed
completed: 2026-10-07
---

# Phase 1 Plan 06: Consented request transaction summary

**One SQL commit now creates the authorized booking, consumes consent, records its replay response and grant, and schedules a notification; actual isolated PostgreSQL concurrency and rollback checks pass.**

Implementation work is committed for both tasks. Status remains partial because full deployed-schema/provider/identity/payment/worker acceptance is unavailable. No requirement is marked complete.

## Task commits

1. Task 1 RED: `093e71e1` — failing durable request adapter policies, missing implementation observed.
2. Task 2 RED: `9b7e7b73` — failing durable notification policies, missing implementation observed.
3. Task 1 GREEN: `2be040cf` — atomic SQL request, replay adapter and guarded actual PostgreSQL lab.
4. Task 2 GREEN: `1ee4222a` — secure guest identity decision, post-commit outbox helpers, actual legacy handler and source SQL compatibility checks.

Worktree: `<LOCAL_BUILD_ROOT>/plan-06-worktree`, branch `codex/agent-booking-plan-06`, base `56931e1c`. Original checkouts, hosted backends and providers were not changed. No deploy or push.

## Implemented behavior

The SQL RPC validates trusted issuer/subject/client/customer/operator/audience, exact active tenant linkage, quote and receipt ownership/action/terms/expiry, immutable current pricing/terms/window, inventory availability and source booking result. It uses the real retained18 source writer, locks quote and receipt before inserting ledger foreign keys, and commits all six side effects together. Committed same-key response reads precede quote expiry checks; changed payload conflicts and revoked grants deny access without creating another booking. No agent response includes the legacy confirmation token.

Five bounded whole-RPC retries handle serialization/inventory contention. Ambiguous HTTP transport errors are left for callers to replay with the same key. The ledger carries a conservative return/commit plus30day retention timestamp; no deletion job exists, so retained records currently remain indefinitely. Future cleanup must additionally check actual booking lifetime/terminal state before deletion.

The legacy handler retains guest validation, Turnstile, persistent IP limits, authoritative quote call, explicit return time, initial guest flow and existing email helper. Guest typed email now always starts pending_documents; returning guests may need fresh verification until an authenticated customer bridge is available. Authenticated external requests reuse identity only for their exact tenant customer with known unexpired document expiry. Delegated contract fields are rejected by the legacy handler. This does not classify arbitrary browser versus agent traffic.

Outbox RPCs claim committed events with durable2minute leases, wrong-token context/ack denials, retry backoff and delivered state. Existing template/sendRenterEmail is invoked through the internal worker helper with a stable provider key and frozen message inputs. Delivery itself is outside SQL. Pending ambiguous outcomes stop after23hours or10attempts for manual review. [Resend documents a24hour idempotency window and unchanged request payload requirement](https://resend.com/docs/dashboard/emails/idempotency-keys); actual provider delivery was not tested. No exactly-once SMTP claim.

## Verification performed

- Offline unit command: `npm run test:agent:unit -- --run tests/agent-booking/request-policy.test.ts tests/agent-booking/outbox-policy.test.ts` —13 passed.
- Owned partial PostgreSQL/actual Edge-handler command: `node node_modules/vitest/vitest.mjs --config request-lab/vitest.config.ts --run` —11 passed.
- Real SQL:20 same-key connections returned identical committed responses with one booking;20 different-key connections using one receipt produced one booking and19 consent denials. Booking/grant/outbox/ledger/quote/receipt counts each matched exactly.
- Real SQL: injected downstream failure rolled back booking, ledger and receipt/quote consumption; changed authoritative price denied; actual short quote expiry still replayed committed body; changed key payload conflicted; revoked grant denied.
- Actual source SQL14required/17omitted-return/18explicit-return calls executed after exact obsolete17 removal. Default return equals pickup; explicit return is preserved. Verified/NULL/expired identity decisions and internal table/worker privilege denials passed.
- Actual Edge handler was imported using test-only aliases for serve/Supabase and mocked rate limiter/email; guest shape, pending status, explicit return, Turnstile and rate limiter regression checks passed. This is handler behavior proof, not actual Supabase gateway or email delivery.
- Strict TypeScript requests/outbox/policy/idempotency check passed, using a temporary test-only Deno.env ambient declaration. Actual Edge remote imports/runtime typecheck remains an integration gate.
- Contract command: canonical13 tests and2 capability tests passed; source-fingerprint capability test failed as expected after new tracked migration/Edge edits. Parent owns reviewed provenance regeneration after integration.
- Named dedicated staging command refused: “Dedicated staging evidence is required; no production fallback.” This refusal is preserved and is not a staging pass.
- `git diff --check` passed; no TODO/FIXME/placeholder patterns in production files scanned.

## Evidence and isolation

Own `request-lab` uses explicitly marked partial synthetic PostgreSQL17, internal Docker network with no host ports, inspected ownership labels/resource IDs/volume/image and local Docker context. Every SQL operation rechecks the guard. Fixture resets only that marked public schema. Selected source bodies/dependencies are documented; the complete production schema/auth/triggers/defaults are not recreated. Local generated credentials/resources/evidence are ignored and never copied into committed source or output.

Latest request migration SHA256: `800d6d9398c8e17bdec40051016092c95c1493881d0e45f23bad525438b1ec83`. Local `request-lab/applied-evidence.json` records exact prerequisite hashes. `request-lab/concurrency-evidence.json` records40connection outcomes and actual counts; both explicitly state partialSchema=true/providerParity=false. Root inventory optimization postdates this branch base; parent must rerun integrated latest902 before claiming combined acceptance.

## Deviations and remaining acceptance

1. [Rule 1 - Bug] Retained17/18 source overload ambiguity: dropped exact obsolete17 only; actual calls prove compatibility locally.
2. [Rule 1 - Bug] Real concurrency exposed40P01: inserting FK ledger before quote lock caused shared-lock upgrades. Moved ledger insertion after quote/receipt locking;20different-key check now passes.
3. [Rule 1 - Bug] Exclusive locking every committed replay exhausted retry bursts. Added safe concurrent committed-ledger read;20same-key check now passes.
4. [Rule 2 - Security] Guest email lookup previously reused unrelated identity. Removed it under parent/user-approved secure behavior; external source result/customer/expiry checks preserve exact authenticated binding.
5. User explicitly lacks hosted staging; actual owned local partial SQL tests were added without weakening dedicated staging guards.

Full managed-provider issuer/audience/client interoperability, deployed schema/all-overload ACL parity, real identity paid promotion, both Stripe payment legs, rollout opt-in and actual notification worker scheduling/provider delivery remain gates. Parent ingress/rollout owners must compose and operate the worker; this plan exposes real SQL/provider adapter primitives but starts no background service. Plan-requested request_in_flight409 with Retry-After1..5 requires canonical enum/error policy expansion by parent/contracts owner; current exhausted40001 maps safely to upstream_unavailable503, and parent was alerted. Ledger cleanup lifetime semantics remain an operations gate.

Source18 local wall-clock conversion cannot represent both DST fold instants; exact resulting UTC window validation safely rolls back mismatch. Full fold caller parity needs future source-compatible writer evolution. Pre-existing identity-webhook event claim-before-promotion can acknowledge a retry after downstream failure; parent was alerted for payment/reconciliation ownership. No out-of-scope webhook edit or future paid-promotion success is claimed.

## Known stubs

No placeholder business implementation. Provider callback injection uses the existing sender and actual narrow context RPC; deployment/scheduling and managed-provider verification intentionally remain gated. Those gates prevent full plan acceptance.

## Threat flags

| Flag | File | Description |
|---|---|---|
| threat_flag: internal provider delivery credential | transaction migration / outbox.ts | Frozen internal email context includes legacy booking credential solely for existing renter link; raw writes and public worker/context reads are denied. Never expose this context through API/MCP/logs. |

## Self-Check: PASSED

All26 intentional changed files exist. All four task commits exist in branch history; worktree is clean. Shared STATE/ROADMAP/REQUIREMENTS and metadata commit remain parent-owned under explicit delegation.
