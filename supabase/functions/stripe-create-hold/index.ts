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

    const { booking_id, amount, customer_email, customer_name, description } = await req.json();
    if (!booking_id || !amount || amount <= 0) throw new Error("booking_id and positive amount are required");

    logStep("Request", { booking_id, amount });

    // Get team and stripe account
    const { data: teamMember } = await supabaseClient
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!teamMember) throw new Error("No team found");

    const { data: team } = await supabaseClient
      .from("teams")
      .select("stripe_account_id, stripe_charges_enabled")
      .eq("id", teamMember.team_id)
      .single();

    if (!team?.stripe_account_id) throw new Error("Stripe account not connected. Please complete onboarding first.");
    if (!team.stripe_charges_enabled) throw new Error("Stripe account is not yet enabled for charges. Please complete onboarding.");

    // Check booking source for fee calculation
    const { data: booking } = await supabaseClient
      .from("bookings")
      .select("booking_source")
      .eq("id", booking_id)
      .single();

    const isMarketplace = booking?.booking_source === 'marketplace';
    const platformFee = isMarketplace ? Math.round(amount * 100 * 0.20) : 0;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Create PaymentIntent with manual capture on connected account
    const piParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100),
      currency: "usd",
      capture_method: "manual",
      description: description || `Security deposit hold for booking ${booking_id.substring(0, 8)}`,
      metadata: {
        booking_id,
        user_id: user.id,
        team_id: teamMember.team_id,
        type: "security_deposit_hold",
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

    logStep("Hold created", { piId: paymentIntent.id, clientSecret: "***" });

    // Record in payments table
    await supabaseClient.from("payments").insert({
      booking_id,
      user_id: user.id,
      amount,
      payment_type: "security_deposit",
      payment_method: "stripe",
      payment_status: "pending",
      stripe_payment_intent_id: paymentIntent.id,
      hold_status: "pending",
      original_amount: amount,
      platform_fee: platformFee / 100,
      team_id: teamMember.team_id,
      transaction_date: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
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
