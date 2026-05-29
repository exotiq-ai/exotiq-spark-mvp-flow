// AI receipt parser: reads an image/PDF from expense-receipts storage,
// extracts structured fields via Lovable AI Gateway (tool calling), and
// returns them. Row insertion is handled client-side under RLS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPENSE_TYPES = [
  "fuel","insurance","maintenance","cleaning","storage","registration",
  "detailing","toll","parking","damage","partner_payout","transport","tax",
  "overhead","deposit_recovery","other",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const { receipt_path } = await req.json();
    if (!receipt_path || typeof receipt_path !== "string") {
      return json({ error: "receipt_path required" }, 400);
    }

    // Download the file (RLS scopes it to the user's team)
    const { data: file, error: dlErr } = await supabase
      .storage.from("expense-receipts").download(receipt_path);
    if (dlErr || !file) return json({ error: "Could not read receipt" }, 404);

    const mime = file.type || "image/jpeg";
    const buf = new Uint8Array(await file.arrayBuffer());
    // base64 encode
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const dataUrl = `data:${mime};base64,${b64}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You extract structured expense data from receipts and invoices for a luxury car rental fleet. Be conservative — if a field is missing, omit it. Confidence reflects how clearly the document was read.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the expense data from this receipt or invoice." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_receipt",
            description: "Return structured receipt data",
            parameters: {
              type: "object",
              properties: {
                vendor: { type: "string" },
                amount: { type: "number" },
                currency: { type: "string", description: "ISO 4217 e.g. USD" },
                expense_date: { type: "string", description: "YYYY-MM-DD" },
                expense_type: { type: "string", enum: EXPENSE_TYPES },
                line_items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      amount: { type: "number" },
                    },
                    required: ["description", "amount"],
                  },
                },
                vehicle_hint: {
                  type: "string",
                  description: "License plate or VIN visible on receipt, or empty",
                },
                confidence: { type: "number", description: "0..1" },
              },
              required: ["amount", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_receipt" } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, text);
      if (aiResp.status === 429) return json({ error: "Rate limited — try again in a moment." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "AI parsing failed" }, 502);
    }

    const result = await aiResp.json();
    const toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "No structured output", raw: result }, 502);

    let parsed: any = {};
    try { parsed = JSON.parse(toolCall.function.arguments); } catch {
      return json({ error: "AI returned invalid JSON" }, 502);
    }

    return json({ parsed });
  } catch (e) {
    console.error("parse-expense-receipt error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
