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

## Rollback Triggers

Rollback immediately if:

- Users cannot log in.
- Dashboard or booking flows fail broadly.
- Storage objects are missing at scale.
- RLS blocks normal same-team workflows.
- Stripe payment/connect flows point to the wrong environment.
- Rari cannot access restored data.

