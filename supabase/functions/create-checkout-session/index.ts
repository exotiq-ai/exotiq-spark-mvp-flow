import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stripe Price IDs - Hybrid Pricing Model
const STRIPE_PRICES = {
  starter: {
    monthly: 'price_1TK1CDQn5o30XCWdYrdXqWoi',
    annual: 'price_1TK1CJQn5o30XCWdTRIlTFT9',
  },
  professional: {
    monthly: 'price_1TK1COQn5o30XCWdvm3jVgGX',
    annual: 'price_1TK1CPQn5o30XCWdIFgGk2oK',
  },
  business: {
    monthly: 'price_1TK1CUQn5o30XCWdubyD6CKp',
    annual: 'price_1TK1CVQn5o30XCWd8XU5IF0t',
  },
  enterprise: {
    monthly: 'price_1TK1CaQn5o30XCWdiGFjpsXh',
    annual: 'price_1TK1CbQn5o30XCWdpyWNFfIg',
  },
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tierId, isAnnual, fleetSize } = await req.json();
    
    console.log('Creating checkout session:', { tierId, isAnnual, fleetSize });

    // Validate tier
    if (!STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES]) {
      throw new Error(`Invalid tier: ${tierId}`);
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get the correct price ID
    const priceId = isAnnual 
      ? STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES].annual
      : STRIPE_PRICES[tierId as keyof typeof STRIPE_PRICES].monthly;

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
      line_items: [
        {
          price: priceId,
          quantity: fleetSize,
        },
      ],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          tierId,
          fleetSize: String(fleetSize),
          isFounderPricing: 'true',
        },
      },
      metadata: {
        tierId,
        fleetSize: String(fleetSize),
        isFounderPricing: 'true',
      },
      success_url: `${req.headers.get("origin")}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/?canceled=true#pricing`,
      allow_promotion_codes: true,
    });

    console.log('Checkout session created:', session.id);

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
