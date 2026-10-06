// Studio Hero — versioned master prompt + QC checklist.
// Single source of truth for the ARK-style studio render pipeline.
// Bump STUDIO_HERO_PROMPT_VERSION whenever the prompt or checklist changes.

export const STUDIO_HERO_PROMPT_VERSION = "v1.3";

export const STUDIO_HERO_MASTER_PROMPT = `Create a photorealistic premium automotive studio photograph of this EXACT vehicle. Replace the source environment and lighting, not the vehicle's identity. Every output must look photographed in the same fixed ARK studio, with the same neutral charcoal backdrop, polished floor, exposure and broad soft lighting. Vehicle paint must NEVER tint the studio background or floor.

STUDIO: a seamless neutral charcoal-gray cyclorama with understated fine matte texture and a gradual, broad tonal transition across the entire backdrop. Keep the floor-to-wall transition unobtrusive. No concentrated radial glow behind the car, bright halo, spotlight cone or pool, heavy vignette, crushed-black corners, colored light, brick, cinderblock, windows, doors, wall panels, visible ceiling, light fixtures or overhead lightbox. Do not reproduce the source photo's surroundings.

LIGHTING: use large diffused light sources outside the frame, broad soft overhead illumination and balanced soft side fill. Long smooth highlights follow the hood, roof and shoulder line; gentle fill reveals the grille, front bumper, wheels and side profile without flattening the paint finish. Preserve natural contrast and black paint separation without hard-edged glare, blown highlights or a theatrical spotlight. The car must feel evenly lit in a professional studio, not isolated in a bright pool of light. Never show or reflect a recognizable lightbox panel, fixture or lighting rig.

FLOOR: polished neutral charcoal, neither matte asphalt nor a mirror. Show a subtle, softly blurred, low-opacity reflection of the lower body, wheels and sills directly beneath the car, fading naturally with distance. Keep realistic soft contact shadows under the tires so the car sits firmly on the floor. No sharp duplicate car reflection, wet-floor effect, luminous floor patch or colored reflections spilling across the studio.

COMPOSITION: true 45-degree front driver-side three-quarter view from knee height. The front of the car points toward the LEFT edge of the frame. Wheels turned slightly toward camera without changing their design. Landscape orientation. The complete car fills 75-80% of frame width, centered lower-middle, with generous clear padding above and on both sides. Keep the entire front bumper, splitter, mirrors, roof and every tire inside the frame; leave floor visible below the tires and their reflection. No crop, collage, text, watermark or added graphics.

VEHICLE FIDELITY — highest priority: preserve exact body proportions, wheels and spoke design, badges and lettering, grille, body kit and aerodynamic parts, paint color and finish, brake calipers, glass and interior. Preserve the source's actual convertible roof state. Do not invent, replace, simplify or restyle vehicle details to achieve the camera angle. Studio consistency must come from the environment and lighting, never from altering the car.`;

// Appended to the master prompt when a QC check fails, keyed by failure code.
export const STUDIO_HERO_CORRECTIONS: Record<string, string> = {
  wrong_direction:
    "CRITICAL: the front of the car MUST point toward the LEFT edge of the frame. Mirror the composition horizontally if needed.",
  wrong_backdrop:
    "CRITICAL: use the fixed neutral charcoal-gray seamless studio, with a broad subtle tonal transition only. Remove color casts, concentrated radial glow, bright halo, wall panels and visible ceiling. Absolutely no light fixtures, lightbox, brick, cinderblock, windows, garage doors or outdoor elements.",
  wrong_lighting:
    "CRITICAL: replace theatrical spotlight lighting with broad, large-source diffused illumination and balanced soft side fill. Keep gentle long highlights and readable body details. No spotlight pool, bright halo, hard-edged glare, heavy vignette, clipped highlights or visible/reflected lighting rigs.",
  wrong_floor:
    "CRITICAL: use a polished neutral charcoal studio floor with a visible but subtle, softly blurred low-opacity reflection beneath the lower body, wheels and sills, plus soft tire contact shadows. Not a matte floor, sharp mirror duplicate, wet floor or bright spotlight patch.",
  wrong_orientation:
    "CRITICAL: output must be landscape orientation (wider than tall), with the full car visible and generous padding on all sides.",
  wrong_framing:
    "CRITICAL: the car must fill 75-80% of the frame width, centered lower-middle, fully visible with padding around it.",
  detail_mismatch:
    "CRITICAL: preserve the exact wheels, badges, grille, body kit, paint color, calipers and interior from the source photo. Do not invent or restyle any vehicle detail.",
};

export const STUDIO_HERO_QC_CHECKLIST = `You are an automotive photography QC reviewer. Compare the RENDERED image against the SOURCE photo for vehicle fidelity; assess the rendered environment against the fixed ARK studio standard below, NOT against the source environment. Answer in JSON only. A broad subtle charcoal tonal transition is acceptable; a concentrated spotlight halo is not. Judge obvious visual defects, not tiny pixel differences.

Check each item:
1. direction: front of the car points toward the LEFT edge of the frame (45-degree front three-quarter view).
2. backdrop: seamless neutral charcoal-gray studio with a broad subtle tonal transition. FAIL for obvious color casts, concentrated bright radial halos, wall panels, visible ceiling, brick or cinderblock walls, windows, garage doors, outdoor scenery, or visible light fixtures/lightbox. A gentle broad gradient is fine.
3. orientation: landscape (wider than tall).
4. framing: car fully visible, roughly centered, approximately 75-80% of frame width with padding. FAIL if any bumper, splitter, mirror, roof or tire is cut off, or the car is tiny. Floor and reflection must have space below the tires.
5. fidelity: the car is recognizably the same vehicle with the same paint color, wheel design, and body kit as the SOURCE. FAIL only for obvious changes: different paint color, clearly different wheel design, extra wheels, warped badges, or invented body panels. Minor lighting/reflection differences are fine.
6. lighting: broad soft studio illumination with balanced fill and smooth highlights. FAIL for a conspicuous spotlight cone/pool, strong halo, heavy vignette, hard glare, large blown highlights, or a recognizable lightbox/lighting rig reflected in the car. Natural paint-dependent highlight differences are fine.
7. floor: polished neutral charcoal with a subtle soft reflection beneath the car and realistic tire contact shadows. FAIL for a clearly matte floor with no reflection, a sharp mirror duplicate, wet-floor appearance or a bright localized floor pool. Do not demand an equally bright reflection from every paint color.
8. roof state: the rendered convertible roof must match the SOURCE's open or closed state; an obvious change is detail_mismatch.

Use wrong_lighting for lighting defects and wrong_floor for floor/reflection defects. pass must be false whenever any checklist item fails, with every failed item's code included.
Respond ONLY with JSON: {"pass": boolean, "failures": ["wrong_direction"|"wrong_backdrop"|"wrong_orientation"|"wrong_framing"|"detail_mismatch"|"wrong_lighting"|"wrong_floor"], "notes": "one short sentence"}`;

export const STUDIO_HERO_MAX_ATTEMPTS = 3;
export const STUDIO_HERO_ESCALATION_EMAIL = "hello@exotiq.ai";
