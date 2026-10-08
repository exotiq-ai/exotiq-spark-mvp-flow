---
phase: 01-api-docs-mcp-foundation
plan: "14"
status: partial
subsystem: owned-customer-handoffs
requires: [01-08, 01-09]
provides: [hashed-customer-nonces, signed-internal-provider-boundaries, explicit-action-scopes, customer-owned-completion, explicit-grant-recovery, checkout-reservation-continuity]
affects: [01-10, 01-12, 01-15]
requirements_completed: []
completed: 2026-10-07
---

# Plan14 local implementation and acceptance limits

Backend and frontend are integrated. Immutable quote consent separately selects agent read/identity/checkout scopes with initially unchecked choices. Existing verified customers can complete their own identity/checkout via the first-party account page without expanding an agent grant. Short-lived opaque43-character nonces are stored hashed and bind issuer/subject/customer/tenant/booking/authority/action/mode. Review GET creates no provider session. Explicit POST Continue needs a fresh request-bound customer BFF proof and the actual current managed action scope before claiming a lease or provider creation. Withdrawn/expired agent permissions require explicit original-client/scopes recovery; no implicit restoration.

Source identity/checkout reject unsigned caller markers before authority/provider access. Distinct internal HMAC binds exact endpoint/body/time and current nonce lease. Legacy credentials stay private. Provider creation uses persisted original keys, frozen attempt age, shared booking checkout reservation and inherited source session/customer references; unknown responses never justify a second operator charge. Provider URLs pin Stripe hosts, preserve the documented bounded Checkout fragment, reject credential/receipt query fields and return via the exact authenticated first-party selector. New sessions expire no later than the booking deadline and require a31-minute creation window.

Executed local evidence: owner's50 offline checks/strict API graph; actual SQL nonce ownership/role/explicit scope/lost-response/recovery/metadata/attempt-age/deadline checks; two real connections rotate customer nonces in432ms with one active nonce/shared key; delayed settlement versus expiry keeps inventory blocked in326ms. Root's signed JWT/gateway/BFF/internal proof runtime test validates actual dispatch, narrowed customer action denial before any provider claim and redacted safe output. Frontend665 passes/20 explicit skips,12 actual Next/Chromium cases, typecheck and mock production build pass. Additional bounded BFF ingress73 affected tests and typecheck pass after final follow-up3411a4e.

Independent handoff review found six concrete issues; all have local mitigations verified by the final independent source/targeted-test review. Checkout expiry protection now preserves an issued/ambiguous reservation through cancellation/expiry and queues bounded fair manual review before sweep. Final actual PostgreSQL RED/GREEN proof additionally closes reserved legacy DELETE without an external-ledger FK, while unreserved legacy DELETE remains compatible. Immutable metadata prevents clearing the reservation to bypass the guard. Automatic provider-authoritative cleanup/clearance is not implemented, so uncertain holds can persist. Audit/drain/reconcile pre-migration legacy sessions before exposure. See01-14-BACKEND-NOTES.md,14-FRONTEND-NOTES.md and independent INTEGRATION-HANDOFF-REVIEW.md for exact proof and remaining operating limits.

Full acceptance remains partial. The user confirmed no hosted staging/payment/identity sandboxes and directed isolated local tests. Complete deployed schema/privileges, provider/OAuth registrations, schedules/gateway, confirmation pilot and release metrics remain unverified. requirements_completed stays empty. Originals and production were not modified.
