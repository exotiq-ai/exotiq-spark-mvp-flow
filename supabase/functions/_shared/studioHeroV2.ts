// Studio Hero v2 — two-stage pipeline: Vehicle Identity Sheet + Locked Studio Recipe.
// Bump STUDIO_RECIPE_VERSION on any change; a version only goes live after
// benchmarking at least as well as the current one (studio-hero-benchmark).
import { STUDIO_HERO_MASTER_PROMPT } from "./studioHero.ts";

export const STUDIO_RECIPE_VERSION = "v2.3";

export const IDENTITY_SHEET_PROMPT = `You are an automotive expert cataloguing ONE specific vehicle from several photos of it. Describe only what is visible; use null when unsure. Ignore surroundings and interior color when describing exterior paint. Respond ONLY with JSON:
{
 "make": string, "model": string, "trim_or_package": string|null,
 "body_style": string, "roof_state": "closed"|"open"|"fixed"|null,
 "paint": {"color": string, "finish": "gloss"|"matte"|"satin"|"metallic"|"pearl"|null, "accents": string|null},
 "wheels": {"spoke_count": number|null, "perimeter_opening_count": number|null, "face_geometry": string, "style": string, "finish": string, "center_caps": string|null, "tire_sidewall": string|null},
 "brake_calipers": string|null,
 "badges_and_lettering": [string],
 "grille": string, "headlights": string, "mirrors": string,
 "body_kit_and_aero": [string],
 "window_tint": string|null,
 "distinctive_features": [string],
 "evidence": [{"detail": string, "source_image_numbers": [number], "confidence": "high"|"medium"|"low", "observation": string}]
 }
For wheels, distinguish a solid disc/dish from a spoke wheel: a solid dish has spoke_count null, not an opening count masquerading as spokes. Count only visible openings; use null rather than guessing hidden geometry. Describe the broad face, perimeter openings, center cap and finish precisely. Record material and finish separately for grille slats, lower bumper mesh and surrounds. Cite source image numbers and uncertainty for wheels, bumper materials, badges, paint and roof. Do not infer a standard factory detail from the vehicle model.`;

export function identitySheetToText(sheet: Record<string, unknown>): string {
  return `VEHICLE IDENTITY SHEET (ground truth — every item must appear exactly as described):\n${JSON.stringify(sheet, null, 1)}`;
}

// Locked camera/lighting recipe appended to the v1.5 master studio prompt.
export const LOCKED_RECIPE = `LOCKED CAMERA RECIPE (identical for every vehicle): full-frame camera, 50mm lens equivalent, f/8, camera at knee height (about 60cm), positioned at the front driver-side corner so the car is seen at a true 45-degree three-quarter angle. Absolute frame layout: front bumper, grille and headlights in the LEFT third; rear body recedes toward the RIGHT third. Car travels right to left. Reconstruct this viewpoint from the references; do not retain a right-facing source composition or mirror badges and lettering. Frame slightly downward with the ceiling entirely outside the picture. Full car at 75-80% width, generous tire/reflection clearance. 3:2 landscape.
LOCKED LIGHT RECIPE: broad, even, soft off-camera illumination and balanced side fill. No ceiling, light panels, softboxes, strips or fixtures anywhere in frame or reflected as rectangles in the paint. The upper 20% is unobstructed near-black wall, not a ceiling or a lighting rig. Same neutral exposure every time. No spotlight pool, halo or colored glow. The dark smooth concrete floor has a soft, low-opacity reflection beneath the wheels and lower body, not a sharp mirror image.
IMAGES: FIRST image = main source photo of the exact car. Any following images before the last = extra reference photos of the SAME car (use them for wheels, badges, kit details). LAST image = fixed studio STYLE REFERENCE (environment only).`;

export function buildV2Prompt(sheet: Record<string, unknown>, corrections: string[] = []): string {
  // Remove conflicting v1 image numbering and lighting language in the benchmark only.
  const master = STUDIO_HERO_MASTER_PROMPT
    .replace("The SECOND image", "The LAST image")
    .replace("large soft overhead key light and gentle side fill, out of frame", "broad soft off-camera illumination and balanced gentle side fill");
  return [master, LOCKED_RECIPE, identitySheetToText(sheet), ...corrections].join("\n\n");
}

export const QC_V2_PROMPT = `You are a strict automotive photography QC reviewer. You get: the VEHICLE IDENTITY SHEET (text), one or more SOURCE photos of the real car, then the RENDER, then the STUDIO STYLE REFERENCE (last image).
Check the RENDER item by item against the identity sheet and source photos: wheel spoke count/style/finish, calipers, badges, grille, headlights, mirrors, body kit/aero, paint color/finish, roof state. Then check studio match to the style reference (dark charcoal room, faint masonry, dark concrete floor with soft sheen, no colored glow, no visible lights), direction (front points LEFT, 45-degree front three-quarter), landscape, car fully in frame ~75-80% width.
Scores 0-10: fidelity (vehicle matches) and studio (environment/lighting/composition match).
pass = true only if fidelity >= 8, studio >= 7 and no failures.
The subtle floor reflection MUST be visible beneath the lower body and wheels; an entirely matte floor fails reflection. Wall masonry must be barely perceptible, not a prominent brick wall. Inspect lower bumper mesh material separately from its chrome surround. Fail lighting for any ceiling seam, panel, lightbox or recognizable rig. For each check use true only when verified; unknown means false. Every false check must also have a matching failure code. Scores cannot excuse individual defects.
Respond ONLY with JSON: {"pass": boolean, "fidelity": number, "studio": number, "checks": {"direction": boolean, "wheels": boolean, "bumper_materials": boolean, "badges": boolean, "paint": boolean, "roof": boolean, "framing": boolean, "wall": boolean, "lighting": boolean, "reflection": boolean}, "failures": ["wrong_wheels"|"detail_mismatch"|"paint_mismatch"|"wrong_direction"|"wrong_backdrop"|"wrong_lighting"|"wrong_floor"|"wrong_orientation"|"wrong_framing"], "notes": "one short sentence naming the specific mismatched items"}`;

export const V2_CORRECTIONS: Record<string, string> = {
  wrong_wheels: "CRITICAL: the wheels must exactly match the identity sheet and extra reference photos — same spoke count, spoke shape, finish and center caps. Do not redesign the wheels.",
};

// Image models eligible for benchmarking (chat-completions image output).
export const BENCHMARK_MODELS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image",
];
