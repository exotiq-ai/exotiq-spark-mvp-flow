// One-shot super-admin utility: create a test-mode Stripe Express Connect
// account for a team and store it in teams.stripe_test_account_id.
// Delete after M6 QA. Requires STRIPE_SECRET_KEY to be sk_test_.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const { data: isSuper } = await db.rpc("is_super_admin", { _user_id: userData.user.id });
    if (!isSuper) return json({ error: "forbidden — super admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const teamId: string | undefined = body.team_id;
    const email: string | undefined = body.email;
    const companyName: string | undefined = body.company_name;
    if (!teamId || !email) return json({ error: "team_id and email required" }, 400);

    // Create Express account (USD/US per M6a README flag #10).
    const params = new URLSearchParams({
      type: "express",
      country: "US",
      email,
      business_type: "company",
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
      "metadata[purpose]": "m6-sandbox",
      "metadata[team_id]": teamId,
    });
    if (companyName) params.set("company[name]", companyName);

    const acctRes = await fetch("https://api.stripe.com/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const acct = await acctRes.json();
    if (!acctRes.ok) return json({ error: "stripe_account_create_failed", details: acct }, acctRes.status);

    // Onboarding link
    const origin = req.headers.get("origin") ?? "https://app.exotiq.ai";
    const linkParams = new URLSearchParams({
      account: acct.id,
      refresh_url: `${origin}/super-admin?stripe_refresh=1`,
      return_url: `${origin}/super-admin?stripe_return=1`,
      type: "account_onboarding",
    });
    const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: linkParams.toString(),
    });
    const link = await linkRes.json();

    // Persist on the team.
    const { error: upErr } = await db
      .from("teams")
      .update({ stripe_test_account_id: acct.id })
      .eq("id", teamId);
    if (upErr) return json({ error: "db_update_failed", details: upErr.message, stripe_account_id: acct.id }, 500);

    return json({
      ok: true,
      stripe_account_id: acct.id,
      onboarding_url: link?.url ?? null,
      onboarding_error: linkRes.ok ? null : link,
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
