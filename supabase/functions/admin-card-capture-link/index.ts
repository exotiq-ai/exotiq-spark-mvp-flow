// Super-admin utility: mint a Stripe Checkout link (mode: setup) that lets a
// customer save a card. Used for teams that started a trial before we required
// a card up front. stripe-webhook attaches the saved card as the default
// payment method on the customer and any live subscription.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const jwt = authHeader.replace("Bearer ", "");

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Service-role bearer = trusted internal caller (ops tooling).
    const isInternal = jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!isInternal) {
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData, error: userErr } = await anonClient.auth.getUser(jwt);
      if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
      const { data: isSuper } = await db.rpc("is_super_admin", { check_user_id: userData.user.id });
      if (!isSuper) return json({ error: "forbidden — super admin only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    let customer: string | undefined =
      typeof body?.customer === "string" && body.customer.startsWith("cus_")
        ? body.customer
        : undefined;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    if (!customer) {
      if (!email) return json({ error: "customer (cus_...) or email is required" }, 400);
      const found = await stripe.customers.list({ email, limit: 1 });
      customer = found.data[0]?.id;
      if (!customer) return json({ error: `No Stripe customer for ${email}` }, 404);
    }

    const session = await stripe.checkout.sessions.create({
      customer,
      mode: "setup",
      payment_method_types: ["card"],
      success_url: "https://app.exotiq.ai/dashboard/settings?card=saved",
      cancel_url: "https://app.exotiq.ai/dashboard/settings",
    });

    // Optionally email the link (exotiq-branded, minimal).
    const sendTo = typeof body?.send_to === "string" ? body.send_to.trim() : "";
    let emailed = false;
    if (sendTo) {
      const apiKey = Deno.env.get("RESEND_API_KEY");
      if (!apiKey) return json({ error: "RESEND_API_KEY not configured", url: session.url }, 500);
      const html = `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#ffffff;padding:40px 24px;color:#111;">
  <div style="max-width:520px;margin:0 auto;">
    <img src="https://app.exotiq.ai/brand/logos/exotiq-mark-black.png" alt="exotiq" width="40" height="40" style="display:block;margin-bottom:28px;" />
    <h1 style="font-size:20px;font-weight:600;margin:0 0 12px;">Add a payment method</h1>
    <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 24px;">
      Your exotiq trial is active. Add a card now so your account continues without interruption when the trial ends. You won't be charged today.
    </p>
    <a href="${session.url}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:15px;font-weight:500;">Add payment method</a>
    <p style="font-size:13px;color:#888;line-height:1.6;margin:28px 0 0;">
      If the button doesn't work, paste this link into your browser:<br />
      <span style="word-break:break-all;">${session.url}</span>
    </p>
  </div>
</div>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "exotiq <noreply@mail.exotiq.ai>",
          to: [sendTo],
          subject: "Add a payment method to your exotiq account",
          html,
          text: `Add a payment method to your exotiq account: ${session.url}`,
        }),
      });
      emailed = res.ok;
      if (!res.ok) console.error("[ADMIN-CARD-CAPTURE-LINK] email failed", await res.text());
    }

    return json({ url: session.url, customer, sessionId: session.id, emailed });
  } catch (error) {
    console.error("[ADMIN-CARD-CAPTURE-LINK]", error);
    return json({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
