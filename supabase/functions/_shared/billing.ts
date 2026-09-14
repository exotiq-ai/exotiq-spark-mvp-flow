// Single source of truth for Exotiq subscription billing.
// Tier bounds, price ids, trial length and the "active vehicle" definition all
// live here so the checkout function, the webhook, the reconciler and the
// command center can never disagree.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export const TRIAL_DAYS = 30;

/** Date the 30-day card-required trial went live. Teams created before this
 *  keep their existing arrangement (grandfathered) and are never billed. */
export const BILLING_CUTOVER_ISO = "2026-09-15T00:00:00Z";

export type BillingTier = "pro" | "business" | "enterprise";

export const TIER_BOUNDS: Record<Exclude<BillingTier, "enterprise">, { min: number; max: number }> = {
  pro: { min: 1, max: 15 },
  business: { min: 16, max: 50 },
};

/** Hard ceiling: above this we do not auto-bill, we flag for Enterprise sales. */
export const ENTERPRISE_THRESHOLD = 50;

export const STRIPE_PRICES: Record<Exclude<BillingTier, "enterprise">, { month: string; year: string }> = {
  pro: {
    month: "price_1Tbv4IHO7nC3pJiPH4EbyVlL", // $39/vehicle/month
    year: "price_1Tbv4JHO7nC3pJiPqaBeoyAX", // $390/vehicle/year
  },
  business: {
    month: "price_1Tbv4KHO7nC3pJiPC5emMKgJ", // $29/vehicle/month
    year: "price_1Tbv4LHO7nC3pJiParUQCB7y", // $290/vehicle/year
  },
};

export function tierForCount(count: number): BillingTier {
  const n = Math.max(1, Math.floor(count || 1));
  if (n <= TIER_BOUNDS.pro.max) return "pro";
  if (n <= TIER_BOUNDS.business.max) return "business";
  return "enterprise";
}

/** Billable quantity: the fleet count, capped at the Enterprise threshold so a
 *  team above the cap is never silently charged Enterprise-scale amounts. */
export function billableQuantity(count: number): number {
  return Math.min(Math.max(1, Math.floor(count || 1)), ENTERPRISE_THRESHOLD);
}

export function priceIdFor(tier: BillingTier, interval: "month" | "year"): string {
  if (tier === "enterprise") throw new Error("enterprise_requires_sales");
  return STRIPE_PRICES[tier][interval];
}

/** Active vehicles = not archived, not trashed. The only definition. */
export async function activeVehicleCount(
  supabase: SupabaseClient,
  teamId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .is("archived_at", null)
    .is("trashed_at", null);
  if (error) throw new Error(`active_vehicle_count_failed: ${error.message}`);
  return Math.max(1, count ?? 1);
}

export type BillingEmailType =
  | "trial_started"
  | "trial_ending"
  | "first_payment"
  | "payment_failed"
  | "subscription_canceled";

const SUBJECTS: Record<BillingEmailType, string> = {
  trial_started: "Your Exotiq trial has started",
  trial_ending: "Your Exotiq trial ends in 3 days",
  first_payment: "Thanks — your Exotiq subscription is active",
  payment_failed: "We couldn't process your Exotiq payment",
  subscription_canceled: "Your Exotiq subscription has been cancelled",
};

