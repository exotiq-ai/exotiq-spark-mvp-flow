// TEMP smoketest: replicates rent-approve-booking without JWT auth.
// Delete after use.
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

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const bookingId = "9b09675d-ee92-4e94-83ad-059db166e0b4";
    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select(
        "id, booking_ref, status, booking_source, customer_email, customer_name, " +
          "start_date, end_date, pickup_location, total_value, platform_fee_cents, protection_total_cents, " +
          "vehicle_id, vehicle_name, team_id, confirmation_token",
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!booking) return json({ error: "not found" }, 404);

    const APPROVABLE = ["pending", "requested"];
    if (!APPROVABLE.includes(booking.status)) {
      return json({ error: `bad status: ${booking.status}` }, 409);
    }

    const isMarketplace = booking.booking_source === "marketplace";
    const nextStatus = isMarketplace ? "pending_payment" : "confirmed";
    const approvedAt = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: nextStatus,
      confirmed_at: isMarketplace ? null : approvedAt,
    };
    if (isMarketplace) updates.payment_due_at = computePaymentDueAt(booking.start_date, approvedAt);

    const { error: uErr } = await admin
      .from("bookings")
      .update(updates)
      .eq("id", bookingId)
      .in("status", APPROVABLE);
    if (uErr) throw uErr;

    let emailResult: unknown = null;
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
      const origin = "https://book.exotiq.rent";
      const payUrl = buildPayUrl(booking.booking_ref, String(booking.confirmation_token), origin);
      const vehicleName = booking.vehicle_name || "Vehicle";
      const vehicleShort = shortVehicleName(vehicleName);
      const operatorName = team?.name ?? "Operator";
      const replyTo = resolveRenterReplyTo(team?.support_email);

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

      const r = await sendRenterEmail({
        templateName: "paymentApproved",
        to: booking.customer_email,
        subject: `You're approved — complete your ${vehicleShort} booking`,
        variables,
        idempotencyKey: `approve-${booking.booking_ref}-smoketest-${Date.now()}`,
        replyTo,
        tags: [
          { name: "booking_ref", value: booking.booking_ref },
          { name: "email_type", value: "payment_approved" },
        ],
      });
      emailResult = { replyTo, result: r };
    }

    return json({ ok: true, nextStatus, payment_due_at: updates.payment_due_at ?? null, email: emailResult });
  } catch (e) {
    console.error("[smoketest-approve]", e);
    return json({ error: String(e) }, 500);
  }
});
