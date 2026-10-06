// Studio Hero — versioned master prompt + QC checklist.
// Single source of truth for the ARK-style studio render pipeline.
// Bump STUDIO_HERO_PROMPT_VERSION whenever the prompt or checklist changes.

export const STUDIO_HERO_PROMPT_VERSION = "v1.2";

export const STUDIO_HERO_MASTER_PROMPT = `Restyle this exact vehicle into a premium dark automotive studio: textured matte charcoal backdrop with a soft radial falloff behind the car, seamless dark ceiling fade, no visible light fixtures or lightbox, no brick or cinderblock walls. Soft overhead diffused highlights along the shoulder line and hood. Polished dark floor with realistic contact shadows and subtle low-opacity reflections under the tires and sills. True 45-degree front driver-side three-quarter view from knee height, with the front of the car pointing toward the LEFT edge of the frame, wheels turned slightly toward camera. Landscape orientation. Car fills 75-80% of frame width, centered lower-middle with generous padding around it. STRICT: preserve the exact wheels, badges, grille, body kit, paint color and finish, brake calipers, and interior of the vehicle in the photo — do not invent, replace or restyle any vehicle detail.`;

// Appended to the master prompt when a QC check fails, keyed by failure code.
export const STUDIO_HERO_CORRECTIONS: Record<string, string> = {
  wrong_direction:
    "CRITICAL: the front of the car MUST point toward the LEFT edge of the frame. Mirror the composition horizontally if needed.",
  wrong_backdrop:
    "CRITICAL: the backdrop must be a seamless dark textured studio wall — absolutely no brick, cinderblock, windows, garage doors, or outdoor elements.",
  wrong_orientation:
    "CRITICAL: output must be landscape orientation (wider than tall), with the full car visible and generous padding on all sides.",
  wrong_framing:
    "CRITICAL: the car must fill 75-80% of the frame width, centered lower-middle, fully visible with padding around it.",
  detail_mismatch:
    "CRITICAL: preserve the exact wheels, badges, grille, body kit, paint color, calipers and interior from the source photo. Do not invent or restyle any vehicle detail.",
};

export const STUDIO_HERO_QC_CHECKLIST = `You are an automotive photography QC reviewer. Compare the RENDERED image against the SOURCE photo and answer in JSON only. A smooth dark studio gradient with a soft glow behind the car is the DESIRED look — that is a PASS, not a failure.

Check each item:
1. direction: front of the car points toward the LEFT edge of the frame (45-degree front three-quarter view).
2. backdrop: dark studio environment. PASS for any smooth/seamless dark backdrop including gradient or radial glow. FAIL only for clearly non-studio environments: brick or cinderblock walls, windows, garage doors, outdoor scenery, or visible light fixtures/lightbox.
3. orientation: landscape (wider than tall).
4. framing: car fully visible, roughly centered with padding, not tiny or cropped.
5. fidelity: the car is recognizably the same vehicle with the same paint color, wheel design, and body kit as the SOURCE. FAIL only for obvious changes: different paint color, clearly different wheel design, extra wheels, warped badges, or invented body panels. Minor lighting/reflection differences are fine.

Respond ONLY with JSON: {"pass": boolean, "failures": ["wrong_direction"|"wrong_backdrop"|"wrong_orientation"|"wrong_framing"|"detail_mismatch"], "notes": "one short sentence"}`;

export const STUDIO_HERO_MAX_ATTEMPTS = 3;
export const STUDIO_HERO_ESCALATION_EMAIL = "hello@exotiq.ai";
