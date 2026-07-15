# Renter App Goal Mode — Checkpoint

> Updated by the executing agent at the end of every session. Next session:
> read `docs/rent/RENTER_APP_GOAL.md` first, then this file, then resume.

## Current state

- **Current milestone:** M0 running on exotiq-rent (separate agent); M2 + M3 complete pending PR merge; M1 decision register awaiting Gregory
- **Last session:** 2026-07-15 — M3 public read plumbing (PR #22, stacked on #21)

## Completed

- [x] Revival verification of `exotiq-rent` `feat/drive-exotiq-booking-flow`: green across install / tests (7/7) / tsc / lint / build / route smoke (2026-07-15)
- [x] Plan review with 10 findings: `docs/rent/PLAN_REVIEW_2026-07-15.md`
- [x] Goal brief: `docs/rent/RENTER_APP_GOAL.md`
- [x] `/goal` skill: `.cursor/skills/goal/SKILL.md`
- [x] Decision register scaffold: `docs/rent/DECISIONS.md`
- [x] **M2 security hardening** (2026-07-15, PR #21): audit showed inventory findings 1–4 already fixed by `20260530203000_harden_tenant_rls_policies.sql`; findings 5 (vehicle-photos uploader-keyed storage RLS → team-scoped) and 6 (`stripe_webhook_events` no SELECT policy → super-admin-only) fixed in `20260715211500_*.sql`. Verified behaviorally: 10/10 RLS tests pass on scratch Postgres 16 (`scripts/rls-verify/`).
- [x] **M3 public read plumbing** (2026-07-15, PR #22, stacked on #21): `vehicles.slug` (backfill + trigger, unique per team), `marketplace_visible` flags (opt-in, default false) + `is_marketplace_team`/`is_marketplace_vehicle` helpers, `public_team_by_slug` / `public_team_fleet` / `public_vehicle_by_slug` / `public_vehicle_availability` (busy ranges + buffer) / `public_vehicle_quote` (cents, D1 default) RPCs, `rent-public-media` edge function (1h signed URLs, deno-typechecked). Verified: 22/22 behavioral tests as anon incl. base-table leak checks and RPC signature PII scan.
- [x] Decision assumptions recorded: D1 (fee = platform_fee_percent on operator total) and D5 (protection $89/$59/decline) implemented per register defaults — revisit if Gregory decides differently.

## In flight

- PR #20 (`cursor/renter-app-goal-cde9`) — goal docs + skills, awaiting merge
- PR #21 (`cursor/m2-security-rls-cde9`) — M2 migration + RLS test harness, awaiting merge
- PR #22 (`cursor/m3-public-read-rpcs-cde9`, base = M2 branch) — M3 schema + RPCs + media function, awaiting merge after #21
- M0 demo polish — running on the exotiq-rent repo via a separate cloud agent (repo access granted 2026-07-15)

## Blockers

1. Decision register unanswered (`docs/rent/DECISIONS.md`) — D1/D5 assumptions now baked into PR #22 per defaults; confirm or amend.
2. No deploy credentials for the M0 demo host (needs `VERCEL_TOKEN` or `NETLIFY_AUTH_TOKEN` in Cursor Dashboard → Cloud Agents → Secrets).
3. Migration export artifacts still outstanding from Lovable support (gates M5/M6 only).
4. PR #21 + #22 migrations must be applied to the hosted project via the established Lovable/owner path after merge, then `rent-public-media` deployed (agents never touch hosted Supabase).

## Next action

M4 (real reads in the renter app, exotiq-rent repo — needs #21/#22 merged AND applied to hosted project first): `services/exotiq-rent/client.ts` + `adapters.ts` wrapping the five public RPCs + media endpoint, `NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=mock|supabase` flag, contract tests against RPC shapes; mock mode must stay green with no env. Coordinate with the M0 agent's branch to avoid conflicts. Meanwhile: M5 prep is possible decision-free only up to drafting the `btree_gist` exclusion constraint migration (blocked on cutover for apply). Chase D-register answers and Lovable export artifacts.
