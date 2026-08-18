// Resend the renter's existing payment link.
//
// MONEY GUARDRAIL: this function is email-only. It creates no charge, no
// PaymentIntent and no Checkout Session, and it never writes an amount, a fee
// or the payment deadline. It re-sends the SAME tokenized link for the SAME
// payment window that rent-approve-booking already issued.
//
// Operator-only POST { booking_id }. Requires status 'pending_payment'.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { sendRenterEmail, resolveRenterReplyTo } from "../_shared/rentEmail.ts";
import {
  buildPayUrl,
  formatCurrency,
  formatDateRange,
  formatPaymentDeadline,
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
  console.log(`[RENT-RESEND-PAYMENT-LINK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header provided" }, 401);
    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) return json({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const bookingId = typeof body.booking_id === "string" ? body.booking_id.trim() : "";
    if (!bookingId) return json({ error: "booking_id is required" }, 400);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, booking_ref, status, booking_source, customer_email, customer_name, " +
        "start_date, end_date, pickup_location, total_value, platform_fee_cents, protection_total_cents, " +
        "vehicle_name, team_id, confirmation_token, payment_due_at",
      )
      .eq("id", bookingId)
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
    let authorized = Boolean(membership);
    if (!authorized) {
      const { data: isSuper } = await admin.rpc("is_super_admin", { check_user_id: userId });
      authorized = Boolean(isSuper);
    }
    if (!authorized) return json({ error: "Not a member of this booking's team" }, 403);

    if (booking.status !== "pending_payment") {
      return json(
        { error: `This booking isn't awaiting payment (status: ${booking.status}), so there's no payment link to send.` },
        409,
      );
    }
    if (!booking.customer_email) {
      return json({ error: "This booking has no renter email on file." }, 409);
    }
    if (!booking.confirmation_token) {
      return json({ error: "This booking has no secure link token — approve it again to issue one." }, 409);
    }

    // Throttle: one resend per booking per 60s so a double click can't spam.
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      _bucket: `resend-pay-link:${booking.id}`,
      _limit: 1,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return json({ error: "A payment link was just sent. Wait a minute before sending another." }, 429);
    }

    const { data: team } = await admin
      .from("teams")
      .select("name, currency, timezone, support_email")
      .eq("id", booking.team_id)
      .single();

    const currency = team?.currency ?? "USD";
    const timezone = team?.timezone ?? "UTC";
    // Display only — these are the already-stored amounts, recomputed for the
    // email body exactly the way rent-approve-booking rendered them.
    const rentalAmount = Number(booking.total_value ?? 0);
    const exotiqAmount =
      (Number(booking.platform_fee_cents ?? 0) + Number(booking.protection_total_cents ?? 0)) / 100;
    const totalDue = rentalAmount + exotiqAmount;

    const renterOrigin = Deno.env.get("RENTER_APP_ORIGIN") ?? "https://book.exotiq.rent";
    const payUrl = buildPayUrl(booking.booking_ref, String(booking.confirmation_token), renterOrigin);

    const vehicleName = booking.vehicle_name || "Vehicle";
    const vehicleShort = shortVehicleName(vehicleName);
    const operatorName = team?.name ?? "Operator";

    await sendRenterEmail({
      templateName: "paymentApproved",
      to: booking.customer_email,
      subject: `Your payment link — ${vehicleShort} · ${operatorName}`,
      variables: {
        BOOKING_REF: booking.booking_ref,
        OPERATOR_NAME: operatorName,
        VEHICLE_NAME: vehicleName,
        VEHICLE_SHORT: vehicleShort,
        DATE_RANGE: formatDateRange(booking.start_date, booking.end_date),
        PICKUP_TIME: formatPickupTime(booking.start_date, timezone),
        LOCATION: booking.pickup_location,
        RENTAL_AMOUNT: formatCurrency(rentalAmount, currency),
        EXOTIQ_AMOUNT: formatCurrency(exotiqAmount, currency),
        TOTAL_DUE: formatCurrency(totalDue, currency),
        PAYMENT_DEADLINE: booking.payment_due_at
          ? formatPaymentDeadline(String(booking.payment_due_at), timezone)
          : "",
        PAY_URL: payUrl,
      },
      // Distinct per send so the queue doesn't dedupe a deliberate resend.
      idempotencyKey: `resend-${booking.booking_ref}-${Date.now()}`,
      replyTo: resolveRenterReplyTo(team?.support_email),
      fromName: operatorName,
      tags: [
        { name: "booking_ref", value: booking.booking_ref },
        { name: "email_type", value: "payment_link_resend" },
      ],
    });

    logStep("Resent", { bookingRef: booking.booking_ref });
    return json({
      sent_to: booking.customer_email,
      payment_due_at: booking.payment_due_at ?? null,
    });
  } catch (error) {
    console.error("[RENT-RESEND-PAYMENT-LINK] error", error);
    return json({ error: "Unable to send the payment link. Please try again." }, 500);
  }
});
