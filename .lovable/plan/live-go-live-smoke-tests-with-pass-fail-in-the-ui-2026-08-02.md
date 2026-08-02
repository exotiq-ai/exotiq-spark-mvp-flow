# Live Go-Live Smoke Tests with PASS/FAIL in the UI

Add a repeatable, semi-automated smoke run that proves the live Stripe cutover
actually works: a real subscription checkout, one real marketplace booking, and
one real refund — all at minimum amounts and reversed at the end.

You were right that this does not belong in a "sandbox" tab. The existing
Super Admin **Payments** tab is renamed **Payments & Go-Live**; the one-off test
Connect tool moves into a collapsed "Sandbox utilities" section at the bottom,
and the live smoke runner becomes the primary content.

## What the run does

Three independent scenarios, each a sequence of steps with its own PASS/FAIL:

```text
A. Subscription checkout (Command Center billing)
   1  create checkout session (Pro monthly, qty 1, trial off)   -> auto
   2  you pay with a real card at the returned link             -> manual
   3  session completed + subscription active in Stripe         -> auto poll
   4  stripe-webhook received & recorded the event row          -> auto
   5  cancel subscription + refund the invoice                  -> auto

B. Marketplace booking (renter money path)
   1  pick the live-ready tenant + cheapest bookable vehicle    -> auto
   2  quote via public RPC; snapshot every fee component        -> auto
   3  create booking, approve it, get renter checkout link      -> auto
   4  you pay with a real card                                  -> manual
   5  both legs captured: operator PI + Exotiq PI               -> auto poll
   6  charged amounts equal the snapshot, to the cent           -> auto
   7  fee split lands on the right accounts (destination charge)-> auto

C. Refund
   1  refund booking from B via rent-refund-booking             -> auto
   2  both legs show refunded in Stripe                         -> auto poll
   3  booking status + ledger rows reflect the reversal         -> auto
   4  no orphan payment rows left behind                        -> auto
```

Scenario C depends on B. A can run alone. Each run is recorded so you can look
back at the last green run before flipping anything.

## Safety rails

- Live runs require typing `RUN LIVE` in the panel; nothing fires otherwise.
- Amounts are pinned to the minimum chargeable (one day, cheapest vehicle,
  qty 1 monthly seat). The panel shows the exact dollar exposure before you start.
- Every run has a **Clean up** action that cancels the subscription, refunds any
  outstanding charge, and cancels the booking — also run automatically at the
  end of a successful pass.
- Test rows are tagged (`metadata.exotiq_smoke_run_id`, booking flag) so they are
  excluded from tenant revenue, P&L and dashboards.
- Super-admin only, end to end: the runner function refuses anyone else.
- The panel shows which Stripe mode the platform key is in and refuses to start a
  live run if the key is a test key (and vice versa).

## Technical detail

**New table `smoke_test_runs`** — id, mode (`live`/`test`), scenario, status
(`running`/`passed`/`failed`/`cancelled`), `steps` jsonb (step key, label, state,
detail, timing), created_by, amounts_cents, cleanup_state, timestamps. RLS:
super admins only; GRANT select/insert/update to `authenticated`, all to
`service_role`.

**New edge function `admin-smoke-run`** — super-admin gated, same auth pattern as
`admin-create-test-connect`. Actions: `start`, `advance` (poll the next automated
step), `cleanup`, `cancel`. It calls the real production paths — the same
`create-checkout-session`, `rent-create-booking`, `rent-approve-booking`,
`rent-checkout`, `rent-refund-booking` — rather than reimplementing them, so a
green run means the real code paths work. All fee assertions compare against the
booking's snapshotted `platform_fee_cents`, `protection_total_cents`,
`state_fee_cents`, `processing_fee_cents`.

**New UI `src/components/super-admin/GoLiveSmokeTestPanel.tsx`** — scenario
cards, per-step rows with pass/fail/pending/blocked icons and detail text, the
Checkout link surfaced for the manual pay step, live polling while a run is open,
run history list, and a Clean up button. Rendered inside the renamed
`SuperAdminPaymentsTestTab`.

**Tests** — vitest coverage for the step-state reducer and the fee-parity
assertion helpers; the network-touching parts stay behind the runner function.

## What stays manual

Card entry. Stripe blocks scripted card entry on live Checkout, so steps A2 and
B4 are yours; everything before and after them is automated and verified.
