// supabase/functions/prepare-tenant-document/index.ts
// Super admin uploads a PDF to send a tenant for signature. Writes a copy
// to the exotiq-compliance bucket, creates the tenant_documents row,
// notifies the tenant's owners/admins.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PrepareBody {
  team_id: string;
  title: string;
  template: "order_form" | "addendum" | "custom";
  signer_name?: string;
  signer_title?: string;
  signer_email?: string;
  pdf_base64: string; // raw PDF bytes, base64-encoded
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return jsonResponse({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return jsonResponse({ error: "Invalid token" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify super admin
    const { data: isSa } = await admin.rpc("is_super_admin", { check_user_id: user.id });
    if (!isSa) return jsonResponse({ error: "Super admin required" }, 403);

    const body = (await req.json()) as PrepareBody;
    if (!body?.team_id || !body?.title || !body?.template || !body?.pdf_base64) {
      return jsonResponse({ error: "team_id, title, template, pdf_base64 required" }, 400);
    }
    if (!["order_form", "addendum", "custom"].includes(body.template)) {
      return jsonResponse({ error: "Invalid template" }, 400);
    }

    // Verify team exists
    const { data: team, error: teamErr } = await admin
      .from("teams")
      .select("id, name")
      .eq("id", body.team_id)
      .maybeSingle();
    if (teamErr || !team) return jsonResponse({ error: "Team not found" }, 404);

    const pdfBytes = decodeBase64(body.pdf_base64);
    if (pdfBytes.length === 0) return jsonResponse({ error: "Empty PDF" }, 400);
    if (pdfBytes.length > 25 * 1024 * 1024) {
      return jsonResponse({ error: "PDF exceeds 25MB" }, 400);
    }

    const originalSha = await sha256Hex(pdfBytes);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const safeTitle = body.title.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
    const originalPath = `teams/${body.team_id}/originals/${ts}-${safeTitle}.pdf`;

    // Upload to compliance bucket
    const { error: upErr } = await admin.storage
      .from("exotiq-compliance")
      .upload(originalPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upErr) {
      console.error("compliance upload failed", upErr);
      return jsonResponse({ error: "Storage upload failed" }, 500);
    }

    // Insert tenant_documents row
    const { data: td, error: insErr } = await admin
      .from("tenant_documents")
      .insert({
        team_id: body.team_id,
        sent_by_super_admin_id: user.id,
        title: body.title,
        template: body.template,
        original_storage_path: originalPath,
        signer_name: body.signer_name ?? null,
        signer_title: body.signer_title ?? null,
        signer_email: body.signer_email ?? null,
        original_sha256: originalSha,
        field_overlay: [],
        status: "sent",
      })
      .select("id, doc_ref")
      .single();
    if (insErr || !td) {
      console.error("tenant_documents insert failed", insErr);
      return jsonResponse({ error: "Database insert failed" }, 500);
    }

    // Audit
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    await admin.from("tenant_document_audit").insert({
      tenant_document_id: td.id,
      event_type: "sent",
      actor_user_id: user.id,
      ip_address: ip,
      user_agent: ua,
      metadata: { sha256: originalSha, size_bytes: pdfBytes.length },
    });

    // Notify all owners/admins of the team
    const { data: members } = await admin
      .from("team_members")
      .select("user_id")
      .eq("team_id", body.team_id)
      .eq("is_active", true)
      .in("role", ["owner", "admin"]);

    if (members && members.length) {
      const rows = members.map((m: { user_id: string }) => ({
        user_id: m.user_id,
        type: "tenant_document_sent",
        title: "Document awaiting your signature",
        message: `Exotiq sent "${body.title}" for your signature (${td.doc_ref}).`,
        data: { tenant_document_id: td.id, doc_ref: td.doc_ref },
      }));
      await admin.from("notifications").insert(rows);
    }

    return jsonResponse({
      tenant_document_id: td.id,
      doc_ref: td.doc_ref,
      original_sha256: originalSha,
    });
  } catch (err) {
    console.error("prepare-tenant-document error", err);
    return jsonResponse({ error: (err as Error).message || "Unknown error" }, 500);
  }
});
