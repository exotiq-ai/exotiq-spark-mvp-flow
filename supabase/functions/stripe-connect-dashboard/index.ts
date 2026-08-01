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

    // Get team — restrict to owner/admin/manager to prevent low-privilege staff
    // (operators, viewers) from opening the Express financial dashboard.
    const { team_id: requestedTeamId } = await req.json().catch(() => ({}));
    let membershipQuery = supabaseClient
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["owner", "admin", "manager"]);
    if (requestedTeamId) membershipQuery = membershipQuery.eq("team_id", requestedTeamId);
    const { data: memberships } = await membershipQuery;
    const teamMember = memberships?.[0] ?? null;

    if (!teamMember) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to access the Stripe Dashboard." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 },
      );
    }

    const { data: team } = await supabaseClient
      .from("teams")
      .select("stripe_account_id, stripe_test_account_id")
      .eq("id", teamMember.team_id)
      .single();

    const accountColumn = resolveStripeMode() === "test" ? "stripe_test_account_id" : "stripe_account_id";
    const accountId = (team as Record<string, string | null> | null)?.[accountColumn] ?? null;
    if (!accountId) throw new Error("No Stripe account connected");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const loginLink = await stripe.accounts.createLoginLink(accountId);

    return new Response(JSON.stringify({ url: loginLink.url }), {
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
