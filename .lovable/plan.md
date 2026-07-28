## Status: no remaining launch blockers

Verified against the DB just now:

- Only 1 open marketplace booking in a pre-payment state: **BK-03458**, correctly parked in `requested` (waiting on operator approval) with no cancellation reason. The identity-webhook fix promoted it as intended.
- `rent-payment-scheduler` last run: `expired=0, reminders=0, warnings=0, holdCancelled=0, errors=0` — clean.
- The four Cluster-A money items (Stripe mode routing, `LOCKED_STATUSES` edit guards, `PaymentTracker` marketplace guard, 10% platform fee backfill + confirm-gate) are all live.
- The launch-blocker split (`pending_documents → requested` for unpaid, `→ confirmed` for paid) is deployed on `identity-webhook`, and the 4h guillotine is replaced by 24h renter / 72h operator windows with pre-cancel warning emails on both sides.

## Non-blocking follow-ups (not launch gates)

These were flagged in earlier handoffs and are still open, but none stop first-time renters from completing a booking:

1. **Stripe webhook-endpoint API check** (Claude's earlier item 1). We flipped the sandbox and live webhook URLs but never programmatically confirmed both endpoints are registered on the Stripe accounts and listening to the right event set. Small script, worth doing before public marketing.
2. **Insurance-upload flow spec.** `verifyIdRequested` template still says "Insurance upload is coming next…" — the surface itself doesn't exist yet. Either write the spec/flow or scrub the sentence from the template so we don't promise vaporware.
3. **Repo hygiene.** Several edge functions were deployed directly from Lovable and are ahead of `exotiq-spark-mvp-flow` main (identity-webhook, rent-payment-scheduler, send-renter-email, rent-approve-booking, and the stripe-* mode-routing changes). Worth exporting a PR so a rebuild from git doesn't regress prod.

## Explicitly downgraded / done, not open

- Deposit sandbox rehearsal — no longer applicable (Exotiq exited the deposit flow 2026-07-28).
- `stripe-create-deposit-setup-session` — returns 410, per that decision.
- Marketplace readiness gate — now keyed on `platform_fee_confirmed_at`, not the deposit column.

## What I'd want to hear from you

Which (if any) of the three follow-ups you want me to pick up next — or if there's a testing surface you already found something on that I haven't seen.
