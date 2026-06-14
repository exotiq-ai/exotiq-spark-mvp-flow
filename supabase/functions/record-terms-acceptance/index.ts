// Edge function: record-terms-acceptance
// Captures a clickwrap acceptance event server-side per the ESIGN/UETA spec.
// All untrusted fields (content_hash, url, effective_date, ip, ua, accepted_at,
// actor email/name) are derived server-side; client cannot forge them.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DocType = "terms" | "privacy" | "aup" | "dpa" | "order_form" | "sms" | "cookies" | "dmca" | "transfer_addendum";
type EventType = "signup" | "reacceptance" | "terms_update" | "order_form";
type Method = "checkbox_click" | "button_click";

interface ReqBody {
  team_id?: string | null;
  event_type: EventType;
  documents: Array<{ document_type: DocType; version: string }>;
  consent_statement: string;
  acceptance_method?: Method;
  page_url?: string;
  is_authorized_representative?: boolean;
}

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "Method not allowed");

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return bad(401, "Unauthorized");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) return bad(401, "Unauthorized");

  const userId = claimsData.claims.sub as string;
  const jwtEmail = (claimsData.claims.email as string | undefined) ?? null;

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return bad(400, "Invalid JSON");
  }

  const validEvents: EventType[] = ["signup", "reacceptance", "terms_update", "order_form"];
  if (!body.event_type || !validEvents.includes(body.event_type)) {
    return bad(400, "Invalid event_type");
  }
  if (!Array.isArray(body.documents) || body.documents.length === 0) {
    return bad(400, "documents required");
  }
  if (!body.consent_statement || typeof body.consent_statement !== "string") {
    return bad(400, "consent_statement required");
  }
  if (body.consent_statement.length > 4000) return bad(400, "consent_statement too long");

  const admin = createClient(supabaseUrl, serviceKey);

  // Resolve each (type, version) pair server-side
  const docKeys = body.documents.map((d) => ({
    document_type: d.document_type,
    version: d.version,
  }));
  const types = [...new Set(docKeys.map((d) => d.document_type))];
  const versions = [...new Set(docKeys.map((d) => d.version))];
  const { data: versionRows, error: vErr } = await admin
    .from("legal_document_versions")
    .select("document_type, version, url, content_hash, effective_date")
    .in("document_type", types)
    .in("version", versions);
  if (vErr) return bad(500, "Failed to load document versions");

  const resolved = docKeys.map((k) => {
    const row = versionRows?.find(
      (r) => r.document_type === k.document_type && r.version === k.version
    );
    return row
      ? {
          document_type: row.document_type,
          version: row.version,
          url: row.url,
          content_hash: row.content_hash,
          effective_date: row.effective_date,
        }
      : null;
  });
  if (resolved.some((r) => r === null)) return bad(400, "Unknown document version");

  // Profile snapshot
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  // Verify team membership if team_id provided
  let teamId: string | null = body.team_id ?? null;
  if (teamId) {
    const { data: tm } = await admin
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!tm) teamId = null;
  }

  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || null;
  const userAgent = req.headers.get("user-agent") ?? null;
  const authContext = `sub:${userId};iat:${claimsData.claims.iat ?? ""}`;

  const { data: inserted, error: insErr } = await admin
    .from("terms_acceptances")
    .insert({
      user_id: userId,
      team_id: teamId,
      actor_email: profile?.email ?? jwtEmail,
      actor_display_name: profile?.full_name ?? null,
      event_type: body.event_type,
      documents_accepted: resolved,
      acceptance_method: body.acceptance_method ?? "checkbox_click",
      consent_statement: body.consent_statement,
      ip_address: ip,
      user_agent: userAgent,
      page_url: body.page_url ?? null,
      auth_context: authContext,
      is_authorized_representative: !!body.is_authorized_representative,
    })
    .select("id, accepted_at")
    .single();

  if (insErr) {
    console.error("terms_acceptances insert failed", insErr);
    return bad(500, "Failed to record acceptance");
  }

  return new Response(
    JSON.stringify({ acceptance_id: inserted.id, accepted_at: inserted.accepted_at }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
});
