import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { logTransfer } from "../_shared/transferGuard.ts";
import {
  STUDIO_HERO_PROMPT_VERSION,
  STUDIO_HERO_MASTER_PROMPT,
  STUDIO_HERO_CORRECTIONS,
  STUDIO_HERO_QC_CHECKLIST,
  STUDIO_HERO_MAX_ATTEMPTS,
  STUDIO_HERO_ESCALATION_EMAIL,
} from "../_shared/studioHero.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RENDER_MODEL = "google/gemini-2.5-flash-image"; // Nano Banana
const QC_MODEL = "google/gemini-2.5-flash";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

// Mirror an image horizontally (so a right-facing car faces left).
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
    let bin = "";
    const bytes = new Uint8Array(out);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { dataUrl: `data:${mime};base64,${btoa(bin)}`, mirrored: true };
  } catch (e) {
    console.warn("mirror failed, using original:", e);
    return { dataUrl, mirrored: false };
  }
}

interface QcResult {
  pass: boolean;
  failures: string[];
  notes?: string;
}

async function runQc(
  apiKey: string,
  sourceDataUrl: string,
  renderDataUrl: string
): Promise<QcResult> {
  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: QC_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: STUDIO_HERO_QC_CHECKLIST + "\n\nFirst image is the SOURCE photo, second image is the RENDER." },
            { type: "image_url", image_url: { url: sourceDataUrl } },
            { type: "image_url", image_url: { url: renderDataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error("QC call failed:", res.status, await res.text());
    // QC unavailable: fail open (treat as pass) so a QC outage never blocks heroes.
    return { pass: true, failures: [], notes: "qc_unavailable_fail_open" };
  }
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { pass: true, failures: [], notes: "qc_unparseable_fail_open" };
    const parsed = JSON.parse(match[0]);
    return {
      pass: Boolean(parsed.pass),
      failures: Array.isArray(parsed.failures) ? parsed.failures.map(String) : [],
      notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
    };
  } catch {
    return { pass: true, failures: [], notes: "qc_parse_error_fail_open" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { vehicleId, teamId: bodyTeamId } = await req.json();
    if (!vehicleId) return json({ success: false, error: "vehicleId is required" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return json({ success: false, error: "Service not configured" }, 500);
    }

    // Authenticated caller required (paid AI + service-role writes).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Authentication required" }, 401);
    const authClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await authClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    const userId = userData?.user?.id;
    if (userError || !userId) return json({ success: false, error: "Authentication required" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load vehicle + team, verify membership
    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles")
      .select("id, team_id, make, model, year, color")
      .eq("id", vehicleId)
      .single();
    if (vErr || !vehicle) return json({ success: false, error: "Vehicle not found" }, 404);
    const teamId = vehicle.team_id ?? bodyTeamId;

    const { data: membership } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return json({ success: false, error: "Not a member of this team" }, 403);

    const { data: team } = await supabase
      .from("teams")
      .select("id, name, slug, studio_hero_opt_out")
      .eq("id", teamId)
      .single();
    if (team?.studio_hero_opt_out) {
      return json({ success: false, error: "Studio hero renders are disabled for this team" }, 400);
    }

    // Enforce the 3-render cap
    const { count: attemptCount } = await supabase
      .from("hero_render_jobs")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId);
    const attempt = (attemptCount ?? 0) + 1;
    if (attempt > STUDIO_HERO_MAX_ATTEMPTS) {
      return json(
        { success: false, error: "Render limit reached — Exotiq support has been notified", escalated: true },
        400
      );
    }

    // Pick the best source photo: front_quarter first, highest quality
    const { data: candidates } = await supabase
      .from("vehicle_photos")
      .select("id, url, detected_angle, quality_score, source")
      .eq("vehicle_id", vehicleId)
      .neq("source", "studio_render")
      .order("quality_score", { ascending: false });
    const photos = candidates ?? [];
    const source =
      photos.find((p) => p.detected_angle === "front_quarter") ??
      photos.find((p) => p.detected_angle === "front") ??
      photos[0];
    if (!source?.url) {
      return json(
        { success: false, error: "Add a 45° front driver-side photo first", needsSourcePhoto: true },
        400
      );
    }

    // Prior failures steer this attempt's prompt
    const { data: priorJobs } = await supabase
      .from("hero_render_jobs")
      .select("qc_failure_reasons")
      .eq("vehicle_id", vehicleId)
      .eq("status", "failed");
    const priorFailures = new Set<string>();
    (priorJobs ?? []).forEach((j) => (j.qc_failure_reasons ?? []).forEach((f) => priorFailures.add(f)));
    let prompt = STUDIO_HERO_MASTER_PROMPT;
    priorFailures.forEach((f) => {
      if (STUDIO_HERO_CORRECTIONS[f]) prompt += "\n\n" + STUDIO_HERO_CORRECTIONS[f];
    });

    // Create the job row
    const { data: job, error: jobErr } = await supabase
      .from("hero_render_jobs")
      .insert({
        vehicle_id: vehicleId,
        team_id: teamId,
        source_photo_id: source.id,
        status: "rendering",
        attempt_number: attempt,
        prompt_version: STUDIO_HERO_PROMPT_VERSION,
        prompt_used: prompt,
      })
      .select()
      .single();
    if (jobErr || !job) return json({ success: false, error: "Failed to create render job" }, 500);

    // Fetch source image; mirror if the car faces right (source facing unknown →
    // rely on prompt + QC; we mirror only when analysis marked it rear/right-ish)
    let sourceDataUrl = await fetchAsDataUrl(source.url);
    if (!sourceDataUrl) {
      await supabase.from("hero_render_jobs").update({ status: "failed", error: "source_fetch_failed" }).eq("id", job.id);
      return json({ success: false, error: "Could not load the source photo" }, 500);
    }
    let mirrored = false;
    if (source.detected_angle === "rear_quarter" || source.detected_angle === "side_right") {
      const m = await mirrorDataUrl(sourceDataUrl);
      sourceDataUrl = m.dataUrl;
      mirrored = m.mirrored;
    }

    // Render via Nano Banana (edit-style: source photo as reference)
    const renderRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: RENDER_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: sourceDataUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      console.error("render error:", renderRes.status, errText);
      await supabase.from("hero_render_jobs").update({ status: "failed", error: `render_${renderRes.status}` }).eq("id", job.id);
      logTransfer({ team_id: teamId, user_id: userId, caller: "render-studio-hero", model: RENDER_MODEL, provider: "Google (Gemini Image via Lovable AI Gateway)", provider_region: "United States / Global", response_bytes: 0, status: "error" }).catch(() => {});
      if (renderRes.status === 429) return json({ success: false, error: "Rate limit exceeded. Please try again later." }, 429);
      if (renderRes.status === 402) return json({ success: false, error: "AI credits exhausted. Please add funds." }, 402);
      return json({ success: false, error: "Studio render failed" }, 500);
    }

    const renderData = await renderRes.json();
    const images = renderData.choices?.[0]?.message?.images;
    const renderImageUrl: string | undefined = images?.[0]?.image_url?.url;
    logTransfer({ team_id: teamId, user_id: userId, caller: "render-studio-hero", model: RENDER_MODEL, provider: "Google (Gemini Image via Lovable AI Gateway)", provider_region: "United States / Global", response_bytes: renderImageUrl?.length ?? 0, status: "ok" }).catch(() => {});

    if (!renderImageUrl?.startsWith("data:image")) {
      await supabase.from("hero_render_jobs").update({ status: "failed", error: "no_image_returned" }).eq("id", job.id);
      return json({ success: false, error: "No image generated" }, 500);
    }

    // QC gate
    await supabase.from("hero_render_jobs").update({ status: "qc" }).eq("id", job.id);
    const qc = await runQc(LOVABLE_API_KEY, sourceDataUrl, renderImageUrl);
    logTransfer({ team_id: teamId, user_id: userId, caller: "render-studio-hero-qc", model: QC_MODEL, provider: "Google (Gemini via Lovable AI Gateway)", provider_region: "United States / Global", response_bytes: 0, status: "ok" }).catch(() => {});

    if (!qc.pass) {
      const finalAttempt = attempt >= STUDIO_HERO_MAX_ATTEMPTS;
      await supabase
        .from("hero_render_jobs")
        .update({
          status: finalAttempt ? "escalated" : "failed",
          qc_passed: false,
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

    // QC passed — upload render and promote to hero
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

    // Demote existing heroes, then insert the studio hero at display_order 0
    await supabase.from("vehicle_photos").update({ photo_type: "exterior" }).eq("vehicle_id", vehicleId).eq("photo_type", "hero");
    await supabase
      .from("vehicle_photos")
      .update({ display_order: 1 })
      .eq("vehicle_id", vehicleId)
      .eq("display_order", 0);

    const { data: photoRecord, error: insErr } = await supabase
      .from("vehicle_photos")
      .insert({
        vehicle_id: vehicleId,
        user_id: userId,
        team_id: teamId,
        storage_path: storagePath,
        url: imageUrl,
        photo_type: "hero",
        display_order: 0,
        detected_angle: "front_quarter",
        source: "studio_render",
        generation_prompt: prompt,
        is_vehicle_confirmed: true,
        quality_score: 95,
        quality_issues: [],
        original_filename: `studio-hero-${vehicle.make}-${vehicle.model}.${ext}`,
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

    await supabase.from("vehicles").update({ image_url: imageUrl }).eq("id", vehicleId);
    await supabase
      .from("hero_render_jobs")
      .update({
        status: "passed",
        qc_passed: true,
        render_photo_id: photoRecord.id,
        mirrored_source: mirrored,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return json({
      success: true,
      imageUrl,
      photoId: photoRecord.id,
      attemptsUsed: attempt,
      attemptsRemaining: Math.max(0, STUDIO_HERO_MAX_ATTEMPTS - attempt),
      qcNotes: qc.notes,
    });
  } catch (error) {
    console.error("render-studio-hero error:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// 3rd failed run: notify Super Admins in-app + email the support desk.
async function escalate(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
  vehicle: { id: string; make: string; model: string; year?: number },
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
        link: `/fleet/${vehicle.id}`,
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
      from: "Exotiq Studio <noreply@exotiq.ai>",
      to: [STUDIO_HERO_ESCALATION_EMAIL],
      subject: `Studio hero needs help: ${label}`,
      html: `<p>The studio hero render for <strong>${label}</strong> (vehicle ${vehicle.id}, team ${teamId}) failed quality checks ${attempts} times.</p><p>Please review the renders in the Super Admin portal and hand-finish the hero photo for this vehicle.</p>`,
    });
  } catch (e) {
    console.error("escalation email failed:", e);
  }
}
