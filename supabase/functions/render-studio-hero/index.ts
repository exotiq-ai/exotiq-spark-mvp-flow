import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { logTransfer } from "../_shared/transferGuard.ts";
import { geminiImageModel, geminiImageResponse } from "../_shared/geminiImage.ts";
import { aiChatUrl, aiModel, aiProviderLabel, aiRequestParams } from "../_shared/aiProvider.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  STUDIO_HERO_PROMPT_VERSION,
  STUDIO_HERO_MASTER_PROMPT,
  STUDIO_HERO_CORRECTIONS,
  STUDIO_HERO_SOURCE_CLASSIFIER,
  STUDIO_HERO_STYLE_REFERENCE_URL,
  STUDIO_HERO_QC_CHECKLIST,
  STUDIO_HERO_MAX_ATTEMPTS,
  STUDIO_HERO_ESCALATION_EMAIL,
} from "../_shared/studioHero.ts";
import {
  STUDIO_RECIPE_VERSION,
  IDENTITY_SHEET_PROMPT,
  QC_V2_PROMPT,
  V2_CORRECTIONS,
  buildV2Prompt,
  identitySheetToText,
} from "../_shared/studioHeroV2.ts";
import { validateStudioReview, mergeIdentity, identityRevision } from "../_shared/studioReview.ts";
import {
  correctionsFor,
  isRealVehiclePhoto,
  isValidIdentitySheet,
  pickRenderReferences,
  renderReferenceSplit,
  studioPipeline,
  type ClassifiedPhoto,
} from "../_shared/studioHeroPlan.ts";

// Pipelines (see _shared/studioHeroPlan.ts):
//  v2 (default): identity sheet of the car + up to 3 of its photos + locked camera/light recipe + scored review.
//                Never mirrors the source (mirroring flips badges and lettering). Same recipe as studio-hero-benchmark.
//  v1:           the earlier single-photo v1.5 prompt. Set the secret STUDIO_HERO_PIPELINE=v1 to roll back without a redeploy.
const RENDER_MODEL = geminiImageModel(); // Nano Banana
const PIPELINE = studioPipeline(Deno.env.get("STUDIO_HERO_PIPELINE"));

