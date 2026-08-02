// Go-Live smoke test runner (super-admin only).
//
// Drives the REAL production paths — create-checkout-session,
// rent-create-booking, rent-approve-booking, rent-checkout,
// rent-refund-booking — at minimum amounts so a green run means the live
// Stripe cutover actually works. Card entry stays manual (Stripe blocks
// scripted cards on live Checkout); everything either side is automated.
//
// Actions: start | advance | cleanup | cancel
// config.toml: verify_jwt = false (auth is enforced in code, super admin only).

import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[ADMIN-SMOKE-RUN] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

// Pro monthly, per-vehicle — smallest recurring live price we sell.
const SUBSCRIPTION_PRICE_ID = "price_1Tbv4IHO7nC3pJiPH4EbyVlL";

type StepState = "pending" | "running" | "passed" | "failed" | "awaiting_user";
interface Step {
  key: string;
  label: string;
  state: StepState;
  detail?: string;
  action_url?: string | null;
  at?: string;
}

const BLUEPRINTS: Record<string, Array<{ key: string; label: string }>> = {
  subscription: [
    { key: "session", label: "Create live subscription Checkout session" },
    { key: "pay", label: "Pay with a real card (manual)" },
    { key: "active", label: "Session completed and subscription active" },
    { key: "webhook", label: "Platform webhook recorded the event" },
    { key: "reverse", label: "Subscription cancelled and invoice refunded" },
  ],
  marketplace_booking: [
    { key: "tenant", label: "Pick live-ready tenant and cheapest vehicle" },
    { key: "quote", label: "Quote booking and snapshot every fee" },
    { key: "booking", label: "Create, approve and generate renter Checkout" },
    { key: "pay", label: "Pay with a real card (manual)" },
    { key: "captured", label: "Both legs captured (operator + Exotiq)" },
    { key: "parity", label: "Charged amounts match the snapshot to the cent" },
    { key: "split", label: "Destination charge routed to the operator account" },
  ],
  refund: [
    { key: "refund", label: "Refund the booking via rent-refund-booking" },
    { key: "stripe", label: "Both legs show refunded in Stripe" },
    { key: "ledger", label: "Booking status and ledger reflect the reversal" },
    { key: "orphans", label: "No orphan payment rows left behind" },
  ],
};

function buildSteps(scenario: string): Step[] {
  return (BLUEPRINTS[scenario] ?? []).map((s) => ({ ...s, state: "pending" as StepState }));
}

function setStep(steps: Step[], key: string, state: StepState, detail?: string, actionUrl?: string | null) {
  const s = steps.find((x) => x.key === key);
  if (!s) return;
  s.state = state;
  if (detail !== undefined) s.detail = detail;
  if (actionUrl !== undefined) s.action_url = actionUrl;
  s.at = new Date().toISOString();
}

