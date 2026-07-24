import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { account, person, file_token } = await req.json();
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const updated = await stripe.accounts.updatePerson(account, person, {
      verification: { document: { front: file_token || "file_identity_document_success" } },
    });
    const acct = await stripe.accounts.retrieve(account);
    return new Response(
      JSON.stringify({
        person_status: updated.verification?.status,
        charges_enabled: acct.charges_enabled,
        payouts_enabled: acct.payouts_enabled,
        requirements: acct.requirements,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
