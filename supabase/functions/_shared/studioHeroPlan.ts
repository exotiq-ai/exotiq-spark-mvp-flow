// Studio Hero — pure planning helpers for the live render (render-studio-hero).
// No Deno globals and no network here, so the app's vitest suite can test them (src/test/studioHeroPlan.test.ts).

export type StudioPipeline = "v1" | "v2";

// STUDIO_HERO_PIPELINE=v1 switches the live render back to the single-photo v1.5 prompt without a redeploy.
// Anything else (including unset) runs v2: identity sheet + several reference photos + locked recipe + scored review.
export function studioPipeline(value: string | null | undefined): StudioPipeline {
  return (value ?? "").trim().toLowerCase() === "v1" ? "v1" : "v2";
}

export interface ClassifiedPhoto<T> {
  photo: T;
  kind: string;
  facing: string | null;
  paint: string | null;
  matchesListedColor: boolean | null;
}

// Kinds that may be the main source (the car the render is built from).
const MAIN_KINDS = ["exterior_front_quarter", "exterior_other"];
// Kinds that may add detail (wheels, badges, kit) as extra references.
const EXTRA_KINDS = ["exterior_front_quarter", "exterior_other", "rear", "detail"];

export const MAX_REFERENCE_PHOTOS = 4;

/**
 * Picks the main source and up to three extra references from classified photos (given best-first).
 * The main source is a front three-quarter view when there is one, else another full exterior view,
 * never a rear, detail, interior or collage. `mainId` lets Exotiq support choose the main photo.
 */
export function pickRenderReferences<T>(
  classified: ClassifiedPhoto<T>[],
  opts: { mainId?: string; idOf?: (photo: T) => string } = {},
): { main: ClassifiedPhoto<T> | null; extras: ClassifiedPhoto<T>[] } {
  let main: ClassifiedPhoto<T> | null = null;
  if (opts.mainId && opts.idOf) {
    main = classified.find((c) => opts.idOf!(c.photo) === opts.mainId) ?? null;
  } else {
    main = classified.find((c) => c.kind === MAIN_KINDS[0]) ??
      classified.find((c) => c.kind === MAIN_KINDS[1]) ??
      null;
  }
  if (!main) return { main: null, extras: [] };
  const extras = classified
    .filter((c) => c !== main && EXTRA_KINDS.includes(c.kind))
    .slice(0, MAX_REFERENCE_PHOTOS - 1);
  return { main, extras };
}

/**
 * How the reference photos are used (same split the benchmark validated):
 * the render gets the main photo plus at most two extras (the studio style image goes last),
 * the identity sheet and the review see up to three.
 */
export function renderReferenceSplit<T>(refs: T[]): { source: T; extras: T[]; review: T[] } {
  return { source: refs[0], extras: refs.slice(1, 3), review: refs.slice(0, 3) };
}

/** One correction paragraph per earlier failure code, looked up in order in the given dictionaries; no repeats. */
export function correctionsFor(codes: Iterable<string>, ...dictionaries: Record<string, string>[]): string[] {
  const out: string[] = [];
  for (const code of new Set(codes)) {
    const text = dictionaries.find((d) => Object.prototype.hasOwnProperty.call(d, code))?.[code];
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

/**
 * True for a photo of the actual car that can feed a studio render: never a studio render, never an
 * AI-invented image (the retired text-to-image hero saved these as front-quarter shots with a 95 score),
 * never an interior shot.
 */
export function isRealVehiclePhoto(p: {
  url?: string | null;
  source?: string | null;
  photo_type?: string | null;
  original_filename?: string | null;
}): boolean {
  if (!p.url) return false;
  if (["studio_render", "ai_generated", "generated"].includes(p.source ?? "")) return false;
  if (/studio-hero|ai-hero|generated/i.test(p.original_filename ?? "")) return false;
  return p.photo_type !== "interior";
}

/** Minimum shape of an identity sheet before a render may rely on it (same check as the benchmark). */
export function isValidIdentitySheet(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Boolean(v.wheels) && Boolean(v.paint) && Array.isArray(v.evidence);
}
