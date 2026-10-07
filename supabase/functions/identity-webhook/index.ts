// Stripe Identity webhook: the source of truth for verification status.
// Ref: exotiq-rent docs/rent/ID_VERIFICATION_PLAN.md (V1-V10, 2026-07-21).
//
// Handles: identity.verification_session.processing / verified /
// requires_input / canceled / redacted. Stores only status, verified name,
// and document expiry (decision V4) - never images, ID numbers, or DOB.
// On the 3rd failed attempt (V6): status -> manual_review + notifications
// to the customer's team members in the Command Center.
//
// config.toml: verify_jwt = false (Stripe calls this; auth is the signature).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

import { applyIdentityEvent } from "../_shared/external-booking/lifecycle.ts";

const MAX_SELF_SERVE_ATTEMPTS = 3; // decision V6

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(
    `[IDENTITY-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`,
  );
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Same dedicated Identity key as identity-create-session: the webhook must
  // operate in the same Stripe mode (sandbox) as the sessions it verifies.
  const stripeKey = Deno.env.get("STRIPE_IDENTITY_SECRET_KEY") ??
    Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    console.error("[IDENTITY-WEBHOOK] missing STRIPE_IDENTITY_SECRET_KEY/STRIPE_SECRET_KEY or STRIPE_IDENTITY_WEBHOOK_SECRET");
    return new Response("Configuration error", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("[IDENTITY-WEBHOOK] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (!event.type.startsWith("identity.verification_session.")) {
    return new Response(JSON.stringify({ ignored: event.type }), { status: 200 });
  }

  const session = event.data.object as Stripe.Identity.VerificationSession;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Provider lookup completes BEFORE one atomic database ledger/customer/promotion
  // transaction. A failed lookup or transaction returns 500 and remains retryable.
  let completion: {applied:boolean;status?:string;customer_id?:string;attempt_count?:number};
  try {
    const current=await stripe.identity.verificationSessions.retrieve(session.id,{expand:["verified_outputs"]});
    const identityKeyMode=stripeKey.startsWith("sk_live_")?true:stripeKey.startsWith("sk_test_")?false:null;
    if(identityKeyMode===null || current.livemode!==identityKeyMode || event.livemode!==identityKeyMode)throw new Error("Identity mode mismatch");
    let documentExpiry:string|null=null;
    if(current.status==="verified"){
      const reportId=typeof current.last_verification_report==="string"?current.last_verification_report:current.last_verification_report?.id;
      if(!reportId)throw new Error("Verified identity report unavailable");
      const report=await stripe.identity.verificationReports.retrieve(reportId,{expand:["document"]});
      const expiry=report.document?.expiration_date;
      if(expiry?.year && expiry.month && expiry.day)documentExpiry=`${expiry.year}-${String(expiry.month).padStart(2,"0")}-${String(expiry.day).padStart(2,"0")}`;
    }
    const outputs=current.verified_outputs;
    completion=await applyIdentityEvent(admin,event,{id:current.id,status:event.type.endsWith(".redacted")?"redacted":current.status,documentExpiry,verifiedName:[outputs?.first_name,outputs?.last_name].filter(Boolean).join(" ")||null}) as typeof completion;
  }catch{
    return new Response("Identity reconciliation unavailable",{status:500});
  }
  if(!completion.applied)return new Response(JSON.stringify({received:true}),{status:200});
  const row={customer_id:completion.customer_id};
  const patch={status:completion.status};
  const notifyManualReview=completion.status==="manual_review";
  const notifyVerified=completion.status==="verified";
  const notifyRequiresInput=completion.status==="requires_input";
  const attemptsRemaining=Math.max(0,MAX_SELF_SERVE_ATTEMPTS-(completion.attempt_count??0));

  // Bell notifications for the tenant's team (decision V6 + verified/retry alerts).
  const notifyType = notifyManualReview
    ? "identity_manual_review"
    : notifyVerified
    ? "identity_verified"
    : notifyRequiresInput
    ? "identity_requires_input"
    : null;

  if (notifyType) {
    const { data: customer } = await admin
      .from("customers")
      .select("id, full_name, team_id")
      .eq("id", row.customer_id)
      .maybeSingle();
    if (customer?.team_id) {
      const { data: members } = await admin
        .from("team_members")
        .select("user_id")
        .eq("team_id", customer.team_id)
        .eq("is_active", true);

      const name = customer.full_name ?? "A customer";
      let title = "";
      let message = "";
      if (notifyType === "identity_verified") {
        title = "ID verified";
        message = `${name} completed Stripe Identity verification.`;
      } else if (notifyType === "identity_requires_input") {
        title = "ID verification retry";
        message = `${name} needs to retry ID verification. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`;
      } else {
        title = "ID verification needs review";
        message = `${name} failed ID verification ${MAX_SELF_SERVE_ATTEMPTS} times. Review in Verification.`;
      }

      const rows = (members ?? []).map((m) => ({
        user_id: m.user_id,
        type: notifyType,
        title,
        message,
        data: { customer_id: customer.id },
      }));
      if (rows.length > 0) {
        await admin.from("notifications").insert(rows);
      }
    }
  }



  logStep("Applied", { event: event.type, status: patch.status });
  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
