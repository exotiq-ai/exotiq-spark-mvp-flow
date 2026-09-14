import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { safeAppOriginFromRequest } from "../_shared/appOrigin.ts";
import {
  activeVehicleCount,
  billableQuantity,
  ENTERPRISE_THRESHOLD,
  priceIdFor,
  tierForCount,
  TIER_NAMES,
  TRIAL_DAYS,
} from "../_shared/billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

/**
 * Activation checkout. Everything that decides the price is derived on the
 * server from the caller's own team: the fleet count, the tier it lands in and
 * the trial eligibility. The client only chooses monthly vs annual.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const isAnnual = Boolean(body?.isAnnual);
    const interval: "month" | "year" = isAnnual ? "year" : "month";
    const returnPath: string | undefined = body?.returnPath;
    const cancelPath: string | undefined = body?.cancelPath;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in required" }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    const user = userData?.user;
    if (userErr || !user?.email) return json({ error: "Sign in required" }, 401);

    // Resolve the caller's team (the one they own or administer).
    const { data: memberships } = await admin
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const teamIds = (memberships ?? []).map((m) => m.team_id);
    if (teamIds.length === 0) return json({ error: "No workspace found for this account" }, 400);

    const { data: teams } = await admin
      .from("teams")
      .select("id, name, owner_id, billing_status, stripe_customer_id, stripe_subscription_id, is_demo_account, support_email")
      .in("id", teamIds);

    const team = (teams ?? []).find((t) => t.owner_id === user.id) ?? (teams ?? [])[0];
    if (!team) return json({ error: "No workspace found for this account" }, 400);
    if (team.is_demo_account) return json({ error: "Demo workspaces cannot be billed" }, 400);
    if (team.stripe_subscription_id && ["trialing", "active", "past_due"].includes(team.billing_status ?? "")) {
      return json({ error: "This workspace already has an active subscription" }, 409);
    }

    // Server-derived fleet size → tier → price.
    const fleetCount = await activeVehicleCount(admin, team.id);
    const tier = tierForCount(fleetCount);
    if (tier === "enterprise") {
      return json(
        {
          error: `Fleets over ${ENTERPRISE_THRESHOLD} vehicles are priced with our team.`,
          code: "enterprise_requires_sales",
          fleetCount,
        },
        409,
      );
    }
    const quantity = billableQuantity(fleetCount);
    const priceId = priceIdFor(tier, interval);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Reuse the team's stored customer, else the one matching this email, else create.
    let customerId = team.stripe_customer_id ?? undefined;
    if (!customerId) {
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = existing.data[0]?.id;
    }
    if (!customerId) {
      const created = await stripe.customers.create({
        email: user.email,
        name: team.name ?? undefined,
        metadata: { team_id: team.id },
      });
      customerId = created.id;
    } else {
      await stripe.customers.update(customerId, { metadata: { team_id: team.id } }).catch(() => {});
    }

    // Trial is once per customer — the server decides, never the browser.
    let allowTrial = true;
    const priorSubs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
    if (priorSubs.data.some((s) => s.trial_start || s.status === "trialing")) allowTrial = false;
    if (team.billing_status === "grandfathered" && team.stripe_subscription_id) allowTrial = false;

    const metadata = {
      team_id: team.id,
      tierId: tier,
      interval,
      quantity: String(quantity),
      fleet_count: String(fleetCount),
    };

    const origin = safeAppOriginFromRequest(req);
    const successPath = returnPath || "/welcome";
    const separator = successPath.includes("?") ? "&" : "?";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity }],
      mode: "subscription",
      // Card required, always — trials convert without a dunning gap.
      payment_method_collection: "always",
      subscription_data: {
        ...(allowTrial
          ? {
              trial_period_days: TRIAL_DAYS,
              trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
            }
          : {}),
        metadata,
      },
      metadata,
      success_url: `${origin}${successPath}${separator}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${cancelPath || "/dashboard/settings?section=billing&canceled=true"}`,
      allow_promotion_codes: true,
    });

    // Mirror the customer + pending state immediately so the app can gate on it
    // even if the webhook is slow.
    await admin
      .from("teams")
      .update({
        stripe_customer_id: customerId,
        billing_status: team.billing_status === "grandfathered" ? "grandfathered" : "pending_activation",
      })
      .eq("id", team.id);

    return json({
      url: session.url,
      sessionId: session.id,
      trialApplied: allowTrial,
      tier,
      tierName: TIER_NAMES[tier],
      quantity,
      fleetCount,
      trialDays: allowTrial ? TRIAL_DAYS : 0,
    });
  } catch (error) {
    console.error("[create-checkout-session]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
