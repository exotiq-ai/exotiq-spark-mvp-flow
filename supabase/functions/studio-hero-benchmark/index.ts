// Super Admin-only benchmark for Studio Hero v2. Never touches vehicle_photos.
// One call = one vehicle x one model. Builds/reuses the identity sheet,
// renders with the locked recipe, scores with strict QC (fail-closed).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { STUDIO_HERO_STYLE_REFERENCE_URL } from "../_shared/studioHero.ts";
import {
  STUDIO_RECIPE_VERSION, IDENTITY_SHEET_PROMPT, QC_V2_PROMPT, BENCHMARK_MODELS,
  buildV2Prompt, identitySheetToText,
} from "../_shared/studioHeroV2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const AI = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-3.1-pro-preview";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer()); let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:${r.headers.get("content-type") || "image/jpeg"};base64,${btoa(bin)}`;
  } catch { return null; }
}
const img = (url: string) => ({ type: "image_url", image_url: { url } });
async function chat(key: string, model: string, content: unknown[], image = false) {
  const r = await fetch(AI, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], ...(image ? { modalities: ["image", "text"] } : {}) }) });
  if (!r.ok) throw new Error(`${model}_${r.status}`);
  return (await r.json()).choices?.[0]?.message;
}
const parseJson = (t: string) => { const m = (t ?? "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { vehicleId, model, runLabel, rebuildSheet } = await req.json();
    if (typeof vehicleId !== "string" || !/^[0-9a-f-]{36}$/i.test(vehicleId)) return json({ error: "Invalid vehicleId" }, 400);
    if (!BENCHMARK_MODELS.includes(model)) return json({ error: "Unsupported model" }, 400);
    const label = typeof runLabel === "string" && runLabel.length < 80 ? runLabel : `bench-${new Date().toISOString().slice(0, 10)}`;

    const KEY = Deno.env.get("LOVABLE_API_KEY")!, URL_ = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!auth) return json({ error: "Authentication required" }, 401);
    const anon = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: u } = await anon.auth.getUser(auth);
    if (!u?.user) return json({ error: "Authentication required" }, 401);
    const db = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isSa } = await db.rpc("is_super_admin", { check_user_id: u.user.id });
    if (isSa !== true) return json({ error: "Super admin only" }, 403);

    const { data: v } = await db.from("vehicles").select("id, team_id, make, model, year, color").eq("id", vehicleId).single();
    if (!v) return json({ error: "Vehicle not found" }, 404);

    // Real (non-AI) exterior photos, best angle first.
    const { data: photos } = await db.from("vehicle_photos")
      .select("id, url, photo_type, detected_angle, original_filename, display_order")
      .eq("vehicle_id", vehicleId).order("display_order");
    const real = (photos ?? []).filter((p) => p.url && !/studio-hero|ai-hero|generated/i.test(p.original_filename ?? "") && !["interior", "detail"].includes(p.photo_type ?? ""));
    if (!real.length) return json({ error: "No real exterior photos" }, 422);
    real.sort((a, b) => Number(b.detected_angle === "front_quarter") - Number(a.detected_angle === "front_quarter"));
    const refs = real.slice(0, 4);
    const refData = (await Promise.all(refs.map((p) => toDataUrl(p.url)))).filter(Boolean) as string[];
    if (!refData.length) return json({ error: "Could not load photos" }, 422);

    // Stage 1: identity sheet (cached per vehicle)
    let { data: sheetRow } = await db.from("vehicle_identity_sheets").select("sheet").eq("vehicle_id", vehicleId).maybeSingle();
    if (!sheetRow || rebuildSheet === true) {
      const msg = await chat(KEY, VISION_MODEL, [{ type: "text", text: `${IDENTITY_SHEET_PROMPT}\nListing: ${v.year ?? ""} ${v.make} ${v.model}, listed color ${v.color ?? "unknown"}.` }, ...refData.map(img)]);
      const sheet = parseJson(msg?.content);
      if (!sheet) return json({ error: "Identity sheet failed" }, 502);
      await db.from("vehicle_identity_sheets").upsert({ vehicle_id: vehicleId, team_id: v.team_id, sheet, source_photo_ids: refs.map((r) => r.id), model: VISION_MODEL, updated_at: new Date().toISOString() }, { onConflict: "vehicle_id" });
      sheetRow = { sheet };
    }
    const sheet = sheetRow.sheet as Record<string, unknown>;

    // Stage 2: locked studio render
    const style = await toDataUrl(STUDIO_HERO_STYLE_REFERENCE_URL);
    const renderInputs = [refData[0], ...refData.slice(1, 3), ...(style ? [style] : [])];
    let renderUrl: string | null = null, error: string | null = null, qc: any = null;
    try {
      const m = await chat(KEY, model, [{ type: "text", text: buildV2Prompt(sheet) }, ...renderInputs.map(img)], true);
      const out = m?.images?.[0]?.image_url?.url as string | undefined;
      if (!out?.startsWith("data:image")) throw new Error("no_image");
      const [h, b64] = out.split(","); const mime = h.match(/data:([^;]+)/)?.[1] || "image/png";
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `_benchmark/${label}/${vehicleId}/${model.replace("/", "_")}-${Date.now()}.${mime.split("/")[1]}`;
      const { error: upErr } = await db.storage.from("vehicle-photos").upload(path, bytes, { contentType: mime });
      if (upErr) throw new Error("upload_failed");
      renderUrl = db.storage.from("vehicle-photos").getPublicUrl(path).data.publicUrl;
      // Strict QC — fail closed
      const q = await chat(KEY, VISION_MODEL, [{ type: "text", text: `${QC_V2_PROMPT}\n\n${identitySheetToText(sheet)}` }, ...refData.slice(0, 3).map(img), img(out), ...(style ? [img(style)] : [])]);
      qc = parseJson(q?.content);
      if (!qc) error = "qc_unparseable";
    } catch (e) { error = e instanceof Error ? e.message : String(e); }

    const row = {
      run_label: label, recipe_version: STUDIO_RECIPE_VERSION, model, vehicle_id: vehicleId, team_id: v.team_id,
      render_url: renderUrl, qc_pass: qc ? Boolean(qc.pass) : false,
      fidelity_score: qc?.fidelity ?? null, studio_score: qc?.studio ?? null,
      qc_failures: Array.isArray(qc?.failures) ? qc.failures.map(String) : [], qc_notes: qc?.notes ?? null,
      error, created_by: u.user.id,
    };
    await db.from("studio_hero_benchmark_results").insert(row);
    return json({ success: !error, ...row });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed" }, 500);
  }
});
