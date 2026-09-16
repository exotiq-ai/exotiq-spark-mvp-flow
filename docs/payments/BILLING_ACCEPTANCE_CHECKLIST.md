# Billing acceptance checklist (WP-8)

Run against the Stripe **test** environment with a test clock. Each case lists what to do and what
must be true in the app and database afterwards.

Useful commands:
- Dry-run reconciliation: `POST /functions/v1/billing-reconcile?dry_run=true` (super-admin auth)
- Health report: command center → Billing → Subscription health

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 1 | Activation, monthly | New team, 6 vehicles pre-loaded, activate from setup | Checkout shows Pro / 6 vehicles; `billing_status = trialing`; `billed_quantity = 6`; `trial_end` = +30 days; `trial_started` email logged once |
| 2 | Activation, annual | Same with annual toggle | `billing_interval = year`, annual price id used |
| 3 | Card required | Attempt checkout without a payment method | Stripe blocks completion; team stays `pending_activation` |
| 4 | Transaction lock | While `pending_activation`, try to create a booking and a payment | Both refused (RLS + marketplace RPC); fleet, locations and business info still editable |
| 5 | Trial warning | Advance clock to trial end −3 days | `trial_will_end` handled; `trial_ending` email logged once |
| 6 | Trial converts | Advance past trial end | `billing_status = active`; first invoice paid; `first_payment` email logged once |
| 7 | Duplicate webhook | Replay any handled event | No second email, no double write (`stripe_webhook_events` dedupe) |
| 8 | Mid-cycle growth | Add 4 vehicles mid-cycle | No immediate charge; health panel shows billed 6 / live 10 as a mismatch |
| 9 | Renewal recount | Advance to `invoice.upcoming` | Quantity becomes 10; invoice charges 10 |
| 10 | Tier crossing | Grow from 15 to 16 vehicles, advance to renewal | Price swaps to Business, quantity 16 |
| 11 | Over the cap | Grow past 50 vehicles | Billed quantity capped at 50; team listed under "Over the 50-vehicle cap" |
| 12 | Payment failure | Force a failing card at renewal | `billing_status = past_due` → `unpaid`; `payment_failed` email logged; app shows the payment-trouble card; account read-only when `unpaid` |
| 13 | Cancellation | Cancel from Settings → Billing | `cancel_at_period_end = true`, then `canceled` after period end; `subscription_canceled` email logged |
| 14 | Grandfathered team | Pick a pre-cutover team | No banner, no activation prompt, "included" messaging in billing settings |
| 15 | Reconciliation | Break quantity by hand in Stripe, run `billing-reconcile` | Drift corrected, count reported, mismatch clears in the health panel |
| 16 | Lifecycle actions | Restart setup, start demo, stop demo, require activation on a test tenant | Owner returns to step one; demo flag flips; each action written to `role_audit_log` |
