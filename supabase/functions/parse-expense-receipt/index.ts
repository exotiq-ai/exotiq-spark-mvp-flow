// AI receipt parser: reads receipt from expense-receipts storage,
// extracts fields via Lovable AI Gateway, matches vehicle/booking,
// inserts a pending_review row with smart routing metadata.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logTransfer } from "../_shared/transferGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPENSE_TYPES = [
  "fuel","insurance","maintenance","cleaning","storage","registration",
  "detailing","toll","parking","damage","partner_payout","transport","tax",
  "overhead","deposit_recovery","processing_fee","other",
];

const ADMIN_AMOUNT_THRESHOLD = 5000;
const OWNER_AMOUNT_THRESHOLD = 25000;
const OLD_DATE_DAYS = 90;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    // Service client for matching reads (bypasses RLS for safe lookups within the user's team)
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { receipt_path, team_id } = await req.json();
    if (!receipt_path || typeof receipt_path !== "string") {
      return json({ error: "receipt_path required" }, 400);
    }
    if (!team_id || typeof team_id !== "string") {
      return json({ error: "team_id required" }, 400);
    }

    // Verify user belongs to team
    const { data: membership } = await svc
      .from("team_members")
      .select("team_id")
      .eq("team_id", team_id)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) return json({ error: "Not a member of this team" }, 403);

    // Download receipt
    const { data: file, error: dlErr } = await userClient
      .storage.from("expense-receipts").download(receipt_path);
    if (dlErr || !file) return json({ error: "Could not read receipt" }, 404);

    const mime = file.type || "image/jpeg";
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const dataUrl = `data:${mime};base64,${b64}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    // Call AI
    let parsed: any = { confidence: 0 };
    let parseFailed = false;
    let parseFailReason = "";
    try {
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
                { type: "text", text: "Extract the expense data from this receipt or invoice. If a license plate or VIN is visible, include it in vehicle_hint." },
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
                  currency: { type: "string" },
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
                    description: "License plate, VIN, or make/model text visible on receipt",
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
        if (aiResp.status === 429) { parseFailed = true; parseFailReason = "rate limited"; }
        else if (aiResp.status === 402) { parseFailed = true; parseFailReason = "credits exhausted"; }
        else { parseFailed = true; parseFailReason = "AI gateway error"; }
      } else {
        const result = await aiResp.json();
        const toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          parseFailed = true; parseFailReason = "no structured output";
        } else {
          try { parsed = JSON.parse(toolCall.function.arguments); }
          catch { parseFailed = true; parseFailReason = "invalid JSON"; }
        }
      }
    } catch (e) {
      parseFailed = true;
      parseFailReason = e instanceof Error ? e.message : "AI call failed";
    }

    logTransfer({
      team_id,
      user_id: userId,
      caller: "parse-expense-receipt",
      model: "google/gemini-3-flash-preview",
      provider: "Google (Gemini Vision via Lovable AI Gateway)",
      provider_region: "United States / Global",
      status: parseFailed ? "error" : "ok",
    }).catch(() => {});

    // ----- Match cascade -----
    let matchedVehicleId: string | null = null;
    let matchedBookingId: string | null = null;
    let matchMethod: string | null = null;

    const hint = String(parsed?.vehicle_hint || "").trim();
    const expenseDate = typeof parsed?.expense_date === "string"
      ? parsed.expense_date
      : new Date().toISOString().slice(0, 10);

    if (hint) {
      // Try plate / VIN exact (case-insensitive, alphanumeric only)
      const norm = hint.replace(/[^a-z0-9]/gi, "").toUpperCase();
      if (norm.length >= 3) {
        const { data: vehs } = await svc
          .from("vehicles")
          .select("id, make, model, year, license_plate, vin")
          .eq("team_id", team_id);
        for (const v of vehs || []) {
          const plate = String((v as any).license_plate || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
          const vin = String((v as any).vin || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
          if (plate && plate === norm) { matchedVehicleId = v.id; matchMethod = "plate"; break; }
          if (vin && vin === norm) { matchedVehicleId = v.id; matchMethod = "vin"; break; }
        }
        // Fuzzy: make/model substring
        if (!matchedVehicleId) {
          const lower = hint.toLowerCase();
          for (const v of vehs || []) {
            const blob = `${(v as any).make || ""} ${(v as any).model || ""} ${(v as any).year || ""}`.toLowerCase();
            if (
              (((v as any).model || "").toLowerCase() &&
                lower.includes(((v as any).model || "").toLowerCase())) ||
              (blob.includes(lower) && lower.length >= 3)
            ) {
              matchedVehicleId = v.id; matchMethod = "model"; break;
            }
          }
        }
      }
    }

    // Recent open work order on a vehicle within ±14 days of receipt date
    if (!matchedVehicleId) {
      const dateLo = new Date(expenseDate); dateLo.setDate(dateLo.getDate() - 14);
      const dateHi = new Date(expenseDate); dateHi.setDate(dateHi.getDate() + 14);
      const { data: wos } = await svc
        .from("maintenance_schedules")
        .select("vehicle_id, scheduled_date")
        .eq("team_id", team_id)
        .gte("scheduled_date", dateLo.toISOString())
        .lte("scheduled_date", dateHi.toISOString())
        .limit(2);
      if (wos && wos.length === 1) {
        matchedVehicleId = (wos[0] as any).vehicle_id;
        matchMethod = "maintenance_window";
      }
    }

    // Match a booking covering the receipt date
    if (matchedVehicleId) {
      const { data: bks } = await svc
        .from("bookings")
        .select("id, start_date, end_date")
        .eq("team_id", team_id)
        .eq("vehicle_id", matchedVehicleId)
        .lte("start_date", expenseDate + "T23:59:59")
        .gte("end_date", expenseDate + "T00:00:00")
        .in("status", ["confirmed", "active", "completed"])
        .limit(2);
      if (bks && bks.length === 1) {
        matchedBookingId = bks[0].id;
      }
    }

    // ----- Routing decision -----
    const rawConf = Number(parsed?.confidence ?? 0);
    const confidence = isFinite(rawConf) ? Math.min(Math.max(rawConf, 0), 1) : 0;
    const amount = Number(parsed?.amount ?? 0);
    const safeAmount = amount > 0 ? amount : 0.01;
    const expense_type = typeof parsed?.expense_type === "string" ? parsed.expense_type : "other";

    const daysOld = Math.floor((Date.now() - new Date(expenseDate).getTime()) / 86400000);

    let auto_routed_reason: string;
    let requires_admin_approval = false;
    let review_reason: string;

    if (parseFailed) {
      auto_routed_reason = "parse_failed";
      review_reason = `AI parsing failed (${parseFailReason}) — please fill in manually`;
    } else if (confidence < 0.6) {
      auto_routed_reason = "low_confidence";
      review_reason = `Low AI confidence (${Math.round(confidence * 100)}%) — please verify`;
    } else if (!matchedVehicleId) {
      auto_routed_reason = "no_vehicle_match";
      review_reason = "No vehicle matched — assign manually";
    } else if (daysOld > OLD_DATE_DAYS) {
      auto_routed_reason = "old_date";
      review_reason = `Receipt date is ${daysOld} days old — confirm this isn't a misread`;
    } else if (confidence < 0.85) {
      auto_routed_reason = "low_confidence";
      review_reason = `AI confidence ${Math.round(confidence * 100)}% — please verify`;
    } else {
      auto_routed_reason = "ok";
      review_reason = "AI-parsed receipt — confirm details";
    }

    if (safeAmount > OWNER_AMOUNT_THRESHOLD) {
      requires_admin_approval = true;
      review_reason = `${review_reason} · Amount exceeds $${OWNER_AMOUNT_THRESHOLD.toLocaleString()} — owner approval required`;
    } else if (safeAmount > ADMIN_AMOUNT_THRESHOLD) {
      requires_admin_approval = true;
      review_reason = `${review_reason} · Amount exceeds $${ADMIN_AMOUNT_THRESHOLD.toLocaleString()} — admin approval required`;
    }

    // Notes from line items
    const notes = Array.isArray(parsed?.line_items) && parsed.line_items.length
      ? parsed.line_items.map((l: any) => `${l.description}: ${l.amount}`).join(" · ")
      : null;

    // Insert via service role (we've already verified team membership above)
    const { data: ins, error: insErr } = await svc
      .from("vehicle_expenses")
      .insert({
        team_id,
        vehicle_id: matchedVehicleId,
        booking_id: matchedBookingId,
        expense_type,
        amount: safeAmount,
        expense_date: expenseDate,
        vendor: parsed?.vendor || null,
        notes,
        receipt_url: receipt_path,
        source_module: "ai_receipt",
        status: "pending_review",
        review_reason,
        auto_routed_reason,
        requires_admin_approval,
        ai_confidence: parseFailed ? 0 : confidence,
        ai_parsed_fields: { ...parsed, match_method: matchMethod },
        created_by: userId,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("insert error:", insErr);
      return json({ error: insErr.message }, 500);
    }

    return json({
      expense_id: ins?.id,
      auto_routed_reason,
      requires_admin_approval,
      matched_vehicle_id: matchedVehicleId,
      matched_booking_id: matchedBookingId,
      confidence,
    });
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
