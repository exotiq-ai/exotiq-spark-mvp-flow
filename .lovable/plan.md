## Current state
- `teams.stripe_test_account_id` for Exotiq is set to `acct_1TwYk2HpKoA2ZJg1`.
- Stripe account status: `details_submitted: false`, `charges_enabled: false`, `payouts_enabled: false`.
- You are on the Stripe test onboarding page selecting a payout bank.

## Immediate action (you do this)
1. On the “Select an account for payouts” screen, choose **Test (Non-OAuth)** (or any other green-check test bank).
2. Click **Continue** and complete the remaining Stripe test onboarding. In test mode you can use any fake data; Stripe pre-fills most fields.
3. When you reach the Stripe return page, you can close it and come back.

## After onboarding returns
4. Verify the account is live enough for destination charges by confirming Stripe reports `charges_enabled: true` and `payouts_enabled: true` for `acct_1TwYk2HpKoA2ZJg1`.
5. Register the **platform** webhook endpoint in the Stripe test dashboard (for the Exotiq platform account, not connected accounts):
   - URL: `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rent-payment-webhook`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
   - `RENT_PAYMENT_WEBHOOK_SECRET` is already saved; you just need the endpoint to exist and match it.
6. Backfill the inflated `total_value` on marketplace bookings created since 2026-07-22 (M6 bug) so analytics and checkout totals are correct.
7. Run a happy-path M6 smoke test:
   - Create a marketplace booking via the renter flow or RPC.
   - Call `rent-checkout` and pay with Stripe test card `4242 4242 4242 4242`.
   - Verify the booking transitions from `pending_payment` to `confirmed`.
   - Verify two Payment Intents are created: operator rental destination charge + Exotiq 10% fee/protection charge.
   - Confirm the operator ledger reflects the correct split.

## Out of scope for now
- Deposit-hold nicety (#11) connected-account webhook — handled separately after M6 core flows are green.
- Renter UI polish — owned by Claude in the exotiq-rent repo.

**Once you click Continue and finish the Stripe test onboarding, tell me and I’ll verify the account status, check the webhook, and run the first test booking.**