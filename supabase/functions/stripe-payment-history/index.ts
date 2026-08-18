import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeMode } from "../_shared/stripeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STRIPE-PAYMENT-HISTORY] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
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
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const {
      limit = 50,
      starting_after,
      search = "",
      offset = 0,
      team_id: requestedTeamId,
    } = await req.json().catch(() => ({}));

    const pageSize = Math.min(Number(limit) || 50, 200);
    const pageOffset = Math.max(Number(offset) || 0, 0);
    const searchTerm = typeof search === "string" ? search.trim() : "";

    // Get team and connected Stripe account. When the caller names a team we
    // still verify active membership in THAT team before reading its money.
    let memberQuery = supabaseClient
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .eq("is_active", true);
    if (typeof requestedTeamId === "string" && requestedTeamId) {
      memberQuery = memberQuery.eq("team_id", requestedTeamId);
    }
    const { data: teamMember } = await memberQuery.limit(1).maybeSingle();

    let stripeAccountId: string | null = null;
    let teamId: string | null = null;

    if (teamMember) {
      teamId = teamMember.team_id;
      const { data: team } = await supabaseClient
        .from("teams")
        .select("stripe_account_id, stripe_test_account_id, stripe_charges_enabled")
        .eq("id", teamMember.team_id)
        .single();
      const mode = resolveStripeMode();
      const modeAcct = mode === "test" ? team?.stripe_test_account_id : team?.stripe_account_id;
      if (modeAcct && team?.stripe_charges_enabled) {
        stripeAccountId = modeAcct;
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let payments: Array<{
      id: string; amount: number; currency: string; status: string; created: string;
      description: string; customer_email: string | null; customer_name: string | null;
      payment_method: string; receipt_url: string | null; metadata: Record<string, string>;
    }> = [];
    let hasMore = false;

    if (!stripeAccountId) {
      // No connected account for this team in the current Stripe mode. Never
      // list the platform account's payment intents here — that would leak
      // other tenants' charges and their customers' PII.
      logStep("No connected account for team — skipping Stripe fetch", { teamId });
    } else {
      try {
        const params: Stripe.PaymentIntentListParams = {
          limit: Math.min(limit, 100),
        };
        if (starting_after) params.starting_after = starting_after;

        const stripeOpts = { stripeAccount: stripeAccountId };

        const paymentIntents = await stripe.paymentIntents.list(params, stripeOpts);
        const charges = await stripe.charges.list({ limit: Math.min(limit, 100) }, stripeOpts);
        hasMore = paymentIntents.has_more;

        payments = paymentIntents.data.map((pi) => {
          const relatedCharge = charges.data.find(c => c.payment_intent === pi.id);
          return {
            id: pi.id,
            amount: pi.amount / 100,
            currency: pi.currency.toUpperCase(),
            status: pi.status,
            created: new Date(pi.created * 1000).toISOString(),
            description: pi.description || relatedCharge?.description || "Payment",
            customer_email: relatedCharge?.billing_details?.email || null,
            customer_name: relatedCharge?.billing_details?.name || null,
            payment_method: relatedCharge?.payment_method_details?.type || "card",
            receipt_url: relatedCharge?.receipt_url || null,
            metadata: pi.metadata || {},
          };
        });

        logStep("Fetched Stripe payments", { count: payments.length, connected: true });
      } catch (stripeErr) {
        logStep("Stripe API error, using local only", { error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr) });
      }
    }


    // Local payments — scoped to the TEAM, not the caller's user id. Payment
    // rows are written by whoever recorded them (or by the Stripe webhook),
    // so a user-id scope hid most of a tenant's own history.
    let localPayments: unknown[] = [];
    let localTotal = 0;

    if (teamId) {
      // Search is resolved server-side: match the booking first (customer,
      // email, reference, vehicle), then pull that booking's payment rows.
      let matchedBookingIds: string[] | null = null;
      if (searchTerm) {
        const like = `%${searchTerm.replace(/[%,]/g, " ")}%`;
        const { data: matches } = await supabaseClient
          .from("bookings")
          .select("id")
          .eq("team_id", teamId)
          .or(
            `customer_name.ilike.${like},customer_email.ilike.${like},booking_ref.ilike.${like},vehicle_name.ilike.${like}`,
          )
          .limit(2000);
        matchedBookingIds = (matches ?? []).map((b) => b.id as string);
      }

      const buildQuery = (head: boolean) => {
        let q = supabaseClient
          .from("payments")
          .select(
            `
        *,
        bookings (
          booking_ref,
          customer_name,
          customer_email,
          vehicle_id,
          vehicle_name,
          vehicles (name, make, model)
        )
      `,
            head ? { count: "exact", head: true } : { count: "exact" },
          )
          .eq("team_id", teamId);
        if (matchedBookingIds) {
          q = matchedBookingIds.length
            ? q.in("booking_id", matchedBookingIds)
            : q.eq("booking_id", "00000000-0000-0000-0000-000000000000");
        }
        return q;
      };

      const { data: rows, count } = await buildQuery(false)
        .order("created_at", { ascending: false })
        .range(pageOffset, pageOffset + pageSize - 1);

      localPayments = rows ?? [];
      localTotal = count ?? 0;
    }

    logStep("Fetched local payments", { count: localPayments.length, total: localTotal, teamId, searchTerm });

    return new Response(JSON.stringify({
      stripe_payments: payments,
      local_payments: localPayments,
      local_total: localTotal,
      local_has_more: pageOffset + localPayments.length < localTotal,
      has_more: hasMore,
      connected_account: !!stripeAccountId,
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
