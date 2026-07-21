import { supabase } from "@/integrations/supabase/client";

export type IdentityStartResult =
  | { kind: "url"; url: string }
  | { kind: "already_verified" }
  | { kind: "manual_review" }
  | { kind: "error"; message: string };

/**
 * Kick off (or reuse) a Stripe Identity verification session for a customer.
 * Shared by VerificationSection (Vault), EnhancedBookingDialog, and
 * CustomerProfileDialog (CRM) so all three code paths stay in lockstep with
 * the identity-create-session edge function contract.
 */
export async function startIdentityVerification(
  customerId: string,
): Promise<IdentityStartResult> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "identity-create-session",
      { body: { customer_id: customerId } },
    );

    if (error) {
      const resp = (error as any)?.context;
      if (resp && typeof resp.json === "function") {
        try {
          const payload = await resp.json();
          if (payload?.status === "manual_review") {
            return { kind: "manual_review" };
          }
        } catch {
          /* fall through */
        }
      }
      return { kind: "error", message: error.message || "Could not start verification" };
    }

    if (data?.status === "verified" && data?.reused) {
      return { kind: "already_verified" };
    }
    if (data?.url) return { kind: "url", url: data.url };
    return { kind: "error", message: "Could not start verification" };
  } catch (err: any) {
    return { kind: "error", message: err?.message || "Could not start verification" };
  }
}

export function stripeIdentityDashboardUrl(sessionId: string): string {
  const base = import.meta.env.PROD
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";
  return `${base}/identity/verification-sessions/${sessionId}`;
}
