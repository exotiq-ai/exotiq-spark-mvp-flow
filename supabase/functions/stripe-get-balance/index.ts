import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-GET-BALANCE] ${step}${detailsStr}`);
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    let availableBalance = 0;
    let pendingBalance = 0;
    let formattedPayouts: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      arrival_date: string;
      created: string;
      description: string;
      method: string;
    }> = [];
    let stripeError: string | null = null;

    try {
      // Get account balance
      const balance = await stripe.balance.retrieve();
      logStep("Retrieved balance", { 
        available: balance.available,
        pending: balance.pending 
      });

      // Get upcoming payouts
      const payouts = await stripe.payouts.list({ limit: 10 });
      logStep("Retrieved payouts", { count: payouts.data.length });

      // Format balance data
      availableBalance = balance.available.reduce((sum, b) => {
        if (b.currency === "usd") return sum + b.amount;
        return sum;
      }, 0) / 100;

      pendingBalance = balance.pending.reduce((sum, b) => {
        if (b.currency === "usd") return sum + b.amount;
        return sum;
      }, 0) / 100;

      // Format payouts
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
    } catch (stripeErr) {
      // Handle Stripe API permission errors gracefully
      const errMsg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      logStep("Stripe API error (using fallback data)", { error: errMsg });
      stripeError = errMsg;
      // Continue with fallback data from database
    }

    // Calculate totals from local database
    const { data: totalRevenue } = await supabaseClient
      .from("payments")
      .select("amount")
      .eq("user_id", user.id)
      .eq("payment_status", "completed");

    const totalCollected = totalRevenue?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // Get pending deposits (security deposits held)
    const { data: pendingDeposits } = await supabaseClient
      .from("payments")
      .select("amount, booking_id, bookings(customer_name)")
      .eq("user_id", user.id)
      .eq("payment_type", "deposit")
      .eq("payment_status", "completed");

    // Get bookings with pending security deposits
    const { data: activeBookingsWithDeposits } = await supabaseClient
      .from("bookings")
      .select("id, customer_name, security_deposit_amount, security_deposit_status")
      .eq("user_id", user.id)
      .eq("security_deposit_status", "held")
      .not("security_deposit_amount", "is", null);

    // If Stripe failed, estimate balance from local payments
    if (stripeError && totalCollected > 0) {
      // Estimate ~85% of collected is available (after fees and processing)
      availableBalance = Math.round(totalCollected * 0.85);
      pendingBalance = Math.round(totalCollected * 0.10);
    }

    return new Response(
      JSON.stringify({
        balance: {
          available: availableBalance,
          pending: pendingBalance,
          currency: "USD",
          using_fallback: !!stripeError,
        },
        payouts: formattedPayouts,
        summary: {
          total_collected: totalCollected,
          pending_deposits_count: pendingDeposits?.length || 0,
          held_security_deposits: activeBookingsWithDeposits || [],
        },
        stripe_error: stripeError,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