type Db = ReturnType<typeof createClient>;
type Vehicle = { id: string; team_id: string; make: string; model: string; year?: number | null; color?: string | null };
type Photo = {
  id: string; url: string; detected_angle: string | null; quality_score: number | null; source: string | null;
  width: number | null; height: number | null; photo_type: string | null; original_filename: string | null; updated_at: string | null;
};
type Job = { id: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${bytesToBase64(buf)}`;
  } catch {
    return null;
  }
}

// Mirror an image horizontally (so a right-facing car faces left). v1 only.
// Uses imagescript; on any failure returns the original bytes unchanged.
async function mirrorDataUrl(dataUrl: string): Promise<{ dataUrl: string; mirrored: boolean }> {
  try {
    const { Image } = await import("https://deno.land/x/imagescript@1.2.15/mod.ts");
    const [header, b64] = dataUrl.split(",");
    const img = await Image.decode(base64ToBytes(b64));
    img.mirror(); // horizontal flip
    const mime = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
    const out =
      mime === "image/png" ? await img.encode() : await img.encodeJPEG(92);
    return { dataUrl: `data:${mime};base64,${bytesToBase64(new Uint8Array(out))}`, mirrored: true };
  } catch (e) {
    console.warn("mirror failed, using original:", e);
    return { dataUrl, mirrored: false };
  }
}

// Pad a portrait (taller-than-wide) image onto a 3:2 landscape charcoal canvas
// so the render model never inherits a portrait frame. No-op for landscape. v1 only.
async function padToLandscape(dataUrl: string): Promise<{ dataUrl: string; padded: boolean }> {
  try {
    const { Image } = await import("https://deno.land/x/imagescript@1.2.15/mod.ts");
    const b64 = dataUrl.split(",")[1];
    const img = await Image.decode(base64ToBytes(b64));
    if (img.width >= img.height) return { dataUrl, padded: false };
    const h = img.height;
    const w = Math.round(h * 1.5);
    const canvas = new Image(w, h);
    canvas.fill(Image.rgbaToColor(28, 28, 30, 255));
    canvas.composite(img, Math.round((w - img.width) / 2), 0);
    const out = new Uint8Array(await canvas.encodeJPEG(92));
    return { dataUrl: `data:image/jpeg;base64,${bytesToBase64(out)}`, padded: true };
  } catch (e) {
    console.warn("pad failed, using original:", e);
    return { dataUrl, padded: false };
  }
}

interface QcResult {
  pass: boolean;
  failures: string[];
  notes?: string;
  pending?: boolean;
  fidelity?: number;
  studio?: number;
  checks?: Record<string, unknown>;
}

interface SourceClass {
  kind: string;
  facing: string | null;
  paint: string | null;
  matches_listed_color: boolean | null;
}

const imagePart = (url: string) => ({ type: "image_url", image_url: { url } });
const parseJson = (text: string) => {
  const m = (text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
};

// One vision call to the OpenAI-compatible provider; returns the text reply, or null on any failure.
async function visionText(apiKey: string, content: unknown[]): Promise<string | null> {
  try {
    const res = await fetch(aiChatUrl(), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...aiRequestParams("vision"), messages: [{ role: "user", content }] }),
    });
    if (!res.ok) { console.error("vision call failed:", res.status, (await res.text()).slice(0, 200)); return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.warn("vision call error:", e);
    return null;
  }
}

// Classify a candidate source photo. Returns null on any failure (candidate skipped).
async function classifyDataUrl(apiKey: string, dataUrl: string, listedColor: string | null): Promise<SourceClass | null> {
  const text = await visionText(apiKey, [
    { type: "text", text: STUDIO_HERO_SOURCE_CLASSIFIER + (listedColor ? `\nListed exterior paint color: ${listedColor}` : "\nListed exterior paint color: none") },
    imagePart(dataUrl),
  ]);
  const p = text ? parseJson(text) : null;
  if (!p) return null;
  return {
    kind: String(p.kind ?? ""),
    facing: typeof p.facing === "string" ? p.facing : null,
    paint: typeof p.paint === "string" ? p.paint : null,
    matches_listed_color: typeof p.matches_listed_color === "boolean" ? p.matches_listed_color : null,
  };
}

async function classifySource(apiKey: string, url: string, listedColor: string | null): Promise<SourceClass | null> {
  const dataUrl = await fetchAsDataUrl(url);
  return dataUrl ? classifyDataUrl(apiKey, dataUrl, listedColor) : null;
}

async function runQc(
  apiKey: string,
  sourceDataUrl: string,
  renderDataUrl: string,
  styleRefDataUrl: string | null = null
): Promise<QcResult> {
  const res = await fetch(aiChatUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...aiRequestParams("vision"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: STUDIO_HERO_QC_CHECKLIST + "\n\nFirst image is the SOURCE photo, second image is the RENDER, third image (if present) is the STYLE REFERENCE studio." },
            { type: "image_url", image_url: { url: sourceDataUrl } },
            { type: "image_url", image_url: { url: renderDataUrl } },
            ...(styleRefDataUrl ? [{ type: "image_url", image_url: { url: styleRefDataUrl } }] : []),
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error("QC call failed:", res.status, await res.text());
    return { pass: false, failures: [], notes: 'Quality review is unavailable. The current hero is unchanged.', pending: true };
  }
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { pass: false, failures: [], notes: 'Quality review is incomplete.', pending: true };
    const parsed = JSON.parse(match[0]);
    const codes = Object.keys(STUDIO_HERO_CORRECTIONS);
    if (typeof parsed.pass !== 'boolean' || !Array.isArray(parsed.failures) || parsed.failures.some((f: unknown) => typeof f !== 'string' || !codes.includes(f)) || typeof parsed.notes !== 'string') return { pass: false, failures: [], notes: 'Quality review is invalid.', pending: true };
    return {
      pass: parsed.pass === true && parsed.failures.length === 0,
      failures: Array.isArray(parsed.failures) ? parsed.failures.map(String) : [],
      notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
    };
  } catch {
    return { pass: false, failures: [], notes: 'Quality review is incomplete.', pending: true };
  }
}

// v2 review: identity sheet + up to 3 source photos + render + style reference, scored and fail-closed.
async function runQcV2(
  apiKey: string,
  sheet: Record<string, unknown>,
  reviewRefs: string[],
  renderDataUrl: string,
  styleRefDataUrl: string,
): Promise<QcResult> {
  const text = await visionText(apiKey, [
    { type: "text", text: `${QC_V2_PROMPT}\n\n${identitySheetToText(sheet)}` },
    ...reviewRefs.map(imagePart),
    imagePart(renderDataUrl),
    imagePart(styleRefDataUrl),
  ]);
  if (text === null) return { pass: false, failures: [], notes: 'Quality review is unavailable. The current hero is unchanged.', pending: true };
  const review = validateStudioReview(parseJson(text));
  if (!review) return { pass: false, failures: [], notes: 'Quality review is incomplete or invalid.', pending: true };
  return { pass: review.pass, failures: review.failures, notes: review.notes, fidelity: review.fidelity, studio: review.studio, checks: review.checks };
}

// Builds (or reuses) the vehicle's identity sheet. Shares the cache with studio-hero-benchmark: same revision
// inputs, same table. Support-reviewed overrides are merged on top. Returns null when no valid sheet can be made.
async function loadIdentitySheet(
  db: Db,
  apiKey: string,
  vehicle: Vehicle,
  refs: Array<Photo & { dataUrl: string }>,
): Promise<Record<string, unknown> | null> {
  const revision = await identityRevision({
    vehicle,
    photos: refs.map((p) => [p.id, p.url, p.updated_at]),
    prompt: IDENTITY_SHEET_PROMPT,
  });
  const { data: row } = await db
    .from("vehicle_identity_sheets")
    .select("sheet,source_revision,reviewed_overrides")
    .eq("vehicle_id", vehicle.id)
    .maybeSingle();
  const overrides = (row?.reviewed_overrides ?? {}) as Record<string, unknown>;
  let sheet = row?.sheet as Record<string, unknown> | undefined;
  if (!row || row.source_revision !== revision || !isValidIdentitySheet(sheet)) {
    const text = await visionText(apiKey, [
      { type: "text", text: `${IDENTITY_SHEET_PROMPT}\nListing: ${vehicle.year ?? ""} ${vehicle.make} ${vehicle.model}, listed color ${vehicle.color ?? "unknown"}.` },
      ...refs.map((r) => imagePart(r.dataUrl)),
    ]);
    const parsed = text ? parseJson(text) : null;
    if (!isValidIdentitySheet(parsed)) return null;
    const { error } = await db.from("vehicle_identity_sheets").upsert({
      vehicle_id: vehicle.id,
      team_id: vehicle.team_id,
      sheet: parsed,
      source_revision: revision,
      source_photo_ids: refs.map((r) => r.id),
      model: aiModel("vision"),
      updated_at: new Date().toISOString(),
    }, { onConflict: "vehicle_id" });
    if (error) console.error("identity sheet save failed (render continues):", error.message);
    sheet = parsed;
  }
  return mergeIdentity(sheet as Record<string, unknown>, overrides);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { vehicleId, sourcePhotoId, mirrorSource, reviewJobId } = await req.json();
    if (typeof vehicleId !== 'string' || !/^[0-9a-f-]{36}$/i.test(vehicleId)) return json({ success: false, error: 'Invalid vehicleId' }, 400);
    if (reviewJobId !== undefined && (typeof reviewJobId !== 'string' || !/^[0-9a-f-]{36}$/i.test(reviewJobId))) return json({ success: false, error: 'Invalid review job' }, 400);
    if (sourcePhotoId !== undefined && (typeof sourcePhotoId !== "string" || !/^[0-9a-f-]{36}$/i.test(sourcePhotoId))) {
      return json({ success: false, error: "Invalid sourcePhotoId" }, 400);
    }
    if (!vehicleId) return json({ success: false, error: "vehicleId is required" }, 400);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!GEMINI_API_KEY || !OPENAI_API_KEY || !SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return json({ success: false, error: "Service not configured" }, 500);
    }

    // Authenticated caller required (paid AI + service-role writes).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Authentication required" }, 401);
    const authClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    const userId = userData?.claims?.sub;
    if (userError || !userId) return json({ success: false, error: "Authentication required" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load vehicle + team, verify membership
    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles")
      .select("id, team_id, make, model, year, color")
      .eq("id", vehicleId)
      .single();
    if (vErr || !vehicle) return json({ success: false, error: "Vehicle not found" }, 404);
    const teamId = vehicle.team_id;
    if (!teamId) return json({ success: false, error: 'Vehicle account not found' }, 400);

    const { data: membership } = await supabase
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership || membership.role === 'viewer') {
      const { data: isSa } = await supabase.rpc("is_super_admin", { check_user_id: userId });
      if (isSa !== true) return json({ success: false, error: "Not a member of this team" }, 403);
    }

    const { data: team } = await supabase
      .from("teams")
      .select("id, name, slug, studio_hero_opt_out")
      .eq("id", teamId)
      .single();
    if (team?.studio_hero_opt_out) {
      return json({ success: false, error: "Studio hero renders are disabled for this team" }, 400);
    }

    if (reviewJobId) {
      const { data: pendingJob } = await supabase.from('hero_render_jobs').select('*').eq('id', reviewJobId).eq('vehicle_id', vehicleId).eq('team_id', teamId).is('archived_at', null).single();
      if (!pendingJob || pendingJob.review_state !== 'waiting' || !pendingJob.render_photo_id || !pendingJob.source_photo_id) return json({ success: false, error: 'No saved image is waiting for review.' }, 400);
      const { data: pair } = await supabase.from('vehicle_photos').select('id,url').eq('vehicle_id', vehicleId).in('id', [pendingJob.source_photo_id, pendingJob.render_photo_id]);
      const sourceUrl = pair?.find((p) => p.id === pendingJob.source_photo_id)?.url;
      const renderUrl = pair?.find((p) => p.id === pendingJob.render_photo_id)?.url;
      if (!sourceUrl || !renderUrl) return json({ success: false, error: 'Review photos could not be found.' }, 422);
      const [sourceData, renderData, styleData] = await Promise.all([fetchAsDataUrl(sourceUrl), fetchAsDataUrl(renderUrl), fetchAsDataUrl(STUDIO_HERO_STYLE_REFERENCE_URL)]);
      if (!sourceData || !renderData || !styleData) return json({ success: false, error: 'Review photos could not be loaded.' }, 422);
      let qc: QcResult;
      if (String(pendingJob.recipe_version ?? '').startsWith('v2')) {
        const v2 = await reviewContextV2(supabase, vehicleId, pendingJob.source_photo_id, sourceData);
        if (!v2) return json({ success: false, error: 'The vehicle description for this render could not be found.' }, 422);
        qc = await runQcV2(OPENAI_API_KEY, v2.sheet, v2.reviewRefs, renderData, styleData);
      } else {
        qc = await runQc(OPENAI_API_KEY, sourceData, renderData, styleData);
      }
      if (qc.pending) return json({ success: false, reviewPending: true, error: qc.notes });
      const dims = imageDims(renderData);
      if (dims && dims.h >= dims.w) { qc.pass = false; qc.failures.push('wrong_orientation'); }
      await supabase.from('hero_render_jobs').update({ qc_passed: qc.pass, review_state: qc.pass ? 'passed' : 'rejected', review_details: qc, qc_failure_reasons: qc.failures, status: qc.pass ? 'qc' : pendingJob.attempt_number >= 3 ? 'escalated' : 'failed', error: qc.notes }).eq('id', pendingJob.id);
      if (!qc.pass) {
        if (pendingJob.attempt_number >= 3) await escalate(supabase, teamId, vehicle, pendingJob.attempt_number);
        return json({ success: false, qcFailed: true, error: qc.notes, attemptsUsed: pendingJob.attempt_number });
      }
      const { error: promoteError } = await supabase.rpc('studio_promote_job', { _job_id: pendingJob.id, _actor_id: userId });
      if (promoteError) return json({ success: false, error: 'Could not promote reviewed photo. Current hero is unchanged.' }, 500);
      return json({ success: true, imageUrl: renderUrl, photoId: pendingJob.render_photo_id, attemptsUsed: pendingJob.attempt_number });
    }

    // Enforce the 3-render cap
    const { count: attemptCount } = await supabase
      .from("hero_render_jobs")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId)
      .is("archived_at", null);
    const attempt = (attemptCount ?? 0) + 1;
    if (attempt > STUDIO_HERO_MAX_ATTEMPTS) {
      return json(
        { success: false, error: "Render limit reached — Exotiq support has been notified", escalated: true },
        400
      );
    }

    // Candidate source photos: real photos of this car only (never a studio render or an AI-invented hero),
    // front_quarter first, known-landscape before unknown before portrait, then highest quality.
    const { data: candidates } = await supabase
      .from("vehicle_photos")
      .select("id, url, detected_angle, quality_score, source, width, height, photo_type, original_filename, updated_at")
      .eq("vehicle_id", vehicleId)
      .order("quality_score", { ascending: false });
    const photos = ((candidates ?? []) as Photo[]).filter(isRealVehiclePhoto);
    const angleRank = (a: string | null) =>
      a === "front_quarter" ? 0 : a === "front" ? 1 : 2;
    const dimRank = (p: { width: number | null; height: number | null }) =>
      p.width && p.height ? (p.width >= p.height ? 0 : 2) : 1;
    const pool = [...photos].sort((a, b) =>
      angleRank(a.detected_angle) - angleRank(b.detected_angle) ||
      dimRank(a) - dimRank(b) ||
      (b.quality_score ?? 0) - (a.quality_score ?? 0)
    );

    if (sourcePhotoId) {
      const { data: isSaOverride } = await supabase.rpc("is_super_admin", { check_user_id: userId });
      if (isSaOverride !== true) return json({ success: false, error: "Only Exotiq support can pick a source photo" }, 403);
      if (!photos.some((p) => p.id === sourcePhotoId)) return json({ success: false, error: "Source photo not found on this vehicle" }, 400);
    }

    // Prior failures steer this attempt's prompt
    const { data: priorJobs } = await supabase
      .from("hero_render_jobs")
      .select("qc_failure_reasons")
      .eq("vehicle_id", vehicleId)
      .is("archived_at", null)
      .eq("status", "failed");
    const priorFailures = new Set<string>();
    (priorJobs ?? []).forEach((j) => (j.qc_failure_reasons ?? []).forEach((f: string) => priorFailures.add(f)));

    const ctx: RenderContext = { supabase, vehicle, teamId, userId, attempt, apiKey: OPENAI_API_KEY };

    if (PIPELINE === "v2") {
      return await renderV2(ctx, pool, sourcePhotoId ?? null, priorFailures);
    }

    // ---- v1.5 (rollback path) ----------------------------------------------------------------
    let source = pool[0];
    let classifiedFacing: string | null = null;
    if (sourcePhotoId) {
      source = photos.find((p) => p.id === sourcePhotoId)!;
    } else if (pool.length) {
      // Classify candidates (costs no attempt) so interior/detail/rear shots are
      // never used as the source. Prefer an exterior front-quarter photo.
      let chosen: (typeof pool)[number] | null = null;
      let fallback: (typeof pool)[number] | null = null;
      let fallbackFacing: string | null = null;
      let paintConflict: string | null = null;
      let fallbackConflict: string | null = null;
      for (const cand of pool.slice(0, 6)) {
        const c = await classifySource(OPENAI_API_KEY, cand.url, vehicle.color ?? null);
        if (!c) continue;
        if (c.kind === "exterior_front_quarter") {
          chosen = cand; classifiedFacing = c.facing;
          paintConflict = c.matches_listed_color === false ? c.paint : null;
          break;
        }
        if (c.kind === "exterior_other" && !fallback) {
          fallback = cand; fallbackFacing = c.facing;
          fallbackConflict = c.matches_listed_color === false ? c.paint : null;
        }
      }
      if (!chosen && fallback) { chosen = fallback; classifiedFacing = fallbackFacing; paintConflict = fallbackConflict; }
      if (!chosen) {
        return json({ success: false, error: "Add a front 45° exterior photo first", needsSourcePhoto: true }, 400);
      }
      if (paintConflict && vehicle.color) {
        return json({
          success: false,
          paintConflict: true,
          error: `Check paint color: the listing says ${vehicle.color} but the photo shows ${paintConflict}. Update the listing color, then render again.`,
        }, 409);
      }
      source = chosen;
    }
    if (!source?.url) {
      return json(
        { success: false, error: "Add a front 45° exterior photo first", needsSourcePhoto: true },
        400
      );
    }

    let prompt = STUDIO_HERO_MASTER_PROMPT;
    if (vehicle.color) {
      prompt += `\n\nPAINT HINT: the listed exterior paint color is ${vehicle.color}. If the source photo clearly shows a different paint color, match the source photo exactly.`;
    }
    priorFailures.forEach((f) => {
      if (STUDIO_HERO_CORRECTIONS[f]) prompt += "\n\n" + STUDIO_HERO_CORRECTIONS[f];
    });

    // Create the job row
    const { data: job, error: jobErr } = await supabase.rpc('studio_reserve_attempt', { _vehicle_id: vehicleId, _source_id: source.id, _actor_id: userId, _prompt: prompt, _version: STUDIO_HERO_PROMPT_VERSION, _model: RENDER_MODEL });
    if (jobErr || !job) return json({ success: false, error: jobErr?.message ?? 'Could not reserve a render attempt.' }, 409);

    // Fetch source image; mirror if the car faces right
    let sourceDataUrl = await fetchAsDataUrl(source.url);
    if (!sourceDataUrl) {
      await supabase.from("hero_render_jobs").update({ status: "failed", error: "source_fetch_failed" }).eq("id", job.id);
      return json({ success: false, error: "Could not load the source photo" }, 500);
    }
    let mirrored = false;
    if ((sourcePhotoId && mirrorSource === true) || source.detected_angle === "rear_quarter" || source.detected_angle === "right_side" || (!sourcePhotoId && classifiedFacing === "right")) {
      const m = await mirrorDataUrl(sourceDataUrl);
      sourceDataUrl = m.dataUrl;
      mirrored = m.mirrored;
    }
    const padRes = await padToLandscape(sourceDataUrl);
    sourceDataUrl = padRes.dataUrl;
    if (padRes.padded) console.log("source padded to landscape", { jobId: job.id });

    const styleRefDataUrl = await fetchAsDataUrl(STUDIO_HERO_STYLE_REFERENCE_URL);
    if (!styleRefDataUrl) {
      await supabase.from('hero_render_jobs').update({ status: 'cancelled', archived_at: new Date().toISOString(), error: 'Studio reference unavailable; no image generated.' }).eq('id', job.id);
      return json({ success: false, error: 'Studio reference is unavailable. No image was generated.' }, 422);
    }
    // Render via Nano Banana (edit-style: source photo as reference)
    const renderRes = await geminiImageResponse({ prompt, sourceDataUrl, referenceDataUrls: [styleRefDataUrl] });
    const finalSource = sourceDataUrl;
    return await saveAndReview(ctx, job, prompt, renderRes, mirrored, (renderImageUrl) =>
      runQc(OPENAI_API_KEY, finalSource, renderImageUrl, styleRefDataUrl));
  } catch (error) {
    console.error("render-studio-hero error:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

interface RenderContext {
  supabase: Db;
  vehicle: Vehicle;
  teamId: string;
  userId: string;
  attempt: number;
  apiKey: string;
}

// ---- v2 ----------------------------------------------------------------------------------------
// Everything that can fail for reasons other than the render itself (photo check, identity sheet,
// studio reference) happens BEFORE an attempt is reserved, so it never costs the owner one of the 3 renders.
async function renderV2(
  ctx: RenderContext,
  pool: Photo[],
  sourcePhotoId: string | null,
  priorFailures: Set<string>,
): Promise<Response> {
  const { supabase, vehicle, userId, apiKey } = ctx;
  const ordered = sourcePhotoId
    ? [pool.find((p) => p.id === sourcePhotoId)!, ...pool.filter((p) => p.id !== sourcePhotoId)]
    : pool;
  const candidates = ordered.filter(Boolean).slice(0, 6);
  if (!candidates.length) {
    return json({ success: false, error: "Add a front 45° exterior photo first", needsSourcePhoto: true }, 400);
  }

  // Load and classify the candidates in parallel (no attempt used).
  const loaded = await Promise.all(candidates.map(async (photo) => {
    const dataUrl = await fetchAsDataUrl(photo.url);
    if (!dataUrl) return null;
    const c = await classifyDataUrl(apiKey, dataUrl, vehicle.color ?? null);
    if (!c) return null;
    const entry: ClassifiedPhoto<Photo & { dataUrl: string }> = {
      photo: { ...photo, dataUrl }, kind: c.kind, facing: c.facing, paint: c.paint, matchesListedColor: c.matches_listed_color,
    };
    return entry;
  }));
  const classified = loaded.filter((x): x is ClassifiedPhoto<Photo & { dataUrl: string }> => x !== null);
  if (!classified.length) {
    return json({ success: false, error: "The photo check is unavailable right now. Nothing was rendered and no render was used — try again shortly." }, 503);
  }

  const { main, extras } = pickRenderReferences(
    classified,
    sourcePhotoId ? { mainId: sourcePhotoId, idOf: (p) => p.id } : {},
  );
  if (!main) {
    return json({ success: false, error: "Add a front 45° exterior photo first", needsSourcePhoto: true }, 400);
  }
  if (!sourcePhotoId && main.matchesListedColor === false && main.paint && vehicle.color) {
    return json({
      success: false,
      paintConflict: true,
      error: `Check paint color: the listing says ${vehicle.color} but the photo shows ${main.paint}. Update the listing color, then render again.`,
    }, 409);
  }
  const refs = [main, ...extras].map((r) => r.photo);

  const sheet = await loadIdentitySheet(supabase, apiKey, vehicle, refs);
  if (!sheet) {
    return json({ success: false, error: "Could not describe this vehicle from its photos. Nothing was rendered and no render was used — try again shortly." }, 502);
  }
  const style = await fetchAsDataUrl(STUDIO_HERO_STYLE_REFERENCE_URL);
  if (!style) return json({ success: false, error: 'Studio reference is unavailable. No image was generated.' }, 422);

  const prompt = buildV2Prompt(sheet, correctionsFor(priorFailures, STUDIO_HERO_CORRECTIONS, V2_CORRECTIONS));
  const { data: job, error: jobErr } = await supabase.rpc('studio_reserve_attempt', { _vehicle_id: vehicle.id, _source_id: main.photo.id, _actor_id: userId, _prompt: prompt, _version: STUDIO_RECIPE_VERSION, _model: RENDER_MODEL });
  if (jobErr || !job) return json({ success: false, error: jobErr?.message ?? 'Could not reserve a render attempt.' }, 409);
  await supabase.from("hero_render_jobs").update({ recipe_version: STUDIO_RECIPE_VERSION, mirrored_source: false }).eq("id", job.id);

  // Image order matters to the prompt: FIRST = main photo, then extra photos of the same car, LAST = studio reference.
  const split = renderReferenceSplit(refs.map((r) => r.dataUrl));
  const renderRes = await geminiImageResponse({ prompt, sourceDataUrl: split.source, referenceDataUrls: [...split.extras, style] });
  return await saveAndReview(ctx, job, prompt, renderRes, false, (renderImageUrl) =>
    runQcV2(apiKey, sheet, split.review, renderImageUrl, style));
}

// Re-review of a v2 render that was waiting: the saved identity sheet and the photos it was built from.
async function reviewContextV2(
  db: Db,
  vehicleId: string,
  sourcePhotoId: string,
  sourceDataUrl: string,
): Promise<{ sheet: Record<string, unknown>; reviewRefs: string[] } | null> {
  const { data: row } = await db
    .from("vehicle_identity_sheets")
    .select("sheet,reviewed_overrides,source_photo_ids")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  if (!row || !isValidIdentitySheet(row.sheet)) return null;
  const sheet = mergeIdentity(row.sheet as Record<string, unknown>, (row.reviewed_overrides ?? {}) as Record<string, unknown>);
  const otherIds = ((row.source_photo_ids ?? []) as string[]).filter((id) => id !== sourcePhotoId).slice(0, 2);
  const reviewRefs = [sourceDataUrl];
  if (otherIds.length) {
    const { data: others } = await db.from("vehicle_photos").select("id,url").eq("vehicle_id", vehicleId).in("id", otherIds);
    for (const id of otherIds) {
      const url = others?.find((p) => p.id === id)?.url;
      const data = url ? await fetchAsDataUrl(url) : null;
      if (data) reviewRefs.push(data);
    }
  }
  return { sheet, reviewRefs };
}

// ---- shared by both pipelines: save the render, review it, then fail / escalate / promote ----------
async function saveAndReview(
  ctx: RenderContext,
  job: Job,
  prompt: string,
  renderRes: Response,
  mirrored: boolean,
  review: (renderImageUrl: string) => Promise<QcResult>,
): Promise<Response> {
  const { supabase, vehicle, teamId, userId, attempt } = ctx;
  const vehicleId = vehicle.id;

  if (!renderRes.ok) {
    const errText = await renderRes.text();
    console.error("render error:", renderRes.status, errText);
    await supabase.from("hero_render_jobs").update({ status: "failed", error: `render_${renderRes.status}` }).eq("id", job.id);
    logTransfer({ team_id: teamId, user_id: userId, caller: "render-studio-hero", model: RENDER_MODEL, provider: "Google (Gemini API)", provider_region: "United States / Global", response_bytes: 0, status: "error" }).catch(() => {});
    if (renderRes.status === 429) return json({ success: false, error: "Rate limit exceeded. Please try again later." }, 429);
    if (renderRes.status === 402) return json({ success: false, error: "AI credits exhausted. Please add funds." }, 402);
    return json({ success: false, error: "Studio render failed" }, 500);
  }

  const renderData = await renderRes.json();
  const images = renderData.choices?.[0]?.message?.images;
  const renderImageUrl: string | undefined = images?.[0]?.image_url?.url;
  logTransfer({ team_id: teamId, user_id: userId, caller: "render-studio-hero", model: RENDER_MODEL, provider: "Google (Gemini API)", provider_region: "United States / Global", response_bytes: renderImageUrl?.length ?? 0, status: "ok" }).catch(() => {});

  if (!renderImageUrl?.startsWith("data:image")) {
    await supabase.from("hero_render_jobs").update({ status: "failed", error: "no_image_returned" }).eq("id", job.id);
    return json({ success: false, error: "No image generated" }, 500);
  }

  // Save every render (pass or fail) so failed attempts are reviewable by
  // support and included in the escalation trail. Failed renders stay
  // non-hero; only a QC pass promotes to hero.
  const [header, b64] = renderImageUrl.split(",");
  const mime = header.match(/data:([^;]+)/)?.[1] || "image/png";
  const ext = mime.split("/")[1] || "png";
  const bytes = base64ToBytes(b64);
  const storagePath = `${teamId}/vehicles/${vehicleId}/studio-hero-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("vehicle-photos")
    .upload(storagePath, bytes, { contentType: mime, cacheControl: "31536000", upsert: false });
  if (upErr) {
    await supabase.from("hero_render_jobs").update({ status: "failed", error: "storage_upload_failed" }).eq("id", job.id);
    return json({ success: false, error: "Failed to save render" }, 500);
  }

  const { data: pub } = supabase.storage.from("vehicle-photos").getPublicUrl(storagePath);
  const imageUrl = pub.publicUrl;

  const { data: photoRecord, error: insErr } = await supabase
    .from("vehicle_photos")
    .insert({
      vehicle_id: vehicleId,
      user_id: userId,
      team_id: teamId,
      storage_path: storagePath,
      url: imageUrl,
      photo_type: "exterior",
      display_order: 90 + attempt,
      is_visible: false,
      detected_angle: "front_quarter",
      source: "studio_render",
      generation_prompt: prompt,
      is_vehicle_confirmed: true,
      quality_score: 95,
      quality_issues: [],
      original_filename: `studio-hero-${vehicle.make}-${vehicle.model}-attempt${attempt}.${ext}`,
      file_size_bytes: bytes.length,
      mime_type: mime,
      analyzed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insErr) {
    console.error("insert error:", insErr);
    await supabase.from("hero_render_jobs").update({ status: "failed", error: "db_insert_failed" }).eq("id", job.id);
    return json({ success: false, error: "Failed to save photo record" }, 500);
  }

  // QC gate
  await supabase.from("hero_render_jobs").update({ status: "qc", render_photo_id: photoRecord.id }).eq("id", job.id);
  let qc: QcResult;
  try { qc = await review(renderImageUrl); }
  catch { qc = { pass: false, failures: [], notes: 'Quality review is unavailable. Current hero is unchanged.', pending: true }; }
  if (qc.pending) {
    await supabase.from('hero_render_jobs').update({ status: 'qc', review_state: 'waiting', qc_passed: false, error: qc.notes }).eq('id', job.id);
    return json({ success: false, reviewPending: true, error: qc.notes, attemptsUsed: attempt });
  }
  // Deterministic orientation gate — the vision reviewer can miss portrait output.
  const dims = imageDims(renderImageUrl);
  if (dims && dims.h >= dims.w) {
    qc.pass = false;
    qc.failures = Array.from(new Set([...(qc.failures ?? []), "wrong_orientation"]));
  }
  logTransfer({ team_id: teamId, user_id: userId, caller: "render-studio-hero-qc", model: aiModel("vision"), provider: aiProviderLabel(), provider_region: "United States / Global", response_bytes: 0, status: "ok" }).catch(() => {});

  if (!qc.pass) {
    const finalAttempt = attempt >= STUDIO_HERO_MAX_ATTEMPTS;
    await supabase
      .from("hero_render_jobs")
      .update({
        status: finalAttempt ? "escalated" : "failed",
        qc_passed: false,
        review_state: 'rejected',
        review_details: qc,
        qc_failure_reasons: qc.failures,
        error: qc.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (finalAttempt) {
      await escalate(supabase, teamId, vehicle, attempt);
    }

    return json({
      success: false,
      qcFailed: true,
      failures: qc.failures,
      escalated: finalAttempt,
      attemptsUsed: attempt,
      attemptsRemaining: Math.max(0, STUDIO_HERO_MAX_ATTEMPTS - attempt),
      error: finalAttempt
        ? "Render limit reached — Exotiq support has been notified"
        : "Render didn't pass quality check — you can re-render",
    });
  }

  const { error: reviewSaveError } = await supabase.from('hero_render_jobs').update({ qc_passed: true, review_state: 'passed', review_details: qc, qc_failure_reasons: [], mirrored_source: mirrored }).eq('id', job.id);
  if (reviewSaveError) return json({ success: false, error: 'Could not save quality review. Current hero is unchanged.' }, 500);
  const { error: promoteError } = await supabase.rpc('studio_promote_job', { _job_id: job.id, _actor_id: userId });
  if (promoteError) return json({ success: false, error: 'Could not promote reviewed photo. Current hero is unchanged.' }, 500);

  return json({
    success: true,
    imageUrl,
    photoId: photoRecord.id,
    attemptsUsed: attempt,
    attemptsRemaining: Math.max(0, STUDIO_HERO_MAX_ATTEMPTS - attempt),
    qcNotes: qc.notes,
  });
}

// 3rd failed run: notify Super Admins in-app + email the support desk.
async function escalate(
  supabase: Db,
  teamId: string,
  vehicle: { id: string; make: string; model: string; year?: number | null },
  attempts: number
) {
  const label = `${vehicle.year ? vehicle.year + " " : ""}${vehicle.make} ${vehicle.model}`;
  try {
    const { data: admins } = await supabase.from("super_admins").select("user_id");
    for (const admin of admins ?? []) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        type: "studio_hero_escalation",
        title: "Studio photo needs a hand",
        message: `${label} failed ${attempts} studio renders. Review and hand-finish the hero photo.`,
        ref: `/fleet/${vehicle.id}`,
      });
    }
  } catch (e) {
    console.error("escalation notification failed:", e);
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return;
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "Exotiq Studio <noreply@mail.exotiq.ai>",
      to: [STUDIO_HERO_ESCALATION_EMAIL],
      subject: `Studio hero needs help: ${label}`,
      html: `<p>The studio hero render for <strong>${label}</strong> (vehicle ${vehicle.id}, team ${teamId}) failed quality checks ${attempts} times.</p><p>Please review the renders in the Super Admin portal and hand-finish the hero photo for this vehicle.</p>`,
    });
  } catch (e) {
    console.error("escalation email failed:", e);
  }
}

