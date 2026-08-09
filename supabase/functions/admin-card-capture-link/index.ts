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

    return json({ url: session.url, customer, sessionId: session.id });
  } catch (error) {
    console.error("[ADMIN-CARD-CAPTURE-LINK]", error);
    return json({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
