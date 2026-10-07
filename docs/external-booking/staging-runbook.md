# Agent booking staging and ownership runbook

Build authorization: 2026-10-07. No production deployment, shared-service mutation, source branch/index edits, or integration into other owners' branches is authorized by this runbook.

## Isolated ownership

| Owner | Isolated implementation path | Branch | Reconciled base |
|---|---|---|---|
| Backend/API contract/database | `/Users/g.r./Documents/Codex/2026-10-06/realtime-voice-chat/work/exotiq-agent-build/backend-worktree` | `codex/agent-booking-backend` | `442dd4d1cb00823132d0a0f24a26892a70dd5288` |
| Frontend renter facade/browser | `/Users/g.r./Documents/Codex/2026-10-06/realtime-voice-chat/work/exotiq-agent-build/frontend-worktree` | `codex/agent-booking-frontend` | `a2260c3de1b539d0a59ab5fa4d21e12f341cb92d` |
| MCP adapter (`packages/renter-mcp` only) | `/Users/g.r./Documents/Codex/2026-10-06/realtime-voice-chat/work/exotiq-agent-build/adapter-worktree` | `codex/agent-booking-adapter` | `442dd4d1cb00823132d0a0f24a26892a70dd5288` |

These worktrees belong to independent clones; the inspected source repositories' `.git` files were not used for worktree registration. The external planning workspace's `IMPLEMENTATION-WORKTREES.json` is the ownership manifest. Root orchestrator owns STATE/ROADMAP and sequential shared-file handoffs. Before integration, recheck source owner revisions/status and reconcile changed interfaces explicitly; do not reset or overwrite other agents. No cross-chat messages are authorized. Backend contract artifacts flow to frontend and adapter only at a recorded handoff.

Before later migration work, the database owner must allocate collision-free timestamps against the refreshed tracked migration inventory, record exact filenames in the ownership manifest and update downstream references. No migrations are allocated or applied by this harness. Unknown writers, unresolved overload/default-grant provenance, or overlapping source changes stop dependent migrations/exposure.

## Present evidence and gates

Offline tests exercise guards, synthetic scopes, source inventory consistency and failure fixtures. They do not prove database transaction safety, applied permissions, live schedules, OAuth compatibility, identity rules or payment reconciliation. No staging evidence file, credentials, baseline approval or synthetic provider configuration has been supplied. Staging and pilot commands therefore exit with a refusal before loading tests or making network requests.

Worktree isolation does not isolate Supabase databases, edge deployments, schedulers, Stripe, identity or email. A separately named local project/container or dedicated hosted project is required, with isolated ports and resource ownership. Never link to original project `jlgwbbqydjeokypoenoc`, default to production, or read source `.env` files.

## Required reviewed configuration

The runner consumes `AGENT_STAGING_CONFIG`, pointing to a runner-controlled JSON file outside tracked source. The config must specify `environment: agent-booking-staging`, explicit `projectId`, exact bare-origin `supabaseUrl`, matching `allowedProjectIds`/`allowedUrls`, and a reviewed `evidence` object with matching environment/project/URL, `reviewedBy`, `reviewedAt`, `expiresAt` (at most seven days), `baselineSha256`, `schemaAndGrantsVerified: true`, `schedulerIsolated: true`, and `providers` specifying an agent-test HTTPS OAuth issuer, `stripeOperator: test`, `stripeExotiq: test`, `identity: sandbox`, `email: sink`. Synthetic auth owner UUIDs, if needed by rows, must be explicitly evidenced in `syntheticAuthUserIds`.

These fields are an operational attestation, not proof by themselves. The reviewer must attach actual baseline/schema/function hashes, `pg_proc` identities/defaults/ACLs, effective role calls, trigger/constraint inventory, scheduler isolation and sandbox provider records. Never generate the attestation from offline fixture successes. Missing actual evidence keeps the gate closed even if a file could be made to pass structural checks.

