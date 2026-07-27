// M6-D1 rev 2: create a setup-mode Checkout Session on the OPERATOR'S
// connected account so the renter's card lands on that account. Later,
// stripe-create-hold (mode=off_session) uses this PM to place the damage
// deposit hold. Money never touches the platform.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { teamConnectedAccountId } from "../_shared/stripeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token",
};

const log = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-CREATE-DEPOSIT-SETUP] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const RENTER_ORIGIN = Deno.env.get("RENTER_APP_ORIGIN") ?? "https://book.exotiq.rent";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth: either a signed-in Command Center user, OR an internal caller
    // (payment scheduler) with the shared token. Internal calls skip
    // membership checks because they run against arbitrary bookings.
    const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN");
    const providedInternal = req.headers.get("x-internal-token");
    const isInternal = !!internalToken && providedInternal === internalToken;

    let callerUserId: string | null = null;
    if (!isInternal) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("No authorization header provided");
      const jwt = authHeader.replace("Bearer ", "");
      const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
      if (userErr) throw new Error(`Authentication error: ${userErr.message}`);
      if (!userData.user) throw new Error("User not authenticated");
      callerUserId = userData.user.id;
    }

    const { booking_id } = await req.json();
    if (!booking_id) throw new Error("booking_id is required");

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, team_id, vehicle_id, booking_ref, customer_email, customer_name, confirmation_token, operator_stripe_customer_id")
      .eq("id", booking_id)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!booking) throw new Error("Booking not found");
    if (!booking.customer_email) throw new Error("Booking has no customer email");

    if (!isInternal && callerUserId) {
      const { data: membership } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", callerUserId)
        .eq("team_id", booking.team_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!membership) throw new Error("Not authorized for this booking's team");
    }

    const { data: team, error: tErr } = await supabase
      .from("teams")
      .select("stripe_account_id, stripe_test_account_id, stripe_charges_enabled, name")
      .eq("id", booking.team_id)
      .single();
    if (tErr) throw tErr;
    const stripeAccountId = teamConnectedAccountId(team);
    if (!team.stripe_charges_enabled) throw new Error("Operator's Stripe account not enabled for charges");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Ensure a customer exists on the connected account for this renter.
    let connectedCustomerId = booking.operator_stripe_customer_id as string | null;
    if (!connectedCustomerId) {
      const existing = await stripe.customers.list(
        { email: booking.customer_email, limit: 1 },
        { stripeAccount: stripeAccountId }
      );
      if (existing.data.length > 0) {
        connectedCustomerId = existing.data[0].id;
      } else {
        const created = await stripe.customers.create(
          { email: booking.customer_email, name: booking.customer_name ?? undefined },
          { stripeAccount: stripeAccountId }
        );
        connectedCustomerId = created.id;
      }
      await supabase
        .from("bookings")
        .update({ operator_stripe_customer_id: connectedCustomerId })
        .eq("id", booking_id);
    }

    const tokenQs = booking.confirmation_token ? `&t=${booking.confirmation_token}` : "";
    const session = await stripe.checkout.sessions.create(
      {
        mode: "setup",
        payment_method_types: ["card"],
        customer: connectedCustomerId!,
        success_url: `${RENTER_ORIGIN}/booking/${booking.booking_ref}?deposit=saved${tokenQs}`,
        cancel_url: `${RENTER_ORIGIN}/booking/${booking.booking_ref}?deposit=cancelled${tokenQs}`,
        metadata: {
          booking_id,
          booking_ref: booking.booking_ref ?? "",
          purpose: "deposit_card_on_file",
        },
      },
      { stripeAccount: stripeAccountId }
    );

    // Stamp the request so the scheduler is idempotent.
    await supabase
      .from("bookings")
      .update({ deposit_card_requested_at: new Date().toISOString() })
      .eq("id", booking_id);

    log("Setup session created", { session: session.id, booking: booking.booking_ref });

    return new Response(JSON.stringify({
      url: session.url,
      session_id: session.id,
      customer_id: connectedCustomerId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
