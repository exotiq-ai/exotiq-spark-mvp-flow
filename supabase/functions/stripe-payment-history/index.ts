import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-PAYMENT-HISTORY] ${step}${detailsStr}`);
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
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { limit = 50, starting_after } = await req.json().catch(() => ({}));

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get all customers (for fleet managers, they may have multiple customer payments)
    // For now, we'll fetch platform-level payments and charges
    const params: Stripe.PaymentIntentListParams = {
      limit: Math.min(limit, 100),
    };
    
    if (starting_after) {
      params.starting_after = starting_after;
    }

    // Fetch payment intents
    const paymentIntents = await stripe.paymentIntents.list(params);
    logStep("Fetched payment intents", { count: paymentIntents.data.length });

    // Fetch charges for more detail
    const charges = await stripe.charges.list({ limit: Math.min(limit, 100) });
    logStep("Fetched charges", { count: charges.data.length });

    // Combine and format the data
    const payments = paymentIntents.data.map((pi) => {
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
        metadata: pi.metadata,
      };
    });

    // Also fetch from local payments table
    const { data: localPayments, error: dbError } = await supabaseClient
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

    if (dbError) {
      logStep("Database error", { error: dbError.message });
    }

    logStep("Fetched local payments", { count: localPayments?.length || 0 });

    return new Response(
      JSON.stringify({
        stripe_payments: payments,
        local_payments: localPayments || [],
        has_more: paymentIntents.has_more,
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
