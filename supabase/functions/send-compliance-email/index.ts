// supabase/functions/send-compliance-email/index.ts
// Sends Exotiq compliance emails via Resend from compliance@notify.exotiq.ai.
// Internal-only: gated by INTERNAL_FUNCTION_TOKEN header.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token",
};

interface SendBody {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotency_key?: string;
  tags?: Array<{ name: string; value: string }>;
  reply_to?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN");
    const provided = req.headers.get("x-internal-token");
    if (!internalToken || provided !== internalToken) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return jsonResponse({ error: "RESEND_API_KEY not configured" }, 500);

    const body = (await req.json()) as SendBody;
    if (!body?.to || !body?.subject || !body?.html) {
      return jsonResponse({ error: "to, subject, html required" }, 400);
    }

    const payload: Record<string, unknown> = {
      from: "Exotiq Compliance <compliance@notify.exotiq.ai>",
      to: [body.to],
      subject: body.subject,
      html: body.html,
      reply_to: body.reply_to ?? "compliance@exotiq.ai",
    };
    if (body.text) payload.text = body.text;
    if (body.tags) payload.tags = body.tags;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (body.idempotency_key) headers["Idempotency-Key"] = body.idempotency_key;

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
    console.error("send-compliance-email error", err);
    return jsonResponse({ error: (err as Error).message || "Unknown error" }, 500);
  }
});
