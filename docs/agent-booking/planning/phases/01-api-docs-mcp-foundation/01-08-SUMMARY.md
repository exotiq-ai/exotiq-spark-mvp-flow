---
phase: 01-api-docs-mcp-foundation
plan: "08"
status: partial
subsystem: auth
requires: [01-03, 01-04, 01-05]
provides: [hosted exact quote consent, verified tenant customer association, one-use receipt rendezvous, scoped grant recovery, customer revocation]
affects: [01-09, 01-14, 01-10, 01-11, 01-15]
requirements-completed: []
completed: 2026-10-07
---

# Hosted customer consent and recovery

Local implementation of all three tasks is integrated. Full hosted-provider acceptance remains pending; no requirement is marked fully complete.

Backend task notes: [01-08-BACKEND-NOTES.md](01-08-BACKEND-NOTES.md). Frontend task notes: [01-08-FRONTEND-NOTES.md](01-08-FRONTEND-NOTES.md). Adjuncts use NOTES suffix to avoid GSD counting subowners as independent completed plans.

Root backend merged f0983fb3 through26eef66f. Integrated215offline unit and21contract tests pass after generated artifact/source audit refreshdf95588c. Actual guarded partial PostgreSQL08 migration and consent-check pass, including verified-email customer association, source uniqueness conflicts, strict prior external identity ownership, receipt one-use/expiry replay and actual25h/71h booking ages, fresh CSRF review, revoked explicit new delegation, current grant revocation and narrow role privileges. Initial wrong ACL function signature was found by actual SQL compilation and fixed before acceptance.

Root frontend OAuth/BFF contribution uses managed OIDC authorization-code PKCE, actual signed ID/access JWT validation, short encrypted HttpOnly customer session, Origin/CSRF-bound server proxy and separate internal proof key.24 actual signed OAuth/proxy tests pass, including wrong ID/access audience, nonce, subject, expiry and signature; cookies expose no bearer to browser code. Distinct cookie encryption and backend proof keys are enforced. Token refresh is not stored; fresh customer login is required after short session expiry. OIDC/provider profile compatibility remains unverified.

Frontend owned mounted pages/analytics125tests pass; full TypeScript passes. Exact terms, itemization, deposit disclosure and separate charges are reviewed before authorization; customer pages never return receipt secrets. Customer current access revocation and renewal action scopes are explicit. Agent routes are excluded from analytics with noindex/no-referrer metadata. Canonical frontend validator is generated from exact backend source and checked for drift.

Root discovered and repaired actual request cloning cancellation that could wait forever on oversized bodies; signed hosted-proof RED timeout now12tests GREEN. API gateway/resource path preservation is proven with actual signed resource JWT, introspection, gateway HMAC and BFF proof in one runtime call. SQL timestamps are normalized at the public DTO boundary rather than weakening the contract.

No source checkout changes, deployments, live provider calls or public exposure. Hosted OAuth/Stripe/identity staging, full applied schema/ACL/scheduler/provider parity,14 handoff integration and remaining foundation plans stay release gates. The user explicitly requested isolated local tests because hosted staging does not exist yet.