Secrets are injected by the runner/secret manager only: `AGENT_STRIPE_OPERATOR_TEST_KEY`, `AGENT_STRIPE_EXOTIQ_TEST_KEY`, and for REST seeding `AGENT_SUPABASE_TEST_SERVICE_KEY`. Both Stripe keys must be `sk_test_...`. The REST seeder accepts only a service JWT whose role/project claims match the selected local or hosted environment. It refuses opaque service keys until separate project-binding support is reviewed. Do not log keys or store credentials in JSON manifests. No agents or browser clients receive these keys.

## Clean schema baseline

Audit tracked migrations; build a reviewed schema-only baseline with required auth/storage/extensions and grants. Never blindly replay the historical migration directory. Quarantine `20260724035422_6ac3ac4e-e8d6-413a-bae7-ae8d23b65ba5.sql`, which mutates a specific historical booking. Capture baseline checksum, applied function signatures/defaults/ACLs, policies, trigger definitions and denied anon/authenticated writer calls. Static source ACLs cannot establish effective permissions inherited through PUBLIC or role membership. Preserve ordinary storefront/operator compatibility before changing inventory policy.

## Seed and cleanup

Create a reviewed manifest `{version:1, runId:'agent-test-...', projectId, rows:[...]}` with UUIDs, supported table, exact synthetic label stored in row data, and dependency-ordered rows. Supported tables: teams, vehicles, customers, bookings, vehicle_blocked_dates. All team/vehicle/customer foreign keys must point into the same manifest; auth owner IDs must match reviewed synthetic accounts. Use non-deliverable `agent-test-...@...invalid` email and fictional 202-555-01xx phones. Credentials, confirmation tokens, card fields and document URLs are prohibited.

Run `node scripts/agent-booking/seed-staging.mjs apply <reviewed-config.json> <manifest.json>`. The complete manifest and environment are validated before reads/writes. Existing IDs are rejected; no upserts. Seed failures can leave already inserted synthetic rows, so preserve the manifest for cleanup. Run the same command with `teardown`; it preflights every existing row's exact UUID and original synthetic markers, then deletes only those exact IDs in reverse dependency order. No team-wide delete, wildcard cleanup or broad cascade is used. Review baseline foreign-key cascades to ensure no data outside the synthetic manifest could be related; preserve the gate otherwise.

## Verification commands

- `npm run test:agent:unit -- --run`: offline named unit files; network APIs blocked.
- `npm run test:agent:contract -- --run`: offline explicit contract files; source consistency checks.
- `npm run test:agent:staging -- --run`: gated real integration suites. No mocks count as applied SQL/payment evidence.
- `npm run test:agent:pilot -- --project=synthetic`: gated synthetic end-to-end pilot suite, added by the rollout owner.
- `node scripts/agent-booking/audit-source.mjs --check docs/external-booking/source-audit.json`: detects tracked source drift and omitted candidates.

Test discovery is fixed in `test-suites.mjs`; no pass-with-no-tests or config override. Each later owner creates the named suite before production behavior. Missing suites fail discovery rather than reporting false validation. Internal functions and legacy status lookup are not exposed merely because these offline checks pass.

## Source inventory reconciliation after later waves

The root orchestrator owns this shared handoff: after every owner has committed the wave's new source files, review changed writer/signature/grant/trigger predicates, then run `node scripts/agent-booking/audit-source.mjs --refresh` in the isolated backend owner branch. This regenerates `docs/external-booking/source-audit.json`, the complete tables in `capabilities.md`, and `tests/agent-booking/fixtures/schema-grants.json` from **tracked** source. Untracked implementation files are not part of provenance until staged/committed. Review the generated diff before committing these three artifacts; regeneration must never waive omitted dynamic writer review or actual applied-schema tests. Run both offline suites afterward. The refreshed fixture remains source-only and never becomes effective grant evidence by regeneration.
