

# Store STRIPE_WEBHOOK_SECRET

## What happens next

When I switch to implementation mode, I'll use the `add_secret` tool to securely prompt you to paste your webhook signing secret (`whsec_...`). It will be stored as `STRIPE_WEBHOOK_SECRET` and made available to the `stripe-webhook` edge function at runtime.

## No code changes needed

The `stripe-webhook` edge function already references `Deno.env.get("STRIPE_WEBHOOK_SECRET")` — once the secret is stored, the webhook will immediately start validating Stripe signatures.

## After storing

I'll deploy the `stripe-webhook` function and run a quick test to confirm it responds correctly.

