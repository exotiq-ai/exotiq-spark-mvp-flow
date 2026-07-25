// M6b: Stripe webhook for the renter payment flow.
// Ref: exotiq-rent docs/rent/M6_MONEY_PLAN.md (M6-D1 rev 2) and
// docs/rent/patches/m6a-payment-foundations/README.md.
//
// Registered in Stripe (per mode) for:
//   - checkout.session.completed   (operator rental paid on-session)
//   - payment_intent.succeeded     (Exotiq leg async-confirm path)
//   - payment_intent.payment_failed
//
// State rule (Lovable flag #6): 'confirmed' fires ONLY when both legs have
// succeeded, evaluated from the booking row — never from a single event —
// so redelivery and reordering are harmless. Events dedupe via the
// stripe_webhook_events table.
//
// Partial failure (rental paid, Exotiq leg declined): the booking STAYS
// pending_payment with an ops alert in user_activity_log; the renter
// retries from the confirmation page. Never silently confirmed.
//
// config.toml: verify_jwt = false (Stripe calls this, not a user).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { resolveStripeMode } from "../_shared/stripeMode.ts";
import { sendRenterEmail, resolveRenterReplyTo } from "../_shared/rentEmail.ts";
import {
  buildPayUrl,
  buildStorefrontUrl,
  buildVehicleUrl,
  formatCurrency,
  formatDateRange,
  formatPickupTime,
  shortVehicleName,
} from "../_shared/rentFormat.ts";


