// Ops-callable retry for a declined Exotiq fee+protection leg.
// Ref: M6 handoff #9. The webhook's per-leg idempotency key locks in a
// decline for 24h; this endpoint bumps exotiq_leg_attempt and retries with
// a fresh key against the customer's saved payment method (from the
// original on-session Checkout).
//
// Auth: JWT-gated; caller must be a member of the booking's team (checked
// via has_role helper). No renter-facing invocation.
//
// config.toml: verify_jwt = true (default).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveStripeMode } from "../_shared/stripeMode.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { booking_ref?: string };
  try { body = await req.json(); } catch { body = {}; }
  const bookingRef = body.booking_ref?.trim();
  if (!bookingRef) {
    return new Response(JSON.stringify({ error: "booking_ref required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: authData } = await userClient.auth.getUser();
  if (!authData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, team_id, status, booking_source, platform_fee_cents, protection_total_cents, state_fee_cents, processing_fee_cents, operator_payment_intent_id, exotiq_payment_intent_id, exotiq_leg_attempt",
    )
    .eq("booking_ref", bookingRef)
    .maybeSingle();

  if (!booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Team-membership check.
  const { data: isMember } = await admin
    .from("team_members")
    .select("id")
    .eq("team_id", booking.team_id)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!isMember) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (booking.booking_source !== "marketplace") {
    return new Response(JSON.stringify({ error: "Not a marketplace booking" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!booking.operator_payment_intent_id) {
    return new Response(JSON.stringify({ error: "Rental leg not captured yet" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (booking.exotiq_payment_intent_id && booking.exotiq_payment_intent_id !== "none_required") {
    return new Response(JSON.stringify({ error: "Exotiq leg already recorded" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Must match rent-payment-webhook's Exotiq leg exactly: fee + protection +
  // state fee + processing fee. Dropping the last two silently undercharges.
  const exotiqCents =
    Number(booking.platform_fee_cents ?? 0)
    + Number(booking.protection_total_cents ?? 0)
    + Number(booking.state_fee_cents ?? 0)
    + Number(booking.processing_fee_cents ?? 0);
  if (exotiqCents <= 0) {
    return new Response(JSON.stringify({ error: "Nothing to charge" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
  const rentalPi = await stripe.paymentIntents.retrieve(booking.operator_payment_intent_id);
  const paymentMethod = typeof rentalPi.payment_method === "string"
    ? rentalPi.payment_method
    : rentalPi.payment_method?.id;
  const customer = typeof rentalPi.customer === "string" ? rentalPi.customer : rentalPi.customer?.id;
  if (!paymentMethod || !customer) {
    return new Response(JSON.stringify({ error: "No saved card on the rental PI" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const mode = resolveStripeMode();
  const attempt = ((booking.exotiq_leg_attempt as number | null) ?? 0) + 1;
  await admin.from("bookings").update({ exotiq_leg_attempt: attempt }).eq("id", booking.id);

  try {
    const exotiqPi = await stripe.paymentIntents.create(
      {
        amount: exotiqCents,
        currency: rentalPi.currency,
        customer,
        payment_method: paymentMethod,
        off_session: true,
        confirm: true,
        statement_descriptor_suffix: "EXOTIQ RENT",
        description: `Exotiq booking fees + protection — ${bookingRef} (retry ${attempt})`,
        metadata: {
          booking_ref: bookingRef,
          leg: "exotiq_fee_protection",
          stripe_mode: mode,
          attempt: String(attempt),
          retry_by: authData.user.id,
        },
      },
      { idempotencyKey: `exotiq-leg-${bookingRef}-${attempt}` },
    );

    await admin
      .from("bookings")
      .update({ exotiq_payment_intent_id: exotiqPi.id })
      .eq("id", booking.id);

    return new Response(JSON.stringify({ ok: true, status: exotiqPi.status, attempt }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: "Retry declined",
      attempt,
      detail: err instanceof Error ? err.message : String(err),
    }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
