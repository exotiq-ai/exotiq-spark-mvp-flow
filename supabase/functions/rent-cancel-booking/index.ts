// M6c: renter self-serve cancellation (M6-D5 + M6-D7).
// Ref: exotiq-rent docs/rent/M6_MONEY_PLAN.md.
//
// Anonymous POST { booking_ref, token }. Window rule, enforced server-side
// against bookings.start_date (the pickup moment, stored tz-aware by M5):
//   - ≥72h before pickup: FREE — full refund of both charges if paid;
//     status → 'refunded' (paid) or 'cancelled' (unpaid).
//   - <72h: forfeit — no refunds (fee/protection per D5, rental per D7);
//     status → 'cancelled'. The renter is told before confirming.
//   - active/completed bookings cannot self-cancel (contact the operator).
//
// Refund mechanics: the rental was a destination charge on the platform →
// refund with reverse_transfer so the operator's share returns; the Exotiq
// leg is a plain platform refund. Idempotency keys per leg; Stripe treats
// an already-refunded PI refund attempt as an error we tolerate.
//
// config.toml: verify_jwt = false (guest path; the token is the credential).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { resolveStripeMode } from "../_shared/stripeMode.ts";
import { sendRenterEmail } from "../_shared/rentEmail.ts";
import {
  buildStorefrontUrl,
  buildVehicleUrl,
  formatCurrency,
  formatDateRange,
  formatPickupTime,
  shortVehicleName,
} from "../_shared/rentFormat.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_HOUR = 10;

function allowRequest(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (!ip) return true;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (entry && entry.resetAt > now) {
    if (entry.count >= MAX_PER_HOUR) return false;
    entry.count += 1;
    return true;
  }
  rateLimitMap.set(ip, { count: 1, resetAt: now + 3_600_000 });
  return true;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[RENT-CANCEL-BOOKING] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const FREE_WINDOW_MS = 72 * 60 * 60 * 1000;
const CANCELLABLE = ["requested", "pending_documents", "pending_payment", "confirmed"];

async function refundLeg(
  stripe: Stripe,
  paymentIntentId: string | null,
  opts: { reverseTransfer: boolean; idempotencyKey: string },
): Promise<boolean> {
  if (!paymentIntentId || paymentIntentId === "none_required") return true;
  try {
    await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        ...(opts.reverseTransfer ? { reverse_transfer: true } : {}),
      },
      { idempotencyKey: opts.idempotencyKey },
    );
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Already fully refunded → treat as success (idempotent retries).
    if (message.includes("already been refunded")) return true;
    console.error("[RENT-CANCEL-BOOKING] refund failed", { paymentIntentId, message });
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!allowRequest(req)) return json({ error: "Too many requests" }, 429);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const bookingRef = typeof body.booking_ref === "string" ? body.booking_ref.trim() : "";
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!bookingRef || !token) return json({ error: "booking_ref and token are required" }, 400);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, booking_ref, status, booking_source, confirmation_token, start_date, end_date, paid_at, " +
        "customer_email, customer_name, pickup_location, total_value, platform_fee_cents, protection_total_cents, " +
        "operator_payment_intent_id, exotiq_payment_intent_id, user_id, team_id, vehicle_id, vehicle_name",
      )
      .eq("booking_ref", bookingRef)
      .eq("booking_source", "marketplace")
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (!booking || booking.confirmation_token !== token) return json({ error: "Booking not found" }, 404);
    if (!CANCELLABLE.includes(booking.status)) {
      return json({ error: `This booking can no longer be cancelled online (status: ${booking.status})` }, 409);
    }

    const pickupMs = Date.parse(booking.start_date);
    const inFreeWindow = Number.isFinite(pickupMs) && pickupMs - Date.now() >= FREE_WINDOW_MS;
    const paid = Boolean(booking.paid_at);

    let refunded = false;
    if (paid && inFreeWindow) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
      const mode = resolveStripeMode();
      const rentalOk = await refundLeg(stripe, booking.operator_payment_intent_id, {
        reverseTransfer: true,
        idempotencyKey: `cancel-rental-${booking.booking_ref}`,
      });
      const exotiqOk = await refundLeg(stripe, booking.exotiq_payment_intent_id, {
        reverseTransfer: false,
        idempotencyKey: `cancel-exotiq-${booking.booking_ref}`,
      });
      if (!rentalOk || !exotiqOk) {
        // Partial refund state: do NOT flip the status; surface for ops and
        // let the renter retry (idempotency keys make retries safe).
        try {
          await admin.from("user_activity_log").insert({
            user_id: booking.user_id,
            team_id: booking.team_id,
            action: "renter_cancel_refund_failed",
            details: { booking_ref: booking.booking_ref, rentalOk, exotiqOk, mode },
          });
        } catch (_) { /* telemetry only */ }
        return json({ error: "Refund could not be completed — please try again or contact support" }, 502);
      }
      refunded = true;
    }
    if (paid && !inFreeWindow) {
      // M6-D5/D7: inside 72h everything is forfeit. The frontend warns
      // before submitting; enforce a second explicit acknowledgement here.
      if (body.acknowledge_forfeit !== true) {
        return json({ error: "Cancelling now forfeits all payments", code: "forfeit_ack_required" }, 409);
      }
    }

    const nextStatus = refunded ? "refunded" : "cancelled";
    const { error: updateError } = await admin
      .from("bookings")
      .update({ status: nextStatus })
      .eq("id", booking.id)
      .in("status", CANCELLABLE); // guard against races
    if (updateError) throw updateError;

    if (refunded && booking.customer_email) {
      try {
        const { data: team } = await admin
          .from("teams")
          .select("slug, name, currency, timezone")
          .eq("id", booking.team_id)
          .single();
        const { data: vehicle } = await admin
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
        const storefrontUrl = buildStorefrontUrl(team?.slug ?? "", origin);
        const vehicleUrl = vehicle?.slug ? buildVehicleUrl(team?.slug ?? "", vehicle.slug, origin) : storefrontUrl;

        await sendRenterEmail({
          templateName: "refundConfirmation",
          to: booking.customer_email,
          subject: `Refunded — booking ${bookingRef}`,
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
            TOTAL_REFUNDED: formatCurrency(totalPaid, currency),
            STOREFRONT_URL: storefrontUrl,
            VEHICLE_URL: vehicleUrl,
          },
          idempotencyKey: `refund-renter-${bookingRef}`,
          replyTo: `${team?.name ?? "Operator"} <no-reply@exotiq.ai>`,
          tags: [{ name: "booking_ref", value: bookingRef }, { name: "email_type", value: "refund_confirmation" }],
        });
        logStep("Refund confirmation email sent", { bookingRef });
      } catch (emailError) {
        logStep("Refund confirmation email failed", { bookingRef, error: String(emailError) });
      }
    }

    try {
      await admin.from("user_activity_log").insert({
        user_id: booking.user_id,
        team_id: booking.team_id,
        action: "marketplace_booking_cancelled",
        details: { booking_ref: booking.booking_ref, by: "renter", refunded, in_free_window: inFreeWindow },
      });
    } catch (_) { /* telemetry only */ }

    logStep("Cancelled", { bookingRef, nextStatus, refunded });
    return json({ status: nextStatus, refunded });
  } catch (error) {
    console.error("[RENT-CANCEL-BOOKING] error", error);
    return json({ error: "Unable to cancel booking" }, 500);
  }
});

