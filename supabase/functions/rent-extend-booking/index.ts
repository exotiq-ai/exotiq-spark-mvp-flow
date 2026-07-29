// Extend an existing booking by additional days. For marketplace bookings
// with a saved card on the platform customer (setup_future_usage from
// rent-checkout), split the extension into two off-session PaymentIntents
// that mirror the original M6 charge model:
//
//   Operator leg  — destination charge on platform, transfer to operator
//                   connected acct minus operator's Stripe processing share.
//                   Amount = rate_per_day × added_days.
//   Exotiq  leg  — plain platform charge (no transfer).
//                   Amount = platform_fee + state_fee + processing_fee_est.
//
// If the operator leg succeeds but the Exotiq leg fails, refund the
// operator leg so the customer isn't left with a partial charge and the
// operator isn't left holding rental $ that Exotiq never fee'd.
//
// Direct (non-marketplace) bookings and marketplace bookings without a
// saved PI fall to the manual branch — dates move now, operator records
// payment in the Payments tab.
//
// Safety: team-membership check, availability re-check inside the request,
// idempotency keys keyed on (booking_id, previous_end, new_end).

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

// System-wide flat rate — matches rent-create-booking and public_vehicle_quote.
// TODO: replace with per-jurisdiction lookup (locations.state_fee_cents_per_day
// + exemption table for MT/OR/NH/DE/AK).
const STATE_FEE_CENTS_PER_DAY = 589;

// Protection tier daily cents — mirrors public_vehicle_quote (server-side
// source of truth). Do NOT derive from protection_total_cents / days: on a
// second extension that divisor has already been bumped, so the derived rate
// silently overcharges. Read the rate from the tier instead.
function protectionDailyCentsForTier(tier: string | null | undefined): number {
  switch ((tier ?? "premium").toLowerCase()) {
    case "premium":
      return 28900;
    case "standard":
      return 8900;
    default:
      return 0;
  }
}

// Operator's estimated Stripe processing share (matches rent-checkout).
function stripeFeeEstimateCents(amountCents: number): number {
  return Math.round(amountCents * 0.029) + 30;
}

