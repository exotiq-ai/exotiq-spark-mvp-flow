// M6c: operator/Command-Center refund for a paid marketplace booking.
// Ref: exotiq-rent docs/rent/M6_MONEY_PLAN.md (M6-D5: decline after payment
// auto-refunds both charges in full; also usable for goodwill refunds).
//
// Authenticated POST { booking_ref } — the caller must be an active member
// of the booking's team (same posture as create-payment-checkout). Refunds
// BOTH legs in full (rental with reverse_transfer, Exotiq platform charge
// plain) and flips the booking to 'refunded'.
//
// Command Center wiring (Lovable): call this when declining a booking whose
// paid_at is set, and from any manual "refund booking" action.
//
// config.toml: verify_jwt = true (operator credential required).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[RENT-REFUND-BOOKING] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const REFUNDABLE = ["pending_payment", "confirmed", "declined", "cancelled"];

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
    if (message.includes("already been refunded")) return true;
    console.error("[RENT-REFUND-BOOKING] refund failed", { paymentIntentId, message });
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Operator authentication + team membership (create-payment-checkout posture).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header provided" }, 401);
    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) return json({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const bookingRef = typeof body.booking_ref === "string" ? body.booking_ref.trim() : "";
    if (!bookingRef) return json({ error: "booking_ref is required" }, 400);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, booking_ref, status, booking_source, paid_at, team_id, user_id, " +
        "operator_payment_intent_id, exotiq_payment_intent_id, payment_stripe_mode, " +
        "customer_email, customer_name, start_date, end_date, pickup_location, " +
        "total_value, platform_fee_cents, protection_total_cents, state_fee_cents, processing_fee_cents, vehicle_id, vehicle_name",

      )
      .eq("booking_ref", bookingRef)
      .eq("booking_source", "marketplace")
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (!booking) return json({ error: "Booking not found" }, 404);

    const { data: membership } = await admin
      .from("team_members")
      .select("id")
      .eq("user_id", userId)
      .eq("team_id", booking.team_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) return json({ error: "Not a member of this booking's team" }, 403);

    // Cluster A: refund by PI presence, not paid_at. paid_at only gets set
    // when BOTH legs succeed; a partial-capture booking (rental charged,
    // Exotiq leg pending/failed) still has real money on Stripe that must
    // be refundable from ops. Mirrors public.booking_has_captured_leg.
    const hasCapturedLeg = Boolean(
      booking.operator_payment_intent_id ||
        booking.exotiq_payment_intent_id ||
        booking.paid_at,
    );
    if (!hasCapturedLeg) return json({ error: "Booking has no captured payment to refund" }, 409);
    if (!REFUNDABLE.includes(booking.status)) {
      return json({ error: `Booking cannot be refunded from status: ${booking.status}` }, 409);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const rentalOk = await refundLeg(stripe, booking.operator_payment_intent_id, {
      reverseTransfer: true,
      idempotencyKey: `op-refund-rental-${booking.booking_ref}`,
    });
    const exotiqOk = await refundLeg(stripe, booking.exotiq_payment_intent_id, {
      reverseTransfer: false,
      idempotencyKey: `op-refund-exotiq-${booking.booking_ref}`,
    });

    // Walk booking_extensions and refund each captured row's two legs.
    // Ops-initiated refund is all-or-nothing → always refund extensions.
    const { data: extensions } = await admin
      .from("booking_extensions")
      .select("id, operator_payment_intent_id, exotiq_payment_intent_id")
      .eq("booking_id", booking.id)
      .in("status", ["paid", "partially_paid"]);

    let extensionsOk = true;
    for (const ext of extensions ?? []) {
      const extOpOk = await refundLeg(stripe, ext.operator_payment_intent_id, {
        reverseTransfer: true,
        idempotencyKey: `op-refund-ext-op-${ext.id}`,
      });
      const extFeeOk = await refundLeg(stripe, ext.exotiq_payment_intent_id, {
        reverseTransfer: false,
        idempotencyKey: `op-refund-ext-exotiq-${ext.id}`,
      });
      if (extOpOk && extFeeOk) {
        await admin
          .from("booking_extensions")
          .update({ status: "refunded" })
          .eq("id", ext.id);
      } else {
        extensionsOk = false;
      }
    }

    if (!rentalOk || !exotiqOk || !extensionsOk) {
      return json({ error: "Refund partially failed — retry (idempotent) or resolve in the Stripe dashboard", rentalOk, exotiqOk, extensionsOk }, 502);
    }

    const { error: updateError } = await admin
      .from("bookings")
      .update({ status: "refunded" })
      .eq("id", booking.id);
    if (updateError) throw updateError;


    if (booking.customer_email) {
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
          idempotencyKey: `refund-op-${bookingRef}`,
          replyTo: Deno.env.get("RENTER_EMAIL_REPLY_TO") ?? "support@exotiq.ai",
          tags: [{ name: "booking_ref", value: bookingRef }, { name: "email_type", value: "refund_confirmation" }],
        });
        logStep("Refund confirmation email sent", { bookingRef });
      } catch (emailError) {
        logStep("Refund confirmation email failed", { bookingRef, error: String(emailError) });
      }
    }

    try {
      await admin.from("user_activity_log").insert({
        user_id: userId,
        team_id: booking.team_id,
        action: "marketplace_booking_refunded",
        details: { booking_ref: booking.booking_ref, by: "operator", previous_status: booking.status },
      });
    } catch (_) { /* telemetry only */ }

    logStep("Refunded", { bookingRef });
    return json({ status: "refunded" });
  } catch (error) {
    console.error("[RENT-REFUND-BOOKING] error", error);
    return json({ error: "Unable to refund booking" }, 500);
  }
});

