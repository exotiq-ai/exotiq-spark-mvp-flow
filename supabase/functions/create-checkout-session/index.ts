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
    monthly: 'price_1Tbv4IHO7nC3pJiPH4EbyVlL', // $39/vehicle/month
    annual:  'price_1Tbv4JHO7nC3pJiPqaBeoyAX', // $390/vehicle/year
  },
  business: {
    monthly: 'price_1Tbv4KHO7nC3pJiPC5emMKgJ', // $29/vehicle/month
    annual:  'price_1Tbv4LHO7nC3pJiParUQCB7y', // $290/vehicle/year
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
    const { tierId, isAnnual, fleetSize, returnPath, cancelPath, trial = true } = await req.json();

    console.log('Creating checkout session:', { tierId, isAnnual, fleetSize, trial });

    if (!STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES]) {
      throw new Error(`Invalid tier: ${tierId}. Enterprise (51+ vehicles) requires contacting sales.`);
    }
    const bounds = TIER_BOUNDS[tierId];
    if (!fleetSize || fleetSize < 1 || fleetSize > 500) {
      throw new Error(`Invalid fleet size: ${fleetSize}`);
    }
    if (fleetSize < bounds.min || fleetSize > bounds.max) {
      throw new Error(
        `Fleet size ${fleetSize} doesn't fit ${tierId} tier (${bounds.min}–${bounds.max}). ` +
        `Try ${fleetSize <= 15 ? 'Pro' : fleetSize <= 50 ? 'Business' : 'Enterprise (contact sales)'}.`
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const priceId = isAnnual
      ? STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES].annual
      : STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES].monthly;

    // Lookup or create customer
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    let customerId: string | undefined;
    let customerEmail: string | undefined;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      if (data.user?.email) {
        customerEmail = data.user.email;
        const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }
    }

    // Determine if customer already used their trial
    let allowTrial = trial;
    if (allowTrial && customerId) {
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 5,
      });
      if (existingSubs.data.some(s => s.trial_start || s.status === 'trialing')) {
        allowTrial = false;
        console.log('Customer already used trial, skipping trial_period_days');
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [
        {
          price: priceId,
          quantity: fleetSize, // per-vehicle quantity
        },
      ],
      mode: "subscription",
      // Trial requires no payment method up front
      payment_method_collection: allowTrial ? 'if_required' : 'always',
      subscription_data: {
        ...(allowTrial ? { trial_period_days: 14 } : {}),
        metadata: {
          tierId,
          fleetSize: String(fleetSize),
          interval: isAnnual ? 'annual' : 'monthly',
        },
      },
      metadata: {
        tierId,
        fleetSize: String(fleetSize),
        interval: isAnnual ? 'annual' : 'monthly',
      },
      success_url: (() => {
        const origin = req.headers.get("origin") || "https://app.exotiq.ai";
        const path = returnPath || "/welcome";
        const separator = path.includes("?") ? "&" : "?";
        return `${origin}${path}${separator}session_id={CHECKOUT_SESSION_ID}`;
      })(),
      cancel_url: `${req.headers.get("origin") || "https://app.exotiq.ai"}${cancelPath || "/?canceled=true#pricing"}`,
      allow_promotion_codes: true,
    });

    console.log('Checkout session created:', session.id, 'trial:', allowTrial);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id, trialApplied: allowTrial }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
