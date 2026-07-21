# Renter App Goal Mode — Checkpoint

> Updated by the executing agent at the end of every session. Next session:
> read `docs/rent/RENTER_APP_GOAL.md` first, then this file, then resume.

## Current state

- **Current milestone:** M1/M2/M3 COMPLETE, merged to main AND applied to the
  hosted cloud DB (Lovable, 2026-07-16): all five migrations applied
  (realtime.messages block deferred to cutover), `rent-public-media` deployed
  and verified (400 on missing params, 404 on unknown AND on
  non-marketplace-visible real slugs — visibility gate confirmed active in
  production). Positive-path (200 + signed URLs) pending Gregory designating
  an opt-in team + vehicle. **M4 is unblocked.**
- **exotiq-rent status:** PRs #2 (M0 bootstrap) and #3 (D1/D5/D9 frontend changes) are OPEN on exotiq-rent — merging them + repointing the Netlify deploy is what fixes demo.exotiq.rent (currently showing old cyan marketplace from stale main).
- **Last session:** 2026-07-16 — merged #20/#21/#22, wrote Lovable prompts
- **CRITICAL FINDING (2026-07-16):** the May 31 security hardening migration
  (`20260530203000_harden_tenant_rls_policies.sql`, inventory findings 1–4)
  was merged to repo main but NEVER applied to the cloud DB — the cross-team
  RLS holes were live in production until now. Lovable was instructed to apply
  it (+ `20260530224500`) before the M2 migration, then produce a drift report
  of all post-2026-05-30 repo migrations with no applied record.   Triage that
  report when it arrives. Root cause: no pipeline from repo main → hosted DB;
  resolved permanently by the planned Supabase migration (CI-applied migrations).
- **Drift report triaged (2026-07-16):** clean — only 5 unapplied migrations
  (the two 20260530 hardening files + the three M2/M3 files). Apply order
  1→2→3→4→5 approved.
- **DEFERRED TO CUTOVER — realtime.messages policies:** Lovable Cloud's
  migration runner cannot ALTER/CREATE POLICY on `realtime.messages`
  (ownership restriction; error 42501). The realtime block of
  `20260530203000_harden_tenant_rls_policies.sql` was skipped on cloud apply
  (safe: policies only bind to private channels, which the app does not use
  yet). ACTION AT MIGRATION CUTOVER: apply the realtime block on the new
  self-managed project, and pair it with a frontend switch to private
  channels (add to M-post-cutover hardening). Also: earlier partial apply
  detected on cloud (team_conversations delete policy pre-existed) — Lovable
  asked to report which policies already existed.

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

1. ~~Decision register unanswered~~ **RESOLVED 2026-07-15: all ten decisions recorded in `docs/rent/DECISIONS.md`** (D1 fee = 10% of rental subtotal only, renter-charged separately; D5 protection reprice $89/$289 premium-default; D7 Netlify at demo.exotiq.rent; see decision log for consequences). PR #22 quote RPC amended to match; 25/25 tests pass.
2. Demo deploy (D7 = Netlify): Gregory can run the Netlify MCP from Cursor desktop, or add `NETLIFY_AUTH_TOKEN` in Cloud Agents → Secrets for agents to deploy.
3. Migration export artifacts still outstanding from Lovable support (gates M5/M6 only).
4. PR #21 + #22 migrations must be applied to the hosted project via the established Lovable/owner path after merge, then `rent-public-media` deployed (agents never touch hosted Supabase).
5. M6 money-flow question (from D1): renter sees TWO separate charges (operator rental charge + Exotiq booking fee/protection). Single-checkout model from the May 27 handoff needs rework; Gregory reviews Stripe money flow before M6 starts.

## Frontend changes queued for the exotiq-rent agent (from decisions, 2026-07-15)

