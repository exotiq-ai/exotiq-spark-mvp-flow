// M6d: payment scheduler.
// Runs every 15 minutes via pg_cron. Handles two jobs:
//   1. Expire overdue marketplace bookings and notify renter + operator.
//   2. Send 24-hour payment reminder to pending_payment bookings.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

import { sendRenterEmail, resolveRenterReplyTo } from "../_shared/rentEmail.ts";
import {
  buildPayUrl,
  buildStorefrontUrl,
  buildVehicleUrl,
  formatCurrency,
  formatDateRange,
  formatPaymentDeadline,
  formatPickupTime,
  shortVehicleName,
} from "../_shared/rentFormat.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[RENT-PAYMENT-SCHEDULER] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

interface ExpiredBooking {
  booking_id: string;
  booking_ref: string;
  team_id: string;
  vehicle_id: string;
  customer_email: string;
  customer_name: string;
  vehicle_name: string;
  start_date: string;
  end_date: string;
  pickup_location: string;
  total_value: number;
  platform_fee_cents: number;
  protection_total_cents: number;
  confirmation_token: string;
}

interface TeamContext {
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  support_email: string | null;
}

async function getTeamContext(db: SupabaseClient, teamId: string): Promise<TeamContext | null> {
  const { data } = await db
    .from("teams")
    .select("id, slug, name, currency, timezone, support_email")
    .eq("id", teamId)
    .single();
  return data ?? null;
}

async function getOperatorEmails(db: SupabaseClient, teamId: string): Promise<string[]> {
  const { data } = await db
    .from("team_members")
    .select("profiles(email)")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"]);
  return (data ?? [])
    .map((row: any) => row.profiles?.email)
    .filter((email): email is string => Boolean(email));
}

async function getVehicleSlug(db: SupabaseClient, vehicleId: string): Promise<string | null> {
  const { data } = await db.from("vehicles").select("slug").eq("id", vehicleId).maybeSingle();
  return data?.slug ?? null;
}

