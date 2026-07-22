## Goal
Wipe the half-onboarded Stripe Connect account so Exotiq Inc can start fresh onboarding for the **Exotiq** tenant, cleanly, ahead of the marketplace test.

## Current state (verified)

- Stripe Connect account `acct_1TcPJyQchd6jAAl0`
  - `details_submitted: false`
  - `charges_enabled: false`, `payouts_enabled: false`
  - No external accounts, no capabilities active, no charges — safe to delete.
- Database pointers:
  - **Exotiq** team → still points to `acct_1TcPJyQchd6jAAl0`
  - **Saucy Rentals** → already `NULL` (cleared last turn)

So one Connect account is orphaned in Stripe and still referenced by Exotiq's row.

## Plan

1. **Delete the Connect account in Stripe**
   Call Stripe API `DELETE /v1/accounts/acct_1TcPJyQchd6jAAl0`. Because the account has no submitted details, no capabilities, no external account, and no volume, Stripe allows the delete outright — it disappears from the Connect dashboard.

2. **Clear Exotiq's pointer in our DB**
   Update `teams` where `id = c1de6533-…`: set `stripe_account_id = NULL`, `stripe_charges_enabled = false`, `stripe_payouts_enabled = false`. This unblocks the "Connect Stripe" button in Settings → Payments (it currently sees a stale account id and shows "Resume onboarding").

3. **Verify**
   - Re-fetch Exotiq's team row → all three Stripe fields null/false.
   - Attempt to `GET /v1/accounts/acct_1TcPJyQchd6jAAl0` → should 404.

4. **You take over in-app** (no code changes needed for this part)
   Log into the **Exotiq** tenant → Settings → Payments → **Connect Stripe**. Onboard with the real Exotiq Inc info. When Stripe finishes, our existing `stripe-webhook` will flip `charges_enabled` / `payouts_enabled` and the marketplace readiness check goes green on that line automatically.

## Not touching
- Exotiq's live payments key (`STRIPE_SECRET_KEY`), Identity key, webhooks, or any migrations.
- Saucy's row (already clean).
- `marketplace_test_mode` on Exotiq (leave on until real checklist is green, then flip off for the dress rehearsal).

## Risk
Effectively zero. The Connect account being deleted has never processed anything and isn't the platform account — it's a sub-account under your Exotiq Inc platform. Your platform account is untouched.