const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[RENT-PAYMENT-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Confirm iff both legs succeeded (idempotent; safe under redelivery).
 *  Phase 6: if the renter hasn't cleared ID verification yet, park at
 *  `pending_documents` and fire the ID-drip email instead of jumping to
 *  `confirmed`. The identity-webhook auto-promotes to `confirmed` once
 *  identity_status becomes 'verified'. */
async function confirmIfFullyPaid(db: ReturnType<typeof admin>, bookingRef: string, mode: string) {
  const { data: booking } = await db
    .from("bookings")
    .select(
      "id, status, operator_payment_intent_id, exotiq_payment_intent_id, paid_at, " +
      "customer_id, customer_email, customer_name, start_date, end_date, pickup_location, " +
      "total_value, platform_fee_cents, protection_total_cents, vehicle_id, vehicle_name, " +
      "team_id, confirmation_token",
    )
    .eq("booking_ref", bookingRef)
    .maybeSingle();
  if (!booking) return;
  if (booking.status !== "pending_payment") return; // already promoted / expired / declined
  if (!booking.operator_payment_intent_id || !booking.exotiq_payment_intent_id) return;

  // Is the renter already ID-verified?
  let identityVerified = false;
  if (booking.customer_id) {
    const { data: customer } = await db
      .from("customers")
      .select("identity_status")
      .eq("id", booking.customer_id)
      .maybeSingle();
    identityVerified = customer?.identity_status === "verified";
  }

  const nextStatus = identityVerified ? "confirmed" : "pending_documents";
  const paidAt = booking.paid_at ?? new Date().toISOString();
  const { error } = await db
    .from("bookings")
    .update({
      status: nextStatus,
      paid_at: paidAt,
      payment_stripe_mode: mode,
    })
    .eq("id", booking.id)
    .eq("status", "pending_payment"); // guard against races
  if (error) return;

  logStep(identityVerified ? "Booking confirmed" : "Booking paid, awaiting ID", { bookingRef, nextStatus });

  // Send receipt email either way — payment cleared, renter deserves a receipt.
  if (booking.customer_email) {
    try {
      const { data: team } = await db
        .from("teams")
        .select("slug, name, currency, timezone, support_email")
        .eq("id", booking.team_id)
        .single();
      const { data: vehicle } = await db
        .from("vehicles")
        .select("slug")
        .eq("id", booking.vehicle_id)
        .maybeSingle();
      const currency = team?.currency ?? "USD";
      const timezone = team?.timezone ?? "UTC";
      const rentalAmount = Number(booking.total_value ?? 0);
      const exotiqAmount =
        (Number(booking.platform_fee_cents ?? 0) + Number(booking.protection_total_cents ?? 0)) / 100;
      const totalPaid = rentalAmount + exotiqAmount;

      const vehicleName = booking.vehicle_name || "Vehicle";
      const vehicleShort = shortVehicleName(vehicleName);
      const origin = "https://book.exotiq.rent";
      const payUrl = buildPayUrl(bookingRef, booking.confirmation_token, origin);
      const storefrontUrl = `https://${team?.slug ?? "book"}.exotiq.rent`;
      const vehicleUrl = vehicle?.slug ? `${storefrontUrl}/vehicles/${vehicle.slug}` : storefrontUrl;

        await sendRenterEmail({
          templateName: "receiptConfirmed",
          to: booking.customer_email,
          subject: `Receipt confirmed — booking ${bookingRef}`,
          variables: {
            BOOKING_REF: bookingRef,
            OPERATOR_NAME: team?.name ?? "Operator",
            VEHICLE_NAME: vehicleName,
            VEHICLE_SHORT: vehicleShort,
            DATE_RANGE: formatDateRange(booking.start_date, booking.end_date),
            PICKUP_TIME: formatPickupTime(booking.start_date, timezone),
            LOCATION: booking.pickup_location,
            RENTAL_AMOUNT: formatCurrency(rentalAmount, currency),
            EXOTIQ_AMOUNT: formatCurrency(exotiqAmount, currency),
            TOTAL_PAID: formatCurrency(totalPaid, currency),
            CONFIRMATION_URL: payUrl,
            STOREFRONT_URL: storefrontUrl,
            VEHICLE_URL: vehicleUrl,
          },
          idempotencyKey: `receipt-${bookingRef}`,
          replyTo: resolveRenterReplyTo(team?.support_email),
          tags: [{ name: "booking_ref", value: bookingRef }, { name: "email_type", value: "receipt_confirmed" }],
        });
      logStep("Receipt email sent", { bookingRef });

      // ID-verify drip — only when we parked at pending_documents.
      if (!identityVerified) {
        const verifyUrl = `${origin}/verify?ref=${bookingRef}&token=${booking.confirmation_token}`;
        await sendRenterEmail({
          templateName: "verifyIdRequested",
          to: booking.customer_email,
          subject: `Verify your ID — booking ${bookingRef}`,
          variables: {
            BOOKING_REF: bookingRef,
            OPERATOR_NAME: team?.name ?? "Operator",
            VEHICLE_SHORT: vehicleShort,
            DATE_RANGE: formatDateRange(booking.start_date, booking.end_date),
            VERIFY_URL: verifyUrl,
          },
          idempotencyKey: `verify-id-${bookingRef}`,
          replyTo: resolveRenterReplyTo(team?.support_email),
          tags: [{ name: "booking_ref", value: bookingRef }, { name: "email_type", value: "verify_id_requested" }],
        });
        logStep("ID-verify drip sent", { bookingRef });
      }
    } catch (emailError) {
      logStep("Post-payment email failed", { bookingRef, error: String(emailError) });
    }
  }
}



/**
 * Mirror a Stripe PaymentIntent into the payments ledger, idempotent on
 * stripe_payment_intent_id. Every payment surface (booking card, dues,
 * PaymentTracker, margin) reads from this table; the booking row remains
 * source of truth for lifecycle. Safe under webhook redelivery.
 */
async function mirrorPayment(
  db: ReturnType<typeof admin>,
  bookingRef: string,
  leg: "rental" | "fee",
  paymentIntentId: string,
  amount: number,
  transactionDate: string,
) {
  if (!paymentIntentId || paymentIntentId === "none_required" || amount <= 0) return;
  const { data: booking } = await db
    .from("bookings")
    .select("id, user_id, team_id")
    .eq("booking_ref", bookingRef)
    .maybeSingle();
  if (!booking) return;
  const { error } = await db.from("payments").insert({
    user_id: booking.user_id,
    booking_id: booking.id,
    team_id: booking.team_id,
    payment_type: leg === "rental" ? "rental" : "fee",
    amount,
    payment_status: "completed",
    payment_method: "stripe",
    stripe_payment_intent_id: paymentIntentId,
    transaction_date: transactionDate,
    notes: leg === "rental"
      ? "Marketplace rental — Stripe destination charge"
      : "Exotiq booking fee + protection",
  });
  // 23505 = unique_violation → already mirrored on an earlier delivery.
  if (error && (error as { code?: string }).code !== "23505") {
    logStep("mirrorPayment failed", { bookingRef, leg, code: (error as { code?: string }).code });
  }
}

async function opsAlert(db: ReturnType<typeof admin>, bookingRef: string, action: string, details: Record<string, unknown>) {
  // Best-effort — mirrors the M5 audit-trail pattern.
  try {
    const { data: booking } = await db
      .from("bookings")
      .select("user_id, team_id")
      .eq("booking_ref", bookingRef)
      .maybeSingle();
    if (!booking) return;
    await db.from("user_activity_log").insert({
      user_id: booking.user_id,
      team_id: booking.team_id,
      action,
      details: { booking_ref: bookingRef, ...details },
    });
  } catch (_) {
    // never fail the webhook over telemetry
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("RENT_PAYMENT_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[RENT-PAYMENT-WEBHOOK] RENT_PAYMENT_WEBHOOK_SECRET not set");
    return new Response("Misconfigured", { status: 500 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature") ?? "";
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (err) {
    console.error("[RENT-PAYMENT-WEBHOOK] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const db = admin();
  const mode = resolveStripeMode();

  // Dedupe via the existing stripe_webhook_events table (Lovable flag #6).
  // APPLY NOTE: align column names with the deployed table if they differ.
  const { error: dedupeError } = await db
    .from("stripe_webhook_events")
    .insert({ stripe_event_id: event.id, event_type: event.type });
  if (dedupeError) {
    // Unique violation → already processed; anything else → let Stripe retry.
    if ((dedupeError as { code?: string }).code === "23505") {
      logStep("Duplicate event skipped", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }
    console.error("[RENT-PAYMENT-WEBHOOK] dedupe insert failed", dedupeError);
    return new Response("Dedupe failure", { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingRef = session.metadata?.booking_ref;
        if (!bookingRef || session.metadata?.leg !== "operator_rental") break;
        const operatorPi = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
        if (!operatorPi) break;

        logStep("Rental paid", { bookingRef, operatorPi });
        const nowIso = new Date().toISOString();

        // Cluster A: ALWAYS persist the captured PI, regardless of status.
        // A pay/cancel race or a late payment against an already-expired
        // booking must not leave money on Stripe with the PI id nowhere in
        // our system — otherwise ops can never refund it.
        await db
          .from("bookings")
          .update({ operator_payment_intent_id: operatorPi, payment_stripe_mode: mode })
          .eq("booking_ref", bookingRef)
          .is("operator_payment_intent_id", null);

        const { data: bookingRow } = await db
          .from("bookings")
          .select(
            "id, status, total_value, paid_at, platform_fee_cents, protection_total_cents, exotiq_payment_intent_id, exotiq_leg_attempt",
          )
          .eq("booking_ref", bookingRef)
          .maybeSingle();
        if (!bookingRow) {
          await opsAlert(db, bookingRef, "renter_payment_orphaned_booking", { operatorPi });
          break;
        }

        // Mirror rental leg to payments ledger (idempotent on PI id).
        await mirrorPayment(
          db,
          bookingRef,
          "rental",
          operatorPi,
          Number(bookingRow.total_value ?? 0),
          bookingRow.paid_at ?? nowIso,
        );

        // Terminal-state guard: auto-refund with reverse_transfer so the
        // operator's connected account is also debited, then alert ops.
        if (bookingRow.status !== "pending_payment" && bookingRow.status !== "confirmed") {
          await opsAlert(db, bookingRef, "renter_payment_after_terminal_state", {
            status: bookingRow.status,
            operatorPi,
          });
          try {
            await stripe.refunds.create(
              { payment_intent: operatorPi, reverse_transfer: true },
              { idempotencyKey: `auto-refund-rental-${bookingRef}` },
            );
            logStep("Auto-refunded terminal-state rental", { bookingRef, operatorPi });
          } catch (refundErr) {
            await opsAlert(db, bookingRef, "renter_payment_auto_refund_failed", {
              operatorPi,
              detail: refundErr instanceof Error ? refundErr.message : String(refundErr),
            });
          }
          break;
        }

        if (bookingRow.exotiq_payment_intent_id) {
          await confirmIfFullyPaid(db, bookingRef, mode);
          break;
        }

        const exotiqCents =
          Number(bookingRow.platform_fee_cents ?? 0) + Number(bookingRow.protection_total_cents ?? 0);
        if (exotiqCents <= 0) {
          await db
            .from("bookings")
            .update({ exotiq_payment_intent_id: "none_required" })
            .eq("booking_ref", bookingRef);
          await confirmIfFullyPaid(db, bookingRef, mode);
          break;
        }

        const rentalPi = await stripe.paymentIntents.retrieve(operatorPi);
        const paymentMethod = typeof rentalPi.payment_method === "string"
          ? rentalPi.payment_method
          : rentalPi.payment_method?.id;
        const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (!paymentMethod || !customer) {
          await opsAlert(db, bookingRef, "renter_payment_partial_failure", {
            reason: "saved payment method or customer missing for the Exotiq leg",
          });
          break;
        }

        // Attempt-scoped idempotency key so a fresh card can retry after a
        // decline (M6 flag #9).
        const attempt = ((bookingRow.exotiq_leg_attempt as number | null) ?? 0) + 1;
        await db.from("bookings").update({ exotiq_leg_attempt: attempt }).eq("id", bookingRow.id);

        try {
          const exotiqPi = await stripe.paymentIntents.create(
            {
              amount: exotiqCents,
              currency: rentalPi.currency,
              customer,
              payment_method: paymentMethod,
              off_session: true,
              confirm: true,
              statement_descriptor_suffix: "EXOTIQ RENT",
              description: `Exotiq booking fee + protection — ${bookingRef}`,
              metadata: { booking_ref: bookingRef, leg: "exotiq_fee_protection", stripe_mode: mode, attempt: String(attempt) },
            },
            { idempotencyKey: `exotiq-leg-${bookingRef}-${attempt}` },
          );
          await db
            .from("bookings")
            .update({ exotiq_payment_intent_id: exotiqPi.id })
            .eq("booking_ref", bookingRef);
          if (exotiqPi.status === "succeeded") {
            await mirrorPayment(db, bookingRef, "fee", exotiqPi.id, exotiqCents / 100, new Date().toISOString());
            await confirmIfFullyPaid(db, bookingRef, mode);
          }
        } catch (chargeError) {
          logStep("Exotiq leg declined", { bookingRef });
          await opsAlert(db, bookingRef, "renter_payment_partial_failure", {
            reason: "exotiq fee+protection charge declined off-session",
            attempt,
            detail: chargeError instanceof Error ? chargeError.message : String(chargeError),
          });
        }
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingRef = pi.metadata?.booking_ref;
        if (!bookingRef || pi.metadata?.leg !== "exotiq_fee_protection") break;
        await db
          .from("bookings")
          .update({ exotiq_payment_intent_id: pi.id })
          .eq("booking_ref", bookingRef)
          .eq("status", "pending_payment");
        await mirrorPayment(
          db,
          bookingRef,
          "fee",
          pi.id,
          Number(pi.amount ?? 0) / 100,
          new Date().toISOString(),
        );
        await confirmIfFullyPaid(db, bookingRef, mode);
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingRef = pi.metadata?.booking_ref;
        if (!bookingRef) break;
        await opsAlert(db, bookingRef, "renter_payment_failed", {
          leg: pi.metadata?.leg ?? "unknown",
          reason: pi.last_payment_error?.message ?? "payment_failed",
        });
        break;
      }

      default:
        logStep("Ignored event", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error("[RENT-PAYMENT-WEBHOOK] handler error", error);
    // Release the dedupe row so Stripe's redelivery actually reprocesses —
    // otherwise the duplicate check would swallow the retry of failed work.
    // Per-leg idempotency keys keep the retry from double-charging.
    await db.from("stripe_webhook_events").delete().eq("stripe_event_id", event.id);
    return new Response("Handler error", { status: 500 });
  }
});