function baseVariables(
  booking: ExpiredBooking,
  team: TeamContext,
  vehicleSlug: string | null,
  origin: string,
): Record<string, string | number | undefined> {
  const vehicleName = booking.vehicle_name || "Vehicle";
  const vehicleShort = shortVehicleName(vehicleName);
  const operatorName = team.name;
  const currency = team.currency ?? "USD";
  const timezone = team.timezone ?? "UTC";
  return {
    BOOKING_REF: booking.booking_ref,
    OPERATOR_NAME: operatorName,
    VEHICLE_NAME: vehicleName,
    VEHICLE_SHORT: vehicleShort,
    DATE_RANGE: formatDateRange(booking.start_date, booking.end_date),
    PICKUP_TIME: formatPickupTime(booking.start_date, timezone),
    LOCATION: booking.pickup_location,
    CONFIRMATION_URL: buildPayUrl(booking.booking_ref, booking.confirmation_token, origin),
    STOREFRONT_URL: buildStorefrontUrl(team.slug, origin),
    VEHICLE_URL: vehicleSlug ? buildVehicleUrl(team.slug, vehicleSlug, origin) : buildStorefrontUrl(team.slug, origin),
    RENTAL_AMOUNT: formatCurrency(Number(booking.total_value ?? 0), currency),
    EXOTIQ_AMOUNT: formatCurrency(
      (Number(booking.platform_fee_cents ?? 0) + Number(booking.protection_total_cents ?? 0)) / 100,
      currency,
    ),
  };
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

    const origin = "https://book.exotiq.rent";
    let expiredCount = 0;
    let reminderCount = 0;
    let errorCount = 0;

    // 1. Expiry sweep
    const { data: expired, error: expiryError } = await admin.rpc("expire_overdue_payment_bookings");
    if (expiryError) {
      console.error("[RENT-PAYMENT-SCHEDULER] expiry sweep failed", expiryError);
      return json({ error: "Expiry sweep failed", detail: expiryError }, 500);
    }

    for (const booking of (expired ?? []) as ExpiredBooking[]) {
      expiredCount += 1;
      const team = await getTeamContext(admin, booking.team_id);
      if (!team) {
        logStep("Team not found for expired booking", { bookingRef: booking.booking_ref });
        errorCount += 1;
        continue;
      }
      const vehicleSlug = await getVehicleSlug(admin, booking.vehicle_id);
      const vars = baseVariables(booking, team, vehicleSlug, origin);

      // Renter expiry email
      if (booking.customer_email) {
        try {
          await sendRenterEmail({
            templateName: "paymentExpired",
            to: booking.customer_email,
            subject: `The payment window closed — booking ${booking.booking_ref}`,
            variables: vars,
            idempotencyKey: `expired-renter-${booking.booking_ref}`,
            replyTo: resolveRenterReplyTo(team.support_email),
            tags: [{ name: "booking_ref", value: booking.booking_ref }, { name: "email_type", value: "payment_expired_renter" }],
          });
        } catch (emailError) {
          logStep("Renter expiry email failed", { bookingRef: booking.booking_ref, error: String(emailError) });
          errorCount += 1;
        }
      }

      // Operator expiry email
      const operatorEmails = await getOperatorEmails(admin, booking.team_id);
      for (const email of operatorEmails) {
        try {
          await sendRenterEmail({
            templateName: "operatorExpired",
            to: email,
            subject: `Booking ${booking.booking_ref} payment window expired`,
            variables: vars,
            idempotencyKey: `expired-operator-${booking.booking_ref}-${email}`,
            tags: [{ name: "booking_ref", value: booking.booking_ref }, { name: "email_type", value: "payment_expired_operator" }],
          });
        } catch (emailError) {
          logStep("Operator expiry email failed", { bookingRef: booking.booking_ref, error: String(emailError) });
          errorCount += 1;
        }
      }
    }

    // 2. Reminder sweep: pending_payment bookings where due_at - now <= 24h
    //    and reminder has not been sent for this exact window.
    const { data: reminders, error: reminderError } = await admin
      .from("bookings")
      .select(
        "id, booking_ref, customer_email, customer_name, start_date, end_date, pickup_location, " +
        "total_value, platform_fee_cents, protection_total_cents, vehicle_id, vehicle_name, team_id, " +
        "confirmation_token, payment_due_at, payment_reminder_sent_at",
      )
      .eq("status", "pending_payment")
      .eq("booking_source", "marketplace")
      .lte("payment_due_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .gt("payment_due_at", new Date().toISOString());

    if (reminderError) {
      console.error("[RENT-PAYMENT-SCHEDULER] reminder query failed", reminderError);
      return json({ error: "Reminder query failed", detail: reminderError }, 500);
    }

    for (const booking of (reminders ?? []) as any[]) {
      // Skip if already sent during this pending_payment window
      if (booking.payment_reminder_sent_at) continue;

      reminderCount += 1;
      const team = await getTeamContext(admin, booking.team_id);
      if (!team) {
        logStep("Team not found for reminder", { bookingRef: booking.booking_ref });
        errorCount += 1;
        continue;
      }
      const vehicleSlug = await getVehicleSlug(admin, booking.vehicle_id);
      const currency = team.currency ?? "USD";
      const timezone = team.timezone ?? "UTC";
      const rentalAmount = Number(booking.total_value ?? 0);
      const exotiqAmount =
        (Number(booking.platform_fee_cents ?? 0) + Number(booking.protection_total_cents ?? 0)) / 100;
      const totalDue = rentalAmount + exotiqAmount;
      const vehicleName = booking.vehicle_name || "Vehicle";
      const vehicleShort = shortVehicleName(vehicleName);
      const payUrl = buildPayUrl(booking.booking_ref, booking.confirmation_token, origin);

      const variables = {
        BOOKING_REF: booking.booking_ref,
        OPERATOR_NAME: team.name,
        VEHICLE_NAME: vehicleName,
        VEHICLE_SHORT: vehicleShort,
        DATE_RANGE: formatDateRange(booking.start_date, booking.end_date),
        PICKUP_TIME: formatPickupTime(booking.start_date, timezone),
        LOCATION: booking.pickup_location,
        TOTAL_DUE: formatCurrency(totalDue, currency),
        PAYMENT_DEADLINE: formatPaymentDeadline(booking.payment_due_at, timezone),
        PAY_URL: payUrl,
      };

      try {
        await sendRenterEmail({
          templateName: "paymentReminder",
          to: booking.customer_email,
          subject: `24 hours left to lock in your ${vehicleShort}`,
          variables,
          idempotencyKey: `reminder-${booking.booking_ref}`,
          replyTo: resolveRenterReplyTo(team.support_email),
          tags: [{ name: "booking_ref", value: booking.booking_ref }, { name: "email_type", value: "payment_reminder" }],
        });
        await admin
          .from("bookings")
          .update({ payment_reminder_sent_at: new Date().toISOString() })
          .eq("id", booking.id);
      } catch (emailError) {
        logStep("Reminder email failed", { bookingRef: booking.booking_ref, error: String(emailError) });
        errorCount += 1;
      }
    }

    // 3. Unverified-hold WARNING sweep (renter + operator).
    //    Fires within 6-12h of a pending_documents/requested auto-cancel deadline.
    let warningCount = 0;
    const { data: warnings, error: warningError } = await admin.rpc("find_holds_needing_warning");
    if (warningError) {
      console.error("[RENT-PAYMENT-SCHEDULER] warning query failed", warningError);
    }
    for (const b of (warnings ?? []) as any[]) {
      warningCount += 1;
      const team = await getTeamContext(admin, b.team_id);
      if (!team) { errorCount += 1; continue; }
      const vehicleSlug = await getVehicleSlug(admin, b.vehicle_id);
      const isRenterHold = b.status === "pending_documents";
      const renterActionUrl = buildPayUrl(b.booking_ref, b.confirmation_token, origin);
      const operatorActionUrl = `https://app.exotiq.ai/bookings?ref=${b.booking_ref}`;
      const deadlineFmt = formatPaymentDeadline(b.deadline, team.timezone ?? "UTC");
      const vehicleShort = shortVehicleName(b.vehicle_name || "Vehicle");
      const baseVars = {
        BOOKING_REF: b.booking_ref,
        OPERATOR_NAME: team.name,
        VEHICLE_NAME: b.vehicle_name || "Vehicle",
        VEHICLE_SHORT: vehicleShort,
        DATE_RANGE: formatDateRange(b.start_date, b.end_date),
        DEADLINE: deadlineFmt,
      };

      // Renter side (only makes sense on pending_documents — ID verification needed)
      if (isRenterHold && b.customer_email) {
        try {
          await sendRenterEmail({
            templateName: "holdWarning",
            to: b.customer_email,
            subject: `Heads up — booking ${b.booking_ref} needs your ID`,
            variables: { ...baseVars, ACTION_NEEDED: "your ID verification", ACTION_URL: renterActionUrl, ACTION_LABEL: "Verify my ID" },
            idempotencyKey: `hold-warn-renter-${b.booking_ref}`,
            replyTo: resolveRenterReplyTo(team.support_email),
            tags: [{ name: "booking_ref", value: b.booking_ref }, { name: "email_type", value: "hold_warning_renter" }],
          });
        } catch (e) { logStep("Renter warning failed", { ref: b.booking_ref, error: String(e) }); errorCount += 1; }
      }

      // Operator side (both statuses — approve or nudge the renter)
      const opEmails = await getOperatorEmails(admin, b.team_id);
      const opActionNeeded = isRenterHold ? "your renter to finish ID verification" : "your approval";
      const opLabel = isRenterHold ? "Open booking" : "Review & approve";
      for (const email of opEmails) {
        try {
          await sendRenterEmail({
            templateName: "holdWarning",
            to: email,
            subject: `Booking ${b.booking_ref} auto-cancels ${deadlineFmt}`,
            variables: { ...baseVars, ACTION_NEEDED: opActionNeeded, ACTION_URL: operatorActionUrl, ACTION_LABEL: opLabel },
            idempotencyKey: `hold-warn-operator-${b.booking_ref}-${email}`,
            tags: [{ name: "booking_ref", value: b.booking_ref }, { name: "email_type", value: "hold_warning_operator" }],
          });
        } catch (e) { logStep("Operator warning failed", { ref: b.booking_ref, error: String(e) }); errorCount += 1; }
      }

      await admin.from("bookings").update({ expiry_warning_sent_at: new Date().toISOString() }).eq("id", b.id);
    }

    // 4. Unverified-hold CANCELLATION sweep.
    //    expire_unverified_holds cancels stale pending_documents (24h) / requested (72h) rows
    //    and returns them so we can notify both sides.
    let holdCancelledCount = 0;
    const { data: cancelled, error: cancelError } = await admin.rpc("expire_unverified_holds");
    if (cancelError) {
      console.error("[RENT-PAYMENT-SCHEDULER] hold-cancel sweep failed", cancelError);
    }
    for (const row of (cancelled ?? []) as any[]) {
      holdCancelledCount += 1;
      const { data: full } = await admin
        .from("bookings")
        .select("id, booking_ref, customer_email, customer_name, start_date, end_date, pickup_location, vehicle_id, vehicle_name, team_id, confirmation_token")
        .eq("id", row.booking_id)
        .maybeSingle();
      if (!full) continue;
      const team = await getTeamContext(admin, full.team_id);
      if (!team) { errorCount += 1; continue; }
      const vehicleShort = shortVehicleName(full.vehicle_name || "Vehicle");
      const reasonHuman = row.status === "unverified_hold_expired"
        ? "the renter didn't finish ID verification in time"
        : "the request wasn't approved in time";
      const renterUrl = buildStorefrontUrl(team.slug, origin);
      const operatorUrl = "https://app.exotiq.ai/bookings";
      const baseVars = {
        BOOKING_REF: full.booking_ref,
        OPERATOR_NAME: team.name,
        VEHICLE_NAME: full.vehicle_name || "Vehicle",
        VEHICLE_SHORT: vehicleShort,
        DATE_RANGE: formatDateRange(full.start_date, full.end_date),
        REASON_HUMAN: reasonHuman,
      };

      if (full.customer_email) {
        try {
          await sendRenterEmail({
            templateName: "holdCancelled",
            to: full.customer_email,
            subject: `Booking ${full.booking_ref} released — nothing charged`,
            variables: { ...baseVars, ACTION_URL: renterUrl, ACTION_LABEL: "Browse other dates" },
            idempotencyKey: `hold-cancel-renter-${full.booking_ref}`,
            replyTo: resolveRenterReplyTo(team.support_email),
            tags: [{ name: "booking_ref", value: full.booking_ref }, { name: "email_type", value: "hold_cancelled_renter" }],
          });
        } catch (e) { logStep("Renter cancel email failed", { ref: full.booking_ref, error: String(e) }); errorCount += 1; }
      }
      const opEmails = await getOperatorEmails(admin, full.team_id);
      for (const email of opEmails) {
        try {
          await sendRenterEmail({
            templateName: "holdCancelled",
            to: email,
            subject: `Booking ${full.booking_ref} auto-cancelled`,
            variables: { ...baseVars, ACTION_URL: operatorUrl, ACTION_LABEL: "Open bookings" },
            idempotencyKey: `hold-cancel-operator-${full.booking_ref}-${email}`,
            tags: [{ name: "booking_ref", value: full.booking_ref }, { name: "email_type", value: "hold_cancelled_operator" }],
          });
        } catch (e) { logStep("Operator cancel email failed", { ref: full.booking_ref, error: String(e) }); errorCount += 1; }
      }
    }

    logStep("Run complete", { expired: expiredCount, reminders: reminderCount, warnings: warningCount, holdCancelled: holdCancelledCount, errors: errorCount });
    return json({ expired: expiredCount, reminders: reminderCount, warnings: warningCount, holdCancelled: holdCancelledCount, errors: errorCount });
  } catch (error) {
    console.error("[RENT-PAYMENT-SCHEDULER] error", error);
    return json({ error: "Scheduler error" }, 500);
  }
});
