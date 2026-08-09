import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

// Renter marketplace money objects (rent-checkout / rent-payment-webhook /
// rent-extend-booking) always stamp a `leg` in metadata. Those events belong
// exclusively to rent-payment-webhook — this legacy endpoint must never act
// on them, or the two-leg charge/receipt flow gets double-handled.
const RENTER_LEGS = new Set([
  "operator_rental",
  "exotiq_fee_protection",
  "operator_rental_extension",
  "exotiq_fees_extension",
]);

const isRenterMoneyObject = (metadata?: Record<string, string> | null): boolean => {
  const leg = metadata?.leg;
  return typeof leg === "string" && RENTER_LEGS.has(leg);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const connectWebhookSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret && !connectWebhookSecret) {
      throw new Error("No Stripe webhook signing secret is set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    // This URL is registered twice in Stripe: once as a platform endpoint and
    // once as a connected-accounts endpoint. Each has its own signing secret,
    // so try both before rejecting.
    const candidates: Array<{ secret: string; consumer: "legacy" | "legacy_connect" }> = [];
    if (webhookSecret) candidates.push({ secret: webhookSecret, consumer: "legacy" });
    if (connectWebhookSecret) {
      candidates.push({ secret: connectWebhookSecret, consumer: "legacy_connect" });
    }

    let event: Stripe.Event | null = null;
    let consumer: "legacy" | "legacy_connect" = "legacy";
    let lastError: unknown = null;
    for (const candidate of candidates) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, candidate.secret);
        consumer = candidate.consumer;
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!event) {
      logStep("Signature verification failed for all secrets");
      throw lastError instanceof Error ? lastError : new Error("Invalid signature");
    }

    logStep("Event received", { type: event.type, id: event.id, consumer });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Idempotency check — scoped to this consumer. The renter money flow
    // (`rent-payment-webhook`) shares this table and subscribes to some of
    // the same event types; keying per consumer keeps the two endpoints from
    // suppressing each other's processing of the same Stripe event. Platform
    // and connected-account deliveries of the same event type are also kept
    // apart by their distinct consumer keys.
    const { data: existing } = await supabaseClient
      .from("stripe_webhook_events")
      .select("id")
      .eq("consumer", consumer)
      .eq("stripe_event_id", event.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      logStep("Duplicate event, skipping", { eventId: event.id, consumer });
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }

    // Record event
    await supabaseClient.from("stripe_webhook_events").insert({
      consumer,
      stripe_event_id: event.id,
      event_type: event.type,
      payload: JSON.parse(body),
    });


    // Handle events
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        logStep("Account updated", { accountId: account.id });

        // Find team by stripe_account_id
        const { data: team } = await supabaseClient
          .from("teams")
          .select("id")
          .eq("stripe_account_id", account.id)
          .limit(1)
          .single();

        if (team) {
          const chargesEnabled = account.charges_enabled ?? false;
          const payoutsEnabled = account.payouts_enabled ?? false;
          const onboardingComplete = chargesEnabled && payoutsEnabled;

          await supabaseClient
            .from("teams")
            .update({
              stripe_charges_enabled: chargesEnabled,
              stripe_payouts_enabled: payoutsEnabled,
              stripe_onboarding_complete: onboardingComplete,
            } as any)
            .eq("id", team.id);

          logStep("Team updated", { teamId: team.id, chargesEnabled, payoutsEnabled });
        }
        break;
      }

      case "account.application.deauthorized": {
        // Tenant disconnected our app from Stripe — wipe stored credentials
        // so the UI shows "not connected" and we stop attempting charges on a
        // dead account.
        const accountId = event.account ?? (event.data.object as Stripe.Account)?.id;
        logStep("Account deauthorized", { accountId });

        if (accountId) {
          const { data: team } = await supabaseClient
            .from("teams")
            .select("id, owner_id, name")
            .eq("stripe_account_id", accountId)
            .limit(1)
            .single();

          if (team) {
            await supabaseClient
              .from("teams")
              .update({
                stripe_account_id: null,
                stripe_charges_enabled: false,
                stripe_payouts_enabled: false,
                stripe_onboarding_complete: false,
              } as any)
              .eq("id", team.id);

            if (team.owner_id) {
              await supabaseClient.from("notifications").insert({
                user_id: team.owner_id,
                type: "payment",
                title: "Stripe Account Disconnected",
                message: "Your Stripe payment account has been disconnected. Reconnect in Settings → Payments to resume accepting card payments.",
                data: { stripe_account_id: accountId },
              });
            }

            logStep("Team Stripe credentials cleared", { teamId: team.id });
          }
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id, mode: session.mode });

        if (isRenterMoneyObject(session.metadata)) {
          logStep("Renter marketplace event — owned by rent-payment-webhook, skipping", {
            sessionId: session.id,
            leg: session.metadata?.leg,
          });
          break;
        }

        if (session.mode === "setup") {
          // Card-capture link (e.g. a trialing team that started before we
          // required a card). Attach the new PM as the customer default and
          // to any live subscription so the trial converts cleanly.
          const customerId = session.customer as string | null;
          const setupIntentId = session.setup_intent as string | null;
          if (customerId && setupIntentId) {
            const si = await stripe.setupIntents.retrieve(setupIntentId);
            const pmId = si.payment_method as string | null;
            if (pmId) {
              await stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: pmId },
              });
              const subs = await stripe.subscriptions.list({
                customer: customerId,
                status: "all",
                limit: 10,
              });
              for (const sub of subs.data) {
                if (["trialing", "active", "past_due", "unpaid"].includes(sub.status)) {
                  await stripe.subscriptions.update(sub.id, {
                    default_payment_method: pmId,
                    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
                  });
                }
              }
              logStep("Card saved and attached", { customerId, pmId });
            }
          }
          break;
        }

        if (session.mode === "payment" && session.metadata?.booking_id) {
          // Tenant payment — update booking and payment records. This event can
          // arrive on the platform endpoint OR on the connected-accounts
          // endpoint (create-payment-checkout mints the session on the
          // tenant's connected account), so both consumers land here.
          const bookingId = session.metadata.booking_id;
          const userId = session.metadata.user_id;
          const paymentType = session.metadata.payment_type || "balance";
          const paymentIntentId = session.payment_intent as string | null;

          // Guard against a double insert if both endpoints deliver the same
          // session (distinct consumer keys bypass the event-level dedupe).
          let alreadyRecorded = false;
          if (paymentIntentId) {
            const { data: existingPayment } = await supabaseClient
              .from("payments")
              .select("id")
              .eq("stripe_payment_intent_id", paymentIntentId)
              .limit(1)
              .maybeSingle();
            alreadyRecorded = !!existingPayment;
          }

          if (alreadyRecorded) {
            logStep("Payment already recorded, skipping insert", { bookingId, paymentIntentId });
            break;
          }

          await supabaseClient.from("payments").insert({
            booking_id: bookingId,
            user_id: userId,
            amount: (session.amount_total || 0) / 100,
            payment_type: paymentType,
            payment_method: "stripe",
            payment_status: "completed",
            stripe_payment_intent_id: paymentIntentId,
            transaction_date: new Date().toISOString(),
            platform_fee: session.metadata?.platform_fee ? Number(session.metadata.platform_fee) : null,
          });


          // Update booking payment status
          await supabaseClient
            .from("bookings")
            .update({ payment_status: "partial" })
            .eq("id", bookingId);

          logStep("Payment recorded", { bookingId, amount: (session.amount_total || 0) / 100 });
        }
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        logStep("PaymentIntent succeeded", { piId: pi.id });

        if (isRenterMoneyObject(pi.metadata)) {
          logStep("Renter marketplace PI — owned by rent-payment-webhook, skipping", {
            piId: pi.id,
            leg: pi.metadata?.leg,
          });
          break;
        }

        const { data: existingPaymentRow } = await supabaseClient
          .from("payments")
          .select("id")
          .eq("stripe_payment_intent_id", pi.id)
          .limit(1)
          .maybeSingle();

        if (existingPaymentRow) {
          await supabaseClient
            .from("payments")
            .update({ payment_status: "completed" })
            .eq("stripe_payment_intent_id", pi.id);
          break;
        }

        // Safety net: an operator-initiated Checkout charge on a connected
        // account whose checkout.session.completed delivery never arrived.
        // The PI carries the same metadata, so we can still record the money.
        if (pi.metadata?.booking_id) {
          await supabaseClient.from("payments").insert({
            booking_id: pi.metadata.booking_id,
            user_id: pi.metadata.user_id || null,
            amount: (pi.amount_received || pi.amount || 0) / 100,
            payment_type: pi.metadata.payment_type || "balance",
            payment_method: "stripe",
            payment_status: "completed",
            stripe_payment_intent_id: pi.id,
            transaction_date: new Date().toISOString(),
          });
          await supabaseClient
            .from("bookings")
            .update({ payment_status: "partial" })
            .eq("id", pi.metadata.booking_id);
          logStep("Payment recorded from PI fallback", { piId: pi.id, bookingId: pi.metadata.booking_id });
        }
        break;

      }

      case "payment_intent.amount_capturable_updated": {
        const pi = event.data.object as Stripe.PaymentIntent;
        logStep("Hold authorized", { piId: pi.id, capturable: pi.amount_capturable });

        await supabaseClient
          .from("payments")
          .update({
            hold_status: "authorized",
            hold_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("stripe_payment_intent_id", pi.id);
        break;
      }

      case "charge.captured": {
        const charge = event.data.object as Stripe.Charge;
        logStep("Charge captured", { chargeId: charge.id });

        if (charge.payment_intent) {
          await supabaseClient
            .from("payments")
            .update({
              hold_status: "captured",
              stripe_charge_id: charge.id,
            })
            .eq("stripe_payment_intent_id", charge.payment_intent as string);

          await logStripeProcessingFee(supabaseClient, stripe, charge);
        }
        break;
      }

      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;
        logStep("Charge succeeded", { chargeId: charge.id });
        // Cover non-hold flows (direct charges) — captured handler covers manual capture
        if (charge.payment_intent && charge.captured) {
          await logStripeProcessingFee(supabaseClient, stripe, charge);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        logStep("Charge refunded", { chargeId: charge.id, amountRefunded: charge.amount_refunded });

        if (charge.payment_intent) {
          await supabaseClient
            .from("payments")
            .update({
              refund_amount: charge.amount_refunded / 100,
              payment_status: charge.refunded ? "refunded" : "partially_refunded",
            })
            .eq("stripe_payment_intent_id", charge.payment_intent as string);
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        logStep("Dispute created", { disputeId: dispute.id });

        // Find the payment and create a notification
        if (dispute.payment_intent) {
          const { data: payment } = await supabaseClient
            .from("payments")
            .select("user_id, booking_id")
            .eq("stripe_payment_intent_id", dispute.payment_intent as string)
            .limit(1)
            .single();

          if (payment) {
            // charge.dispute.created is enabled on both the platform and the
            // Connect endpoint, so key the notification on the dispute id
            // rather than the event id to stay single-write.
            const { data: existing } = await supabaseClient
              .from("notifications")
              .select("id")
              .eq("type", "payment")
              .contains("data", { dispute_id: dispute.id })
              .limit(1)
              .maybeSingle();

            if (!existing) {
              await supabaseClient.from("notifications").insert({
                user_id: payment.user_id,
                type: "payment",
                title: "Payment Dispute",
                message: `A payment dispute has been filed for $${(dispute.amount / 100).toFixed(2)}`,
                data: { dispute_id: dispute.id, booking_id: payment.booking_id },
              });
            }
          }

        }
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout paid", { payoutId: payout.id, amount: payout.amount });

        // Find the team by connected account
        const connectedAccountId = event.account;
        let teamId = null;
        if (connectedAccountId) {
          const { data: team } = await supabaseClient
            .from("teams")
            .select("id")
            .eq("stripe_account_id", connectedAccountId)
            .limit(1)
            .single();
          teamId = team?.id;
        }

        await supabaseClient.from("payouts").insert({
          user_id: "00000000-0000-0000-0000-000000000000", // System-level payout
          amount: payout.amount / 100,
          currency: payout.currency.toUpperCase(),
          status: payout.status,
          stripe_payout_id: payout.id,
          arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
          description: payout.description || "Payout",
          team_id: teamId,
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { subId: subscription.id, status: subscription.status });

        // Find the user by customer email and notify them
        const updatedCustomer = await stripe.customers.retrieve(subscription.customer as string);
        if (updatedCustomer && !updatedCustomer.deleted && updatedCustomer.email) {
          const { data: profile } = await supabaseClient
            .from("profiles")
            .select("id")
            .eq("email", updatedCustomer.email)
            .limit(1)
            .maybeSingle();

          if (profile) {
            const tierName = subscription.metadata?.tierId || 'unknown';
            await supabaseClient.from("notifications").insert({
              user_id: profile.id,
              type: "payment",
              title: "Subscription Updated",
              message: `Your subscription (${tierName}) status is now: ${subscription.status}`,
              data: { subscription_id: subscription.id, status: subscription.status, tier: tierName },
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription cancelled", { subId: subscription.id });

        const cancelledCustomer = await stripe.customers.retrieve(subscription.customer as string);
        if (cancelledCustomer && !cancelledCustomer.deleted && cancelledCustomer.email) {
          const { data: profile } = await supabaseClient
            .from("profiles")
            .select("id")
            .eq("email", cancelledCustomer.email)
            .limit(1)
            .maybeSingle();

          if (profile) {
            await supabaseClient.from("notifications").insert({
              user_id: profile.id,
              type: "payment",
              title: "Subscription Cancelled",
              message: "Your subscription has been cancelled. You will lose access at the end of the current billing period.",
              data: { subscription_id: subscription.id },
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment failed", { invoiceId: invoice.id, customer: invoice.customer });

        if (invoice.customer) {
          const failedCustomer = await stripe.customers.retrieve(invoice.customer as string);
          if (failedCustomer && !failedCustomer.deleted && failedCustomer.email) {
            const { data: profile } = await supabaseClient
              .from("profiles")
              .select("id")
              .eq("email", failedCustomer.email)
              .limit(1)
              .maybeSingle();

            if (profile) {
              await supabaseClient.from("notifications").insert({
                user_id: profile.id,
                type: "payment",
                title: "Payment Failed",
                message: `Your payment of $${((invoice.amount_due || 0) / 100).toFixed(2)} failed. Please update your payment method to avoid service interruption.`,
                data: { invoice_id: invoice.id },
              });
            }
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: error instanceof Error && error.message.includes("signature") ? 400 : 500,
    });
  }
});

// Logs Stripe's processing fee as a confirmed vehicle_expense for accurate margin.
// Idempotent on (source_module='stripe_fee', source_record_id=<charge uuid v5 from charge.id>).
async function logStripeProcessingFee(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  charge: Stripe.Charge,
) {
  try {
    if (!charge.payment_intent) return;

    // Need booking + team context — pull from existing payments record
    const { data: payment } = await supabase
      .from("payments")
      .select("booking_id, team_id, user_id")
      .eq("stripe_payment_intent_id", charge.payment_intent as string)
      .limit(1)
      .single();
    if (!payment?.team_id || !payment.booking_id) {
      logStep("Skipping fee log — no booking/team", { chargeId: charge.id });
      return;
    }

    // Pull balance transaction for accurate fee
    let feeCents = 0;
    if (charge.balance_transaction) {
      const bt = typeof charge.balance_transaction === "string"
        ? await stripe.balanceTransactions.retrieve(charge.balance_transaction)
        : charge.balance_transaction;
      feeCents = bt.fee || 0;
    }
    if (feeCents <= 0) return;

    // Stable uuid for idempotency
    const chargeUuid = await chargeIdToUuid(charge.id);


    const { data: booking } = await supabase
      .from("bookings")
      .select("vehicle_id")
      .eq("id", payment.booking_id)
      .maybeSingle();

    const { error } = await supabase
      .from("vehicle_expenses")
      .insert({
        team_id: payment.team_id,
        vehicle_id: booking?.vehicle_id || null,
        booking_id: payment.booking_id,
        expense_type: "processing_fee",
        amount: feeCents / 100,
        expense_date: new Date((charge.created || Date.now() / 1000) * 1000).toISOString().slice(0, 10),
        vendor: "Stripe",
        notes: `Card processing fee on charge ${charge.id}`,
        source_module: "stripe_fee",
        source_record_id: chargeUuid,
        status: "confirmed",
        auto_routed_reason: "ok",
        ai_confidence: 1,
        created_by: payment.user_id || null,
      });
    if (error && !String(error.message).includes("duplicate")) {
      console.error("[STRIPE-WEBHOOK] fee log error", error);
    } else {
      logStep("Processing fee logged", { chargeId: charge.id, fee: feeCents / 100 });
    }
  } catch (e) {
    console.error("[STRIPE-WEBHOOK] logStripeProcessingFee failed", e);
  }
}

// Deterministic UUID (v5-style layout) from a charge id, using SHA-256 via Web Crypto.
async function chargeIdToUuid(chargeId: string): Promise<string> {
  const data = new TextEncoder().encode(`stripe_charge:${chargeId}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const b = digest.slice(0, 16);
  // RFC4122 layout: version 5, variant 10xx
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