// Reads width/height from a base64 PNG/JPEG/WebP data URL without decoding pixels.
function imageDims(dataUrl: string): { w: number; h: number } | null {
  try {
    const b64 = dataUrl.split(",")[1];
    if (!b64) return null;
    const bin = atob(b64.slice(0, 200000));
    const b = (i: number) => bin.charCodeAt(i);
    if (b(0) === 0x89 && b(1) === 0x50) return { w: (b(16) << 24) | (b(17) << 16) | (b(18) << 8) | b(19), h: (b(20) << 24) | (b(21) << 16) | (b(22) << 8) | b(23) };
    if (bin.slice(0, 4) === "RIFF" && bin.slice(12, 16) === "VP8X") return { w: 1 + (b(24) | (b(25) << 8) | (b(26) << 16)), h: 1 + (b(27) | (b(28) << 8) | (b(29) << 16)) };
    if (b(0) === 0xff && b(1) === 0xd8) {
      let i = 2;
      while (i < bin.length) {
        if (b(i) !== 0xff) return null;
        const m = b(i + 1), len = (b(i + 2) << 8) | b(i + 3);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b(i + 5) << 8) | b(i + 6), w: (b(i + 7) << 8) | b(i + 8) };
        i += 2 + len;
      }
    }
    return null;
  } catch { return null; }
}
