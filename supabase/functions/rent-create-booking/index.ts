// M5 + M6b: renter booking creation with fee/protection snapshot.
// M6b changes (docs/rent/M6_MONEY_PLAN.md): persists protection_tier,
// platform_fee_cents, protection_total_cents so rent-checkout charges from
// the booking, and strips deposit_cents out of total_value (the 2026-07-22
// quote update rolled the deposit into operator_total_cents).
// Original M5 header follows.
// M5: renter booking creation (goal brief M5; marketplace handoff gap #1).
// Ref: exotiq-rent docs/rent/RENTER_APP_GOAL.md; DECISIONS D2/D3/D4/D6.
//
// Anonymous POST. Everything client-supplied is re-derived server-side:
// the vehicle is re-validated via the marketplace helpers, the quote is
// re-run via public_vehicle_quote (client totals are never trusted), and
// the overlap check + insert happen inside one SQL transaction
// (create_marketplace_booking) with the btree_gist constraint as the
// concurrency backstop.
//
// Initial status (D3 + ID plan V1 ruling): 'requested' when the renter's
// email already has a verified, unexpired identity; otherwise
// 'pending_documents' — verification confirms the booking post-payment.
//
// Deliberately NOT returned: a Stripe Checkout URL. The D1 money-flow
// review (two separate charges) is still open with Gregory; wiring
// create-payment-checkout before that lands the wrong model (M6).
//
// config.toml: verify_jwt = false (guest checkout; anon key passes gateway).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { checkRateLimit, clientIp, verifyTurnstile } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Persistent limiter (see _shared/rateLimit.ts). 20/hr per IP matches prior
// intent; enforced now because state lives in Postgres, not per-isolate memory.
const MAX_PER_HOUR = 20;
const WINDOW_SECONDS = 3600;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[RENT-CREATE-BOOKING] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Cluster C item #29: strict RFC-5322-lite email. `.includes("@")` accepted
// bare "@", trailing dots, and whitespace-in-local-part, which then flowed
// into ilike identity lookups. Reject at the door.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = clientIp(req);
  const allowed = await checkRateLimit(`rent-create-booking:${ip}`, MAX_PER_HOUR, WINDOW_SECONDS);
  if (!allowed) return json({ error: "Too many requests" }, 429);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));

    // Turnstile (only enforced when CLOUDFLARE_TURNSTILE_SECRET is set).
    const turnstile = await verifyTurnstile(body?.turnstile_token, ip);
    if (!turnstile.ok) {
      return json({ error: "Bot check failed. Please retry." }, 400);
    }

    const teamSlug = String(body.team_slug ?? "").trim();
    const vehicleSlug = String(body.vehicle_slug ?? "").trim();
    const startDate = String(body.start_date ?? "").trim();
    const endDate = String(body.end_date ?? "").trim();
    const pickupTime = String(body.pickup_time ?? "10:00 AM").trim().slice(0, 16);

    // Strict protection validation (item #4): unknown values are rejected
    // rather than silently coerced to premium (the most expensive tier).
    const ALLOWED_PROTECTION = ["premium", "standard", "decline"] as const;
    const rawProtection = body.protection;
    let protection: (typeof ALLOWED_PROTECTION)[number] = "premium";
    if (rawProtection === undefined || rawProtection === null || rawProtection === "") {
      protection = "premium";
    } else if (typeof rawProtection === "string" && (ALLOWED_PROTECTION as readonly string[]).includes(rawProtection)) {
      protection = rawProtection as (typeof ALLOWED_PROTECTION)[number];
    } else {
      return json({ error: "protection must be one of: premium, standard, decline" }, 400);
    }

    const driver = body.driver ?? {};
    const name = String(driver.name ?? "").trim().slice(0, 120);
    const email = String(driver.email ?? "").trim().toLowerCase().slice(0, 200);
    const phone = String(driver.phone ?? "").trim().slice(0, 40);

    if (!teamSlug || !vehicleSlug) return json({ error: "team_slug and vehicle_slug are required" }, 400);
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate) || endDate <= startDate) {
      return json({ error: "valid start_date and end_date are required" }, 400);
    }
    if (startDate < new Date().toISOString().slice(0, 10)) {
      return json({ error: "start_date cannot be in the past" }, 400);
    }
    if (name.length < 2 || !email.includes("@") || phone.replace(/\D/g, "").length < 10) {
      return json({ error: "driver name, email, and phone are required" }, 400);
    }


    // Server-side quote — the only totals that count (D1/D9/D5).
    const { data: quoteRows, error: quoteError } = await admin.rpc("public_vehicle_quote", {
      _team_slug: teamSlug,
      _vehicle_slug: vehicleSlug,
      _start_date: startDate,
      _end_date: endDate,
      _options: { protection },
    });
    if (quoteError) throw quoteError;
    const quote = Array.isArray(quoteRows) ? quoteRows[0] : quoteRows;
    if (!quote) return json({ error: "Vehicle is not available for booking" }, 404);

    // Identity reuse (V7): verified + unexpired for this email, any team.
    const { data: verifiedRows } = await admin
      .from("identity_verifications")
      .select("id, document_expiry, customers!inner(email)")
      .eq("status", "verified")
      .ilike("customers.email", email)
      .limit(1);
    const identity = verifiedRows?.[0] as { document_expiry: string | null } | undefined;
    const identityVerified = Boolean(
      identity && (!identity.document_expiry || new Date(identity.document_expiry) > new Date()),
    );
    const initialStatus = identityVerified ? "requested" : "pending_documents";

    // Transactional create: overlap re-check + customer upsert + insert.
    const { data: created, error: createError } = await admin.rpc("create_marketplace_booking", {
      _team_slug: teamSlug,
      _vehicle_slug: vehicleSlug,
      _start_date: startDate,
      _end_date: endDate,
      _pickup_time: pickupTime,
      _customer_name: name,
      _customer_email: email,
      _customer_phone: phone,
      _daily_rate: Number(quote.daily_rate_cents) / 100,
      // M6b: operator_total_cents has included deposit_cents since the
      // 2026-07-22 quote update — total_value must be CHARGES only (the
      // deposit is an authorization at pickup, never part of the rental
      // charge). Subtract it defensively (older quote shape lacks the field).
      _total_value: (Number(quote.operator_total_cents) - Number(quote.deposit_cents ?? 0)) / 100,
      _initial_status: initialStatus,
      // M6b fee snapshot: what rent-checkout charges as the Exotiq leg.
      _protection_tier: protection,
      _platform_fee_cents: Math.round(Number(quote.platform_fee_cents)),
      _protection_total_cents: Math.round(Number(quote.protection_total_cents)),
    });

    if (createError) {
      const message = createError.message ?? "";
      if (message.includes("dates_unavailable") || message.includes("bookings_no_marketplace_overlap")) {
        return json({ error: "Those dates were just taken. Pick different dates." }, 409);
      }
      if (message.includes("team_not_available") || message.includes("vehicle_not_available")) {
        return json({ error: "Vehicle is not available for booking" }, 404);
      }
      if (message.includes("invalid_date_range")) {
        return json({ error: "valid start_date and end_date are required" }, 400);
      }
      throw createError;
    }

    const row = Array.isArray(created) ? created[0] : created;
    logStep("Booking created", { ref: row.booking_ref, status: row.status });

    return json({
      booking_ref: row.booking_ref,
      confirmation_token: row.confirmation_token,
      status: row.status,
      identity_verified: identityVerified,
      quote,
    });
  } catch (error) {
    console.error("[RENT-CREATE-BOOKING] error", error);
    return json({ error: "Unable to create booking" }, 500);
  }
});
