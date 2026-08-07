// Super-admin utility: create a Stripe account onboarding link for a
// connected account. Gated to super admins only — this mints a link that lets
// the holder complete onboarding on a live connected account.
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

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isSuper } = await db.rpc("is_super_admin", { check_user_id: userData.user.id });
    if (!isSuper) return json({ error: "forbidden — super admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const account: unknown = body?.account;
    if (typeof account !== "string" || !account.startsWith("acct_")) {
      return json({ error: "account must be a Stripe account id (acct_...)" }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const link = await stripe.accountLinks.create({
      account,
      refresh_url: "https://app.exotiq.ai/super-admin",
      return_url: "https://app.exotiq.ai/super-admin",
      type: "account_onboarding",
      collection_options: { fields: "currently_due" },
    });
    return json({ url: link.url, expires_at: link.expires_at });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
