// Nightly billing reconciliation.
// Insurance behind invoice.upcoming: for every team with a live subscription,
// compare the billed quantity against the live fleet count, fix drift, and
// flag fleets that have outgrown auto-billing for Enterprise sales.
// Also mirrors Stripe's own subscription status back onto the team.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ENTERPRISE_THRESHOLD } from "../_shared/billing.ts";
import { recountSubscriptionQuantity, syncTeamFromSubscription } from "../_shared/billingSync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    // Callable by the nightly scheduler (cron token) or a signed-in super admin.
    const cronToken = Deno.env.get("CRON_TRIGGER_TOKEN");
    const providedToken = req.headers.get("x-cron-token");
    let authorized = Boolean(cronToken && providedToken && providedToken === cronToken);

    if (!authorized) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const { data } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
        if (data.user?.id) {
          const { data: isSuper } = await admin.rpc("is_super_admin", { check_user_id: data.user.id });
          authorized = Boolean(isSuper);
        }
      }
    }
    if (!authorized) return json({ error: "Not authorized" }, 403);

    const dryRun = new URL(req.url).searchParams.get("dry_run") === "true";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const { data: teams, error } = await admin
      .from("teams")
      .select("id, name, owner_id, billed_quantity, billing_status, stripe_subscription_id")
      .not("stripe_subscription_id", "is", null)
      .in("billing_status", ["trialing", "active", "past_due", "unpaid"]);
    if (error) throw error;

    const mismatches: Array<Record<string, unknown>> = [];
    const enterpriseReview: Array<Record<string, unknown>> = [];
    let checked = 0;

    for (const team of teams ?? []) {
      checked += 1;
      try {
        const subscription = await stripe.subscriptions.retrieve(team.stripe_subscription_id!);
        await syncTeamFromSubscription(admin, team.id, subscription);

        const before = subscription.items.data[0]?.quantity ?? 0;
        const result = await recountSubscriptionQuantity(admin, stripe, team.id, subscription, {
          apply: !dryRun,
        });

        if (before !== result.billedQuantity) {
          mismatches.push({
            teamId: team.id,
            teamName: team.name,
            billedQuantity: before,
            fleetCount: result.fleetCount,
            correctedTo: result.billedQuantity,
            applied: result.updated,
          });
        }
        if (result.needsEnterpriseReview) {
          enterpriseReview.push({
            teamId: team.id,
            teamName: team.name,
            fleetCount: result.fleetCount,
            cappedAt: ENTERPRISE_THRESHOLD,
          });
        }
      } catch (e) {
        mismatches.push({
          teamId: team.id,
          teamName: team.name,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    console.log("[billing-reconcile]", JSON.stringify({ checked, mismatches, enterpriseReview, dryRun }));

    return json({ checked, dryRun, mismatches, enterpriseReview });
  } catch (e) {
    console.error("[billing-reconcile] failed", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
