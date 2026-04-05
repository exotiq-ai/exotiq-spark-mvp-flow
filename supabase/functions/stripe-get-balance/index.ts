import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-GET-BALANCE] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
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
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get team and check for connected Stripe account
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

    let availableBalance = 0;
    let pendingBalance = 0;
    let formattedPayouts: Array<{
      id: string; amount: number; currency: string; status: string;
      arrival_date: string; created: string; description: string; method: string;
    }> = [];
    let stripeError: string | null = null;

    try {
      if (stripeAccountId) {
        // Query CONNECTED account balance
        const balance = await stripe.balance.retrieve({ stripeAccount: stripeAccountId });
        const payouts = await stripe.payouts.list({ limit: 10 }, { stripeAccount: stripeAccountId });

        availableBalance = balance.available.reduce((sum, b) => b.currency === "usd" ? sum + b.amount : sum, 0) / 100;
        pendingBalance = balance.pending.reduce((sum, b) => b.currency === "usd" ? sum + b.amount : sum, 0) / 100;

        formattedPayouts = payouts.data.map((payout) => ({
          id: payout.id,
          amount: payout.amount / 100,
          currency: payout.currency.toUpperCase(),
          status: payout.status,
          arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
          created: new Date(payout.created * 1000).toISOString(),
          description: payout.description || "Payout",
          method: payout.method,
        }));

        logStep("Connected account balance retrieved", { stripeAccountId });
      } else {
        // No connected account — try platform balance (for platform admins)
        try {
          const balance = await stripe.balance.retrieve();
          const payouts = await stripe.payouts.list({ limit: 10 });

          availableBalance = balance.available.reduce((sum, b) => b.currency === "usd" ? sum + b.amount : sum, 0) / 100;
          pendingBalance = balance.pending.reduce((sum, b) => b.currency === "usd" ? sum + b.amount : sum, 0) / 100;

          formattedPayouts = payouts.data.map((payout) => ({
            id: payout.id,
            amount: payout.amount / 100,
            currency: payout.currency.toUpperCase(),
            status: payout.status,
            arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
            created: new Date(payout.created * 1000).toISOString(),
            description: payout.description || "Payout",
            method: payout.method,
          }));
        } catch (e) {
          stripeError = e instanceof Error ? e.message : String(e);
          logStep("Platform balance unavailable", { error: stripeError });
        }
      }
    } catch (stripeErr) {
      stripeError = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      logStep("Stripe API error", { error: stripeError });
    }

    // Local DB data
    const { data: totalRevenue } = await supabaseClient
      .from("payments")
      .select("amount")
      .eq("user_id", user.id)
      .eq("payment_status", "completed");

    const totalCollected = totalRevenue?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    const { data: activeBookingsWithDeposits } = await supabaseClient
      .from("bookings")
      .select("id, customer_name, security_deposit_amount, security_deposit_status")
      .eq("user_id", user.id)
      .eq("security_deposit_status", "held")
      .not("security_deposit_amount", "is", null);

    // Get active holds from payments
    const { data: activeHolds } = await supabaseClient
      .from("payments")
      .select("id, amount, hold_status, hold_expires_at, stripe_payment_intent_id, booking_id")
      .eq("user_id", user.id)
      .eq("hold_status", "authorized");

    if (stripeError && totalCollected > 0) {
      availableBalance = Math.round(totalCollected * 0.85);
      pendingBalance = Math.round(totalCollected * 0.10);
    }

    return new Response(JSON.stringify({
      balance: {
        available: availableBalance,
        pending: pendingBalance,
        currency: "USD",
        using_fallback: !!stripeError,
        connected_account: !!stripeAccountId,
      },
      payouts: formattedPayouts,
      summary: {
        total_collected: totalCollected,
        held_security_deposits: activeBookingsWithDeposits || [],
        active_holds: activeHolds || [],
      },
      stripe_error: stripeError,
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
