// M6d: renter transactional email sender.
// Sends the HTML templates from exotiq-rent/docs/rent/emails via Resend.
// Internal-only: gated by INTERNAL_FUNCTION_TOKEN. Called by other edge
// functions and the payment scheduler, never directly from the browser.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { templates, TemplateName } from "./templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token",
};

interface SendBody {
  templateName: TemplateName;
  to: string;
  subject: string;
  variables: Record<string, string | number | undefined>;
  idempotencyKey?: string;
  replyTo?: string;
  /** Tenant display name for the From header ("Exotics By The Bay <bookings@…>"). */
  fromName?: string;
  tags?: Array<{ name: string; value: string }>;
  bcc?: string | string[];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function interpolate(html: string, variables: Record<string, string | number | undefined>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, " · ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function derivePlainText(html: string, variables: Record<string, string | number | undefined>): string {
  const text = stripHtml(html)
    .replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = variables[key];
      return value === undefined || value === null ? "" : String(value);
    });
  // Replace multiple spaces with a single space and clean up
  return text.replace(/\s{2,}/g, " ").replace(/\n\s*/g, "\n").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN");
    const provided = req.headers.get("x-internal-token");
    if (!internalToken || provided !== internalToken) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return jsonResponse({ error: "RESEND_API_KEY not configured" }, 500);

    const body = (await req.json()) as SendBody;
    if (!body?.to || !body?.subject || !body?.templateName || !body?.variables) {
      return jsonResponse({ error: "templateName, to, subject, variables required" }, 400);
    }

    const template = templates[body.templateName];
    if (!template) {
      return jsonResponse({ error: `Unknown template: ${body.templateName}` }, 400);
    }

    const html = interpolate(template, body.variables);
    const text = derivePlainText(template, body.variables);

    // Validate that no raw placeholders remain after interpolation (QA safety).
    const remaining = html.match(/\{\{\w+\}\}/g) ?? [];
    if (remaining.length > 0) {
      return jsonResponse({ error: "Unresolved template variables", variables: remaining }, 400);
    }

    const from = Deno.env.get("RENTER_EMAIL_FROM") ?? "Drive Exotiq <bookings@exotiq.rent>";
    const replyTo = body.replyTo ?? Deno.env.get("RENTER_EMAIL_REPLY_TO") ?? "support@exotiq.ai";

    const payload: Record<string, unknown> = {
      from,
      to: [body.to],
      subject: body.subject,
      html,
      text,
      reply_to: replyTo,
    };
    if (body.tags) payload.tags = body.tags;
    if (body.bcc) payload.bcc = Array.isArray(body.bcc) ? body.bcc : [body.bcc];

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (body.idempotencyKey) headers["Idempotency-Key"] = body.idempotencyKey;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Resend send failed", res.status, json);
      return jsonResponse({ error: "Resend send failed", status: res.status, detail: json }, 502);
    }

    return jsonResponse({ message_id: (json as { id?: string })?.id ?? null });
  } catch (err) {
    console.error("send-renter-email error", err);
    return jsonResponse({ error: (err as Error).message || "Unknown error" }, 500);
  }
});
