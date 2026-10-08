# Exotiq API and MCP build handoff

The API, six-tool renter MCP adapter and customer consent/handoff flow are implemented in isolated repository copies and verified locally. Fifteen of sixteen plans have local implementation delivered; the hosted pilot plan is partial. Full phase acceptance remains **gaps_found**, with no requirement marked fully accepted and no deployment performed.

You confirmed that no separate hosted Supabase, Stripe test accounts or identity sandbox exists and requested isolated local tests. Those tests are complete for this handoff. A fully confirmed provider journey is still unverified; the dedicated hosted pilot driver/configuration also remains to be implemented.

## What is built

- A versioned API for eligible Miami/Tampa inventory, authoritative availability, immutable itemized quotes, explicit customer authorization, durable request submission and owned status/recovery.
- A thin OAuth MCP adapter with search_vehicles, check_availability, create_quote, submit_rental_request, get_request_status and create_checkout_handoff. It retrieves consent through the authenticated API and preserves prices, UNKNOWN and pending states.
- Customer browser consent, explicit action scopes, account continuity, expiring opaque identity/Checkout links and explicit grant renewal. Sensitive provider and legacy credentials stay behind the server boundary.
- Transactional inventory serialization, default-disabled admission, private rollout administration, durable retries/outbox, redacted events, bounded ingress/egress and guarded release evaluation.
- Canonical schemas, generated OpenAPI, examples and complete frontend validator drift checks. Internal backend changes require mapping/migration tests; public contract changes additionally require regeneration, compatibility review and an API version decision.

A submitted request is never presented as confirmed. Confirmation requires operator approval, current owned verified identity and the independently required settled payment legs.

## Verification and its limits

| Check | Result | Scope |
|---|---|---|
| API unit suite | 320 passed / 27 files | Local signed authority, state, error and runtime fixtures |
| API contract suite | 36 passed / 6 files | Schemas, docs, source provenance, isolation and release refusal |
| MCP default suite | 50 passed; 5 SQL cases skipped / 7 files | Real SDK/runtime and concrete HTTP ingress; SQL requires explicit manifest |
| Guarded MCP/API/PostgreSQL composition | 8 passed in 93.70 seconds | Four Miami/Tampa × legacy/modern SDK journeys reach pending_documents, with real consent and SQL; partial schema, no real providers |
| Existing backend suite | 261 passed / 22 files | Existing application regression |
| Frontend full checkpoint | 665 passed; 20 skipped | At ce44f37 before the final body-reader fix |
| Final affected frontend suite | 73 passed / 5 files | At final3411a4e; buffered/stalled/aborted body and customer flow checks |
| Actual Next/Chromium suite | 12 passed | Actual local browser/session/BFF; provider/API boundary is synthetic |
| Typecheck/build/provenance | Passed | Full shared Edge graph, backend app, MCP, frontend; Vite and mock Next builds; canonical generation and exact consumer match |
| Dedicated hosted pilot command | Refused as designed | Missing hosted evidence stops loading/network; this is not a passed pilot |

Separate real PostgreSQL evidence covers mixed-writer inventory contention, twenty-connection keyed request replay, fair nonce rotation, delayed settlement versus expiry and persistent rate capacity. The final capacity race accepted7 of24 requests at a limit of7. Nonce rotation finished in432ms; delayed settlement/expiry finished in326ms with one whole-transaction retry, one settlement and inventory retained. These establish the selected local schema behavior, not complete applied Supabase parity.

Reviews caught and fixed the checkout return mismatch, documented Stripe URL fragment handling, missing explicit nonce renewal, booking lock upgrade, inherited provider-attempt age, payment expiry/inventory race, reserved legacy deletion bypass, persistent rate-capacity bug and stalled/disconnected request bodies. Regression evidence and authorship are recorded in the independent reviews. No unresolved blocking defect remains in those scoped local reviews; their unproven operating and hosted limits remain below.

