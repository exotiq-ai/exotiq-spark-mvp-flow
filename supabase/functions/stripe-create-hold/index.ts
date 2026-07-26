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

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const mode: "off_session" | "client_secret" = body.mode === "off_session" ? "off_session" : "client_secret";
    if (!booking_id) throw new Error("booking_id is required");
    if (Object.prototype.hasOwnProperty.call(body, "amount")) {
      throw new Error("amount is no longer accepted; deposit is resolved server-side from vehicle/tenant config");
    }

    logStep("Request", { booking_id, mode });

    // Booking-scoped auth: derive team from the booking, not the caller.
    const { data: booking, error: bookingErr } = await supabaseClient
      .from("bookings")
      .select("id, vehicle_id, team_id, booking_ref, deposit_hold_attempt, operator_stripe_customer_id")
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

    const { data: depositCentsRaw, error: depErr } = await supabaseClient
      .rpc("resolve_deposit_cents", { _vehicle_id: booking.vehicle_id });
    if (depErr) throw depErr;
    const depositCents = Number(depositCentsRaw);
    if (!Number.isFinite(depositCents) || depositCents <= 0) {
      throw new Error("Could not resolve deposit amount for this vehicle");
    }

    const currency = (team.currency || "USD").toLowerCase();
    const platformFee = 0; // D1: operator-owned deposits, no application fee.

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // ---- OFF-SESSION path: use the renter's saved PM on the connected account.
    if (mode === "off_session") {
      const connectedCustomerId = booking.operator_stripe_customer_id;
      if (!connectedCustomerId) {
        return jsonResponse({
          error: "no_card_on_file",
          message: "Renter hasn't added a card to the operator's account yet.",
        }, 409);
      }

      const pms = await stripe.paymentMethods.list(
        { customer: connectedCustomerId, type: "card", limit: 1 },
        { stripeAccount: team.stripe_account_id }
      );
      const pm = pms.data[0];
      if (!pm) {
        return jsonResponse({
          error: "no_card_on_file",
          message: "Renter hasn't added a card to the operator's account yet.",
        }, 409);
      }

      const attempt = (booking.deposit_hold_attempt ?? 0) + 1;
      await supabaseClient.from("bookings").update({ deposit_hold_attempt: attempt }).eq("id", booking_id);

      try {
        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: depositCents,
            currency,
            capture_method: "manual",
            customer: connectedCustomerId,
            payment_method: pm.id,
            off_session: true,
            confirm: true,
            description: description || `Security deposit hold — booking ${booking.booking_ref ?? booking_id}`,
            metadata: {
              booking_id,
              vehicle_id: booking.vehicle_id,
              user_id: user.id,
              team_id: booking.team_id,
              type: "security_deposit_hold",
              deposit_source: "resolve_deposit_cents",
              mode: "off_session",
            },
          },
          {
            stripeAccount: team.stripe_account_id,
            idempotencyKey: `deposit-hold-${booking.booking_ref ?? booking_id}-${attempt}`,
          }
        );

        const amountDollars = depositCents / 100;
        await supabaseClient.from("payments").insert({
          booking_id,
          user_id: user.id,
          amount: amountDollars,
          payment_type: "security_deposit",
          payment_method: "stripe",
          payment_status: paymentIntent.status === "requires_capture" ? "pending" : paymentIntent.status,
          stripe_payment_intent_id: paymentIntent.id,
          hold_status: paymentIntent.status === "requires_capture" ? "authorized" : paymentIntent.status,
          original_amount: amountDollars,
          platform_fee: 0,
          team_id: booking.team_id,
          transaction_date: new Date().toISOString(),
        });

        logStep("Hold created (off_session)", { piId: paymentIntent.id, status: paymentIntent.status, attempt });

        return jsonResponse({
          payment_intent_id: paymentIntent.id,
          status: paymentIntent.status,
          amount_cents: depositCents,
          attempt,
        }, 200);
      } catch (err) {
        const anyErr = err as { code?: string; raw?: { code?: string; payment_intent?: { id?: string } }; message?: string };
        const code = anyErr?.code ?? anyErr?.raw?.code;
        if (code === "authentication_required") {
          logStep("Off-session declined: authentication_required", { attempt });
          return jsonResponse({
            error: "authentication_required",
            requires_action: true,
            message: "Renter must confirm this card (SCA/3DS). Re-send the setup link.",
            payment_intent_id: anyErr?.raw?.payment_intent?.id ?? null,
            attempt,
          }, 402);
        }
        throw err;
      }
    }

    // ---- CLIENT_SECRET fallback: card-present flow (staff collects the card at the counter).
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
        mode: "client_secret",
      },
    };
    if (platformFee > 0) piParams.application_fee_amount = platformFee;

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
      // Remember the connected-account customer for future off_session holds.
      if (piParams.customer && !booking.operator_stripe_customer_id) {
        await supabaseClient
          .from("bookings")
          .update({ operator_stripe_customer_id: piParams.customer as string })
          .eq("id", booking_id);
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(
      piParams,
      { stripeAccount: team.stripe_account_id }
    );

    logStep("Hold created (client_secret)", { piId: paymentIntent.id, amountCents: depositCents });

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

    return jsonResponse({
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount_cents: depositCents,
    }, 200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return jsonResponse({ error: errorMessage }, 500);
  }
});
