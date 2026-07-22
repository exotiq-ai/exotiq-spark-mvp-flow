## Redeploy create-payment-checkout + stripe-create-hold and verify D1 (no 20% fee)

Repo `main` versions of both functions already have the 20% hardcode retired (`platformFee = 0`, `application_fee_amount` only attached when `> 0`). This plan redeploys them to Lovable Cloud and confirms behavior.

### Steps

1. **Redeploy both functions**
   - `supabase--deploy_edge_functions` with `["create-payment-checkout", "stripe-create-hold"]`.

2. **Smoke-check `create-payment-checkout` responds**
   - `supabase--curl_edge_functions` POST with an empty/invalid body.
   - Expect a controlled 4xx/5xx JSON error (e.g. "Invalid payment amount" or auth error), NOT `function-not-found`. This confirms boot.

3. **Smoke-check `stripe-create-hold` responds**
   - Same technique: POST with minimal body; expect a controlled JSON error, not a boot failure.

4. **Confirm no application_fee_amount on a real deposit hold**
   - Use `supabase--curl_edge_functions` to call `stripe-create-hold` while signed in as the Exotiq preview user (auto-injected auth), with a small test amount (e.g. `$1.00`) and a throwaway `booking_id` string. Exotiq is now on a fully live Connect account, so the resulting PaymentIntent is real but manual-capture and immediately releasable.
   - Capture `payment_intent_id` from the response.
   - `stripe--stripe_api_read` on the returned PaymentIntent (on the connected account `acct_1TvnfgQfNJmCrgjR`) and confirm `application_fee_amount` is **null / absent**.
   - Immediately call `stripe-release-hold` (or `stripe--stripe_api_write` cancel) to release the $1 hold so nothing lingers.
   - Also verify the corresponding row in `payments` has `platform_fee = 0`.

5. **Read recent logs** for both functions via `supabase--edge_function_logs` to confirm the new build is live (look for absence of any "platformFee: 20%" style log lines and presence of the new `[STRIPE-CREATE-HOLD]` / `[CREATE-PAYMENT-CHECKOUT]` traces).

6. **Report results** with: deploy status, HTTP status of each smoke call, the PaymentIntent's `application_fee_amount` value, and the `payments.platform_fee` value.

### Not in scope

- No code edits — repo `main` is already correct.
- No changes to `stripe-webhook`, `stripe-capture-hold`, or `stripe-release-hold`.
- Renter-side 10% separate charge (M6) is a future task, not this deploy.

### Risk

Low. Test hold is $1, manual-capture, released within the same turn. Uses the live Exotiq Connect account only because that's where the fee-attach behavior actually needs to be verified in production configuration.