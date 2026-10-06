// Append-only renter legal assent logging (Checkout Compliance Track B).
// Anonymous POST, token-gated by booking_ref + confirmation token.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { checkRateLimit, clientIp } from "../_shared/rateLimit.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DOCS = new Set(["terms", "privacy", "release"]);
const HASH = /^[0-9a-f]{64}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const ip = clientIp(req);
  if (!(await checkRateLimit(`rent-log-assent:${ip}`, 60, 3600))) return json({ error: "Too many requests" }, 429);

  try {
    const body = await req.json().catch(() => ({}));
    const ref = String(body.booking_ref ?? "").trim();
    const token = String(body.token ?? "").trim();
    const assents = Array.isArray(body.assents) ? body.assents.slice(0, 5) : [];
    if (!ref || !token || assents.length === 0) return json({ error: "booking_ref, token and assents are required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { data: b } = await admin
      .from("bookings")
      .select("id, booking_ref, confirmation_token, customer_email, team_id")
      .eq("booking_ref", ref)
      .maybeSingle();
    if (!b || b.confirmation_token !== token) return json({ error: "Booking not found" }, 404);

    const rows = [];
    for (const a of assents) {
      const doc = String(a?.doc_id ?? "");
      const ver = String(a?.doc_version ?? "").slice(0, 40);
      const hash = String(a?.checkbox_text_hash ?? "").toLowerCase();
      if (!DOCS.has(doc) || !ver || !HASH.test(hash)) return json({ error: "Invalid assent entry" }, 400);
      rows.push({
        booking_id: b.id,
        booking_ref: b.booking_ref,
        renter_email: String(b.customer_email ?? "").toLowerCase(),
        doc_id: doc,
        doc_version: ver,
        checkbox_text_hash: hash,
        ip_address: ip,
        user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400),
        team_id: b.team_id,
        storefront_path: String(body.storefront_path ?? "").slice(0, 300) || null,
      });
    }
    const { error } = await admin.from("legal_assents").insert(rows);
    if (error) throw error;
    return json({ ok: true, logged: rows.length });
  } catch (e) {
    console.error("[RENT-LOG-ASSENT]", e);
    return json({ error: "Unable to record assent" }, 500);
  }
});
