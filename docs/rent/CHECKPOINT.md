# Renter App Goal Mode — Checkpoint

> Updated by the executing agent at the end of every session. Next session:
> read `docs/rent/RENTER_APP_GOAL.md` first, then this file, then resume.

## Current state

- **Current milestone:** M0 running on exotiq-rent (separate agent); M2 complete pending PR merge; M1 decision register awaiting Gregory
- **Last session:** 2026-07-15 — M2 security hardening (PR #21)

## Completed

- [x] Revival verification of `exotiq-rent` `feat/drive-exotiq-booking-flow`: green across install / tests (7/7) / tsc / lint / build / route smoke (2026-07-15)
- [x] Plan review with 10 findings: `docs/rent/PLAN_REVIEW_2026-07-15.md`
- [x] Goal brief: `docs/rent/RENTER_APP_GOAL.md`
- [x] `/goal` skill: `.cursor/skills/goal/SKILL.md`
- [x] Decision register scaffold: `docs/rent/DECISIONS.md`
- [x] **M2 security hardening** (2026-07-15, PR #21): audit showed inventory findings 1–4 already fixed by `20260530203000_harden_tenant_rls_policies.sql`; findings 5 (vehicle-photos uploader-keyed storage RLS → team-scoped) and 6 (`stripe_webhook_events` no SELECT policy → super-admin-only) fixed in `20260715211500_*.sql`. Verified behaviorally: 10/10 RLS tests pass on scratch Postgres 16 (`scripts/rls-verify/`).

## In flight

- PR #20 (`cursor/renter-app-goal-cde9`) — goal docs + skills, awaiting merge
- PR #21 (`cursor/m2-security-rls-cde9`) — M2 migration + RLS test harness, awaiting merge
- M0 demo polish — running on the exotiq-rent repo via a separate cloud agent (repo access granted 2026-07-15)

## Blockers

1. Decision register unanswered (`docs/rent/DECISIONS.md`) — defaults apply if work must proceed, record assumptions.
2. No deploy credentials for the M0 demo host (needs `VERCEL_TOKEN` or `NETLIFY_AUTH_TOKEN` in Cursor Dashboard → Cloud Agents → Secrets).
3. Migration export artifacts still outstanding from Lovable support (gates M5/M6 only).
4. PR #21's migration must be applied to the hosted project via the established Lovable/owner path after merge (agents never touch hosted Supabase).

## Next action

Start M3 (public read plumbing) in this repo: vehicle slugs migration (unique per team, deterministic backfill) → `marketplace_visible` flags + demo-exclusion helper → `public_team_by_slug` / `public_team_fleet` / `public_vehicle_by_slug` RPCs → signed media strategy → availability (with `rental_buffer_minutes`) + quote RPCs. Fee rule inside the quote RPC depends on D1 — if still PENDING, implement `teams.platform_fee_percent` on operator total per the recommended default and record the assumption. Extend `scripts/rls-verify/` to cover each public RPC (anon can read only intended fields).
