# Renter App Goal Mode — Checkpoint

> Updated by the executing agent at the end of every session. Next session:
> read `docs/rent/RENTER_APP_GOAL.md` first, then this file, then resume.

## Current state

- **Current milestone:** M0 (demo ready) — not started; M1 decision register awaiting Gregory
- **Last session:** 2026-07-15 — revival verification + plan review + goal brief (PR #20)

## Completed

- [x] Revival verification of `exotiq-rent` `feat/drive-exotiq-booking-flow`: green across install / tests (7/7) / tsc / lint / build / route smoke (2026-07-15)
- [x] Plan review with 10 findings: `docs/rent/PLAN_REVIEW_2026-07-15.md`
- [x] Goal brief: `docs/rent/RENTER_APP_GOAL.md`
- [x] `/goal` skill: `.cursor/skills/goal/SKILL.md`
- [x] Decision register scaffold: `docs/rent/DECISIONS.md`

## In flight

- PR #20 (`cursor/renter-app-goal-cde9`) on exotiq-spark-mvp-flow — docs + skills, awaiting merge

## Blockers

1. `cursor[bot]` has no write access to `exotiq-ai/exotiq-rent` (push 403). Gregory: GitHub org settings → Cursor app → add repo. Until then, exotiq-rent work is delivered as patches under `docs/rent/patches/`.
2. Decision register unanswered (`docs/rent/DECISIONS.md`) — defaults apply if work must proceed, record assumptions.
3. No deploy credentials for the M0 demo host (needs `VERCEL_TOKEN` or `NETLIFY_AUTH_TOKEN` in Cursor Dashboard → Cloud Agents → Secrets).
4. Migration export artifacts still outstanding from Lovable support (gates M5/M6 only).

## Next action

Start M0: branch off `feat/drive-exotiq-booking-flow`, patch `npm audit` advisories, expand mock catalog (2–3 teams / 6–10 vehicles, unavailable ranges, one hidden vehicle), then storefront + vehicle-detail buildout. Add a GitHub Actions CI workflow (test/tsc/lint/build) to exotiq-rent in the same PR once repo access exists.
