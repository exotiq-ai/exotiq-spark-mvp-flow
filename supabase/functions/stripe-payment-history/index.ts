import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-PAYMENT-HISTORY] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

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
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { limit = 50, starting_after } = await req.json().catch(() => ({}));

    // Get team and connected Stripe account
    const { data: teamMember } = await supabaseClient
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    let stripeAccountId: string | null = null;
    let teamId: string | null = null;

    if (teamMember) {
      teamId = teamMember.team_id;
      const { data: team } = await supabaseClient
        .from("teams")
        .select("stripe_account_id, stripe_charges_enabled")
        .eq("id", teamMember.team_id)
        .single();
      if (team?.stripe_account_id && team?.stripe_charges_enabled) {
        stripeAccountId = team.stripe_account_id;
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let payments: Array<{
      id: string; amount: number; currency: string; status: string; created: string;
      description: string; customer_email: string | null; customer_name: string | null;
      payment_method: string; receipt_url: string | null; metadata: Record<string, string>;
    }> = [];
    let hasMore = false;

    try {
      const params: Stripe.PaymentIntentListParams = {
        limit: Math.min(limit, 100),
      };
      if (starting_after) params.starting_after = starting_after;

      const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;

      const paymentIntents = await stripe.paymentIntents.list(params, stripeOpts);
      const charges = await stripe.charges.list({ limit: Math.min(limit, 100) }, stripeOpts);
      hasMore = paymentIntents.has_more;

      payments = paymentIntents.data.map((pi) => {
        const relatedCharge = charges.data.find(c => c.payment_intent === pi.id);
        return {
          id: pi.id,
          amount: pi.amount / 100,
          currency: pi.currency.toUpperCase(),
          status: pi.status,
          created: new Date(pi.created * 1000).toISOString(),
          description: pi.description || relatedCharge?.description || "Payment",
          customer_email: relatedCharge?.billing_details?.email || null,
          customer_name: relatedCharge?.billing_details?.name || null,
          payment_method: relatedCharge?.payment_method_details?.type || "card",
          receipt_url: relatedCharge?.receipt_url || null,
          metadata: pi.metadata || {},
        };
      });

      logStep("Fetched Stripe payments", { count: payments.length, connected: !!stripeAccountId });
    } catch (stripeErr) {
      logStep("Stripe API error, using local only", { error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr) });
    }

    // Local payments
    const { data: localPayments } = await supabaseClient
      .from("payments")
      .select(`
        *,
        bookings (
          customer_name,
          customer_email,
          vehicle_id,
          vehicles (name, make, model)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    logStep("Fetched local payments", { count: localPayments?.length || 0 });

    return new Response(JSON.stringify({
      stripe_payments: payments,
      local_payments: localPayments || [],
      has_more: hasMore,
      connected_account: !!stripeAccountId,
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
