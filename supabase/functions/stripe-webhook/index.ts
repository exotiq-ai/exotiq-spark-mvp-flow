import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Idempotency check
    const { data: existing } = await supabaseClient
      .from("stripe_webhook_events")
      .select("id")
      .eq("stripe_event_id", event.id)
      .limit(1)
      .single();

    if (existing) {
      logStep("Duplicate event, skipping", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }

    // Record event
    await supabaseClient.from("stripe_webhook_events").insert({
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

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id, mode: session.mode });

        if (session.mode === "payment" && session.metadata?.booking_id) {
          // Tenant payment — update booking and payment records
          const bookingId = session.metadata.booking_id;
          const userId = session.metadata.user_id;
          const paymentType = session.metadata.payment_type || "balance";

          await supabaseClient.from("payments").insert({
            booking_id: bookingId,
            user_id: userId,
            amount: (session.amount_total || 0) / 100,
            payment_type: paymentType,
            payment_method: "stripe",
            payment_status: "completed",
            stripe_payment_intent_id: session.payment_intent as string,
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

        await supabaseClient
          .from("payments")
          .update({ payment_status: "completed" })
          .eq("stripe_payment_intent_id", pi.id);
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
            await supabaseClient.from("notifications").insert({
              user_id: payment.user_id,
              type: "payment",
              title: "Payment Dispute",
              message: `A payment dispute has been filed for $${(dispute.amount / 100).toFixed(2)}`,
              data: { dispute_id: dispute.id, booking_id: payment.booking_id },
            });
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
