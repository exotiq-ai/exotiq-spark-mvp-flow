## M6 Money Milestone — Current state

- **Test Connect account**: `teams.stripe_test_account_id` for Exotiq is set to `acct_1TwYk2HpKoA2ZJg1`.
- **Webhook endpoint**: Created/rotated in Stripe test mode and pointing to `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rent-payment-webhook`.
- **Webhook secret**: `RENT_PAYMENT_WEBHOOK_SECRET` is saved and bound to the edge functions.
- **Data backfill**: Inflated `total_value` on marketplace bookings BK-03435, BK-03436, BK-03437 (created 2026-07-22) has been corrected to rental-subtotal only.
- **Stripe account status**: `details_submitted: false`, `charges_enabled: false`, `payouts_enabled: false` — still waiting for test onboarding completion.

## Immediate action (you do this)

1. On the Stripe “Select an account for payouts” screen, choose **Test (Non-OAuth)** (or any other green-check test bank).
2. Click **Continue** and finish the remaining test onboarding. Stripe pre-fills most fields in test mode; any fake data works.
3. When you reach the Stripe return page, close it and come back.

## After onboarding returns

4. I will verify Stripe reports `charges_enabled: true` and `payouts_enabled: true` for `acct_1TwYk2HpKoA2ZJg1`.
5. I will run a happy-path M6 smoke test:
   - Create a marketplace booking via the renter flow or RPC.
   - Call `rent-checkout` and pay with Stripe test card `4242 4242 4242 4242`.
   - Verify the booking transitions from `pending_payment` to `confirmed`.
   - Verify two Payment Intents are created: operator rental destination charge + Exotiq 10% fee/protection charge.
   - Confirm the operator ledger reflects the correct split.

## Out of scope for now

- Deposit-hold nicety (#11) connected-account webhook — handled separately after M6 core flows are green.
- Renter UI polish — owned by Claude in the exotiq-rent repo.

**Once you finish Stripe test onboarding, just say “done” and I’ll verify the account and run the first test booking.**
