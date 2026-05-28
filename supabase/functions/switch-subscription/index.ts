import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 2026 Pricing Restructure (LIVE) — per-vehicle pricing
const STRIPE_PRICES = {
  pro: {
    monthly: 'price_1Tbv4IHO7nC3pJiPH4EbyVlL',
    annual:  'price_1Tbv4JHO7nC3pJiPqaBeoyAX',
  },
  business: {
    monthly: 'price_1Tbv4KHO7nC3pJiPC5emMKgJ',
    annual:  'price_1Tbv4LHO7nC3pJiParUQCB7y',
  },
};

const TIER_BOUNDS: Record<string, { min: number; max: number }> = {
  pro:      { min: 1,  max: 15 },
  business: { min: 16, max: 50 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tierId, isAnnual, fleetSize } = await req.json();

    if (!STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES]) {
      throw new Error(`Invalid tier: ${tierId}. Enterprise requires contacting sales.`);
    }
    const bounds = TIER_BOUNDS[tierId];
    if (!fleetSize || fleetSize < 1 || fleetSize > 500) {
      throw new Error(`Invalid fleet size: ${fleetSize}`);
    }
    if (fleetSize < bounds.min || fleetSize > bounds.max) {
      throw new Error(
        `Fleet size ${fleetSize} doesn't fit ${tierId} tier (${bounds.min}–${bounds.max}).`
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseClient.auth.getUser(token);
    if (userErr || !userData.user?.email) throw new Error("User not authenticated");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: userData.user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found — start a subscription first.");
    }
    const customerId = customers.data[0].id;

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 5,
    });
    const activeSub = subs.data.find(s =>
      ['active', 'trialing', 'past_due'].includes(s.status)
    );
    if (!activeSub) {
      throw new Error("No active subscription to switch — please use checkout.");
    }

    const newPriceId = isAnnual
      ? STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES].annual
      : STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES].monthly;

    // Replace the single subscription item with the new price + quantity, prorating
    const itemId = activeSub.items.data[0].id;
    const updated = await stripe.subscriptions.update(activeSub.id, {
      items: [{ id: itemId, price: newPriceId, quantity: fleetSize }],
      proration_behavior: 'create_prorations',
      metadata: {
        ...activeSub.metadata,
        tierId,
        fleetSize: String(fleetSize),
        interval: isAnnual ? 'annual' : 'monthly',
      },
      cancel_at_period_end: false,
    });

    return new Response(
      JSON.stringify({
        subscriptionId: updated.id,
        status: updated.status,
        tierId,
        fleetSize,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error('switch-subscription error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