// Exotiq leg processing fee estimate (matches public_vehicle_quote):
// 2% platform overhead + Stripe 2.9% + 30¢ on the rental subtotal.
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

    if (!booking_id || !new_end_date || rate_cents_per_day == null) {
      return json({ error: "booking_id, new_end_date, rate_cents_per_day required" }, 400);
    }
    if (!["card_on_file", "manual"].includes(charge_method)) {
      return json({ error: "Invalid charge_method" }, 400);
    }
    if (Number(rate_cents_per_day) < 0) {
      return json({ error: "rate_cents_per_day must be >= 0" }, 400);
    }

    const { data: booking, error: bErr } = await db
      .from("bookings")
      .select(
        "id, team_id, vehicle_id, booking_ref, booking_source, status, start_date, end_date, total_value, operator_payment_intent_id, exotiq_payment_intent_id, paid_at, customer_email, customer_name, platform_fee_cents, state_fee_cents, processing_fee_cents, protection_total_cents",
      )
      .eq("id", booking_id)
      .single();
    if (bErr || !booking) return json({ error: "Booking not found" }, 404);

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

    // Availability re-check.
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
          { error: "Extension conflicts with another booking", conflict: conflicts[0] },
          409,
        );
      }
    }

    // Compute deltas.
    const ratePerDayCents = Math.round(Number(rate_cents_per_day));
    const addedSubtotalCents = ratePerDayCents * addedDays;
    const addedStateFeeCents = STATE_FEE_CENTS_PER_DAY * addedDays;

    const originalSubtotalCents = Math.max(0, Math.round(Number(booking.total_value ?? 0) * 100));
    const originalPlatformFeeCents = Number(booking.platform_fee_cents ?? 0);
    const platformFeePct =
      originalSubtotalCents > 0 && originalPlatformFeeCents > 0
        ? originalPlatformFeeCents / originalSubtotalCents
        : 0;
    const addedPlatformFeeCents = Math.round(addedSubtotalCents * platformFeePct);

    const addedProcessingFeeCents = estimateProcessingFeeCents(addedSubtotalCents);

    const addedExotiqLegCents =
      addedPlatformFeeCents + addedStateFeeCents + addedProcessingFeeCents;
    const addedTotalCents = addedSubtotalCents + addedExotiqLegCents;

    log("Computed deltas", {
      addedDays,
      ratePerDayCents,
      addedSubtotalCents,
      addedStateFeeCents,
      addedProcessingFeeCents,
      addedPlatformFeeCents,
      addedExotiqLegCents,
      addedTotalCents,
    });

    const { data: extension, error: exErr } = await db
      .from("booking_extensions")
      .insert({
        booking_id: booking.id,
        team_id: booking.team_id,
        extended_by_user_id: user.id,
        previous_end_date: booking.end_date,
        new_end_date: newEnd.toISOString(),
        added_days: addedDays,
        rate_cents_per_day: ratePerDayCents,
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const mode = resolveStripeMode();

    // Shared helper to persist booking date/fee bumps + write payment row(s).
    const applyBookingBump = async (paymentRows: Array<Record<string, unknown>>) => {
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
        } as Record<string, unknown>)
        .eq("id", booking.id);
      if (updErr) throw new Error(`Booking update failed: ${updErr.message}`);
      if (paymentRows.length > 0) {
        await db.from("payments").insert(paymentRows as never);
      }
    };

    const markFailed = async (reason: string, extras: Record<string, unknown> = {}) => {
      await db
        .from("booking_extensions")
        .update({ status: "failed", failure_reason: reason, ...extras })
        .eq("id", extension.id);
    };

    if (charge_method === "card_on_file") {
      if (booking.booking_source !== "marketplace" || !booking.operator_payment_intent_id) {
        await markFailed(
          "No card on file for this booking. Use 'balance owed' to record payment manually.",
        );
        return json(
          {
            error:
              "No card on file for this booking. Use 'Mark as balance owed' to record payment manually.",
            extension_id: extension.id,
          },
          422,
        );
      }

      // Resolve operator connected account for the operator-leg transfer.
      const { data: team } = await db
        .from("teams")
        .select("stripe_account_id, stripe_test_account_id")
        .eq("id", booking.team_id)
        .single();
      let operatorAccountId: string;
      try {
        operatorAccountId = teamConnectedAccountId(
          team ?? { stripe_account_id: null, stripe_test_account_id: null },
          mode,
        );
      } catch (accErr) {
        const msg = accErr instanceof Error ? accErr.message : String(accErr);
        await markFailed(`Tenant Stripe account not configured for ${mode} mode: ${msg}`);
        return json({ error: `Tenant Stripe account not configured for ${mode} mode` }, 422);
      }

      // Retrieve the original destination-charged PI from the PLATFORM
      // (not the connected account — destination charges live on platform).
      let customer: string | undefined;
      let paymentMethod: string | undefined;
      let currency: string;
      try {
        const originalPi = await stripe.paymentIntents.retrieve(
          booking.operator_payment_intent_id,
        );
        customer =
          typeof originalPi.customer === "string"
            ? originalPi.customer
            : originalPi.customer?.id;
        paymentMethod =
          typeof originalPi.payment_method === "string"
            ? originalPi.payment_method
            : originalPi.payment_method?.id;
        currency = originalPi.currency;
      } catch (retrErr) {
        const msg = retrErr instanceof Error ? retrErr.message : String(retrErr);
        await markFailed(`Could not retrieve original payment intent: ${msg}`);
        return json({ error: "Could not retrieve original payment intent" }, 502);
      }

      if (!customer || !paymentMethod) {
        await markFailed("Original PaymentIntent has no saved payment method or customer.");
        return json(
          { error: "Original booking has no saved card to reuse. Record payment manually." },
          422,
        );
      }

      const idempotencyEnvelope = `${booking.id}-${prevEnd.toISOString()}-${newEnd.toISOString()}`;

      // -------- OPERATOR LEG (destination charge on platform) --------
      let operatorPi: Stripe.PaymentIntent;
      try {
        operatorPi = await stripe.paymentIntents.create(
          {
            amount: addedSubtotalCents,
            currency,
            customer,
            payment_method: paymentMethod,
            off_session: true,
            confirm: true,
            on_behalf_of: operatorAccountId,
            transfer_data: {
              destination: operatorAccountId,
              amount: addedSubtotalCents - stripeFeeEstimateCents(addedSubtotalCents),
            },
            description: `Booking extension ${booking.booking_ref} +${addedDays}d (rental)`,
            metadata: {
              booking_ref: booking.booking_ref ?? "",
              booking_id: booking.id,
              extension_id: extension.id,
              added_days: String(addedDays),
              leg: "operator_rental_extension",
              stripe_mode: mode,
            },
          },
          { idempotencyKey: `extend-op-${idempotencyEnvelope}` },
        );
      } catch (opErr) {
        const msg = opErr instanceof Error ? opErr.message : String(opErr);
        log("Operator leg failed", { error: msg });
        await markFailed(`Operator card charge failed: ${msg}`);
        return json(
          {
            error: `Card charge failed: ${msg}. You can record payment manually to complete the extension.`,
          },
          402,
        );
      }

      if (operatorPi.status !== "succeeded") {
        await markFailed(
          `Operator charge did not settle (${operatorPi.status})`,
          { operator_payment_intent_id: operatorPi.id },
        );
        return json(
          {
            error: `Card did not settle (${operatorPi.status}). Try again or record payment manually.`,
            payment_intent_id: operatorPi.id,
          },
          402,
        );
      }

      // -------- EXOTIQ LEG (plain platform charge, no transfer) --------
      let exotiqPi: Stripe.PaymentIntent | null = null;
      if (addedExotiqLegCents > 0) {
        try {
          exotiqPi = await stripe.paymentIntents.create(
            {
              amount: addedExotiqLegCents,
              currency,
              customer,
              payment_method: paymentMethod,
              off_session: true,
              confirm: true,
              description: `Booking extension ${booking.booking_ref} +${addedDays}d (fees)`,
              metadata: {
                booking_ref: booking.booking_ref ?? "",
                booking_id: booking.id,
                extension_id: extension.id,
                added_days: String(addedDays),
                leg: "exotiq_fees_extension",
                stripe_mode: mode,
              },
            },
            { idempotencyKey: `extend-fee-${idempotencyEnvelope}` },
          );
        } catch (feeErr) {
          const msg = feeErr instanceof Error ? feeErr.message : String(feeErr);
          log("Exotiq leg failed — refunding operator leg", { error: msg });
          try {
            await stripe.refunds.create({ payment_intent: operatorPi.id });
          } catch (rErr) {
            log("Operator refund attempt failed", {
              error: (rErr as Error).message,
              operatorPiId: operatorPi.id,
            });
          }
          await markFailed(
            `Exotiq fee charge failed (operator leg refunded): ${msg}`,
            { operator_payment_intent_id: operatorPi.id },
          );
          return json(
            {
              error: `Fee charge failed and rental charge was refunded: ${msg}. Try again or record payment manually.`,
            },
            402,
          );
        }

        if (exotiqPi.status !== "succeeded") {
          log("Exotiq leg not settled — refunding operator leg");
          try {
            await stripe.refunds.create({ payment_intent: operatorPi.id });
          } catch (rErr) {
            log("Operator refund attempt failed", { error: (rErr as Error).message });
          }
          await markFailed(
            `Exotiq charge did not settle (${exotiqPi.status}); operator leg refunded`,
            {
              operator_payment_intent_id: operatorPi.id,
              exotiq_payment_intent_id: exotiqPi.id,
            },
          );
          return json(
            {
              error: `Fee charge did not settle (${exotiqPi.status}); rental refunded. Try again or record payment manually.`,
            },
            402,
          );
        }
      }

      // -------- BOTH LEGS OK — bump booking + record payments --------
      const paymentRows: Array<Record<string, unknown>> = [
        {
          booking_id: booking.id,
          team_id: booking.team_id,
          amount: addedSubtotalCents / 100,
          payment_method: "stripe",
          payment_status: "completed",
          stripe_payment_intent_id: operatorPi.id,
          notes: `Booking extension rental (+${addedDays} day${addedDays === 1 ? "" : "s"})`,
          paid_at: new Date().toISOString(),
        },
      ];
      if (exotiqPi) {
        paymentRows.push({
          booking_id: booking.id,
          team_id: booking.team_id,
          amount: addedExotiqLegCents / 100,
          payment_method: "stripe",
          payment_status: "completed",
          stripe_payment_intent_id: exotiqPi.id,
          notes: `Booking extension fees (state + platform + processing)`,
          paid_at: new Date().toISOString(),
        });
      }

      try {
        await applyBookingBump(paymentRows);
      } catch (bumpErr) {
        const msg = bumpErr instanceof Error ? bumpErr.message : String(bumpErr);
        log("Booking bump failed after both charges — refunding both legs", { error: msg });
        try {
          await stripe.refunds.create({ payment_intent: operatorPi.id });
        } catch (_) { /* noop */ }
        if (exotiqPi) {
          try {
            await stripe.refunds.create({ payment_intent: exotiqPi.id });
          } catch (_) { /* noop */ }
        }
        await markFailed(`Booking update failed after charges; both refunded: ${msg}`, {
          operator_payment_intent_id: operatorPi.id,
          exotiq_payment_intent_id: exotiqPi?.id ?? null,
        });
        return json({ error: "Booking update failed after charges; both refunded" }, 500);
      }

      await db
        .from("booking_extensions")
        .update({
          status: "paid",
          operator_payment_intent_id: operatorPi.id,
          exotiq_payment_intent_id: exotiqPi?.id ?? null,
        })
        .eq("id", extension.id);

      log("Extension charged (two-leg) + booking updated", {
        bookingRef: booking.booking_ref,
        addedDays,
        addedSubtotalCents,
        addedExotiqLegCents,
      });

      return json({
        success: true,
        extension_id: extension.id,
        operator_payment_intent_id: operatorPi.id,
        exotiq_payment_intent_id: exotiqPi?.id ?? null,
        added_subtotal_cents: addedSubtotalCents,
        added_exotiq_leg_cents: addedExotiqLegCents,
        added_total_cents: addedTotalCents,
        new_end_date: newEnd.toISOString(),
      });
    }

    // -------- MANUAL PATH — extend dates now, operator reconciles later --------
    try {
      await applyBookingBump([]);
    } catch (bumpErr) {
      const msg = bumpErr instanceof Error ? bumpErr.message : String(bumpErr);
      await markFailed(msg);
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
