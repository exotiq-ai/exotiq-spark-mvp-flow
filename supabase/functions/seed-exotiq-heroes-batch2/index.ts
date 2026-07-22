// One-shot seeder for 8 Exotiq vehicles missing proper hero images.
// Delete after use.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEAM_ID = "c1de6533-ab44-4973-a123-007a8007b5ba";

const TARGETS: Array<{ id: string; year: number; make: string; model: string; color?: string }> = [
  { id: "97178246-f4af-4aed-83a0-667b98407cb2", year: 2017, make: "Audi", model: "S8", color: "Daytona Gray" },
  { id: "a909a1f7-b055-4c51-a835-352f408ca879", year: 2024, make: "Mercedes-Benz", model: "AMG GT", color: "Obsidian Black" },
  { id: "57c3430c-78e8-476a-88a9-f0e8ad7c7ea6", year: 2024, make: "Porsche", model: "Panamera Turbo S", color: "Volcano Gray" },
  { id: "3f69130b-862b-463f-bd32-9af1a73b8afb", year: 2024, make: "Aston Martin", model: "DBX707", color: "Satin Xenon Grey" },
  { id: "1fb5a6af-e61f-435c-835d-8dad0fe72a40", year: 2024, make: "Audi", model: "R8 V10 Plus", color: "Suzuka Gray" },
  { id: "2ce57711-bb45-4945-83c1-113936e327e2", year: 2024, make: "Bugatti", model: "Chiron Sport", color: "Nocturne Black" },
  { id: "b4d6d8e5-270a-451f-8dd9-93ba9ca19864", year: 2024, make: "Ferrari", model: "296 GTB", color: "Rosso Corsa" },
  { id: "320a5c9b-cf81-4b94-b3ff-0c007bda0d4b", year: 2024, make: "McLaren", model: "720S Spider", color: "Papaya Orange" },
];

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function generateHero(v: typeof TARGETS[number], apiKey: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const prompt = `Editorial studio automotive photograph of a ${v.year} ${v.make} ${v.model} in ${v.color ?? "signature"} color. Front three-quarter angle, low camera height, seamless dark charcoal gradient background, soft rim lighting and clean specular highlights on the bodywork. Subtle contact shadow beneath the car. High-end commercial photography, photorealistic, ultra-sharp detail, pristine condition. No text, no watermarks, no people, no other cars.`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url?.startsWith("data:image")) throw new Error("no image in response");
  const [header, b64] = url.split(",");
  const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  return { bytes: b64ToBytes(b64), mime };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const apiKey = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const results: any[] = [];

  for (const v of TARGETS) {
    try {
      const { bytes, mime } = await generateHero(v, apiKey);
      const ext = mime.split("/")[1] ?? "jpg";
      const path = `${TEAM_ID}/generated/${v.id}/hero.${ext}`;
      const { error: upErr } = await supabase.storage.from("vehicle-photos").upload(path, bytes, {
        contentType: mime, cacheControl: "31536000", upsert: true,
      });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("vehicle-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("no signed url");

      await supabase.from("vehicle_photos").insert({
        vehicle_id: v.id,
        team_id: TEAM_ID,
        storage_path: path,
        url: signed.signedUrl,
        photo_type: "hero",
        detected_angle: "front_quarter",
        source: "generated",
        is_vehicle_confirmed: true,
        is_visible: true,
        quality_score: 95,
        quality_issues: [],
        original_filename: `hero-${v.make}-${v.model}.${ext}`.replace(/\s+/g, "-"),
        file_size_bytes: bytes.length,
        mime_type: mime,
        display_order: 0,
        analyzed_at: new Date().toISOString(),
      });
      await supabase.from("vehicles").update({ image_url: signed.signedUrl }).eq("id", v.id);
      results.push({ id: v.id, make: v.make, model: v.model, ok: true });
    } catch (e) {
      results.push({ id: v.id, make: v.make, model: v.model, ok: false, error: String(e) });
    }
  }
  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
