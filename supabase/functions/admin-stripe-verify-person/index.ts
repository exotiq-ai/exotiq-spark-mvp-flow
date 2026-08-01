// Super-admin utility: attach an identity document to a person on a connected
// account and report back the resulting verification state. Gated to super
// admins only; requires an explicit file token (no sandbox fallback).
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
    const person: unknown = body?.person;
    const fileToken: unknown = body?.file_token;
    if (typeof account !== "string" || !account.startsWith("acct_")) {
      return json({ error: "account must be a Stripe account id (acct_...)" }, 400);
    }
    if (typeof person !== "string" || !person.startsWith("person_")) {
      return json({ error: "person must be a Stripe person id (person_...)" }, 400);
    }
    if (typeof fileToken !== "string" || fileToken.length === 0) {
      return json({ error: "file_token is required" }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const updated = await stripe.accounts.updatePerson(account, person, {
      verification: { document: { front: fileToken } },
    });
    const acct = await stripe.accounts.retrieve(account);
    return json({
      person_status: updated.verification?.status,
      charges_enabled: acct.charges_enabled,
      payouts_enabled: acct.payouts_enabled,
      requirements: acct.requirements,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
