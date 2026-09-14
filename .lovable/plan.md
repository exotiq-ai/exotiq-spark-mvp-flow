# Review — 30-Day Trial & Per-Vehicle Billing handoff (2026-09-14)

Scope: the app side only (app.exotiq.ai). The exotiq.ai marketing/pricing page is yours.
Verdict: the design is sound and I'd build it. Nine things need correcting or a decision before I start.

## Things that are wrong in the doc

1. **"Teams with no trial date today are grandfathered" is false.** New teams are currently created with a trial date filled in automatically (a 14-day default set in May). So today almost no team has an empty trial date, and the grandfathering rule as written would catch almost nobody. Correction: grandfather by "has no Stripe subscription and was created before the switch-over date", and record that date in the migration.

2. **There is no `expenses` table.** Expenses live in `vehicle_expenses`. Same for the write-lock list generally — I'll use the real table names.

3. **The read-only lock can't be done with table rules alone.** Several writes go through trusted server routines that skip table rules entirely — including marketplace booking creation and every webhook. If we only add the lock to the table rules, an unpaid team can still get bookings and customers written by those paths. Correction: add the lock to the table rules *and* inside the trusted routines/functions that write bookings, customers and vehicles. I'll produce the full list of those paths first.

4. **`docs/clickwrap-acceptance-spec.md` doesn't exist in the repo.** Terms acceptance already works though (there's a live terms-acceptance function and a versioned legal-documents table), so I'll use the existing mechanism and bump the terms version there. No new spec needed unless you have one.

5. **The webhook doesn't resolve teams by team id today** — it resolves subscription events by matching the Stripe customer's email to a profile. The doc treats this as "extend the existing pattern"; it's actually a replacement. Fine, but it means the backfill has to run *before* the new handlers go live, otherwise existing subscribers stop being recognised.

## Things I'd push back on

6. **Blocking every write during `pending_activation` is too harsh for a live demo call.** A brand-new team can't add a vehicle, so they can't see their own fleet count before being asked for a card, and the "your fleet: N vehicles" line reads "1 vehicle" for everyone. Proposal: `pending_activation` allows fleet and location setup and blocks only bookings, payments and renter-facing actions. Full lock stays for `unpaid`/`canceled`.

7. **Capping at 50 vehicles instead of billing them is a silent revenue leak.** A team at 70 cars gets billed for 50 indefinitely until someone works the notification. Proposal: keep the cap (don't auto-bill Enterprise pricing) but add it to the super-admin trial/billing tile as a standing exception list, not just a one-time task.

8. **Rate lock ("rate at activation applies for life") conflicts with the tier price swap.** Crossing 15 vehicles swaps to the *current* Business price, which is not the price that was locked at activation. For 2026 prices that's harmless; the first time you raise prices in 2027 it breaks the promise for anyone who crosses a tier. Proposal: either soften the Terms wording to "the rate for your tier at the time you activated", or store the activation price ids on the team and swap only between those. My recommendation is the wording change — it's the same promise with none of the machinery.

9. **`invoice.upcoming` as the recount hook is the risky part of the plan.** It's not guaranteed to arrive before the invoice finalises in every case, and if it's ever missed the customer is billed the stale quantity. Proposal: keep it as the primary hook, and add a nightly reconciliation that compares billed quantity to live fleet count for every active team and flags mismatches in the command center. Cheap insurance, and it doubles as the annual true-up job's home (nightly scheduled jobs already run in this project, so the plumbing exists).

## Smaller notes

- Tier bounds (1–15 / 16–50) are hardcoded in four places today (two functions, the settings screen, the pricing data). I'll collapse them to one shared definition as part of WP-5, otherwise the next price change desyncs them.
- The in-app FAQ currently says "14-day free trial, no credit card required". That's a public-facing contradiction the moment the new Terms go live, so WP-5 copy and WP-8 Terms must ship in the same release.
- The trial length is hardcoded in the checkout function and separately relied on by the trial banner; both move to the single 30-day constant.
- Trial-eligibility today is decided partly by a value the browser sends. That goes away — server decides.
- `invoice.paid` "first paid invoice" detection: I'll key it off the email log plus Stripe's own billing reason rather than amount alone, so a mid-cycle proration invoice can't trigger the annual offer early.
- Idempotency already exists in the webhook table keyed per consumer; the new handlers reuse it, no new scheme.

## What I'd build, in order

1. Schema + backfill (columns on teams, email log, grandfathering by cutover date), plus a shared server-side definition of "active vehicle" and "team is writable".
2. Activation checkout rewritten server-derived, 30-day trial, card required, terms consent.
3. Webhook handlers with team-id resolution, renewal recount, nightly reconciliation + annual true-up.
4. Billing emails (four templates, logged and deduped).
5. App UI: one billing card, no plan picker, write-lock enforced server-side, copy aligned.
6. Command center: billing columns, trial health tile, upsell/Enterprise tasks.
7. Terms page clauses + version bump, one-click cancel.
8. Test-clock acceptance run (the 13 cases), then the backfill in production.

Nothing here touches Stripe Connect, renter checkout, deposits or the marketplace.

## Decisions I need from you

- Item 6: soften `pending_activation` to allow fleet setup, or keep it fully locked?
- Item 8: reword the rate-lock clause, or store activation prices per team?
- Item 9: nightly reconciliation in scope now, or note it as a follow-up?
