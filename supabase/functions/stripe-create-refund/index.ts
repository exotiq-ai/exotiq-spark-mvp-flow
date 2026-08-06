import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { teamConnectedAccountId } from "../_shared/stripeMode.ts";

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

    // Owner/Admin only — refunds move real money.
    const { data: roleRows } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    if (!roles.includes("owner") && !roles.includes("admin")) {
      return new Response(JSON.stringify({ error: "Forbidden — owner or admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // The payment intent must belong to a booking on the caller's team.
    const { data: ownerBooking } = await supabaseClient
      .from("bookings")
      .select("id, team_id, booking_source")
      .or(
        `operator_payment_intent_id.eq.${payment_intent_id},exotiq_payment_intent_id.eq.${payment_intent_id}`,
      )
      .limit(1)
      .maybeSingle();

    if (!ownerBooking) {
      // Fall back to the direct payments ledger for non-marketplace charges.
      const { data: paymentRow } = await supabaseClient
        .from("payments")
        .select("id, team_id")
        .eq("stripe_payment_intent_id", payment_intent_id)
        .limit(1)
        .maybeSingle();
      if (!paymentRow || paymentRow.team_id !== teamMember.team_id) {
        return new Response(
          JSON.stringify({ error: "Payment intent not found for this team" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      if (ownerBooking.team_id !== teamMember.team_id) {
        return new Response(
          JSON.stringify({ error: "Payment intent not found for this team" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (ownerBooking.booking_source === "marketplace") {
        return new Response(
          JSON.stringify({
            error:
              "Marketplace bookings must be refunded via rent-refund-booking so both legs and extensions are walked",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { data: team } = await supabaseClient
      .from("teams")
      .select("stripe_account_id, stripe_test_account_id")
      .eq("id", teamMember.team_id)
      .single();
    const stripeAccountId = teamConnectedAccountId(team ?? { stripe_account_id: null, stripe_test_account_id: null });


    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: payment_intent_id,
    };

    if (amount && amount > 0) {
      // Clamp to what is actually still refundable on the intent. Without this
      // a caller can request an arbitrary amount and Stripe errors out (or, on
      // partially-refunded intents, the UI silently over-reports).
      const pi = await stripe.paymentIntents.retrieve(
        payment_intent_id,
        { expand: ["latest_charge"] },
        { stripeAccount: stripeAccountId },
      );
      const charge = pi.latest_charge as Stripe.Charge | null;
      const capturedCents = charge?.amount_captured ?? pi.amount_received ?? 0;
      const alreadyRefundedCents = charge?.amount_refunded ?? 0;
      const refundableCents = Math.max(0, capturedCents - alreadyRefundedCents);

      if (refundableCents === 0) {
        return new Response(
          JSON.stringify({ error: "This payment has already been fully refunded" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const requestedCents = Math.round(amount * 100);
      if (requestedCents > refundableCents) {
        return new Response(
          JSON.stringify({
            error: "Refund amount exceeds the remaining refundable balance",
            max_refundable: refundableCents / 100,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      refundParams.amount = requestedCents;
    }


    // Map custom reasons to Stripe-valid reasons
    const stripeReason = reason === "damage_deduction" ? "requested_by_customer" : reason;
    if (stripeReason && ["duplicate", "fraudulent", "requested_by_customer"].includes(stripeReason)) {
      refundParams.reason = stripeReason as Stripe.RefundCreateParams.Reason;
    }

    const refund = await stripe.refunds.create(
      refundParams,
      { stripeAccount: stripeAccountId }
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
          { stripeAccount: stripeAccountId }
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
