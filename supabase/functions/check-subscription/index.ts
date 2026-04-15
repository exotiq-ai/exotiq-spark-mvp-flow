import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Map by PRODUCT ID (stable across price changes / billing intervals)
const PRODUCT_TIERS: Record<string, { tier: string; name: string }> = {
  'prod_UIcRqJzc9qC0zh': { tier: 'starter', name: 'Starter' },
  'prod_UIcRHKBhWSyMO6': { tier: 'professional', name: 'Professional' },
  'prod_UIcR8tFUKCjx7i': { tier: 'business', name: 'Business' },
  'prod_UIcRnSPmFfcwWH': { tier: 'enterprise', name: 'Enterprise' },
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");

    // Retry auth up to 2 times for cold start race condition
    let userData = null;
    let userError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await supabaseClient.auth.getUser(token);
      userData = result.data;
      userError = result.error;
      if (!userError) break;
      logStep(`Auth attempt ${attempt + 1} failed, retrying...`, { error: userError.message });
      await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
    }

    if (userError) {
      logStep("Auth failed after retries, returning unsubscribed state");
      return new Response(JSON.stringify({
        subscribed: false, tier: null, tierName: null, interval: null,
        subscriptionEnd: null, customerId: null, authError: true
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const user = userData?.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found");
      return new Response(JSON.stringify({
        subscribed: false, tier: null, tierName: null, interval: null,
        subscriptionEnd: null, customerId: null
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Query all statuses and filter for active or trialing
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId, limit: 10,
    });

    const validStatuses = ['active', 'trialing'];
    const activeSub = subscriptions.data.find(s => validStatuses.includes(s.status));
    const hasActiveSub = !!activeSub;
    let tier = null;
    let tierName = null;
    let interval = null;
    let subscriptionEnd = null;
    let priceId = null;
    let subscriptionStatus = null;

    if (hasActiveSub && activeSub) {
      const subscription = activeSub;
      subscriptionStatus = subscription.status;
      const endTimestamp = subscription.current_period_end;
      if (endTimestamp && !isNaN(Number(endTimestamp))) {
        subscriptionEnd = new Date(Number(endTimestamp) * 1000).toISOString();
      }
      priceId = subscription.items.data[0].price.id;
      const productId = subscription.items.data[0].price.product as string;
      interval = subscription.items.data[0].price.recurring?.interval || null;

      logStep("Active subscription found", { subscriptionId: subscription.id, productId, priceId });

      const tierInfo = PRODUCT_TIERS[productId];
      if (tierInfo) {
        tier = tierInfo.tier;
        tierName = tierInfo.name;
        logStep("Determined tier from product ID", { tier, tierName, interval });
      } else {
        logStep("Unknown product ID, subscribed but no tier match", { productId });
      }
    } else {
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub, tier, tierName, interval,
      subscriptionEnd, customerId, priceId, subscriptionStatus
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
