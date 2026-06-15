// supabase/functions/sign-tenant-document/index.ts
// Tenant owner/admin signs a tenant_documents row. Overlays signature
// + name + title + date onto the original PDF, appends a Certificate of
// Completion page, stores the signed PDF in:
//   1. Tenant Vault (documents table + customer-documents bucket)
//   2. Exotiq compliance bucket (write-once)
// Updates the tenant_documents row, logs audit, notifies super admin sender.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SignBody {
  tenant_document_id: string;
  signature_image_data_url: string;
  printed_name: string;
  title: string;
  acknowledged: boolean;
  fields: Array<{
    type: "signature" | "printed_name" | "title" | "date";
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  form_values?: Record<string, string | boolean>;
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

function decodeDataUrl(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? dataUrl;
  const bin = atob(b64);
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

    const body = (await req.json()) as SignBody;
    if (
      !body?.tenant_document_id ||
      !body?.signature_image_data_url ||
      !body?.printed_name?.trim() ||
      !body?.title?.trim() ||
      body.acknowledged !== true ||
      !Array.isArray(body.fields) ||
      body.fields.length === 0
    ) {
      return jsonResponse(
        { error: "tenant_document_id, signature_image_data_url, printed_name, title, fields, acknowledged=true required" },
        400
      );
    }
    if (body.printed_name.length > 200 || body.title.length > 200) {
      return jsonResponse({ error: "Field too long" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Load the tenant_documents row
    const { data: td, error: tdErr } = await admin
      .from("tenant_documents")
      .select("id, team_id, title, doc_ref, original_storage_path, status, sent_by_super_admin_id, original_sha256")
      .eq("id", body.tenant_document_id)
      .maybeSingle();
    if (tdErr || !td) return jsonResponse({ error: "Document not found" }, 404);
    if (td.status === "signed") return jsonResponse({ error: "Already signed" }, 409);
    if (td.status === "voided") return jsonResponse({ error: "Document voided" }, 410);

    // Verify caller is owner/admin of that team
    const { data: tm } = await admin
      .from("team_members")
      .select("role, is_active")
      .eq("team_id", td.team_id)
      .eq("user_id", user.id)
      .maybeSingle();
    const allowedRoles = ["owner", "admin"];
    if (!tm || !tm.is_active || !allowedRoles.includes(tm.role)) {
      return jsonResponse({ error: "Owner or admin role required to sign" }, 403);
    }

    // Download original
    const { data: pdfBlob, error: dlErr } = await admin.storage
      .from("exotiq-compliance")
      .download(td.original_storage_path);
    if (dlErr || !pdfBlob) {
      console.error("download original failed", dlErr);
      return jsonResponse({ error: "Failed to read original document" }, 500);
    }
    const originalBytes = new Uint8Array(await pdfBlob.arrayBuffer());

    // Stamp signature + fields
    const pdfDoc = await PDFDocument.load(originalBytes);
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const sigBytes = decodeDataUrl(body.signature_image_data_url);
    const sigImage = await pdfDoc.embedPng(sigBytes);

    // Apply AcroForm values (if any), then flatten so values become permanent
    // and the certificate hash covers them.
    if (body.form_values && Object.keys(body.form_values).length > 0) {
      try {
        const form = pdfDoc.getForm();
        for (const [name, raw] of Object.entries(body.form_values)) {
          try {
            const field = form.getFieldMaybe?.(name) ?? null;
            if (!field) continue;
            const kind = field.constructor?.name ?? "";
            if (kind.includes("CheckBox")) {
              if (raw === true || raw === "true" || raw === "Yes" || raw === "On") form.getCheckBox(name).check();
              else form.getCheckBox(name).uncheck();
            } else if (kind.includes("RadioGroup")) {
              if (typeof raw === "string" && raw) form.getRadioGroup(name).select(raw);
            } else if (kind.includes("Dropdown")) {
              if (typeof raw === "string" && raw) form.getDropdown(name).select(raw);
            } else if (kind.includes("OptionList")) {
              if (typeof raw === "string" && raw) form.getOptionList(name).select(raw);
            } else {
              // Default: text field
              form.getTextField(name).setText(typeof raw === "boolean" ? (raw ? "Yes" : "") : String(raw));
            }
          } catch (fieldErr) {
            console.warn("form field apply skipped", name, (fieldErr as Error).message);
          }
        }
        try { form.flatten(); } catch (flatErr) { console.warn("form flatten failed", flatErr); }
      } catch (formErr) {
        console.warn("AcroForm not available on this PDF", (formErr as Error).message);
      }
    }

    const pages = pdfDoc.getPages();

    const stamped = new Date();
    const dateStr = stamped.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    for (const f of body.fields) {
      const pageIdx = Math.max(0, Math.min(pages.length - 1, f.page));
      const page = pages[pageIdx];
      const pw = page.getWidth();
      const ph = page.getHeight();
      const x = f.x * pw;
      const y = f.y * ph;
      const w = f.width * pw;
      const h = f.height * ph;

      if (f.type === "signature") {
        // Maintain aspect ratio inside the box
        const aspect = sigImage.width / sigImage.height;
        let drawW = w;
        let drawH = w / aspect;
        if (drawH > h) {
          drawH = h;
          drawW = h * aspect;
        }
        page.drawImage(sigImage, { x, y, width: drawW, height: drawH });
      } else {
        let value = "";
        if (f.type === "printed_name") value = body.printed_name;
        else if (f.type === "title") value = body.title;
        else if (f.type === "date") value = dateStr;
        const fontSize = Math.max(8, Math.min(14, h * 0.7));
        page.drawText(value, {
          x, y: y + Math.max(2, h * 0.15),
          size: fontSize, font: helv,
          color: rgb(0.05, 0.05, 0.05),
        });
      }
    }

    // Compute signed bytes BEFORE certificate so cert can include the body hash
    const bodyOnlyBytes = await pdfDoc.save();
    const bodyOnlySha = await sha256Hex(bodyOnlyBytes);

    // Reload to append certificate (so we can include the body hash on the page)
    const finalDoc = await PDFDocument.load(bodyOnlyBytes);
    const certPage = finalDoc.addPage([612, 792]);
    const cFont = await finalDoc.embedFont(StandardFonts.Helvetica);
    const cBold = await finalDoc.embedFont(StandardFonts.HelveticaBold);
    const muted = rgb(0.4, 0.4, 0.4);
    const ink = rgb(0.08, 0.08, 0.08);

    let cy = 740;
    certPage.drawText("CERTIFICATE OF COMPLETION", {
      x: 50, y: cy, size: 18, font: cBold, color: ink,
    });
    cy -= 18;
    certPage.drawText("Electronic signature record (ESIGN Act, 15 U.S.C. \u00a7 7001; UETA \u00a7 12)", {
      x: 50, y: cy, size: 9, font: cFont, color: muted,
    });
    cy -= 30;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";

    const lines: Array<[string, string]> = [
      ["Document", td.title],
      ["Reference", td.doc_ref ?? td.id],
      ["Signer", body.printed_name],
      ["Title", body.title],
      ["Signer user id", user.id],
      ["Signer email", user.email ?? "unknown"],
      ["Signed (UTC)", stamped.toISOString()],
      ["IP address", ip],
      ["User agent", ua.length > 90 ? ua.slice(0, 87) + "..." : ua],
      ["Original SHA-256", td.original_sha256 ?? "unknown"],
      ["Signed (body) SHA-256", bodyOnlySha],
      ["Acknowledgement", "Accepted ESIGN disclosure and represented authority to bind."],
    ];

    for (const [k, v] of lines) {
      certPage.drawText(k + ":", { x: 50, y: cy, size: 10, font: cBold, color: ink });
      // Wrap long values
      const maxChars = 64;
      const chunks: string[] = [];
      let remaining = v;
      while (remaining.length > maxChars) {
        chunks.push(remaining.slice(0, maxChars));
        remaining = remaining.slice(maxChars);
      }
      chunks.push(remaining);
      let lineY = cy;
      for (const c of chunks) {
        certPage.drawText(c, { x: 180, y: lineY, size: 10, font: cFont, color: ink });
        lineY -= 14;
      }
      cy = lineY - 4;
    }

    cy -= 14;
    certPage.drawText("Exotiq Inc. \u2014 1001 S Main St #6709, Kalispell, MT 59901 \u2014 legal@exotiq.ai", {
      x: 50, y: 40, size: 8, font: cFont, color: muted,
    });

    const finalBytes = await finalDoc.save();
    const finalSha = await sha256Hex(finalBytes);

    // Storage paths
    const stampSafe = stamped.toISOString().replace(/[:.]/g, "-");
    const complianceSignedPath = `teams/${td.team_id}/signed/${stampSafe}-${td.doc_ref}.pdf`;
    const tenantVaultPath = `${user.id}/${stampSafe}-${td.doc_ref}.pdf`;

    // Upload signed copy to compliance bucket
    const { error: upCompErr } = await admin.storage
      .from("exotiq-compliance")
      .upload(complianceSignedPath, finalBytes, {
        contentType: "application/pdf", upsert: false,
      });
    if (upCompErr) {
      console.error("compliance signed upload failed", upCompErr);
      return jsonResponse({ error: "Compliance storage upload failed" }, 500);
    }

    // Upload to tenant vault bucket
    const { error: upTenErr } = await admin.storage
      .from("customer-documents")
      .upload(tenantVaultPath, finalBytes, {
        contentType: "application/pdf", upsert: false,
      });
    if (upTenErr) {
      console.error("tenant vault upload failed", upTenErr);
      // Roll back compliance upload to keep storage clean
      await admin.storage.from("exotiq-compliance").remove([complianceSignedPath]);
      return jsonResponse({ error: "Tenant vault upload failed" }, 500);
    }

    // Get public-ish URL for tenant copy (signed copies in their bucket)
    const { data: tenantUrlData } = admin.storage
      .from("customer-documents")
      .getPublicUrl(tenantVaultPath);

    // Insert tenant Vault document row
    const { data: vaultDoc, error: vaultErr } = await admin
      .from("documents")
      .insert({
        user_id: user.id,
        name: `${td.title} (signed)`,
        type: "contract",
        file_url: tenantUrlData?.publicUrl ?? tenantVaultPath,
        file_size: finalBytes.length,
        status: "active",
        signed_at: stamped.toISOString(),
        signed_by_name: body.printed_name,
        signature_image_url: null,
        signing_metadata: {
          source: "tenant_document",
          tenant_document_id: td.id,
          doc_ref: td.doc_ref,
          signer_title: body.title,
          signer_email: user.email,
          ip_address: ip,
          user_agent: ua,
          original_sha256: td.original_sha256,
          signed_body_sha256: bodyOnlySha,
          signed_full_sha256: finalSha,
        },
      })
      .select("id")
      .single();
    if (vaultErr) {
      console.error("vault document insert failed", vaultErr);
      // Best-effort rollback of storage
      await admin.storage.from("exotiq-compliance").remove([complianceSignedPath]);
      await admin.storage.from("customer-documents").remove([tenantVaultPath]);
      return jsonResponse({ error: "Vault record creation failed" }, 500);
    }

    // Update tenant_documents row
    await admin
      .from("tenant_documents")
      .update({
        status: "signed",
        signed_at: stamped.toISOString(),
        signed_storage_path: complianceSignedPath,
        signed_document_id: vaultDoc.id,
        signer_name: body.printed_name,
        signer_title: body.title,
        signer_email: user.email,
        signed_sha256: finalSha,
        signing_metadata: {
          ip_address: ip,
          user_agent: ua,
          signer_user_id: user.id,
          body_sha256: bodyOnlySha,
          full_sha256: finalSha,
          signed_at_utc: stamped.toISOString(),
        },
      })
      .eq("id", td.id);

    // Audit
    await admin.from("tenant_document_audit").insert({
      tenant_document_id: td.id,
      event_type: "signed",
      actor_user_id: user.id,
      ip_address: ip,
      user_agent: ua,
      metadata: {
        body_sha256: bodyOnlySha,
        full_sha256: finalSha,
        vault_document_id: vaultDoc.id,
      },
    });

    // Notify the super admin who sent it
    if (td.sent_by_super_admin_id) {
      await admin.from("notifications").insert({
        user_id: td.sent_by_super_admin_id,
        type: "tenant_document_signed",
        title: "Document signed",
        message: `${body.printed_name} signed "${td.title}" (${td.doc_ref}).`,
        data: { tenant_document_id: td.id, doc_ref: td.doc_ref, vault_document_id: vaultDoc.id },
      });
    }

    // Fire-and-forget: email signed PDF to the Exotiq compliance inbox.
    // Failure must NOT roll back the signature.
    try {
      const complianceInbox = Deno.env.get("COMPLIANCE_INBOX") || "hello@exotiq.ai";
      const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN");
      if (internalToken) {
        // Look up team name for the subject line
        const { data: team } = await admin
          .from("teams")
          .select("name")
          .eq("id", td.team_id)
          .maybeSingle();
        const teamName = team?.name ?? "Tenant";

        // Base64-encode the signed PDF (chunked to avoid stack overflow)
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < finalBytes.length; i += chunk) {
          binary += String.fromCharCode(...finalBytes.subarray(i, i + chunk));
        }
        const attachmentB64 = btoa(binary);

        const subject = `Signed: ${td.doc_ref ?? td.id} — ${teamName}`;
        const html = `
          <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;line-height:1.5;">
            <h2 style="margin:0 0 16px;font-size:18px;">Tenant document signed</h2>
            <table style="border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Document</td><td style="padding:4px 0;">${td.title}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Reference</td><td style="padding:4px 0;font-family:monospace;">${td.doc_ref ?? td.id}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Tenant</td><td style="padding:4px 0;">${teamName}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Signer</td><td style="padding:4px 0;">${body.printed_name}, ${body.title}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td style="padding:4px 0;">${user.email ?? "unknown"}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Signed (UTC)</td><td style="padding:4px 0;">${stamped.toISOString()}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">IP</td><td style="padding:4px 0;">${ip}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">SHA-256</td><td style="padding:4px 0;font-family:monospace;font-size:11px;">${finalSha}</td></tr>
            </table>
            <p style="margin-top:20px;font-size:12px;color:#666;">The fully executed PDF (including Certificate of Completion) is attached. A sealed copy is retained in the Exotiq compliance archive.</p>
          </div>`;

        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-compliance-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-token": internalToken,
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: complianceInbox,
            subject,
            html,
            idempotency_key: `signed-${td.id}`,
            tags: [
              { name: "category", value: "tenant_document_signed" },
              { name: "doc_ref", value: (td.doc_ref ?? td.id).replace(/[^a-zA-Z0-9_-]/g, "_") },
            ],
            attachments: [{
              filename: `${td.doc_ref ?? td.id}-signed.pdf`,
              content_base64: attachmentB64,
              content_type: "application/pdf",
            }],
          }),
        });

        const emailOk = emailRes.ok;
        const emailDetail = emailOk ? await emailRes.json().catch(() => ({})) : await emailRes.text().catch(() => "");
        await admin.from("tenant_document_audit").insert({
          tenant_document_id: td.id,
          event_type: emailOk ? "email_sent" : "email_failed",
          actor_user_id: user.id,
          ip_address: ip,
          user_agent: ua,
          metadata: {
            to: complianceInbox,
            kind: "signed_copy",
            status: emailRes.status,
            detail: emailDetail,
          },
        });
      } else {
        console.warn("INTERNAL_FUNCTION_TOKEN missing; skipping compliance email");
      }
    } catch (e) {
      console.error("compliance email dispatch failed", e);
      try {
        await admin.from("tenant_document_audit").insert({
          tenant_document_id: td.id,
          event_type: "email_failed",
          actor_user_id: user.id,
          ip_address: ip,
          user_agent: ua,
          metadata: { kind: "signed_copy", error: (e as Error).message },
        });
      } catch { /* swallow */ }
    }

    return jsonResponse({
      tenant_document_id: td.id,
      doc_ref: td.doc_ref,
      vault_document_id: vaultDoc.id,
      signed_sha256: finalSha,
    });

  } catch (err) {
    console.error("sign-tenant-document error", err);
    return jsonResponse({ error: (err as Error).message || "Unknown error" }, 500);
  }
});
