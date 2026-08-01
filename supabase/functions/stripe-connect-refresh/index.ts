import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeMode } from "../_shared/stripeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const mode = resolveStripeMode();
    const accountColumn = mode === "test" ? "stripe_test_account_id" : "stripe_account_id";
    const { team_id: requestedTeamId } = await req.json().catch(() => ({}));

    // Get team (explicit team_id required for multi-team users)
    let membershipQuery = supabaseClient
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["owner", "admin"]);
    if (requestedTeamId) membershipQuery = membershipQuery.eq("team_id", requestedTeamId);

    const { data: memberships } = await membershipQuery;
    if (!memberships || memberships.length === 0) throw new Error("Only team owners or admins can manage Stripe");
    if (!requestedTeamId && memberships.length > 1) {
      return new Response(
        JSON.stringify({ error: "Multiple teams found — pass team_id", error_code: "team_ambiguous" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }
    const teamMember = memberships[0];

    const { data: team } = await supabaseClient
      .from("teams")
      .select("stripe_account_id, stripe_test_account_id")
      .eq("id", teamMember.team_id)
      .single();

    const accountId = (team as Record<string, string | null> | null)?.[accountColumn] ?? null;
    if (!accountId) throw new Error("No Stripe account found. Please start onboarding first.");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || "https://exotiq.lovable.app";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?stripe_refresh=true`,
      return_url: `${origin}/dashboard?stripe_onboard=complete`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
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
