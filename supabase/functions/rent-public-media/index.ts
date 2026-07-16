// M3 (renter app public read plumbing): public-safe vehicle media delivery.
// Ref: docs/rent/RENTER_APP_GOAL.md milestone M3; exotiq-rent roadmap §3 task D.
//
// The vehicle-photos bucket is private and DB photo URLs are not publicly
// fetchable. This function lets the anonymous renter app obtain short-lived
// signed URLs (TTL <= 1 hour) for exactly the photos of one marketplace-
// visible vehicle. Visibility is re-validated server-side on every call via
// public.is_marketplace_vehicle; nothing else in the bucket is reachable.
//
// GET /rent-public-media?team=<teamSlug>&vehicle=<vehicleSlug>
// -> { photos: [{ signedUrl, thumbnailUrl, displayOrder }], expiresIn: 3600 }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_TTL_SECONDS = 3600;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const teamSlug = url.searchParams.get("team")?.trim() ?? "";
  const vehicleSlug = url.searchParams.get("vehicle")?.trim() ?? "";
  if (!teamSlug || !vehicleSlug) {
    return json({ error: "team and vehicle query params are required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve the vehicle and re-check marketplace eligibility server-side.
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id, slug, teams!inner(slug)")
    .eq("slug", vehicleSlug)
    .eq("teams.slug", teamSlug)
    .maybeSingle();

  if (vehicleError) {
    console.error("rent-public-media vehicle lookup failed", vehicleError);
    return json({ error: "Lookup failed" }, 500);
  }
  if (!vehicle) {
    return json({ error: "Not found" }, 404);
  }

  const { data: eligible, error: eligibleError } = await supabase.rpc(
    "is_marketplace_vehicle",
    { _vehicle_id: vehicle.id },
  );
  if (eligibleError) {
    console.error("rent-public-media eligibility check failed", eligibleError);
    return json({ error: "Lookup failed" }, 500);
  }
  if (!eligible) {
    return json({ error: "Not found" }, 404);
  }

  const { data: photos, error: photosError } = await supabase
    .from("vehicle_photos")
    .select("storage_path, thumbnail_url, display_order")
    .eq("vehicle_id", vehicle.id)
    .eq("is_visible", true)
    .eq("is_vehicle_confirmed", true)
    .order("display_order", { ascending: true, nullsFirst: false })
    .limit(24);

  if (photosError) {
    console.error("rent-public-media photos lookup failed", photosError);
    return json({ error: "Lookup failed" }, 500);
  }

  const paths = (photos ?? [])
    .map((p) => p.storage_path)
    .filter((p): p is string => Boolean(p));

  let signed: { path: string | null; signedUrl: string | null }[] = [];
  if (paths.length > 0) {
    const { data: signedData, error: signError } = await supabase.storage
      .from("vehicle-photos")
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error("rent-public-media signing failed", signError);
      return json({ error: "Signing failed" }, 500);
    }
    signed = signedData ?? [];
  }

  const byPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const result = (photos ?? [])
    .map((p) => ({
      signedUrl: p.storage_path ? byPath.get(p.storage_path) ?? null : null,
      thumbnailUrl: p.thumbnail_url,
      displayOrder: p.display_order,
    }))
    .filter((p) => p.signedUrl !== null);

  return json(
    { photos: result, expiresIn: SIGNED_URL_TTL_SECONDS },
    200,
  );
});
