# Production Cutover Go/No-Go Checklist

This checklist is for the final cutover only. Do not use it until the staging
restore rehearsal and staging smoke pass.

## Freeze Confirmation

- [ ] Schema changes frozen.
- [ ] Supabase migration changes frozen.
- [ ] Stripe backend changes frozen.
- [ ] Auth/storage changes frozen.
- [ ] Feature PRs #1-#5 remain excluded.

## Rollback Snapshot

Record current production Netlify values outside the repo:

- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] `VITE_SUPABASE_PROJECT_ID`, if configured
- [ ] Any production-only Supabase-related values

Rollback is env-var reversal plus Netlify production redeploy.

## Final 24-Hour Rehearsal

- [ ] Fresh staging smoke passes.
- [ ] `npm run build` passes.
- [ ] Edge Function smoke passes.
- [ ] Data counts still match expected baselines.
- [ ] Cron jobs are staged with new URLs and JWTs.
- [ ] Auth redirect URLs include production domains.
- [ ] Stripe live/test boundaries are confirmed.

## Cutover Window

- [ ] Low-traffic night window selected.
- [ ] Owner approval recorded.
- [ ] Technical operator assigned.
- [ ] Rollback operator assigned.
- [ ] Lovable Supabase remains available.

## Immediate Production Smoke

- [ ] Login works.
- [ ] Dashboard loads.
- [ ] Booking create works.
- [ ] Customer create works.
- [ ] Document upload/preview/download works.
- [ ] Vehicle photos load.
- [ ] Rari can read booking data.
- [ ] Realtime notifications/messages work.
- [ ] Stripe sanity checks pass without unsafe live charges.
- [ ] Browser console has no new critical errors.

## Renter Marketplace Items (added 2026-07-16, see docs/rent/CHECKPOINT.md)

- [ ] Apply the deferred `realtime.messages` block from
      `20260530203000_harden_tenant_rls_policies.sql` (Lovable Cloud could not
      apply it — ownership restriction; the new self-managed project can).
      Pair with the frontend switch to private realtime channels.
- [ ] Verify the five renter migrations survived the restore
      (`20260530203000`, `20260530224500`, `20260715211500`,
      `20260715220000`, `20260715220100`) — policies, helper functions,
      slugs, visibility flags.
- [ ] Verify public RPCs post-restore with the new anon key:
      `public_team_by_slug` returns only marketplace-visible teams; anon
      cannot read `teams`/`vehicles`/`bookings` directly.
- [ ] Re-deploy `rent-public-media` on the new project and re-test 400/404/200.
- [ ] Update the exotiq-rent app env (`NEXT_PUBLIC_SUPABASE_URL`/anon key)
      if M4 supabase mode is live by then.
- [ ] M5 (booking writes) remains blocked until AFTER this cutover completes;
      the `btree_gist` double-booking exclusion constraint is added then
      (pre-check for existing overlapping bookings first).

## Rollback Triggers

Rollback immediately if:

- Users cannot log in.
- Dashboard or booking flows fail broadly.
- Storage objects are missing at scale.
- RLS blocks normal same-team workflows.
- Stripe payment/connect flows point to the wrong environment.
- Rari cannot access restored data.

