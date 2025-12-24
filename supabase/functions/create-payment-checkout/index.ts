import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Get request body
    const { 
      booking_id, 
      customer_id,
      customer_email, 
      customer_name,
      amount, 
      payment_type,
      description 
    } = await req.json();
    
    logStep("Request body parsed", { booking_id, amount, payment_type, customer_email });

    if (!amount || amount <= 0) {
      throw new Error("Invalid payment amount");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists in Stripe
    let stripeCustomerId: string | undefined;
    if (customer_email) {
      const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        logStep("Found existing Stripe customer", { stripeCustomerId });
      } else {
        // Create a new customer
        const newCustomer = await stripe.customers.create({
          email: customer_email,
          name: customer_name,
          metadata: {
            supabase_customer_id: customer_id || '',
            booking_id: booking_id || ''
          }
        });
        stripeCustomerId = newCustomer.id;
        logStep("Created new Stripe customer", { stripeCustomerId });
      }
    }

    // Create a one-time payment session using price_data for dynamic amounts
    const origin = req.headers.get("origin") || "https://exotiq.lovable.app";
    
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : customer_email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${payment_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} - Booking`,
              description: description || `Payment for booking ${booking_id?.substring(0, 8) || 'N/A'}`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/dashboard?payment=success&booking_id=${booking_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?payment=cancelled&booking_id=${booking_id}`,
      metadata: {
        booking_id: booking_id || '',
        customer_id: customer_id || '',
        payment_type: payment_type,
        user_id: user.id
      },
      payment_intent_data: {
        metadata: {
          booking_id: booking_id || '',
          customer_id: customer_id || '',
          payment_type: payment_type,
          user_id: user.id
        }
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ 
      url: session.url,
      session_id: session.id 
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
