// M6d: marketplace booking approval.
// Operator-only POST { booking_id }.
// For marketplace bookings: flips status from 'pending' to 'pending_payment',
// computes payment_due_at (48h from approval, capped at pickup - 2h), and
// sends the renter their payment link.
// For non-marketplace bookings, falls back to the legacy 'confirmed' behavior.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { sendRenterEmail, resolveRenterReplyTo } from "../_shared/rentEmail.ts";
import {
  buildPayUrl,
  computePaymentDueAt,
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
  console.log(`[RENT-APPROVE-BOOKING] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
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
        "vehicle_id, vehicle_name, team_id, confirmation_token",
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
    if (!membership) return json({ error: "Not a member of this booking's team" }, 403);

    // Approvable statuses: legacy direct 'pending' AND marketplace 'requested'
    // (identity verified). 'pending_documents' is intentionally NOT approvable —
    // ID verification stays a precondition for marketplace approval.
    const APPROVABLE = ["pending", "requested"];
    if (!APPROVABLE.includes(booking.status)) {
      return json({ error: `Booking cannot be approved from status: ${booking.status}` }, 409);
    }

    const isMarketplace = booking.booking_source === "marketplace";
    const nextStatus = isMarketplace ? "pending_payment" : "confirmed";
    const approvedAt = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: nextStatus,
      confirmed_at: isMarketplace ? null : approvedAt,
    };
    if (isMarketplace) {
      updates.payment_due_at = computePaymentDueAt(booking.start_date, approvedAt);
    }

    const { error: updateError } = await admin
      .from("bookings")
      .update(updates)
      .eq("id", bookingId)
      .in("status", APPROVABLE);
    if (updateError) throw updateError;


    // Google Calendar sync
    try {
      await admin.functions.invoke("gcal-sync", {
        body: { action: "update", booking_id: bookingId },
      });
    } catch (_) {
      // calendar sync is best-effort
    }

    if (isMarketplace && booking.customer_email) {
      const { data: team } = await admin
        .from("teams")
        .select("id, slug, name, currency, timezone, support_email")
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
      const totalDue = rentalAmount + exotiqAmount;
      // L1 (2026-07-25 handoff): NEVER derive the renter's pay link from
      // req.headers.get("origin"). The CC calls this from the browser, so
      // the browser sends the operator app's origin and the emailed link
      // 404s. Renter app is a fixed destination.
      const renterOrigin = Deno.env.get("RENTER_APP_ORIGIN") ?? "https://book.exotiq.rent";
      const payUrl = buildPayUrl(booking.booking_ref, String(booking.confirmation_token), renterOrigin);

      const vehicleName = booking.vehicle_name || "Vehicle";
      const vehicleShort = shortVehicleName(vehicleName);
      const operatorName = team?.name ?? "Operator";

      const variables = {
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
        PAYMENT_DEADLINE: formatPaymentDeadline(updates.payment_due_at as string, timezone),
        PAY_URL: payUrl,
      };

      try {
        await sendRenterEmail({
          templateName: "paymentApproved",
          to: booking.customer_email,
          subject: `You're approved — complete your ${vehicleShort} booking`,
          variables,
          idempotencyKey: `approve-${booking.booking_ref}`,
          replyTo: resolveRenterReplyTo(team?.support_email),
          tags: [{ name: "booking_ref", value: booking.booking_ref }, { name: "email_type", value: "payment_approved" }],
        });
        logStep("Payment-approved email sent", { bookingRef: booking.booking_ref });
      } catch (emailError) {
        logStep("Payment-approved email failed", { bookingRef: booking.booking_ref, error: String(emailError) });
        // Booking approval succeeds; email failure is logged and does not roll back.
      }
    }

    logStep("Approved", { bookingRef: booking.booking_ref, nextStatus, marketplace: isMarketplace });
    return json({ status: nextStatus, payment_due_at: updates.payment_due_at ?? null });
  } catch (error) {
    console.error("[RENT-APPROVE-BOOKING] error", error);
    return json({ error: "Unable to approve booking" }, 500);
  }
});
