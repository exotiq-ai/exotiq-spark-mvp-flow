// Extend an existing booking by additional days and (for marketplace bookings
// with a saved card) auto-charge the balance off-session on the tenant's
// connected account. Direct bookings are marked "manual" — the operator
// records payment via the normal payments flow.
//
// Safety:
// - Team-membership check on the booking's team_id (never trust caller team).
// - Availability re-check inside the request so races with a new booking on
//   the same vehicle window fail closed.
// - Idempotency key = booking_id + previous_end_date + new_end_date so a
//   retried request can't double-charge.
// - If DB update fails after a successful charge, the PI is auto-refunded
//   and the extension is marked failed.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { teamConnectedAccountId, resolveStripeMode } from "../_shared/stripeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: Record<string, unknown>) => {
  console.log(`[RENT-EXTEND-BOOKING] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// State fee: matches rent-create-booking (589¢/day).
const STATE_FEE_CENTS_PER_DAY = 589;
// Processing fee estimate (Exotiq leg): 2% platform overhead + Stripe 2.9% + 30¢.
function estimateProcessingFeeCents(rentalSubtotalCents: number): number {
  return Math.round(0.02 * rentalSubtotalCents) + Math.round(rentalSubtotalCents * 0.029) + 30;
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);
    const user = userData.user;

    const body = await req.json();
    const {
      booking_id,
      new_end_date,
      rate_cents_per_day,
      charge_method = "card_on_file", // 'card_on_file' | 'manual'
    } = body ?? {};

    if (!booking_id || !new_end_date || !rate_cents_per_day) {
      return json({ error: "booking_id, new_end_date, rate_cents_per_day required" }, 400);
    }
    if (!["card_on_file", "manual"].includes(charge_method)) {
      return json({ error: "Invalid charge_method" }, 400);
    }
    if (Number(rate_cents_per_day) < 0) {
      return json({ error: "rate_cents_per_day must be >= 0" }, 400);
    }

    // Load booking.
    const { data: booking, error: bErr } = await db
      .from("bookings")
      .select(
        "id, team_id, vehicle_id, booking_ref, status, start_date, end_date, total_value, operator_payment_intent_id, exotiq_payment_intent_id, paid_at, customer_email, customer_name, platform_fee_cents, state_fee_cents, processing_fee_cents, protection_total_cents",
      )
      .eq("id", booking_id)
      .single();
    if (bErr || !booking) return json({ error: "Booking not found" }, 404);

    // Auth: user must be an active member of the booking's team.
    const { data: membership } = await db
      .from("team_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("team_id", booking.team_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) return json({ error: "Not authorized for this booking's team" }, 403);

    const prevEnd = new Date(booking.end_date);
    const newEnd = new Date(new_end_date);
    if (isNaN(newEnd.getTime())) return json({ error: "Invalid new_end_date" }, 400);
    if (newEnd.getTime() <= prevEnd.getTime()) {
      return json({ error: "new_end_date must be after current end_date" }, 400);
    }

    const addedDays = daysBetween(prevEnd, newEnd);
    if (addedDays < 1) return json({ error: "Extension must be at least 1 day" }, 400);

    // Availability check: any other blocking booking on the same vehicle
    // whose window overlaps [prevEnd, newEnd].
    if (booking.vehicle_id) {
      const { data: conflicts } = await db
        .from("bookings")
        .select("id, booking_ref, status, start_date, end_date")
        .eq("vehicle_id", booking.vehicle_id)
        .neq("id", booking.id)
        .in("status", ["pending", "requested", "confirmed", "active", "checked_out"])
        .lt("start_date", newEnd.toISOString())
        .gt("end_date", prevEnd.toISOString());
      if (conflicts && conflicts.length > 0) {
        return json(
          {
            error: "Extension conflicts with another booking",
            conflict: conflicts[0],
          },
          409,
        );
      }
    }

    // Compute deltas.
    const addedSubtotalCents = Math.round(Number(rate_cents_per_day)) * addedDays;
    const addedStateFeeCents = STATE_FEE_CENTS_PER_DAY * addedDays;
    // Platform fee delta uses the same % as the original booking snapshot,
    // when the original had one. Otherwise 0 (direct booking, no marketplace fee).
    const originalSubtotalCents = Math.max(0, Math.round(Number(booking.total_value ?? 0) * 100));
    const originalPlatformFeeCents = Number(booking.platform_fee_cents ?? 0);
    const platformFeePct =
      originalSubtotalCents > 0 && originalPlatformFeeCents > 0
        ? originalPlatformFeeCents / originalSubtotalCents
        : 0;
    const addedPlatformFeeCents = Math.round(addedSubtotalCents * platformFeePct);
    const addedProcessingFeeCents = estimateProcessingFeeCents(addedSubtotalCents);
    const addedTotalCents =
      addedSubtotalCents + addedStateFeeCents + addedProcessingFeeCents;

    log("Computed deltas", {
      addedDays,
      addedSubtotalCents,
      addedStateFeeCents,
      addedProcessingFeeCents,
      addedPlatformFeeCents,
      addedTotalCents,
    });

    // Insert extension row (pending) — audit trail even if charge fails.
    const { data: extension, error: exErr } = await db
      .from("booking_extensions")
      .insert({
        booking_id: booking.id,
        team_id: booking.team_id,
        extended_by_user_id: user.id,
        previous_end_date: booking.end_date,
        new_end_date: newEnd.toISOString(),
        added_days: addedDays,
        rate_cents_per_day: Math.round(Number(rate_cents_per_day)),
        added_subtotal_cents: addedSubtotalCents,
        added_state_fee_cents: addedStateFeeCents,
        added_processing_fee_cents: addedProcessingFeeCents,
        added_platform_fee_cents: addedPlatformFeeCents,
        added_total_cents: addedTotalCents,
        charge_method,
        status: "pending",
      })
      .select()
      .single();
    if (exErr || !extension) {
      log("Failed to insert extension row", { error: exErr?.message });
      return json({ error: "Failed to record extension" }, 500);
    }

    // Resolve tenant's connected account.
    const mode = resolveStripeMode();
    const { data: team } = await db
      .from("teams")
      .select("stripe_account_id, stripe_test_account_id")
      .eq("id", booking.team_id)
      .single();
    let stripeAccountId: string | null = null;
    try {
      stripeAccountId = teamConnectedAccountId(
        team ?? { stripe_account_id: null, stripe_test_account_id: null },
        mode,
      );
    } catch (_) {
      // Direct bookings on tenants without a Stripe account can't auto-charge.
      stripeAccountId = null;
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    if (charge_method === "card_on_file") {
      if (!booking.operator_payment_intent_id) {
        await db
          .from("booking_extensions")
          .update({ status: "failed", failure_reason: "No original payment intent on booking (direct booking has no saved card). Use manual charge instead." })
          .eq("id", extension.id);
        return json(
          {
            error: "No card on file for this booking. Use 'Mark as balance owed' to record payment manually.",
            extension_id: extension.id,
          },
          422,
        );
      }
      if (!stripeAccountId) {
        await db
          .from("booking_extensions")
          .update({ status: "failed", failure_reason: "Tenant Stripe account not configured for current mode." })
          .eq("id", extension.id);
        return json({ error: "Tenant Stripe account not configured for current mode" }, 422);
      }

      try {
        const originalPi = await stripe.paymentIntents.retrieve(
          booking.operator_payment_intent_id,
          { stripeAccount: stripeAccountId },
        );
        const paymentMethod = typeof originalPi.payment_method === "string"
          ? originalPi.payment_method
          : originalPi.payment_method?.id;
        const customer = typeof originalPi.customer === "string"
          ? originalPi.customer
          : originalPi.customer?.id;
        if (!paymentMethod || !customer) {
          await db
            .from("booking_extensions")
            .update({
              status: "failed",
              failure_reason: "Original PaymentIntent has no saved payment method or customer.",
            })
            .eq("id", extension.id);
          return json({ error: "Original booking has no saved card to reuse. Record payment manually." }, 422);
        }

        const pi = await stripe.paymentIntents.create(
          {
            amount: addedTotalCents,
            currency: originalPi.currency,
            customer,
            payment_method: paymentMethod,
            off_session: true,
            confirm: true,
            application_fee_amount:
              addedPlatformFeeCents > 0 ? addedPlatformFeeCents : undefined,
            statement_descriptor_suffix: "EXT",
            description: `Booking extension ${booking.booking_ref} +${addedDays}d`,
            metadata: {
              booking_ref: booking.booking_ref ?? "",
              booking_id: booking.id,
              extension_id: extension.id,
              added_days: String(addedDays),
              leg: "extension",
              stripe_mode: mode,
            },
          },
          {
            stripeAccount: stripeAccountId,
            idempotencyKey: `extend-${booking.id}-${prevEnd.toISOString()}-${newEnd.toISOString()}`,
          },
        );

        if (pi.status !== "succeeded") {
          await db
            .from("booking_extensions")
            .update({
              status: "failed",
              payment_intent_id: pi.id,
              failure_reason: `Payment did not settle immediately (status=${pi.status}). Try again or record payment manually.`,
            })
            .eq("id", extension.id);
          return json(
            {
              error: `Charge did not settle (${pi.status}). Try again or record payment manually.`,
              payment_intent_id: pi.id,
            },
            402,
          );
        }

        // Charge succeeded — update booking + mirror payment.
        const { error: updErr } = await db
          .from("bookings")
          .update({
            end_date: newEnd.toISOString(),
            total_value: Number(booking.total_value ?? 0) + addedSubtotalCents / 100,
            platform_fee_cents:
              Number(booking.platform_fee_cents ?? 0) + addedPlatformFeeCents,
            state_fee_cents:
              Number(booking.state_fee_cents ?? 0) + addedStateFeeCents,
            processing_fee_cents:
              Number(booking.processing_fee_cents ?? 0) + addedProcessingFeeCents,
          } as any)
          .eq("id", booking.id);

        if (updErr) {
          // Refund and mark failed.
          log("Charge captured but booking update failed — refunding", { error: updErr.message });
          try {
            await stripe.refunds.create(
              { payment_intent: pi.id },
              { stripeAccount: stripeAccountId },
            );
          } catch (rErr) {
            log("Refund attempt failed", { error: (rErr as Error).message });
          }
          await db
            .from("booking_extensions")
            .update({
              status: "failed",
              payment_intent_id: pi.id,
              failure_reason: `Booking update failed after charge; refund attempted: ${updErr.message}`,
            })
            .eq("id", extension.id);
          return json({ error: "Booking update failed after charge; refund attempted" }, 500);
        }

        await db.from("payments").insert({
          booking_id: booking.id,
          team_id: booking.team_id,
          amount: addedTotalCents / 100,
          payment_method: "stripe",
          payment_status: "completed",
          stripe_payment_intent_id: pi.id,
          notes: `Booking extension (+${addedDays} day${addedDays === 1 ? "" : "s"})`,
          paid_at: new Date().toISOString(),
        } as any);

        await db
          .from("booking_extensions")
          .update({
            status: "paid",
            payment_intent_id: pi.id,
          })
          .eq("id", extension.id);

        log("Extension charged + booking updated", {
          bookingRef: booking.booking_ref,
          addedDays,
          addedTotalCents,
        });

        return json({
          success: true,
          extension_id: extension.id,
          payment_intent_id: pi.id,
          added_total_cents: addedTotalCents,
          new_end_date: newEnd.toISOString(),
        });
      } catch (chargeErr) {
        const msg = chargeErr instanceof Error ? chargeErr.message : String(chargeErr);
        log("Off-session charge failed", { error: msg });
        await db
          .from("booking_extensions")
          .update({
            status: "failed",
            failure_reason: msg,
          })
          .eq("id", extension.id);
        return json(
          {
            error: `Card charge failed: ${msg}. You can record payment manually to complete the extension.`,
          },
          402,
        );
      }
    }

    // Manual path — extend dates now, operator records payment separately.
    const { error: updErr } = await db
      .from("bookings")
      .update({
        end_date: newEnd.toISOString(),
        total_value: Number(booking.total_value ?? 0) + addedSubtotalCents / 100,
        platform_fee_cents:
          Number(booking.platform_fee_cents ?? 0) + addedPlatformFeeCents,
        state_fee_cents:
          Number(booking.state_fee_cents ?? 0) + addedStateFeeCents,
        processing_fee_cents:
          Number(booking.processing_fee_cents ?? 0) + addedProcessingFeeCents,
      } as any)
      .eq("id", booking.id);
    if (updErr) {
      await db
        .from("booking_extensions")
        .update({ status: "failed", failure_reason: updErr.message })
        .eq("id", extension.id);
      return json({ error: "Failed to update booking dates" }, 500);
    }
    await db
      .from("booking_extensions")
      .update({ status: "manual" })
      .eq("id", extension.id);

    return json({
      success: true,
      extension_id: extension.id,
      added_total_cents: addedTotalCents,
      new_end_date: newEnd.toISOString(),
      note: "Extension recorded. Add a payment record to reconcile the balance.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return json({ error: msg }, 500);
  }
});