1. `domain/booking/totals.ts`: `platformFeeBaseCents` = `rentalSubtotalCents` only (remove extras + operator tax from fee base, per D1/D9); `PROTECTION_DAILY_RATES` → premium 28900, standard 8900 (D5).
2. `ProtectStep`: pricing copy $89 standard / $289 premium (premium default); decline path must present decline terms (copy TODO: renter liable for total cash value incl. total loss; personal auto insurance verified before pickup).
3. Review/Pay/Confirmation: keep two-party billing; label the Exotiq line as booking fee + protection.

## Session 2026-07-16 (late): D1 hardcode retirement + handoffs

- PR #23 (`cursor/retire-marketplace-fee-hardcode-cde9`) — OPEN, awaiting
  Gregory merge: removes the 20% marketplace application fee from
  `create-payment-checkout` + `stripe-create-hold` (D1); adds renter items to
  the cutover go/no-go checklist; updates LOVABLE-PROMPTS-RENT.md (1–4 done,
  Prompt 5 toggles now recommended, Prompt 6 fee-retirement awareness note).
  NOTE: functions auto-deploy from repo sync on merge.
- Pending Gregory: (a) merge PR #23, (b) positive-path test — designate an
  opt-in team + vehicle and run the prompt from the 2026-07-16 03:05 session,
  (c) send Lovable Prompt 5 (visibility toggles) and Prompt 6 (awareness),
  (d) merge exotiq-rent PRs #2/#3 to fix demo.exotiq.rent.
- exotiq-rent lane (M0/M4) is owned by the other cloud agent — this repo's
  sessions must not touch that repo's in-flight branches.

## Session 2026-07-21: ID-verification lane — V1 backend applied to spark repo

- Applied the IDV V1 patch from exotiq-rent PR #8 (`docs/rent/patches/idv/`,
  plan: exotiq-rent `docs/rent/ID_VERIFICATION_PLAN.md`, decisions V1–V10):
  migration `20260721180000_identity_verifications.sql` + edge functions
  `identity-create-session` / `identity-webhook` / `identity-session-status`
  + config.toml entries (webhook + status are `verify_jwt = false`).
- Schema cross-check vs this repo: `customers.team_id/user_id/email/full_name/
  id_verified/id_verified_at` ✓, `is_team_member_of_record` ✓ (requires
  `is_active = true`), `notifications(user_id,type,title,message,data)` ✓,
  `team_members` ✓. Drift fixes applied: both function queries against
  `team_members` now filter `is_active = true` (matches the helper's
  semantics; avoids notifying/authorizing deactivated members). No other
  drift found.
- Verified: `deno check` clean on all three functions; 6/6 behavioral tests
  pass on scratch Postgres (`scripts/rls-verify/test_idv.sql`) — check
  constraint, updated_at trigger, team-scoped SELECT, client INSERT/UPDATE
  blocked (service-role-only), cross-team isolation.
- **ID lane V1: applied.** Next for the ID lane:
  1. Merge the IDV PR in this repo (functions auto-deploy on repo sync).
  2. Stripe sandbox → Webhooks: add endpoint for
     `/functions/v1/identity-webhook`, subscribe to the five
     `identity.verification_session.*` events (incl. `redacted` explicitly),
     copy signing secret → `STRIPE_IDENTITY_WEBHOOK_SECRET` edge-function
     secret (patch README steps 5–6).
  3. Lovable Prompts A (apply migration) + B (Command Center UI) from
     exotiq-rent `docs/rent/ID_VERIFICATION_PLAN.md` §5.
  4. Smoke: `stripe trigger identity.verification_session.verified` →
     ledger row + `customers.identity_status` flip.

## Next action

M4 (real reads in the renter app, exotiq-rent repo — needs #21/#22 merged AND applied to hosted project first): `services/exotiq-rent/client.ts` + `adapters.ts` wrapping the five public RPCs + media endpoint, `NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=mock|supabase` flag, contract tests against RPC shapes; mock mode must stay green with no env. Coordinate with the M0 agent's branch to avoid conflicts. Meanwhile: M5 prep is possible decision-free only up to drafting the `btree_gist` exclusion constraint migration (blocked on cutover for apply). Chase D-register answers and Lovable export artifacts.