function shell(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b0b0c;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;color:#e9e9ea;">
    <div style="font-size:18px;letter-spacing:0.18em;text-transform:uppercase;color:#fff;margin-bottom:28px;">Exotiq</div>
    ${bodyHtml}
    <p style="margin-top:32px;font-size:12px;color:#8a8a8f;">Exotiq · <a href="https://app.exotiq.ai/dashboard/settings?section=billing" style="color:#8a8a8f;">Billing settings</a></p>
  </div></body></html>`;
}

function bodyFor(
  type: BillingEmailType,
  vars: Record<string, string | number | undefined>,
): string {
  const p = (t: string) => `<p style="font-size:15px;line-height:1.6;color:#d5d5d8;margin:0 0 16px;">${t}</p>`;
  const cta = (label: string, path = "/dashboard/settings?section=billing") =>
    `<p style="margin:24px 0;"><a href="https://app.exotiq.ai${path}" style="background:#fff;color:#0b0b0c;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${label}</a></p>`;

  switch (type) {
    case "trial_started":
      return shell(
        p(`Welcome${vars.teamName ? `, ${vars.teamName}` : ""} — your 30-day trial is live.`) +
          p(`You're set up for <strong>${vars.quantity}</strong> ${Number(vars.quantity) === 1 ? "vehicle" : "vehicles"} on the ${vars.tierName} plan. Nothing is charged until ${vars.trialEnd}.`) +
          cta("Open your command center", "/dashboard"),
      );
    case "trial_ending":
      return shell(
        p(`Your Exotiq trial ends on ${vars.trialEnd}.`) +
          p(`On that date your card is charged for <strong>${vars.quantity}</strong> ${Number(vars.quantity) === 1 ? "vehicle" : "vehicles"} (${vars.tierName}). No action needed if that's right.`) +
          cta("Review billing"),
      );
    case "first_payment":
      return shell(
        p(`Your subscription is active. Thanks for building on Exotiq.`) +
          p(`Charged ${vars.amount} for ${vars.quantity} ${Number(vars.quantity) === 1 ? "vehicle" : "vehicles"}${vars.interval === "year" ? " (annual)" : ""}.`) +
          (vars.interval === "month"
            ? p(`Switching to annual saves you two months a year — you can change it any time in billing.`)
            : "") +
          cta("View invoice history"),
      );
    case "payment_failed":
      return shell(
        p(`We couldn't process ${vars.amount} for your Exotiq subscription.`) +
          p(`Your account keeps working for now. Update your card to avoid bookings and payments being paused.`) +
          cta("Update payment method"),
      );
    case "subscription_canceled":
      return shell(
        p(`Your Exotiq subscription has been cancelled.`) +
          p(`Your data is safe and read-only. Reactivate any time and everything is exactly where you left it.`) +
          cta("Reactivate"),
      );
  }
}

/**
 * Send an operator billing email exactly once. Deduped on
 * (team, type, stripe event) so webhook retries never double-send.
 */
export async function sendBillingEmail(
  supabase: SupabaseClient,
  args: {
    teamId: string;
    type: BillingEmailType;
    to: string;
    stripeEventId?: string | null;
    vars?: Record<string, string | number | undefined>;
  },
): Promise<{ sent: boolean; reason?: string }> {
  const { teamId, type, to, stripeEventId, vars = {} } = args;
  if (!to) return { sent: false, reason: "no_recipient" };

  const dedupe = supabase
    .from("billing_email_log")
    .select("id")
    .eq("team_id", teamId)
    .eq("email_type", type);
  const { data: already } = stripeEventId
    ? await dedupe.eq("stripe_event_id", stripeEventId).limit(1).maybeSingle()
    : await dedupe.limit(1).maybeSingle();
  if (already) return { sent: false, reason: "already_sent" };

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { sent: false, reason: "resend_not_configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("BILLING_EMAIL_FROM") ?? "Exotiq <billing@notify.exotiq.ai>",
      to: [to],
      subject: SUBJECTS[type],
      html: bodyFor(type, vars),
    }),
  });
  const json = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    console.error("[billing-email] resend failed", type, res.status, JSON.stringify(json));
    return { sent: false, reason: `resend_${res.status}` };
  }

  await supabase.from("billing_email_log").insert({
    team_id: teamId,
    email_type: type,
    stripe_event_id: stripeEventId ?? null,
    recipient: to,
    resend_message_id: (json as { id?: string }).id ?? null,
    metadata: vars as Record<string, unknown>,
  });

  return { sent: true };
}

export const TIER_NAMES: Record<BillingTier, string> = {
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};
