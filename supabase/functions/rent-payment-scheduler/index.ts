// M6d: payment scheduler.
// Runs every 15 minutes via pg_cron. Handles two jobs:
//   1. Expire overdue marketplace bookings and notify renter + operator.
//   2. Send 24-hour payment reminder to pending_payment bookings.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

import { sendRenterEmail } from "../_shared/rentEmail.ts";
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
}

async function getTeamContext(db: SupabaseClient, teamId: string): Promise<TeamContext | null> {
  const { data } = await db
    .from("teams")
    .select("id, slug, name, currency, timezone")
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

  const cronToken = Deno.env.get("CRON_TRIGGER_TOKEN");
  const provided = req.headers.get("x-cron-token");
  if (!cronToken || provided !== cronToken) {
    return json({ error: "Forbidden" }, 403);
  }

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
            replyTo: `${team.name} <no-reply@exotiq.ai>`,
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
          replyTo: `${team.name} <no-reply@exotiq.ai>`,
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

    logStep("Run complete", { expired: expiredCount, reminders: reminderCount, errors: errorCount });
    return json({ expired: expiredCount, reminders: reminderCount, errors: errorCount });
  } catch (error) {
    console.error("[RENT-PAYMENT-SCHEDULER] error", error);
    return json({ error: "Scheduler error" }, 500);
  }
});
