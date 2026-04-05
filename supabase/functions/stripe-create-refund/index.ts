import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-CREATE-REFUND] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
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

    const { payment_intent_id, amount, reason } = await req.json();
    if (!payment_intent_id) throw new Error("payment_intent_id is required");

    const validReasons = ["duplicate", "fraudulent", "requested_by_customer", "damage_deduction"];
    if (reason && !validReasons.includes(reason)) {
      throw new Error(`Invalid reason. Must be one of: ${validReasons.join(", ")}`);
    }

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

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: payment_intent_id,
    };

    if (amount && amount > 0) {
      refundParams.amount = Math.round(amount * 100);
    }

    // Map custom reasons to Stripe-valid reasons
    const stripeReason = reason === "damage_deduction" ? "requested_by_customer" : reason;
    if (stripeReason && ["duplicate", "fraudulent", "requested_by_customer"].includes(stripeReason)) {
      refundParams.reason = stripeReason as Stripe.RefundCreateParams.Reason;
    }

    const refund = await stripe.refunds.create(
      refundParams,
      { stripeAccount: team.stripe_account_id }
    );

    logStep("Refund created", { refundId: refund.id, amount: refund.amount });

    // Update payment record
    await supabaseClient
      .from("payments")
      .update({
        stripe_refund_id: refund.id,
        refund_amount: refund.amount / 100,
        refund_reason: reason || null,
        payment_status: refund.amount === (await stripe.paymentIntents.retrieve(
          payment_intent_id,
          { stripeAccount: team.stripe_account_id }
        )).amount ? "refunded" : "partially_refunded",
      })
      .eq("stripe_payment_intent_id", payment_intent_id);

    return new Response(JSON.stringify({
      refund_id: refund.id,
      amount_refunded: refund.amount / 100,
      status: refund.status,
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
