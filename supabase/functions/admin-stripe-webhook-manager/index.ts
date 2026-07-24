// One-shot super-admin utility: create or retrieve the Stripe test-mode webhook
// endpoint that feeds `rent-payment-webhook`. Returns the endpoint ID and secret
// so the project can keep `RENT_PAYMENT_WEBHOOK_SECRET` in sync without manual
// dashboard copy-pasting. Delete after M6 QA.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
];

const DEFAULT_WEBHOOK_URL =
  "https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rent-payment-webhook";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!stripeKey.startsWith("sk_test_")) {
      return json({ error: "STRIPE_SECRET_KEY is not sk_test_ — refusing" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const jwt = authHeader.replace("Bearer ", "");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await anonClient.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isSuper } = await db.rpc("is_super_admin", { check_user_id: userData.user.id });
    if (!isSuper) return json({ error: "forbidden — super admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const webhookUrl = typeof body.url === "string" && body.url.trim()
      ? body.url.trim()
      : DEFAULT_WEBHOOK_URL;
    const recreate = Boolean(body.recreate);

    // List existing endpoints and find one matching this URL.
    const listRes = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", {
      method: "GET",
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (!listRes.ok) {
      const err = await listRes.json();
      return json({ error: "stripe_list_failed", details: err }, listRes.status);
    }
    const list = (await listRes.json()) as { data: Array<{ id: string; url: string }> };
    const existing = list.data.find((e) => e.url === webhookUrl);

    if (existing && !recreate) {
      return json({
        ok: true,
        created: false,
        endpoint_id: existing.id,
        url: webhookUrl,
        note: "Stripe only returns the secret at creation time; pass recreate:true to rotate it.",
      });
    }

    if (existing && recreate) {
      const delRes = await fetch(`https://api.stripe.com/v1/webhook_endpoints/${existing.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      if (!delRes.ok) {
        const err = await delRes.json();
        return json({ error: "stripe_delete_failed", details: err }, delRes.status);
      }
    }

    // Create the endpoint.
    const params = new URLSearchParams();
    params.set("url", webhookUrl);
    DEFAULT_WEBHOOK_EVENTS.forEach((event, i) => params.set(`enabled_events[${i}]`, event));
    params.set("metadata[purpose]", "m6-rent-payment-webhook");

    const createRes = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      return json({ error: "stripe_create_failed", details: created }, createRes.status);
    }

    return json({
      ok: true,
      created: true,
      endpoint_id: created.id,
      url: webhookUrl,
      secret: created.secret,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
