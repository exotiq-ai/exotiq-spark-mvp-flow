// Pulls the tenant's Connect account straight from Stripe and syncs the
// cached flags on `teams`. This is the authoritative status path: it does NOT
// depend on the `account.updated` webhook being Connect-enabled, so tenant
// onboarding always resolves even if webhook delivery is delayed or misrouted.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeMode } from "../_shared/stripeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[STRIPE-CONNECT-STATUS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const mode = resolveStripeMode();
    const accountColumn = mode === "test" ? "stripe_test_account_id" : "stripe_account_id";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !userData.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const { team_id: requestedTeamId } = await req.json().catch(() => ({}) as { team_id?: string });

    // Resolve the team the caller administers. When the caller belongs to more
    // than one team the client must say which — never guess silently.
    let query = supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["owner", "admin"]);
    if (requestedTeamId) query = query.eq("team_id", requestedTeamId);

    const { data: memberships } = await query;
    if (!memberships || memberships.length === 0) {
      return json({ error: "Only team owners or admins can view payment account status" }, 403);
    }
    if (!requestedTeamId && memberships.length > 1) {
      return json(
        { error: "Multiple teams found — pass team_id", error_code: "team_ambiguous" },
        400,
      );
    }
    const teamId = memberships[0].team_id;

    const { data: team } = await supabase
      .from("teams")
      .select("id, stripe_account_id, stripe_test_account_id")
      .eq("id", teamId)
      .single();

    const accountId = (team as Record<string, string | null> | null)?.[accountColumn] ?? null;
    if (!accountId) {
      return json({ status: "not_connected", mode, team_id: teamId });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const account = await stripe.accounts.retrieve(accountId);

    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;
    const onboardingComplete = chargesEnabled && payoutsEnabled;

    // Cached flags on `teams` are live-mode only — test-mode accounts exist for
    // QA and must never flip the tenant's production readiness badges.
    if (mode === "live") {
      await supabase
        .from("teams")
        .update({
          stripe_charges_enabled: chargesEnabled,
          stripe_payouts_enabled: payoutsEnabled,
          stripe_onboarding_complete: onboardingComplete,
        } as never)
        .eq("id", teamId);
    }

    const requirements = account.requirements;
    log("Synced", { teamId, accountId, chargesEnabled, payoutsEnabled });

    return json({
      status: onboardingComplete
        ? "active"
        : detailsSubmitted
        ? "restricted"
        : "onboarding",
      mode,
      team_id: teamId,
      account_id: accountId,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      details_submitted: detailsSubmitted,
      disabled_reason: requirements?.disabled_reason ?? null,
      currently_due: requirements?.currently_due ?? [],
      past_due: requirements?.past_due ?? [],
      pending_verification: requirements?.pending_verification ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return json({ error: message, error_code: "stripe_status_failed" }, 500);
  }
});
