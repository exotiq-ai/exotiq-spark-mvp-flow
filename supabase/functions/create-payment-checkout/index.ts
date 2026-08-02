import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { teamConnectedAccountId } from "../_shared/stripeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const {
      booking_id, customer_id, customer_email, customer_name,
      amount, payment_type, description
    } = await req.json();

    logStep("Request body parsed", { booking_id, amount, payment_type, customer_email });

    if (!booking_id) throw new Error("booking_id is required");
    if (!amount || amount <= 0) throw new Error("Invalid payment amount");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Booking-scoped auth: resolve team from the booking, NOT the caller's
    // first team membership. Prevents cross-tenant charge routing when a user
    // belongs to multiple teams.
    const { data: booking, error: bookingErr } = await supabaseClient
      .from("bookings")
      .select("id, team_id, booking_source, status")
      .eq("id", booking_id)
      .maybeSingle();
    if (bookingErr) throw new Error(`Booking lookup error: ${bookingErr.message}`);
    if (!booking) throw new Error("Booking not found");

    // Hard refuse marketplace bookings: those go through rent-checkout so the
    // Exotiq fee leg + platform routing happen. A manual Record Payment here
    // would bill the operator's account with no fee split and no on_behalf_of.
    if (booking.booking_source === "marketplace") {
      return new Response(
        JSON.stringify({
          error: "Marketplace bookings cannot be charged manually. The renter pays via the marketplace checkout link.",
          code: "marketplace_manual_charge_blocked",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
      );
    }

    // Assert active membership in THIS booking's team.
    const { data: membership, error: memErr } = await supabaseClient
      .from("team_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("team_id", booking.team_id)
      .eq("is_active", true)
      .maybeSingle();
    if (memErr) throw new Error(`Membership lookup error: ${memErr.message}`);
    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Not authorized for this booking's team." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 },
      );
    }

    const teamId = booking.team_id;

    const { data: team, error: teamError } = await supabaseClient
      .from("teams")
      .select("stripe_account_id, stripe_test_account_id, stripe_charges_enabled, currency")
      .eq("id", teamId)
      .single();

    if (teamError) throw new Error(`Team fetch error: ${teamError.message}`);

    // Mode-aware: routes to the live or test connected account based on the
    // current Stripe key. Hard-fails on missing mapping.
    const stripeAccountId = teamConnectedAccountId(team);

    if (!team.stripe_charges_enabled) {
      return new Response(
        JSON.stringify({
          error: "Your Stripe account is not yet enabled for charges. Please complete onboarding in Settings → Payments.",
          code: "stripe_charges_disabled",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
      );
    }

    // Tenant currency drives Stripe checkout currency. Defaults to USD so
    // existing US tenants see identical behaviour.
    const currency: string = (team.currency || "USD").toLowerCase();

    // DECISION D1 (2026-07-15, docs/rent/DECISIONS.md): the legacy hardcoded
    // 20% marketplace application fee is retired. The Exotiq booking fee is a
    // renter-side charge handled in rent-checkout; operator-initiated direct
    // charges take no application fee.
    const platformFee = 0;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const stripeOpts = { stripeAccount: stripeAccountId };

    // Find or create customer
    let stripeCustomerId: string | undefined;
    if (customer_email) {
      const customers = await stripe.customers.list({ email: customer_email, limit: 1 }, stripeOpts);
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        logStep("Found existing Stripe customer", { stripeCustomerId });
      } else {
        const newCustomer = await stripe.customers.create({
          email: customer_email,
          name: customer_name,
          metadata: { supabase_customer_id: customer_id || '', booking_id: booking_id || '' }
        }, stripeOpts);
        stripeCustomerId = newCustomer.id;
        logStep("Created new Stripe customer", { stripeCustomerId });
      }
    }

    // Return the operator to the real app. Lovable preview origins are
    // storage-partitioned, so a top-level return there has no session and
    // bounces to /auth — always fall back to the canonical app URL.
    const rawOrigin = req.headers.get("origin") || "";
    const isPreviewOrigin = /lovable\.app$|localhost|127\.0\.0\.1/.test(rawOrigin);
    const origin = rawOrigin && !isPreviewOrigin ? rawOrigin : "https://app.exotiq.ai";


    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : customer_email,
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: `${payment_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} - Booking`,
            description: description || `Payment for booking ${booking_id?.substring(0, 8) || 'N/A'}`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/dashboard?payment=success&booking_id=${booking_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?payment=cancelled&booking_id=${booking_id}`,
      metadata: {
        booking_id: booking_id || '',
        customer_id: customer_id || '',
        payment_type: payment_type,
        user_id: user.id,
        team_id: teamId || '',
        platform_fee: String(platformFee / 100),
      },
      payment_intent_data: {
        metadata: {
          booking_id: booking_id || '',
          customer_id: customer_id || '',
          payment_type: payment_type,
          user_id: user.id,
        },
        ...(platformFee > 0 ? { application_fee_amount: platformFee } : {}),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams, stripeOpts);
    logStep("Checkout session created", { sessionId: session.id, connected: !!stripeAccountId });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
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
