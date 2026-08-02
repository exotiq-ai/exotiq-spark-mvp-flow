import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeMode } from "../_shared/stripeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-CONNECT-ONBOARD] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Onboarding writes into the column matching the CURRENT Stripe key mode,
    // so a sandbox key can never park a test account in the live slot.
    const mode = resolveStripeMode();
    const accountColumn = mode === "test" ? "stripe_test_account_id" : "stripe_account_id";

    const { return_url, refresh_url, team_id: requestedTeamId } = await req.json().catch(() => ({}));

    // Get user's team and verify they're owner/admin. Multi-team users must
    // name the team explicitly — never silently connect the wrong tenant.
    let membershipQuery = supabaseClient
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["owner", "admin"]);
    if (requestedTeamId) membershipQuery = membershipQuery.eq("team_id", requestedTeamId);

    const { data: memberships, error: tmError } = await membershipQuery;
    if (tmError || !memberships || memberships.length === 0) {
      throw new Error("Only team owners or admins can connect a Stripe account");
    }
    if (!requestedTeamId && memberships.length > 1) {
      return new Response(
        JSON.stringify({ error: "Multiple teams found — pass team_id", error_code: "team_ambiguous" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }
    const teamMember = memberships[0];
    logStep("Team member verified", { teamId: teamMember.team_id, role: teamMember.role, mode });

    // Check if team already has a Stripe account for this mode
    const { data: team } = await supabaseClient
      .from("teams")
      .select("stripe_account_id, stripe_test_account_id, stripe_onboarding_complete, country_code")
      .eq("id", teamMember.team_id)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    let accountId = (team as Record<string, string | null> | null)?.[accountColumn] ?? null;

    if (!accountId) {
      // Country is captured in onboarding/settings and drives the Connect
      // account's settlement currency. Defaults to US to preserve existing
      // behaviour for tenants who haven't set a country.
      const country = (team?.country_code || "US").toUpperCase();

      // Create new Express account
      const account = await stripe.accounts.create({
        type: "express",
        country,
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          team_id: teamMember.team_id,
          created_by: user.id,
          country,
        },
      });
      accountId = account.id;
      logStep("Created Express account", { accountId, country });

      // Store on team
      await supabaseClient
        .from("teams")
        .update({ [accountColumn]: accountId } as any)
        .eq("id", teamMember.team_id);
    } else {
      logStep("Using existing account", { accountId });
    }

    // Generate Account Link for onboarding
    const origin = req.headers.get("origin") || "https://app.exotiq.ai";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url || `${origin}/dashboard?stripe_refresh=true`,
      return_url: return_url || `${origin}/dashboard?stripe_onboard=complete`,
      type: "account_onboarding",
    });

    logStep("Account link created", { url: accountLink.url });

    return new Response(JSON.stringify({
      url: accountLink.url,
      account_id: accountId,
      mode,
      team_id: teamMember.team_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    // Detect Stripe platform profile not configured (loss liability responsibilities)
    const isPlatformProfileError =
      errorMessage.includes("platform-profile") ||
      errorMessage.includes("responsibilities of managing losses");

    if (isPlatformProfileError) {
      return new Response(
        JSON.stringify({
          error:
            "Your Stripe Connect platform profile needs to be completed before tenants can connect. Open your Stripe Dashboard → Connect → Platform Profile to accept loss-liability responsibilities, then try again.",
          error_code: "platform_profile_incomplete",
          action_url: "https://dashboard.stripe.com/settings/connect/platform-profile",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        }
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage, error_code: "stripe_onboard_failed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