## Work required before rollout

1. Select and isolate hosted staging, managed OAuth registrations, Stripe test accounts and identity sandbox. Implement the missing tests/agent-booking/pilot.spec.ts and playwright.agent.config.ts, with the correct guarded Playwright runner, plus the outstanding managed acceptance cases identified in the verification report. No passing placeholder or production fallback exists.
2. Prove the complete applied schema, effective ACL/RLS/function/trigger coverage, gateway, scheduler and PostgREST timeout/cancellation behavior. The refreshed source audit is source-only; it cannot attest deployed behavior.
3. Exercise complete Miami/Tampa × API/MCP journeys through operator approval, hosted identity and both required payment legs to confirmation, including revocation, recovery, retries, delayed events, rollback and measured thresholds.
4. Finish provider-authoritative cleanup and a reviewed safe clearance procedure for uncertain payments. Current code conservatively retains inventory and queues bounded manual review. Automatic Stripe expire/retrieve cleanup and a safe manual clearance RPC are absent, so uncertain holds can persist. Audit/drain/reconcile pre-migration legacy Checkout sessions before exposure.
5. Verify the managed issuer's bounded JWKS response profile or add a reviewed response byte/key-count cap. Request cancellation and a three-second fetch timeout are implemented; key-set response size is not explicitly capped. Existing source lint/dependency backlogs are separately documented; passing build/tests is not a claim that every legacy check is clean.

New external admission defaults off. Existing authorized status, customer completion, recovery and reconciliation continue after admission is disabled. Release evidence evaluation refuses incomplete or local-only records.

## Files for review and continuation

- [Independent goal verification](<HANDOFF_ROOT>/.planning/phases/01-api-docs-mcp-foundation/01-VERIFICATION.md)
- [Independent security audit](<HANDOFF_ROOT>/.planning/phases/01-api-docs-mcp-foundation/01-SECURITY.md)
- [Independent handoff integration review](<HANDOFF_ROOT>/INTEGRATION-HANDOFF-REVIEW.md)
- [Independent operational review](<HANDOFF_ROOT>/OPERATIONS-REVIEW.md)
- [API guide](<BACKEND_CHECKOUT>/docs/external-booking/guide.md), [OpenAPI](<BACKEND_CHECKOUT>/docs/external-booking/openapi.yaml), [MCP compatibility](<BACKEND_CHECKOUT>/docs/external-booking/mcp-compatibility.md)
- [Staging runbook](<BACKEND_CHECKOUT>/docs/external-booking/staging-runbook.md), [rollout/rollback](<BACKEND_CHECKOUT>/docs/external-booking/rollout.md), [pilot evidence](<BACKEND_CHECKOUT>/docs/external-booking/pilot-evidence.md)
- [Final source/build snapshot](<HANDOFF_ROOT>/BUILD-FINAL-SNAPSHOT.json), [worktree map](<HANDOFF_ROOT>/IMPLEMENTATION-WORKTREES.json)

Backend: `<BACKEND_CHECKOUT>` on codex/agent-booking-backend at7c3a9932f7d2dee17c2e30e646043af6279a07a8. Frontend: `<FRONTEND_CHECKOUT>` on codex/agent-booking-frontend at3411a4e49901441553e23772a829d4386067144b. Both private build trees are clean. Original checkouts retain their starting HEAD and status, including preserved pre-existing untracked files/cache. No original branch, production database or provider was changed.

Canonical contract SHA256:7cc0779f647906c58b937e4e0c99bb8c46d7b54231adc5ecfdf0994a1fde5af5. Source audit SHA256:74fa2e861eb59ae88542bcdfe1066749e24025a92c2cf32e2ccb3bec33d28b78. Local fixture evidence remains under `<LOCAL_BUILD_ROOT>/integration-lab`; owned database volumes are preserved when their containers are stopped. Resume with these exact copies and the release gaps, not the historical original branches.
