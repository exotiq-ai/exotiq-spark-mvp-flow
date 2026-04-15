import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stripe Price IDs - Hybrid Pricing Model (LIVE)
const STRIPE_PRICES = {
  starter: {
    monthly: 'price_1ShmMlHO7nC3pJiPxcbd7vlL',
    annual: 'price_1ShmRHHO7nC3pJiPtU6o3AMC',
  },
  professional: {
    monthly: 'price_1ShmMmHO7nC3pJiPPYhhXT1o',
    annual: 'price_1ShmRJHO7nC3pJiP05J4DdvQ',
  },
  business: {
    monthly: 'price_1ShmMoHO7nC3pJiPzUH0wSP3',
    annual: 'price_1ShmRKHO7nC3pJiPSxuuBWtO',
  },
  enterprise: {
    monthly: 'price_1ShmMqHO7nC3pJiPV04rgXRX',
    annual: 'price_1ShmRMHO7nC3pJiPYawYJ13O',
  },
};

// Overage Price IDs — per-vehicle/month for vehicles above tier max
// TODO: Create overage prices in live Stripe account
const STRIPE_OVERAGE_PRICES: Record<string, string> = {
  professional: '', // $22/vehicle/month — needs live price ID
  business: '',     // $18/vehicle/month — needs live price ID
  enterprise: '',   // $15/vehicle/month — needs live price ID
};

// Tier configuration — maxVehicles included in the flat rate
const TIER_CONFIG: Record<string, { priceType: 'per-vehicle' | 'flat'; maxVehicles: number }> = {
  starter:      { priceType: 'per-vehicle', maxVehicles: 10 },
  professional: { priceType: 'flat',        maxVehicles: 25 },
  business:     { priceType: 'flat',        maxVehicles: 75 },
  enterprise:   { priceType: 'flat',        maxVehicles: 150 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tierId, isAnnual, fleetSize, returnPath, cancelPath } = await req.json();
    
    console.log('Creating checkout session:', { tierId, isAnnual, fleetSize });

    // Validate tier
    if (!STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES]) {
      throw new Error(`Invalid tier: ${tierId}`);
    }

    const tierConfig = TIER_CONFIG[tierId];
    if (!tierConfig) {
      throw new Error(`Invalid tier config: ${tierId}`);
    }

    // Validate fleet size
    if (!fleetSize || fleetSize < 1 || fleetSize > 500) {
      throw new Error(`Invalid fleet size: ${fleetSize}`);
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get the correct base price ID
    const priceId = isAnnual 
      ? STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES].annual
      : STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES].monthly;

    // Build line items based on pricing model
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (tierConfig.priceType === 'per-vehicle') {
      // Starter: per-vehicle pricing, quantity = fleet size
      // Enforce minimum: $79 minimum means at least ceil(79/29) = 3 vehicles worth
      const minQuantity = tierConfig.minPrice ? Math.ceil(tierConfig.minPrice / tierConfig.perVehicleRate) : 1;
      const effectiveQuantity = Math.max(fleetSize, minQuantity);
      lineItems.push({
        price: priceId,
        quantity: effectiveQuantity,
      });
    } else {
      // Flat-rate tiers: base plan quantity = 1 (always)
      lineItems.push({
        price: priceId,
        quantity: 1,
      });

      // Add overage line item if fleet exceeds tier max
      const overageVehicles = fleetSize - tierConfig.maxVehicles;
      if (overageVehicles > 0) {
        const overagePriceId = STRIPE_OVERAGE_PRICES[tierId];
        if (!overagePriceId) {
          throw new Error(`No overage price configured for tier: ${tierId}`);
        }
        lineItems.push({
          price: overagePriceId,
          quantity: overageVehicles,
        });
        console.log(`Adding ${overageVehicles} overage vehicles for ${tierId}`);
      }
    }

    // Create Supabase client to check for authenticated user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    let customerId: string | undefined;
    let customerEmail: string | undefined;

    // Try to get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      
      if (data.user?.email) {
        customerEmail = data.user.email;
        
        // Check if customer already exists in Stripe
        const customers = await stripe.customers.list({ 
          email: customerEmail, 
          limit: 1 
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: lineItems,
      mode: "subscription",
      payment_method_collection: 'always',
      subscription_data: {
        metadata: {
          tierId,
          fleetSize: String(fleetSize),
          maxVehicles: String(tierConfig.maxVehicles),
          overageVehicles: String(Math.max(0, fleetSize - tierConfig.maxVehicles)),
          isFounderPricing: 'true',
        },
      },
      metadata: {
        tierId,
        fleetSize: String(fleetSize),
        isFounderPricing: 'true',
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

    console.log('Checkout session created:', session.id, 'line_items:', lineItems.length);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
