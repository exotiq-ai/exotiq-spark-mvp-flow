---
phase: 01-api-docs-mcp-foundation
plan: "11"
status: partial
subsystem: canonical-docs-consumer-compatibility
requires: [01-02, 01-07, 01-08, 01-09, 01-10, 01-14]
provides: [generated-openapi, readable-customer-guide, validated-itemized-examples, complete-consumer-drift-check]
affects: [01-12, 01-15]
requirements_completed: []
completed: 2026-10-07
---

# Plan11 local delivery and acceptance limits

The isolated backend contains generated OpenAPI3.1.2, a readable customer/retry/rollout guide, seven validated fictional examples, source/example SHA256 provenance, MCP compatibility evidence and staging/security runbooks. The canonical v1 module describes24 route paths, including explicit customer-owned completion and nonce renewal. Provider URLs have a separate validator: only pinned Stripe hosts and the documented bounded Checkout fragment are accepted; generic public links remain stricter. Receipt/credential query fields, including decoded field names, are refused.

The public API remains the stable boundary for backend structural changes. Internal schema/function changes require server mapping/migration review and the authority tests. Public DTO/scope/state changes require canonical contract review, regenerated OpenAPI/browser validators, MCP compatibility tests and a version decision. Nothing silently rewrites business logic.

The exact frontend drift check compares the entire generated validator as well as the full canonical source hash. Its two negative tests prove detection of a backend field change and a locally modified validator retaining the old hash. MCP imports the same canonical source. CI gates strict Edge runtime typechecking, generated contract/examples, API unit/contract suites and the pinned adapter typecheck/test/build.

Executed final evidence: canonical generation --check and full-byte frontend validator/provenance comparison pass at backend7c3a9932/frontend3411a4e. All36 integrated contract checks across six files and320 API unit tests pass. The refreshed source-only audit includes87 writer candidates,76 inventory-related function candidates,14 dynamic candidates and374 privilege declarations, with fingerprint74fa2e861eb59ae88542bcdfe1066749e24025a92c2cf32e2ccb3bec33d28b78. Applied schema/effective grants remain unverified. The canonical source fingerprint is7cc0779f647906c58b937e4e0c99bb8c46d7b54231adc5ecfdf0994a1fde5af5.

No documentation example is evidence of a real charge, approval or identity verification. Managed issuer/client compatibility, complete applied Supabase ACL/schema parity, hosted providers and the confirmed pilot remain release gates. Full acceptance is partial and requirements_completed remains empty. Final provenance generation and consumer verification were repeated after owner integration; see BUILD-STATUS and01-VERIFICATION for release limits.
