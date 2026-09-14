// Mirrors Stripe subscription state onto teams, and keeps the billed quantity
// aligned with the live fleet count. Shared by stripe-webhook and
// billing-reconcile so both can never drift.

import type Stripe from "https://esm.sh/stripe@18.5.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  activeVehicleCount,
  billableQuantity,
  ENTERPRISE_THRESHOLD,
  tierForCount,
} from "./billing.ts";

export interface BillingTeam {
  id: string;
  name?: string | null;
  owner_id?: string | null;
  support_email?: string | null;
}

const STATUS_MAP: Record<string, string> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  unpaid: "unpaid",
  canceled: "canceled",
  incomplete: "pending_activation",
  incomplete_expired: "canceled",
  paused: "unpaid",
};

/**
 * Resolve the team a subscription belongs to. Order: subscription metadata
 * team_id → stored stripe_subscription_id → stored stripe_customer_id →
 * customer metadata team_id → customer email against profiles (legacy).
 */
export async function resolveBillingTeam(
  supabase: SupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<BillingTeam | null> {
  const select = "id, name, owner_id, support_email";

  const metaTeamId = subscription.metadata?.team_id;
  if (metaTeamId) {
    const { data } = await supabase.from("teams").select(select).eq("id", metaTeamId).maybeSingle();
    if (data) return data as BillingTeam;
  }

  const bySub = await supabase
    .from("teams")
    .select(select)
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (bySub.data) return bySub.data as BillingTeam;

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (customerId) {
    const byCustomer = await supabase
      .from("teams")
      .select(select)
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (byCustomer.data) return byCustomer.data as BillingTeam;

    const customer = await stripe.customers.retrieve(customerId).catch(() => null);
    if (customer && !("deleted" in customer && customer.deleted)) {
      const custTeamId = (customer as Stripe.Customer).metadata?.team_id;
      if (custTeamId) {
        const { data } = await supabase.from("teams").select(select).eq("id", custTeamId).maybeSingle();
        if (data) return data as BillingTeam;
      }
      const email = (customer as Stripe.Customer).email;
      if (email) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .limit(1)
          .maybeSingle();
        if (profile) {
          const { data } = await supabase
            .from("teams")
            .select(select)
            .eq("owner_id", profile.id)
            .limit(1)
            .maybeSingle();
          if (data) return data as BillingTeam;
        }
      }
    }
  }

  return null;
}

/** Who receives billing email for a team. */
export async function billingRecipient(
  supabase: SupabaseClient,
  team: BillingTeam,
): Promise<string | null> {
  if (team.support_email) return team.support_email;
  if (!team.owner_id) return null;
  const { data } = await supabase.from("profiles").select("email").eq("id", team.owner_id).maybeSingle();
  return (data as { email?: string } | null)?.email ?? null;
}

export async function syncTeamFromSubscription(
  supabase: SupabaseClient,
  teamId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const item = subscription.items.data[0];
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const update: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    billing_status: STATUS_MAP[subscription.status] ?? subscription.status,
    billing_interval: item?.price?.recurring?.interval ?? null,
    billed_tier: subscription.metadata?.tierId ?? tierForCount(item?.quantity ?? 1),
    billed_quantity: item?.quantity ?? null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
  };
  if (["trialing", "active"].includes(subscription.status)) {
    update.activated_at = new Date(subscription.start_date * 1000).toISOString();
  }

  const { error } = await supabase.from("teams").update(update).eq("id", teamId);
  if (error) console.error("[billingSync] team update failed", teamId, error.message);
}

export interface RecountResult {
  fleetCount: number;
  billedQuantity: number;
  updated: boolean;
  needsEnterpriseReview: boolean;
  tierChanged: boolean;
}

/**
 * Align the subscription's quantity (and tier price, if the fleet crossed a
 * boundary) with the live active-vehicle count. Fleets above the Enterprise
 * threshold are capped and flagged for sales rather than auto-billed.
 */
export async function recountSubscriptionQuantity(
  supabase: SupabaseClient,
  stripe: Stripe,
  teamId: string,
  subscription: Stripe.Subscription,
  opts: { apply?: boolean } = {},
): Promise<RecountResult> {
  const apply = opts.apply !== false;
  const fleetCount = await activeVehicleCount(supabase, teamId);
  const quantity = billableQuantity(fleetCount);
  const item = subscription.items.data[0];
  const currentQty = item?.quantity ?? 0;
  const interval = (item?.price?.recurring?.interval ?? "month") as "month" | "year";
  const currentTier = subscription.metadata?.tierId ?? tierForCount(currentQty);
  const targetTier = tierForCount(quantity);
  const needsEnterpriseReview = fleetCount > ENTERPRISE_THRESHOLD;
  const tierChanged = targetTier !== currentTier && targetTier !== "enterprise";

  let updated = false;
  if (apply && item && (currentQty !== quantity || tierChanged)) {
    const { priceIdFor } = await import("./billing.ts");
    await stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: item.id,
          quantity,
          ...(tierChanged ? { price: priceIdFor(targetTier, interval) } : {}),
        },
      ],
      proration_behavior: "none",
      metadata: {
        ...(subscription.metadata ?? {}),
        team_id: teamId,
        tierId: targetTier === "enterprise" ? currentTier : targetTier,
        quantity: String(quantity),
        fleet_count: String(fleetCount),
      },
    });
    updated = true;
  }

  if (apply) {
    await supabase
      .from("teams")
      .update({
        billed_quantity: quantity,
        billed_tier: targetTier === "enterprise" ? currentTier : targetTier,
      })
      .eq("id", teamId);
  }

  return { fleetCount, billedQuantity: quantity, updated, needsEnterpriseReview, tierChanged };
}
