import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-CREATE-HOLD] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const body = await req.json();
    const { booking_id, customer_email, customer_name, description } = body;
    if (!booking_id) throw new Error("booking_id is required");

    // Reject stale callers that still supply amount — the deposit amount is
    // resolved server-side via resolve_deposit_cents(vehicle_id) so a client
    // cannot set its own hold. Fail loudly instead of silently overriding.
    if (Object.prototype.hasOwnProperty.call(body, "amount")) {
      throw new Error("amount is no longer accepted; deposit is resolved server-side from vehicle/tenant config");
    }

    logStep("Request", { booking_id });

    // Load the booking to derive vehicle_id and team_id. Team is the
    // BOOKING's team (not the caller's), so users in multiple teams cannot
    // cross-place a hold. Caller must be a member of that team.
    const { data: booking, error: bookingErr } = await supabaseClient
      .from("bookings")
      .select("id, vehicle_id, team_id")
      .eq("id", booking_id)
      .maybeSingle();
    if (bookingErr) throw bookingErr;
    if (!booking) throw new Error("Booking not found");
    if (!booking.vehicle_id) throw new Error("Booking has no vehicle");

    const { data: membership, error: memErr } = await supabaseClient
      .from("team_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("team_id", booking.team_id)
      .eq("is_active", true)
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership) throw new Error("Not authorized for this booking's team");

    const { data: team, error: teamErr } = await supabaseClient
      .from("teams")
      .select("stripe_account_id, stripe_charges_enabled, currency")
      .eq("id", booking.team_id)
      .single();
    if (teamErr) throw teamErr;
    if (!team?.stripe_account_id) throw new Error("Stripe account not connected. Please complete onboarding first.");
    if (!team.stripe_charges_enabled) throw new Error("Stripe account is not yet enabled for charges. Please complete onboarding.");

    // Server-authoritative deposit amount — cents. Fallback chain lives in
    // the RPC (vehicle override → tenant default → $1,000 platform floor).
    const { data: depositCentsRaw, error: depErr } = await supabaseClient
      .rpc("resolve_deposit_cents", { _vehicle_id: booking.vehicle_id });
    if (depErr) throw depErr;
    const depositCents = Number(depositCentsRaw);
    if (!Number.isFinite(depositCents) || depositCents <= 0) {
      throw new Error("Could not resolve deposit amount for this vehicle");
    }

    // Tenant currency drives the hold currency. Defaults to USD so existing
    // US tenants see identical behaviour.
    const currency = (team.currency || "USD").toLowerCase();

    // DECISION D1 (2026-07-15, docs/rent/DECISIONS.md): deposits are
    // operator-owned and excluded from the Exotiq application fee.
    const platformFee = 0;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // resolve_deposit_cents returns CENTS — do NOT multiply by 100.
    const piParams: Stripe.PaymentIntentCreateParams = {
      amount: depositCents,
      currency,
      capture_method: "manual",
      description: description || `Security deposit hold for booking ${String(booking_id).substring(0, 8)}`,
      metadata: {
        booking_id,
        vehicle_id: booking.vehicle_id,
        user_id: user.id,
        team_id: booking.team_id,
        type: "security_deposit_hold",
        deposit_source: "resolve_deposit_cents",
      },
    };

    if (platformFee > 0) {
      piParams.application_fee_amount = platformFee;
    }

    // Find or create customer on connected account
    if (customer_email) {
      const customers = await stripe.customers.list(
        { email: customer_email, limit: 1 },
        { stripeAccount: team.stripe_account_id }
      );
      if (customers.data.length > 0) {
        piParams.customer = customers.data[0].id;
      } else {
        const newCustomer = await stripe.customers.create(
          { email: customer_email, name: customer_name },
          { stripeAccount: team.stripe_account_id }
        );
        piParams.customer = newCustomer.id;
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(
      piParams,
      { stripeAccount: team.stripe_account_id }
    );

    logStep("Hold created", { piId: paymentIntent.id, amountCents: depositCents });

    // payments.amount is a DOLLAR column — convert cents back down.
    const amountDollars = depositCents / 100;
    await supabaseClient.from("payments").insert({
      booking_id,
      user_id: user.id,
      amount: amountDollars,
      payment_type: "security_deposit",
      payment_method: "stripe",
      payment_status: "pending",
      stripe_payment_intent_id: paymentIntent.id,
      hold_status: "pending",
      original_amount: amountDollars,
      platform_fee: platformFee / 100,
      team_id: booking.team_id,
      transaction_date: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount_cents: depositCents,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
