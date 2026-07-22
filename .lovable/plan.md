## Goal
Force-disconnect Saucy Rentals from the wrong Stripe account (`acct_1TvnfgQfNJmCrgjR`) so it can be reconnected to your new one. Exotiq (`acct_1TcPJyQchd6jAAl0`) is not touched.

## Current state (verified)
- `Saucy Rentals` (bc644f8f…) → `stripe_account_id = acct_1TvnfgQfNJmCrgjR`, charges/payouts/onboarding all false.
- `Exotiq` (c1de6533…) → separate account, untouched.

Because charges/payouts are already false, no live payments or payouts break from clearing this.

## Plan

1. **Clear Stripe linkage on Saucy Rentals only.** Update the `teams` row where `id = bc644f8f-1cdb-445b-931b-750730504406`:
   - `stripe_account_id = NULL`
   - `stripe_charges_enabled = false`
   - `stripe_payouts_enabled = false`
   - `stripe_onboarding_complete = false`
   - Also null any related onboarding/session/timestamp columns on `teams` if present (e.g. `stripe_onboarded_at`, `stripe_details_submitted`) — I'll inspect columns first and only touch Stripe-prefixed ones.

2. **Leave the Stripe account itself alone.** We do NOT delete `acct_1TvnfgQfNJmCrgjR` from Stripe — that's Exotiq's real account. Clearing our DB pointer is enough; Exotiq's connection stays intact via its own team row.

3. **Verify.** Re-query both teams to confirm Saucy is cleared and Exotiq is unchanged.

4. **Next step for you (not in this plan):** In the Saucy Rentals tenant → Settings → Payments, click Connect Stripe and go through onboarding with the correct new account.

## Not doing
- No code changes.
- No migration (data-only fix).
- No changes to Exotiq's row or any Stripe-side objects.
- No touching bookings/payments/payouts history.
