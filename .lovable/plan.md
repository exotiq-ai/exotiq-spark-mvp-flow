# Fix "Connect Stripe Account" Edge Function Error

## What's actually happening

When you click **Connect Stripe Account**, our `stripe-connect-onboard` edge function calls `stripe.accounts.create({ type: "express", capabilities: { card_payments, transfers } })`. Stripe rejects that call with:

> **"Please review the responsibilities of managing losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile."**

That's a platform-level configuration requirement, **not a code bug**. The function is working correctly and refusing to silently create a broken account. Because the call throws, our function returns a 500 — which the frontend surfaces as the generic "Edge Function returned a non-2xx status code" toast.

The error has been firing for both of your test clicks (12:09:24 and 12:10:18 UTC), confirming it's reproducible and configuration-driven.

## Root cause

To request the `card_payments` capability on an Express connected account, Stripe requires the **platform** (your Exotiq Stripe account) to:
1. Complete the Connect **Platform Profile**.
2. Acknowledge **loss liability** for connected accounts — i.e. confirm Exotiq is responsible for handling chargebacks, refunds, and negative balances on tenant accounts.

This is a one-time setup per Stripe account (you have to do it once for test mode and once for live mode). Without it, Stripe will reject every `accounts.create` call with `card_payments` requested.

## Fix — two parts

### Part 1: You complete the Stripe Dashboard setup (5 minutes, manual)

1. Open https://dashboard.stripe.com/settings/connect/platform-profile (make sure the **test mode** toggle matches the key currently in `STRIPE_SECRET_KEY` — if that key is a `sk_test_...` key, you're in test mode).
2. Fill out the Platform Profile sections Stripe asks for:
   - Business model / how connected accounts are used
   - Industries served
   - Volume estimates
3. **Critically**, in the "Responsibilities" / "Loss liability" section, accept that Exotiq (the platform) is responsible for losses on connected accounts.
4. Save.
5. Repeat the same steps in **live mode** before you ever take a real tenant through Connect.

Once that profile is saved, `accounts.create` calls will succeed immediately — no redeploy needed on our side.

### Part 2: I make the error surface clearly (code change)

Right now any Stripe rejection becomes a generic toast. I'll update `supabase/functions/stripe-connect-onboard/index.ts` so that:

- We catch the specific "platform-profile" error and return a structured **409 Conflict** response with a clear human message and a deep link to the Stripe settings page, instead of a bare 500.
- We catch any other Stripe error and pass the actual Stripe message through to the response body, so the UI shows something actionable instead of "non-2xx".

Then update `src/components/settings/PaymentMethodsSection.tsx` `handleConnectStripe` to:

- Read `data?.error` (and the new `error_code`) from the function response — `supabase.functions.invoke` returns the JSON body even on non-2xx, we just weren't using it.
- When `error_code === "platform_profile_incomplete"`, show a specific toast: "Platform setup required — your Stripe Connect platform profile needs to be completed before tenants can connect. Open Stripe settings →" with a link button.
- For any other error, surface the actual Stripe message instead of the generic one.

This way, if Stripe ever rejects an onboarding call for *any* reason (KYC, missing capability, country restriction, etc.), the operator sees what to actually do.

## What I'm explicitly NOT changing

- **The `card_payments` capability.** Removing it to dodge the loss-liability requirement would break the whole tenant payment model (no card charges, no holds, no marketplace fees). Loss-liability acceptance is the correct architectural choice for what Exotiq does.
- **Switching to Standard accounts** (which avoid some of this). Express is the right call for the in-app onboarding UX we already built.
- **Touching `card_payments: { requested: true }`** or any other capability — they're correct as-is.

## Files touched

- `supabase/functions/stripe-connect-onboard/index.ts` — better error mapping (Stripe error → structured 409 with `error_code`).
- `src/components/settings/PaymentMethodsSection.tsx` — `handleConnectStripe` reads the structured error and shows an actionable toast with a link to Stripe's settings page.

## Validation

1. **Before you complete the dashboard step:** click Connect Stripe Account → confirm the new toast says "Platform setup required" with a working link to `https://dashboard.stripe.com/settings/connect/platform-profile`, not the generic "non-2xx".
2. **After you complete the dashboard step:** click Connect Stripe Account → Stripe Express onboarding opens in a new tab. Complete it in test mode. Return URL handler (already shipped last turn) flips the badge to **Active** within ~10s.
3. Check `stripe-connect-onboard` logs — should show `Account link created` instead of `ERROR`.

## Risk

Zero risk on the code side — error handling change only, no behavior change to the happy path. The dashboard step is a Stripe-side configuration with no code impact.
