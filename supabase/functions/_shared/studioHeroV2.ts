// Studio Hero v2 — two-stage pipeline: Vehicle Identity Sheet + Locked Studio Recipe.
// Bump STUDIO_RECIPE_VERSION on any change; a version only goes live after
// benchmarking at least as well as the current one (studio-hero-benchmark).
import { STUDIO_HERO_MASTER_PROMPT } from "./studioHero.ts";

export const STUDIO_RECIPE_VERSION = "v2.1";

export const IDENTITY_SHEET_PROMPT = `You are an automotive expert cataloguing ONE specific vehicle from several photos of it. Describe only what is visible; use null when unsure. Ignore surroundings and interior color when describing exterior paint. Respond ONLY with JSON:
{
 "make": string, "model": string, "trim_or_package": string|null,
 "body_style": string, "roof_state": "closed"|"open"|"fixed"|null,
 "paint": {"color": string, "finish": "gloss"|"matte"|"satin"|"metallic"|"pearl"|null, "accents": string|null},
 "wheels": {"spoke_count": number|null, "style": string, "finish": string, "center_caps": string|null, "tire_sidewall": string|null},
 "brake_calipers": string|null,
 "badges_and_lettering": [string],
 "grille": string, "headlights": string, "mirrors": string,
 "body_kit_and_aero": [string],
 "window_tint": string|null,
 "distinctive_features": [string]
}`;

export function identitySheetToText(sheet: Record<string, unknown>): string {
  return `VEHICLE IDENTITY SHEET (ground truth — every item must appear exactly as described):\n${JSON.stringify(sheet, null, 1)}`;
}

// Locked camera/lighting recipe appended to the v1.5 master studio prompt.
export const LOCKED_RECIPE = `LOCKED CAMERA RECIPE (identical for every vehicle): full-frame camera, 50mm lens equivalent, f/8, camera at knee height (about 60cm), positioned at the front driver-side corner so the car is seen at a true 45-degree three-quarter angle, front pointing to the LEFT edge of frame. 3:2 landscape.
LOCKED LIGHT RECIPE: broad, even, soft illumination whose sources are NEVER visible — no ceiling, no light panels, softboxes, strips or fixtures anywhere in frame or reflected as rectangles in the paint. The top of the frame fades to near-black. Same exposure every time.
IMAGES: FIRST image = main source photo of the exact car. Any following images before the last = extra reference photos of the SAME car (use them for wheels, badges, kit details). LAST image = fixed studio STYLE REFERENCE (environment only).`;

export function buildV2Prompt(sheet: Record<string, unknown>, corrections: string[] = []): string {
  return [STUDIO_HERO_MASTER_PROMPT, LOCKED_RECIPE, identitySheetToText(sheet), ...corrections].join("\n\n");
}

export const QC_V2_PROMPT = `You are a strict automotive photography QC reviewer. You get: the VEHICLE IDENTITY SHEET (text), one or more SOURCE photos of the real car, then the RENDER, then the STUDIO STYLE REFERENCE (last image).
Check the RENDER item by item against the identity sheet and source photos: wheel spoke count/style/finish, calipers, badges, grille, headlights, mirrors, body kit/aero, paint color/finish, roof state. Then check studio match to the style reference (dark charcoal room, faint masonry, dark concrete floor with soft sheen, no colored glow, no visible lights), direction (front points LEFT, 45-degree front three-quarter), landscape, car fully in frame ~75-80% width.
Scores 0-10: fidelity (vehicle matches) and studio (environment/lighting/composition match).
pass = true only if fidelity >= 8, studio >= 7 and no failures.
Respond ONLY with JSON: {"pass": boolean, "fidelity": number, "studio": number, "failures": ["wrong_wheels"|"detail_mismatch"|"paint_mismatch"|"wrong_direction"|"wrong_backdrop"|"wrong_lighting"|"wrong_floor"|"wrong_orientation"|"wrong_framing"], "notes": "one short sentence naming the specific mismatched items"}`;

export const V2_CORRECTIONS: Record<string, string> = {
  wrong_wheels: "CRITICAL: the wheels must exactly match the identity sheet and extra reference photos — same spoke count, spoke shape, finish and center caps. Do not redesign the wheels.",
};

// Image models eligible for benchmarking (chat-completions image output).
export const BENCHMARK_MODELS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image",
];
