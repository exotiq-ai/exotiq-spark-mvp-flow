import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { teamConnectedAccountId } from "../_shared/stripeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const { payment_intent_id, booking_id } = await req.json();
    if (!payment_intent_id) throw new Error("payment_intent_id is required");

    // Booking-scoped team resolution (same fix as create-hold / capture-hold).
    let teamId: string | null = null;
    const { data: paymentRow } = await supabaseClient
      .from("payments")
      .select("team_id")
      .eq("stripe_payment_intent_id", payment_intent_id)
      .maybeSingle();
    if (paymentRow?.team_id) teamId = paymentRow.team_id;

    if (!teamId && booking_id) {
      const { data: b } = await supabaseClient
        .from("bookings")
        .select("team_id")
        .eq("id", booking_id)
        .maybeSingle();
      if (b?.team_id) teamId = b.team_id;
    }
    if (!teamId) throw new Error("Could not resolve booking's team");

    const { data: membership } = await supabaseClient
      .from("team_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("team_id", teamId)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) throw new Error("Not authorized for this booking's team");

    const { data: team } = await supabaseClient
      .from("teams")
      .select("stripe_account_id, stripe_test_account_id")
      .eq("id", teamId)
      .single();
    const stripeAccountId = teamConnectedAccountId(team ?? { stripe_account_id: null, stripe_test_account_id: null });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const cancelled = await stripe.paymentIntents.cancel(
      payment_intent_id,
      { stripeAccount: stripeAccountId }
    );

    await supabaseClient
      .from("payments")
      .update({ hold_status: "released", payment_status: "cancelled" })
      .eq("stripe_payment_intent_id", payment_intent_id);

    return new Response(JSON.stringify({
      status: "released",
      payment_intent_id: cancelled.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
