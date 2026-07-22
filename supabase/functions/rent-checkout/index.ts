// M6: rent-checkout — two-charge marketplace payment flow.
//
// Money flow (Gregory decision, 2026-07-22):
//   Exotiq Inc charge (immediate capture, non-refundable):
//     = platform_fee_10% + protection tier
//     Created on the Exotiq platform Stripe account.
//   Operator charge (manual-capture hold, released or captured at pickup):
//     = rental_subtotal + security_deposit
//     Created DIRECTLY on the operator's connected Stripe account so funds
//     settle on their own balance and appear on the renter's statement as
//     the operator's business name. NO application_fee_amount attached —
//     the 10% operator take is invoiced separately from their Stripe balance.
//
// Input:  { booking_ref, confirmation_token }
// Output: { exotiq: { payment_intent_id, client_secret, amount_cents },
//           operator: { payment_intent_id, client_secret, amount_cents,
//                       stripe_account_id },
//           currency }
//
// The frontend loads Stripe.js twice (once with the platform publishable key
// for the Exotiq PI, once with `stripeAccount: <operator_account>` for the
// operator PI) and confirms both with the same collected PaymentMethod.
//
// Idempotent: repeated calls with the same booking_ref return the existing
// PaymentIntents instead of creating new ones. If the operator PI cannot be
// created, the Exotiq PI is cancelled before we surface the error so the
// renter is never charged for a booking that can't be held.
//
// config.toml: verify_jwt = false (guest checkout; anon key passes gateway).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[RENT-CHECKOUT] ${step}${details ? " " + JSON.stringify(details) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const body = await req.json().catch(() => ({}));
    const bookingRef = String(body.booking_ref ?? "").trim();
    const token = String(body.confirmation_token ?? "").trim();
    if (!bookingRef || !token) {
      return json({ error: "booking_ref and confirmation_token are required" }, 400);
    }

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select(`
        id, booking_ref, confirmation_token, status, booking_source,
        team_id, vehicle_id, customer_email,
        total_value, exotiq_charge_cents, deposit_cents_snapshot,
        protection_cents_snapshot, protection_tier,
        exotiq_payment_intent_id, operator_payment_intent_id,
        teams!inner ( id, currency, stripe_account_id, stripe_charges_enabled, name )
      `)
      .eq("booking_ref", bookingRef)
      .maybeSingle();

    if (bErr || !booking) return json({ error: "Booking not found" }, 404);
    if (String(booking.confirmation_token) !== token) return json({ error: "Invalid confirmation token" }, 403);
    if (booking.booking_source !== "marketplace") return json({ error: "Not a marketplace booking" }, 400);

    const validStatuses = ["requested", "pending_documents", "pending_payment"];
    if (!validStatuses.includes(booking.status)) {
      return json({ error: `Booking is ${booking.status}; checkout unavailable` }, 409);
    }

    // deno-lint-ignore no-explicit-any
    const team = (booking as any).teams as {
      id: string;
      currency: string | null;
      stripe_account_id: string | null;
      stripe_charges_enabled: boolean;
      name: string;
    };

    if (!team.stripe_account_id || !team.stripe_charges_enabled) {
      return json({ error: "Operator payments not ready" }, 409);
    }

    const currency = (team.currency ?? "usd").toLowerCase();
    const exotiqAmount = Number(booking.exotiq_charge_cents ?? 0);
    // total_value already includes deposit (public_vehicle_quote sums them).
    const operatorAmount = Math.round(Number(booking.total_value ?? 0) * 100);

    if (exotiqAmount <= 0 || operatorAmount <= 0) {
      return json({ error: "Booking amounts are not set" }, 400);
    }

    const sharedMetadata = {
      booking_id: String(booking.id),
      booking_ref: booking.booking_ref,
      team_id: team.id,
      customer_email: booking.customer_email ?? "",
    };

    // 1. Exotiq Inc charge — immediate capture on the platform account.
    let exotiqPI: Stripe.PaymentIntent;
    if (booking.exotiq_payment_intent_id) {
      exotiqPI = await stripe.paymentIntents.retrieve(booking.exotiq_payment_intent_id);
      log("Reused Exotiq PI", { id: exotiqPI.id, status: exotiqPI.status });
    } else {
      exotiqPI = await stripe.paymentIntents.create(
        {
          amount: exotiqAmount,
          currency,
          capture_method: "automatic",
          description: `Exotiq booking ${booking.booking_ref} — platform fee + protection`,
          statement_descriptor_suffix: "EXOTIQ",
          metadata: {
            ...sharedMetadata,
            kind: "exotiq_platform",
            protection_tier: booking.protection_tier ?? "premium",
            protection_cents: String(booking.protection_cents_snapshot ?? 0),
          },
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey: `exotiq:${booking.id}` },
      );
      log("Created Exotiq PI", { id: exotiqPI.id, amount: exotiqAmount });
    }

    // 2. Operator charge — manual-capture hold, DIRECT charge on connected acct.
    let operatorPI: Stripe.PaymentIntent;
    try {
      if (booking.operator_payment_intent_id) {
        operatorPI = await stripe.paymentIntents.retrieve(
          booking.operator_payment_intent_id,
          undefined,
          { stripeAccount: team.stripe_account_id },
        );
        log("Reused operator PI", { id: operatorPI.id, status: operatorPI.status });
      } else {
        operatorPI = await stripe.paymentIntents.create(
          {
            amount: operatorAmount,
            currency,
            capture_method: "manual",
            description: `${team.name} booking ${booking.booking_ref} — rental + deposit`,
            metadata: {
              ...sharedMetadata,
              kind: "operator_rental_deposit",
              deposit_cents: String(booking.deposit_cents_snapshot ?? 0),
              exotiq_payment_intent: exotiqPI.id,
            },
            automatic_payment_methods: { enabled: true },
          },
          {
            stripeAccount: team.stripe_account_id,
            idempotencyKey: `operator:${booking.id}`,
          },
        );
        log("Created operator PI", { id: operatorPI.id, amount: operatorAmount });
      }
    } catch (opErr) {
      // Rollback: cancel Exotiq PI if we just created it and it's cancellable.
      if (!booking.exotiq_payment_intent_id && ["requires_payment_method", "requires_confirmation"].includes(exotiqPI.status)) {
        try { await stripe.paymentIntents.cancel(exotiqPI.id); } catch (_) { /* best effort */ }
      }
      log("Operator PI failed", { error: (opErr as Error).message });
      return json({ error: "Operator hold could not be created", detail: (opErr as Error).message }, 502);
    }

    // Persist PI ids + advance status to pending_payment for the renter to confirm.
    await admin
      .from("bookings")
      .update({
        exotiq_payment_intent_id: exotiqPI.id,
        operator_payment_intent_id: operatorPI.id,
        status: booking.status === "requested" ? "pending_payment" : booking.status,
      })
      .eq("id", booking.id);

    return json({
      exotiq: {
        payment_intent_id: exotiqPI.id,
        client_secret: exotiqPI.client_secret,
        amount_cents: exotiqAmount,
      },
      operator: {
        payment_intent_id: operatorPI.id,
        client_secret: operatorPI.client_secret,
        amount_cents: operatorAmount,
        stripe_account_id: team.stripe_account_id,
      },
      currency,
    });
  } catch (error) {
    console.error("[RENT-CHECKOUT] error", error);
    return json({ error: "Unable to start checkout", detail: (error as Error).message }, 500);
  }
});
