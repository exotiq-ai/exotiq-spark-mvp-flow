// Super Admin-only benchmark for Studio Hero v2. Never touches vehicle_photos.
// One call = one vehicle x one model. Builds/reuses the identity sheet,
// renders with the locked recipe, scores with strict QC (fail-closed).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { STUDIO_HERO_STYLE_REFERENCE_URL } from "../_shared/studioHero.ts";
import {
  STUDIO_RECIPE_VERSION, IDENTITY_SHEET_PROMPT, QC_V2_PROMPT, BENCHMARK_MODELS,
  buildV2Prompt, identitySheetToText,
} from "../_shared/studioHeroV2.ts";
import { validateStudioReview, mergeIdentity, identityRevision } from '../_shared/studioReview.ts';

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
async function chat(key: string, model: string, content: unknown[], image = false, telemetry?: { runId?: string; calls: unknown[] }) {
  const headers = new Headers({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' });
  if (telemetry?.runId) headers.set('X-Lovable-AIG-Run-ID', telemetry.runId);
  const r = await fetch(AI, { method: "POST", headers,
    body: JSON.stringify({ model, messages: [{ role: "user", content }], ...(image ? { modalities: ["image", "text"] } : {}) }) });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const message = body.message ?? body.error?.message ?? `${model} request failed (${r.status})`;
    throw Object.assign(new Error(message), { status: r.status });
  }
  const response = await r.json();
  if (telemetry) {
    telemetry.runId ??= r.headers.get('X-Lovable-AIG-Run-ID') ?? undefined;
    telemetry.calls.push({ model, usage: response.usage ?? null });
  }
  const message = response.choices?.[0]?.message;
  if (message?.refusal || (!message?.content && !message?.images?.length)) {
    throw Object.assign(new Error(message?.refusal || 'The model returned no output.'), { status: 422 });
  }
  return message;
}
const parseJson = (t: string) => { const m = (t ?? "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const startedAt = Date.now();
    const telemetry: { runId?: string; calls: unknown[] } = { calls: [] };
    const { vehicleId, model, runLabel, rebuildSheet, referenceImages, sourcePhotoIds, correction } = await req.json();
    if (typeof vehicleId !== "string" || !/^[0-9a-f-]{36}$/i.test(vehicleId)) return json({ error: "Invalid vehicleId" }, 400);
    if (!BENCHMARK_MODELS.includes(model)) return json({ error: "Unsupported model" }, 400);
    if (sourcePhotoIds !== undefined && (!Array.isArray(sourcePhotoIds) || sourcePhotoIds.length < 1 || sourcePhotoIds.length > 4 || sourcePhotoIds.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)))) return json({ error: 'Select 1–4 vehicle reference photos.' }, 400);
    if (correction !== undefined && (typeof correction !== 'string' || correction.length > 2000)) return json({ error: 'Correction must be under 2,000 characters.' }, 400);
    if (referenceImages !== undefined && (!Array.isArray(referenceImages) || referenceImages.length < 1 || referenceImages.length > 4 || referenceImages.some((image) => typeof image !== 'string' || image.length > 8_000_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)))) return json({ error: 'Supply 1–4 JPEG, PNG or WebP reference images, each under 8 MB encoded.' }, 400);
    const label = typeof runLabel === "string" && /^[a-zA-Z0-9_-]{1,79}$/.test(runLabel) ? runLabel : `bench-${new Date().toISOString().slice(0, 10)}`;

    const KEY = Deno.env.get("LOVABLE_API_KEY"), URL_ = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!KEY || !URL_ || !anonKey || !serviceKey) return json({ error: 'Photo testing is not configured.' }, 500);
    const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!auth) return json({ error: "Authentication required" }, 401);
    const anon = createClient(URL_, anonKey);
    const { data: claims, error: claimsError } = await anon.auth.getClaims(auth);
    const userId = claims?.claims?.sub;
    if (claimsError || typeof userId !== 'string') return json({ error: "Authentication required" }, 401);
    const db = createClient(URL_, serviceKey);
    const { data: isSa } = await db.rpc("is_super_admin", { check_user_id: userId });
    if (isSa !== true) return json({ error: "Super admin only" }, 403);

    const { data: v } = await db.from("vehicles").select("id, team_id, make, model, year, color").eq("id", vehicleId).single();
    if (!v) return json({ error: "Vehicle not found" }, 404);

    // Real (non-AI) exterior photos, best angle first.
    const { data: photos } = await db.from("vehicle_photos")
      .select("id, url, photo_type, detected_angle, original_filename, display_order, source, updated_at")
      .eq("vehicle_id", vehicleId).order("display_order");
    const real = (photos ?? []).filter((p) => p.url && !['studio_render', 'ai_generated'].includes(p.source ?? '') && !/studio-hero|ai-hero|generated/i.test(p.original_filename ?? "") && p.photo_type !== 'interior');
    if (!real.length && !referenceImages) return json({ error: "No real exterior photos" }, 422);
    real.sort((a, b) => Number(b.detected_angle === "front_quarter") - Number(a.detected_angle === "front_quarter"));
    const refs = sourcePhotoIds ? sourcePhotoIds.map((id: string) => real.find((p) => p.id === id)) : real.slice(0, 4);
    if (refs.some((p) => !p)) return json({ error: 'Reference photos must belong to this vehicle and cannot be generated or interior photos.' }, 400);
    const refData: string[] = referenceImages ?? (await Promise.all(refs.map((p) => toDataUrl(p.url)))).filter(Boolean) as string[];
    if (!refData.length) return json({ error: "Could not load photos" }, 422);

    // Stage 1: identity sheet (cached per vehicle)
    const revision = await identityRevision({ vehicle: v, photos: refs.map((p) => [p.id, p.url, p.updated_at]), prompt: IDENTITY_SHEET_PROMPT });
    let { data: sheetRow } = await db.from("vehicle_identity_sheets").select("sheet,source_revision,reviewed_overrides").eq("vehicle_id", vehicleId).maybeSingle();
    const overrides = sheetRow?.reviewed_overrides as Record<string, unknown> ?? {};
    if (!sheetRow || rebuildSheet === true || referenceImages || sheetRow.source_revision !== revision) {
      const msg = await chat(KEY, VISION_MODEL, [{ type: "text", text: `${IDENTITY_SHEET_PROMPT}\nListing: ${v.year ?? ""} ${v.make} ${v.model}, listed color ${v.color ?? "unknown"}.` }, ...refData.map(img)], false, telemetry);
      const sheet = parseJson(msg?.content);
      if (!sheet || typeof sheet !== 'object' || Array.isArray(sheet) || !sheet.wheels || !sheet.paint || !Array.isArray(sheet.evidence)) return json({ error: "Identity sheet failed validation; no render was started." }, 422);
      // Ad-hoc uploaded examples must not overwrite the vehicle's saved identity sheet.
      if (!referenceImages) {
        const { error: sheetError } = await db.from("vehicle_identity_sheets").upsert({ vehicle_id: vehicleId, team_id: v.team_id, sheet, source_revision: revision, source_photo_ids: refs.map((r) => r.id), model: VISION_MODEL, updated_at: new Date().toISOString() }, { onConflict: "vehicle_id" });
        if (sheetError) return json({ error: 'Could not save vehicle identity; no render was started.' }, 500);
      }
      sheetRow = { sheet, source_revision: revision, reviewed_overrides: overrides };
    }
    const sheet = referenceImages ? sheetRow.sheet as Record<string, unknown> : mergeIdentity(sheetRow.sheet as Record<string, unknown>, overrides);

    // Stage 2: locked studio render
    const style = await toDataUrl(STUDIO_HERO_STYLE_REFERENCE_URL);
    if (!style) return json({ error: 'Studio reference could not be loaded; no render was started.' }, 422);
    const renderInputs = [refData[0], ...refData.slice(1, 3), ...(style ? [style] : [])];
    const prompt = buildV2Prompt(sheet, correction ? [correction] : []);
    let renderUrl: string | null = null, storagePath: string | null = null, error: string | null = null, qc: ReturnType<typeof validateStudioReview> = null, upstreamStatus: number | null = null;
    try {
      const m = await chat(KEY, model, [{ type: "text", text: prompt }, ...renderInputs.map(img)], true, telemetry);
      const out = m?.images?.[0]?.image_url?.url as string | undefined;
      if (!out?.startsWith("data:image")) throw new Error("no_image");
      const [h, b64] = out.split(","); const mime = h.match(/data:([^;]+)/)?.[1] || "image/png";
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `_benchmark/${label}/${vehicleId}/${model.replace("/", "_")}-${Date.now()}.${mime.split("/")[1]}`;
      storagePath = path;
      const { error: upErr } = await db.storage.from("vehicle-photos").upload(path, bytes, { contentType: mime });
      if (upErr) throw new Error("upload_failed");
      renderUrl = db.storage.from("vehicle-photos").getPublicUrl(path).data.publicUrl;
      // Strict QC — fail closed
      const q = await chat(KEY, VISION_MODEL, [{ type: "text", text: `${QC_V2_PROMPT}\n\n${identitySheetToText(sheet)}` }, ...refData.slice(0, 3).map(img), img(out), ...(style ? [img(style)] : [])], false, telemetry);
      qc = validateStudioReview(parseJson(q?.content));
      if (!qc) error = "Quality review is incomplete or invalid; candidate is not approved.";
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      if (e && typeof e === 'object' && 'status' in e) upstreamStatus = Number(e.status);
    }

    const row = {
      run_label: label, recipe_version: STUDIO_RECIPE_VERSION, model, vehicle_id: vehicleId, team_id: v.team_id,
      render_url: renderUrl, qc_pass: qc ? Boolean(qc.pass) : false,
      fidelity_score: qc?.fidelity ?? null, studio_score: qc?.studio ?? null,
      qc_failures: Array.isArray(qc?.failures) ? qc.failures.map(String) : [], qc_notes: qc?.notes ?? null,
      error, created_by: userId,
      identity_snapshot: sheet, source_photo_ids: referenceImages ? [] : refs.map((p) => p.id), reference_kind: referenceImages ? 'example' : 'vehicle',
      recipe_snapshot: { version: STUDIO_RECIPE_VERSION, prompt, review_prompt: QC_V2_PROMPT, style_url: STUDIO_HERO_STYLE_REFERENCE_URL },
      storage_path: storagePath, review_details: qc, duration_ms: Date.now() - startedAt, gateway_run_id: telemetry.runId ?? null, usage_details: { calls: telemetry.calls },
    };
    const { data: saved, error: saveError } = await db.from("studio_hero_benchmark_results").insert(row).select('id').single();
    if (saveError) return json({ error: 'Could not save the benchmark result.', render_url: renderUrl }, 500);
    return json({ success: !error, ...row, id: saved?.id, identity_sheet: sheet }, upstreamStatus ?? 200);
  } catch (e) {
    const status = e && typeof e === 'object' && 'status' in e ? Number(e.status) : 500;
    return json({ error: e instanceof Error ? e.message : "failed" }, status);
  }
});
