import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-CAPTURE-HOLD] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
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

    const { payment_intent_id, capture_amount } = await req.json();
    if (!payment_intent_id) throw new Error("payment_intent_id is required");

    // Get team's stripe account
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
      .select("stripe_account_id")
      .eq("id", teamMember.team_id)
      .single();
    if (!team?.stripe_account_id) throw new Error("Stripe account not connected");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const captureParams: Stripe.PaymentIntentCaptureParams = {};
    if (capture_amount && capture_amount > 0) {
      captureParams.amount_to_capture = Math.round(capture_amount * 100);
    }

    const captured = await stripe.paymentIntents.capture(
      payment_intent_id,
      captureParams,
      { stripeAccount: team.stripe_account_id }
    );

    logStep("Hold captured", { piId: captured.id, amount: captured.amount_received });

    // Update payment record
    await supabaseClient
      .from("payments")
      .update({
        hold_status: "captured",
        amount: captured.amount_received / 100,
        payment_status: "completed",
      })
      .eq("stripe_payment_intent_id", payment_intent_id);

    return new Response(JSON.stringify({
      status: "captured",
      amount_captured: captured.amount_received / 100,
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