function runStatus(steps: Step[]): "running" | "passed" | "failed" {
  if (steps.some((s) => s.state === "failed")) return "failed";
  if (steps.length && steps.every((s) => s.state === "passed")) return "passed";
  return "running";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function callFn(name: string, body: unknown, auth?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: auth ?? `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, payload } as {
    ok: boolean;
    status: number;
    payload: Record<string, any>;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    // ---- auth: super admin only -------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const { data: userData, error: userErr } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;
    const { data: isSuper } = await db.rpc("is_super_admin", { check_user_id: userId });
    if (!isSuper) return json({ error: "forbidden — super admin only" }, 403);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const mode = stripeKey.startsWith("sk_live_") ? "live" : stripeKey.startsWith("sk_test_") ? "test" : null;
    if (!mode) return json({ error: "STRIPE_SECRET_KEY is missing or malformed" }, 500);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // ---------------------------------------------------------------- start
    if (action === "start") {
      const scenario = String(body.scenario ?? "");
      if (!BLUEPRINTS[scenario]) return json({ error: "unknown scenario" }, 400);
      if (mode === "live" && body.confirm !== "RUN LIVE") {
        return json({ error: "Live runs require confirm: \"RUN LIVE\"" }, 400);
      }

      const steps = buildSteps(scenario);
      const { data: run, error: insErr } = await db
        .from("smoke_test_runs")
        .insert({
          scenario,
          mode,
          steps,
          created_by: userId,
          parent_run_id: body.parent_run_id ?? null,
          context: {},
        })
        .select("*")
        .single();
      if (insErr) throw insErr;

      const origin = req.headers.get("origin") || "https://app.exotiq.ai";
      const ctx: Record<string, unknown> = {};

      try {
        if (scenario === "subscription") {
          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price: SUBSCRIPTION_PRICE_ID, quantity: 1 }],
            payment_method_collection: "always",
            subscription_data: { metadata: { exotiq_smoke_run_id: run.id } },
            metadata: { exotiq_smoke_run_id: run.id },
            success_url: `${origin}/super-admin?smoke=${run.id}&paid=1`,
            cancel_url: `${origin}/super-admin?smoke=${run.id}&paid=0`,
          });
          ctx.session_id = session.id;
          ctx.amount_cents = session.amount_total ?? 0;
          setStep(steps, "session", "passed", `Session ${session.id} · ${((session.amount_total ?? 0) / 100).toFixed(2)} ${(session.currency ?? "usd").toUpperCase()}`);
          setStep(steps, "pay", "awaiting_user", "Open Checkout and pay with a real card.", session.url);
        } else if (scenario === "marketplace_booking") {
          await runBookingStart({ db, stripe, mode, steps, ctx, callerAuth: authHeader, runId: run.id });
        } else if (scenario === "refund") {
          const parentId = body.parent_run_id as string | undefined;
          let bookingRef = typeof body.booking_ref === "string" ? body.booking_ref : "";
          if (!bookingRef && parentId) {
            const { data: parent } = await db
              .from("smoke_test_runs")
              .select("context")
              .eq("id", parentId)
              .maybeSingle();
            bookingRef = String((parent?.context as any)?.booking_ref ?? "");
          }
          if (!bookingRef) throw new Error("A paid smoke booking is required before the refund run.");
          ctx.booking_ref = bookingRef;
          const refundRes = await callFn("rent-refund-booking", { booking_ref: bookingRef }, authHeader);
          if (!refundRes.ok) throw new Error(refundRes.payload?.error ?? `rent-refund-booking ${refundRes.status}`);
          setStep(steps, "refund", "passed", `Refund requested for ${bookingRef}`);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const firstOpen = steps.find((s) => s.state === "pending" || s.state === "running");
        setStep(steps, firstOpen?.key ?? steps[0].key, "failed", message);
      }

      const { data: saved } = await db
        .from("smoke_test_runs")
        .update({
          steps,
          context: ctx,
          amount_cents: Number(ctx.amount_cents ?? 0),
          status: runStatus(steps),
        })
        .eq("id", run.id)
        .select("*")
        .single();
      return json({ ok: true, run: saved });
    }

    // -------------------------------------------------------------- advance
    if (action === "advance" || action === "cleanup" || action === "cancel") {
      const runId = String(body.run_id ?? "");
      const { data: run, error } = await db.from("smoke_test_runs").select("*").eq("id", runId).maybeSingle();
      if (error) throw error;
      if (!run) return json({ error: "run not found" }, 404);

      const steps = (run.steps ?? []) as Step[];
      const ctx = (run.context ?? {}) as Record<string, any>;

      if (action === "cancel") {
        const { data: saved } = await db
          .from("smoke_test_runs")
          .update({ status: "cancelled" })
          .eq("id", runId)
          .select("*")
          .single();
        return json({ ok: true, run: saved });
      }

      if (action === "cleanup") {
        const detail = await cleanupRun({ db, stripe, run, ctx, callerAuth: authHeader });
        const { data: saved } = await db
          .from("smoke_test_runs")
          .update({ cleanup_state: detail.ok ? "done" : "failed", context: { ...ctx, cleanup: detail } })
          .eq("id", runId)
          .select("*")
          .single();
        return json({ ok: detail.ok, run: saved, cleanup: detail });
      }

      try {
        if (run.scenario === "subscription") {
          await advanceSubscription({ db, stripe, steps, ctx });
        } else if (run.scenario === "marketplace_booking") {
          await advanceBooking({ db, stripe, steps, ctx });
        } else if (run.scenario === "refund") {
          await advanceRefund({ db, stripe, steps, ctx });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const open = steps.find((s) => s.state === "pending" || s.state === "running" || s.state === "awaiting_user");
        setStep(steps, open?.key ?? steps[0].key, "failed", message);
      }

      const status = runStatus(steps);
      const { data: saved } = await db
        .from("smoke_test_runs")
        .update({ steps, context: ctx, status })
        .eq("id", runId)
        .select("*")
        .single();
      return json({ ok: true, run: saved });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("ERROR", { message });
    return json({ error: message }, 500);
  }
});

// ---------------------------------------------------------------- scenarios

async function runBookingStart(args: {
  db: any;
  stripe: Stripe;
  mode: string;
  steps: Step[];
  ctx: Record<string, any>;
  callerAuth: string;
  runId: string;
}) {
  const { db, steps, ctx, callerAuth, runId, mode } = args;

  // 1 — tenant + cheapest vehicle
  const acctColumn = mode === "live" ? "stripe_account_id" : "stripe_test_account_id";
  const { data: teams } = await db
    .from("teams")
    .select("id, name, slug, currency, platform_fee_percent, stripe_account_id, stripe_test_account_id, stripe_charges_enabled")
    .eq("marketplace_visible", true)
    .eq("stripe_charges_enabled", true)
    .not(acctColumn, "is", null)
    .limit(20);
  const team = (teams ?? [])[0];
  if (!team) throw new Error(`No marketplace-visible tenant with a ${mode}-mode Connect account and charges enabled.`);

  const { data: vehicles } = await db
    .from("vehicles")
    .select("id, make, model, slug, daily_rate, status")
    .eq("team_id", team.id)
    .eq("marketplace_visible", true)
    .eq("status", "available")
    .order("daily_rate", { ascending: true })
    .limit(1);
  const vehicle = (vehicles ?? [])[0];
  if (!vehicle) throw new Error(`Tenant ${team.name} has no marketplace-visible available vehicle.`);

  ctx.team_id = team.id;
  ctx.team_slug = team.slug;
  ctx.connected_account_id = team[acctColumn];
  ctx.vehicle_id = vehicle.id;
  ctx.vehicle_slug = vehicle.slug;
  ctx.currency = team.currency ?? "USD";
  setStep(steps, "tenant", "passed", `${team.name} · ${vehicle.make} ${vehicle.model} @ ${vehicle.daily_rate}/day`);

  // 2 — quote (single day, protection declined = minimum exposure)
  const start = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 22 * 864e5).toISOString().slice(0, 10);
  const { data: quoteRows, error: quoteErr } = await db.rpc("public_vehicle_quote", {
    _team_slug: team.slug,
    _vehicle_slug: vehicle.slug,
    _start_date: start,
    _end_date: end,
    _options: { protection: "decline" },
  });
  if (quoteErr) throw quoteErr;
  const quote = Array.isArray(quoteRows) ? quoteRows[0] : quoteRows;
  if (!quote) throw new Error("Vehicle is not quotable for those dates.");

  const snapshot = {
    operator_total_cents: Math.round(Number(quote.operator_total_cents)),
    platform_fee_cents: Math.round(Number(quote.platform_fee_cents ?? 0)),
    protection_total_cents: Math.round(Number(quote.protection_total_cents ?? 0)),
    state_fee_cents: Math.round(Number(quote.state_fee_cents ?? 0)),
    processing_fee_cents: Math.round(Number(quote.processing_fee_cents ?? 0)),
  };
  ctx.snapshot = snapshot;
  ctx.start_date = start;
  ctx.end_date = end;
  const exotiqLeg =
    snapshot.platform_fee_cents + snapshot.protection_total_cents + snapshot.state_fee_cents + snapshot.processing_fee_cents;
  ctx.amount_cents = snapshot.operator_total_cents + exotiqLeg;
  setStep(
    steps,
    "quote",
    "passed",
    `Operator ${(snapshot.operator_total_cents / 100).toFixed(2)} + Exotiq ${(exotiqLeg / 100).toFixed(2)} = ${(Number(ctx.amount_cents) / 100).toFixed(2)}`,
  );

  // 3 — create + approve + renter Checkout, through the real functions
  const created = await callFn("rent-create-booking", {
    team_slug: team.slug,
    vehicle_slug: vehicle.slug,
    start_date: start,
    end_date: end,
    pickup_time: "10:00 AM",
    protection: "decline",
    driver: {
      name: "Exotiq Smoke Test",
      email: `smoke+${runId.slice(0, 8)}@exotiq.ai`,
      phone: "+15555550123",
    },
  });
  if (!created.ok) throw new Error(created.payload?.error ?? `rent-create-booking ${created.status}`);
  const bookingRef = created.payload.booking_ref;
  const token = created.payload.confirmation_token;
  if (!bookingRef || !token) throw new Error("rent-create-booking returned an unexpected payload.");

  // The function returns ref + token only; resolve the row id for follow-ups.
  const { data: bookingRow } = await db
    .from("bookings")
    .select("id")
    .eq("booking_ref", bookingRef)
    .maybeSingle();
  const bookingId = bookingRow?.id;
  if (!bookingId) throw new Error(`Booking ${bookingRef} was created but could not be re-read.`);
  ctx.booking_id = bookingId;
  ctx.booking_ref = bookingRef;
  ctx.confirmation_token = token;

  // Identity verification is out of scope for the money smoke — move the hold
  // straight to 'requested' and tag the row so it is auditable.
  await args.db
    .from("bookings")
    .update({ status: "requested", notes: `[GO-LIVE SMOKE ${runId}] automated payment verification` })
    .eq("id", bookingId);

  const approved = await callFn("rent-approve-booking", { booking_id: bookingId }, callerAuth);
  if (!approved.ok) throw new Error(approved.payload?.error ?? `rent-approve-booking ${approved.status}`);

  const checkout = await callFn("rent-checkout", { booking_ref: bookingRef, token });
  if (!checkout.ok || !checkout.payload?.url) {
    throw new Error(checkout.payload?.error ?? `rent-checkout ${checkout.status}`);
  }
  setStep(steps, "booking", "passed", `${bookingRef} approved and payable`);
  setStep(steps, "pay", "awaiting_user", "Open the renter Checkout and pay with a real card.", checkout.payload.url);
}

async function advanceSubscription(args: { db: any; stripe: Stripe; steps: Step[]; ctx: Record<string, any> }) {
  const { db, stripe, steps, ctx } = args;
  const session = await stripe.checkout.sessions.retrieve(String(ctx.session_id), { expand: ["subscription"] });
  if (session.payment_status !== "paid" && session.status !== "complete") {
    setStep(steps, "pay", "awaiting_user", "Still waiting on the card payment.", session.url ?? null);
    return;
  }
  setStep(steps, "pay", "passed", "Card payment completed.");

  const subscription = session.subscription as Stripe.Subscription | null;
  if (!subscription) throw new Error("Checkout completed but no subscription was created.");
  ctx.subscription_id = subscription.id;
  ctx.customer_id = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!["active", "trialing"].includes(subscription.status)) {
    setStep(steps, "active", "failed", `Subscription status is ${subscription.status}`);
    return;
  }
  setStep(steps, "active", "passed", `Subscription ${subscription.id} is ${subscription.status}`);

  // Webhook proof: any recorded platform event referencing this run's objects.
  const since = new Date(Date.now() - 3 * 3600e3).toISOString();
  const { data: events } = await db
    .from("stripe_webhook_events")
    .select("stripe_event_id, event_type, payload, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);
  const needles = [String(ctx.session_id), subscription.id, String(ctx.customer_id ?? "")].filter(Boolean);
  const hit = (events ?? []).find((e: any) => {
    const blob = JSON.stringify(e.payload ?? {});
    return needles.some((n) => blob.includes(n));
  });
  if (!hit) {
    setStep(steps, "webhook", "failed", "No webhook event recorded for this subscription within 3h.");
    return;
  }
  setStep(steps, "webhook", "passed", `${hit.event_type} · ${hit.stripe_event_id}`);

  // Reverse it: cancel now and refund the invoice charge.
  const reversal = await reverseSubscription(stripe, subscription.id);
  setStep(steps, "reverse", reversal.ok ? "passed" : "failed", reversal.detail);
  ctx.cleanup_state = reversal.ok ? "done" : "failed";
}

async function reverseSubscription(stripe: Stripe, subscriptionId: string) {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
    if (sub.status !== "canceled") await stripe.subscriptions.cancel(subscriptionId);
    const invoice = sub.latest_invoice as Stripe.Invoice | null;
    const pi = invoice && typeof (invoice as any).payment_intent === "string"
      ? (invoice as any).payment_intent as string
      : null;
    if (pi) {
      try {
        await stripe.refunds.create({ payment_intent: pi }, { idempotencyKey: `smoke-sub-refund-${subscriptionId}` });
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        if (!m.includes("already been refunded")) throw err;
      }
      return { ok: true, detail: `Cancelled ${subscriptionId} and refunded ${pi}` };
    }
    return { ok: true, detail: `Cancelled ${subscriptionId} (no invoice charge to refund)` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function advanceBooking(args: { db: any; stripe: Stripe; steps: Step[]; ctx: Record<string, any> }) {
  const { db, stripe, steps, ctx } = args;
  const { data: booking } = await db
    .from("bookings")
    .select("id, booking_ref, status, paid_at, operator_payment_intent_id, exotiq_payment_intent_id")
    .eq("id", ctx.booking_id)
    .maybeSingle();
  if (!booking) throw new Error("Smoke booking row disappeared.");

  if (!booking.operator_payment_intent_id) {
    setStep(steps, "pay", "awaiting_user", `Still waiting on payment (status: ${booking.status}).`);
    return;
  }
  setStep(steps, "pay", "passed", "Renter Checkout paid.");

  if (!booking.exotiq_payment_intent_id) {
    setStep(steps, "captured", "awaiting_user", "Operator leg captured; Exotiq leg still processing.");
    return;
  }
  setStep(
    steps,
    "captured",
    "passed",
    `Operator ${booking.operator_payment_intent_id} · Exotiq ${booking.exotiq_payment_intent_id}`,
  );

  const [opPi, exPi] = await Promise.all([
    stripe.paymentIntents.retrieve(booking.operator_payment_intent_id),
    stripe.paymentIntents.retrieve(booking.exotiq_payment_intent_id),
  ]);
  ctx.operator_charged_cents = opPi.amount_received || opPi.amount;
  ctx.exotiq_charged_cents = exPi.amount_received || exPi.amount;

  const snap = ctx.snapshot ?? {};
  const expectedExotiq =
    (snap.platform_fee_cents ?? 0) +
    (snap.protection_total_cents ?? 0) +
    (snap.state_fee_cents ?? 0) +
    (snap.processing_fee_cents ?? 0);
  const diffs: string[] = [];
  if (Number(ctx.operator_charged_cents) !== Number(snap.operator_total_cents)) {
    diffs.push(`operator expected ${snap.operator_total_cents}, charged ${ctx.operator_charged_cents}`);
  }
  if (Number(ctx.exotiq_charged_cents) !== expectedExotiq) {
    diffs.push(`exotiq expected ${expectedExotiq}, charged ${ctx.exotiq_charged_cents}`);
  }
  setStep(
    steps,
    "parity",
    diffs.length ? "failed" : "passed",
    diffs.length ? diffs.join(" · ") : `Both legs match the snapshot (${((Number(snap.operator_total_cents) + expectedExotiq) / 100).toFixed(2)})`,
  );
  if (diffs.length) return;

  const destination =
    typeof opPi.transfer_data?.destination === "string"
      ? opPi.transfer_data.destination
      : (opPi.transfer_data?.destination as any)?.id;
  if (destination !== ctx.connected_account_id) {
    setStep(steps, "split", "failed", `Destination ${destination ?? "none"} ≠ operator account ${ctx.connected_account_id}`);
    return;
  }
  setStep(steps, "split", "passed", `Destination charge → ${destination}`);
}

async function advanceRefund(args: { db: any; stripe: Stripe; steps: Step[]; ctx: Record<string, any> }) {
  const { db, stripe, steps, ctx } = args;
  const { data: booking } = await db
    .from("bookings")
    .select("id, booking_ref, status, operator_payment_intent_id, exotiq_payment_intent_id, team_id")
    .eq("booking_ref", ctx.booking_ref)
    .maybeSingle();
  if (!booking) throw new Error("Booking not found for refund verification.");

  const pis = [booking.operator_payment_intent_id, booking.exotiq_payment_intent_id].filter(
    (p: string | null) => p && p !== "none_required",
  ) as string[];
  const states: string[] = [];
  let allRefunded = true;
  for (const pi of pis) {
    const intent = await stripe.paymentIntents.retrieve(pi, { expand: ["latest_charge"] });
    const charge = intent.latest_charge as Stripe.Charge | null;
    const refunded = Boolean(charge?.refunded) || (charge?.amount_refunded ?? 0) >= (charge?.amount ?? 1);
    if (!refunded) allRefunded = false;
    states.push(`${pi}: ${refunded ? "refunded" : "not refunded"}`);
  }
  setStep(steps, "stripe", allRefunded ? "passed" : "awaiting_user", states.join(" · ") || "No captured legs found.");
  if (!allRefunded) return;

  if (booking.status !== "refunded") {
    setStep(steps, "ledger", "failed", `Booking status is ${booking.status}, expected refunded.`);
    return;
  }
  setStep(steps, "ledger", "passed", `Booking ${booking.booking_ref} is refunded.`);

  const { data: payments } = await db
    .from("payments")
    .select("id, status, amount")
    .eq("booking_id", booking.id);
  const orphans = (payments ?? []).filter((p: any) => !["refunded", "cancelled", "failed"].includes(p.status));
  setStep(
    steps,
    "orphans",
    orphans.length ? "failed" : "passed",
    orphans.length ? `${orphans.length} payment row(s) still marked ${orphans.map((o: any) => o.status).join(", ")}` : "No orphan payment rows.",
  );
}

async function cleanupRun(args: {
  db: any;
  stripe: Stripe;
  run: any;
  ctx: Record<string, any>;
  callerAuth: string;
}) {
  const { db, stripe, run, ctx, callerAuth } = args;
  const notes: string[] = [];
  let ok = true;

  try {
    if (run.scenario === "subscription" && ctx.subscription_id) {
      const r = await reverseSubscription(stripe, String(ctx.subscription_id));
      ok = ok && r.ok;
      notes.push(r.detail);
    }

    if (run.scenario === "marketplace_booking" && ctx.booking_ref) {
      const { data: booking } = await db
        .from("bookings")
        .select("id, status, operator_payment_intent_id, exotiq_payment_intent_id")
        .eq("booking_ref", ctx.booking_ref)
        .maybeSingle();
      if (booking) {
        const captured = Boolean(booking.operator_payment_intent_id || booking.exotiq_payment_intent_id);
        if (captured && booking.status !== "refunded") {
          const res = await callFn("rent-refund-booking", { booking_ref: ctx.booking_ref }, callerAuth);
          if (!res.ok) {
            ok = false;
            notes.push(`refund failed: ${res.payload?.error ?? res.status}`);
          } else {
            notes.push("refunded both legs");
          }
        } else if (!captured) {
          await db.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
          notes.push("unpaid booking cancelled");
        } else {
          notes.push("already refunded");
        }
      }
    }
  } catch (e) {
    ok = false;
    notes.push(e instanceof Error ? e.message : String(e));
  }

  return { ok, detail: notes.join(" · "), at: new Date().toISOString() };
}
