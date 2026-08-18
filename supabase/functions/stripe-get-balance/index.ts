import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeMode } from "../_shared/stripeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-GET-BALANCE] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get team and check for connected Stripe account
    const { data: teamMember } = await supabaseClient
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    let stripeAccountId: string | null = null;
    let teamId: string | null = null;

    if (teamMember) {
      teamId = teamMember.team_id;
      const { data: team } = await supabaseClient
        .from("teams")
        .select("stripe_account_id, stripe_test_account_id, stripe_charges_enabled")
        .eq("id", teamMember.team_id)
        .single();
      // Mode-aware: prefer the account matching the current Stripe key. This
      // read is best-effort (dashboards / summaries), so we degrade silently
      // instead of hard-failing when the current-mode account is missing.
      const mode = resolveStripeMode();
      const modeAcct = mode === "test" ? team?.stripe_test_account_id : team?.stripe_account_id;
      if (modeAcct && team?.stripe_charges_enabled) {
        stripeAccountId = modeAcct;
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let availableBalance = 0;
    let pendingBalance = 0;
    let formattedPayouts: Array<{
      id: string; amount: number; currency: string; status: string;
      arrival_date: string; created: string; description: string; method: string;
    }> = [];
    let stripeError: string | null = null;

    try {
      if (stripeAccountId) {
        // Query CONNECTED account balance
        const balance = await stripe.balance.retrieve({ stripeAccount: stripeAccountId });
        const payouts = await stripe.payouts.list({ limit: 10 }, { stripeAccount: stripeAccountId });

        availableBalance = balance.available.reduce((sum, b) => b.currency === "usd" ? sum + b.amount : sum, 0) / 100;
        pendingBalance = balance.pending.reduce((sum, b) => b.currency === "usd" ? sum + b.amount : sum, 0) / 100;

        formattedPayouts = payouts.data.map((payout) => ({
          id: payout.id,
          amount: payout.amount / 100,
          currency: payout.currency.toUpperCase(),
          status: payout.status,
          arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
          created: new Date(payout.created * 1000).toISOString(),
          description: payout.description || "Payout",
          method: payout.method,
        }));

        logStep("Connected account balance retrieved", { stripeAccountId });
      } else {
        // No connected account for this team in the current Stripe mode.
        // Do NOT fall back to the platform account — that would expose the
        // platform's balance and payouts to any tenant.
        logStep("No connected account for team — returning empty balance", { teamId });
      }

    } catch (stripeErr) {
      stripeError = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      logStep("Stripe API error", { error: stripeError });
    }

    // Local DB data — team-scoped so every member sees the same tenant totals.
    const { data: totalRevenue } = teamId
      ? await supabaseClient
        .from("payments")
        .select("amount")
        .eq("team_id", teamId)
        .eq("payment_status", "completed")
      : { data: [] as Array<{ amount: number | null }> };

    const totalCollected = totalRevenue?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // Outstanding balance across open bookings (display only — nothing here is
    // charged). Legacy security-deposit columns are deliberately NOT read:
    // Exotiq exited the deposit flow on 2026-07-28.
    let balanceDue = 0;
    let balanceDueCount = 0;
    // Same rows that feed the tile also feed the "Awaiting payment" list, so
    // the count and the list can never disagree.
    const outstanding: Array<Record<string, unknown>> = [];
    if (teamId) {
      const { data: openBookings } = await supabaseClient
        .from("bookings")
        .select("id, total_value, payment_status, booking_ref, customer_name, customer_email, vehicle_name, start_date, end_date, status, booking_source, payment_due_at")
        .eq("team_id", teamId)
        .in("status", ["pending", "requested", "pending_payment", "confirmed", "in_progress"])
        .neq("payment_status", "paid");

      const openIds = (openBookings ?? []).map((b) => b.id as string);
      const paidByBooking = new Map<string, number>();
      if (openIds.length) {
        const { data: paidRows } = await supabaseClient
          .from("payments")
          .select("booking_id, amount")
          .eq("team_id", teamId)
          .eq("payment_status", "completed")
          .in("booking_id", openIds);
        for (const row of paidRows ?? []) {
          const key = row.booking_id as string;
          paidByBooking.set(key, (paidByBooking.get(key) ?? 0) + Number(row.amount || 0));
        }
      }
      for (const b of openBookings ?? []) {
        const due = Number(b.total_value || 0) - (paidByBooking.get(b.id as string) ?? 0);
        if (due > 0.01) {
          balanceDue += due;
          balanceDueCount += 1;
          outstanding.push({
            id: b.id,
            booking_ref: b.booking_ref,
            customer_name: b.customer_name,
            customer_email: b.customer_email,
            vehicle_name: b.vehicle_name,
            start_date: b.start_date,
            end_date: b.end_date,
            status: b.status,
            booking_source: b.booking_source,
            payment_due_at: b.payment_due_at,
            amount_due: Math.round(due * 100) / 100,
            total_value: Number(b.total_value || 0),
          });
        }
      }
      outstanding.sort((a, b) =>
        String(a.start_date ?? "").localeCompare(String(b.start_date ?? "")),
      );
    }

    // Get active holds from payments
    const { data: activeHolds } = teamId
      ? await supabaseClient
        .from("payments")
        .select("id, amount, hold_status, hold_expires_at, stripe_payment_intent_id, booking_id")
        .eq("team_id", teamId)
        .eq("hold_status", "authorized")
      : { data: [] };

    if (stripeError && totalCollected > 0) {
      availableBalance = Math.round(totalCollected * 0.85);
      pendingBalance = Math.round(totalCollected * 0.10);
    }

    return new Response(JSON.stringify({
      balance: {
        available: availableBalance,
        pending: pendingBalance,
        currency: "USD",
        using_fallback: !!stripeError,
        connected_account: !!stripeAccountId,
      },
      payouts: formattedPayouts,
      summary: {
        total_collected: totalCollected,
        balance_due: balanceDue,
        balance_due_count: balanceDueCount,
        outstanding,
        active_holds: activeHolds || [],
      },
      stripe_error: stripeError,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
