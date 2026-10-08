---
phase: 01-api-docs-mcp-foundation
plan: "10"
status: partial
subsystem: thin-renter-mcp
requires: [01-02, 01-03, 01-08, 01-09, 01-14, 01-15]
provides: [six-canonical-tools, streamable-http-runtime, resource-bound-oauth, authenticated-consent-rendezvous, bounded-node-ingress]
affects: [01-11, 01-12]
requirements_completed: []
completed: 2026-10-07
---

# Plan10 local implementation and acceptance limits

The pinned official MCP server exposes six tools: search_vehicles, check_availability, create_quote, submit_rental_request, get_request_status and create_checkout_handoff. Their schemas derive from the canonical API module. The adapter delegates business rules to the API; immutable prices, UNKNOWN availability and pending request states are preserved. Tool hints and operator prose confer no payment or approval authority. No card/document collection or charge/approval tool is exposed.

Resource-bound OAuth, protected-resource discovery, token exchange and per-tool scopes are implemented. Submit retrieves its own authenticated consent result, waits with bounded retries when customer authorization is incomplete, then submits with a required durable idempotency key. Neither callers nor tests inject a receipt into a tool. Customer handoff and expired/revoked grant recovery link to explicit hosted customer actions. Gateway proofs bind method, full path/query and exact body independently of the OAuth credential.

Both the Fetch handler and concrete Node HTTP adapter enforce bounded ingress, total body deadlines and request abort before authentication or protected work. Provider/API response reads and tool operations are bounded; cancellation does not wait for hostile producer cleanup. Actual HTTP stalled/disconnected body regressions prove zero subsequent auth/API dispatch. The source API rechecks current authority after this adapter boundary.

Executed final default suite: 50 tests passed across seven files; five SQL-dependent cases explicitly skip without the guarded lab manifest. Typecheck and compiled build pass. Separately, the manifest-guarded composition suite passed eight tests in93.70seconds, including four Miami/Tampa × official legacy/modern SDK journeys through production MCP/API factories and genuine partial-schema PostgreSQL RPCs. Each reaches pending_documents with exact consent and durable replay; none claims confirmed or real provider settlement. OAuth profiles exercise genuine local signed tokens, PKCE/resource indicators and introspection helpers. They are not managed-client/vendor certification.

Package versions, compatibility limits, test evidence and the exact local fixture windows are documented in backend docs/external-booking/mcp-compatibility.md and01-10-MCP-NOTES.md. Full acceptance remains partial: managed issuer/clients, complete deployed database and hosted identity/payment confirmation pilot are unverified. requirements_completed remains empty. Originals and production were not modified.
