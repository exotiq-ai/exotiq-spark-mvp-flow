
# Update Stripe Secret Key to Live Mode

## What We're Doing
Updating the `STRIPE_SECRET_KEY` from sandbox (`sk_test_...`) to your live production key (`sk_live_...`).

## Steps

### 1. Open the Secret Update Modal
- Use the `update_stripe_secret_key` tool to open a secure modal
- You'll paste your live key there

### 2. Verify the Key Format
- Live keys start with `sk_live_...`
- The system will validate the format

### 3. Test the Connection
- After updating, verify the key works by checking your Stripe account info

## What Happens After
Once the live key is active:
- All Edge Functions will immediately start processing **real transactions**
- Your sandbox products/prices won't work anymore
- You'll need to update all hardcoded Product IDs and Price IDs in the codebase to match your live Stripe products

## Important Reminders
- Make sure your live webhook endpoint is configured in Stripe dashboard
- Update `STRIPE_WEBHOOK_SECRET` to the live webhook's signing secret (separate step)
- Have your live Product IDs and Price IDs ready for the next update

## Ready When You Are
I'll call the tool to open the secret update modal. You can then paste your live key.
