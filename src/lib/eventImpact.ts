/**
 * Client-side helpers for the event demand engine v2 payload (see supabase/functions/_shared/eventTaxonomy.ts).
 * The server decides every number; this file only reads, groups and explains them.
 * dayUplifts mirrors the server's overlap rule (strongest event in full, then 35%, then 15%, capped) so the
 * timeline shows the same figures pricing will use.
 */

export type SegmentKey = 'exotic' | 'sports' | 'luxury' | 'suv';
export const SEGMENT_KEYS: SegmentKey[] = ['exotic', 'sports', 'luxury', 'suv'];

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  exotic: 'Exotics',
  sports: 'Sports cars',
  luxury: 'Luxury',
  suv: 'SUVs',
};

/** Tailwind classes per segment (tokens already used elsewhere in the dashboard). */
export const SEGMENT_STYLE: Record<SegmentKey, { bar: string; text: string; soft: string }> = {
  exotic: { bar: 'bg-performance-orange', text: 'text-performance-orange', soft: 'bg-performance-orange/10' },
  sports: { bar: 'bg-gulf-blue', text: 'text-gulf-blue', soft: 'bg-gulf-blue/10' },
  luxury: { bar: 'bg-accent', text: 'text-accent', soft: 'bg-accent/10' },
  suv: { bar: 'bg-success', text: 'text-success', soft: 'bg-success/10' },
};

/** Lower-case phrase for sentences ("for SUVs"). */
export const SEGMENT_PHRASE: Record<SegmentKey, string> = {
  exotic: 'exotics',
  sports: 'sports cars',
  luxury: 'luxury cars',
  suv: 'SUVs',
};

export const AUDIENCE_LABELS: Record<string, string> = {
  'hnw-business': 'Business & collectors',
  'festival-group': 'Groups & festivals',
  'family-tourist': 'Families & visitors',
  'motorsport-auto': 'Car enthusiasts',
  'sports-fans': 'Game-day travel',
  'peak-season': 'Market-wide peak',
  'holiday-travel': 'Holiday travel',
};

/** Audience groups for the filter: who the event brings to town (replaces the old 7 event types). */
export interface AudienceGroup {
  id: string;
  label: string;
  hint: string;
  audiences: string[];
}
export const AUDIENCE_GROUPS: AudienceGroup[] = [
  { id: 'business', label: 'Business & collectors', hint: 'Conferences, art fairs, galas, golf and tennis hospitality', audiences: ['hnw-business'] },
  { id: 'groups', label: 'Groups & festivals', hint: 'Music festivals, big concerts, spring break', audiences: ['festival-group'] },
  { id: 'families', label: 'Families & visitors', hint: 'Theme parks, fairs, fan conventions, ski season', audiences: ['family-tourist'] },
  { id: 'auto', label: 'Car enthusiasts', hint: 'F1, IndyCar, NASCAR, car auctions and shows', audiences: ['motorsport-auto'] },
  { id: 'gameday', label: 'Game-day travel', hint: 'NFL, NBA, MLB, NHL, college', audiences: ['sports-fans'] },
  { id: 'peak', label: 'Peak seasons & holidays', hint: 'Art Basel week, New Year, long weekends', audiences: ['peak-season', 'holiday-travel'] },
];
export const groupOf = (e: ImpactEvent): string | null =>
  AUDIENCE_GROUPS.find((g) => e.audience && g.audiences.includes(e.audience))?.id ?? null;

/** Mirrors supabase/functions/_shared/eventTaxonomy.ts (a test keeps the two in sync). */
export const AUDIENCE_WEIGHTS: Record<string, Record<SegmentKey, number>> = {
  'hnw-business':    { exotic: 1.30, luxury: 1.10, suv: 0.90, sports: 0.70 },
  'festival-group':  { exotic: 0.80, luxury: 0.80, suv: 1.40, sports: 0.90 },
  'family-tourist':  { exotic: 0.80, luxury: 0.90, suv: 1.30, sports: 0.80 },
  'motorsport-auto': { exotic: 1.35, luxury: 0.80, suv: 0.70, sports: 1.20 },
  'sports-fans':     { exotic: 0.90, luxury: 1.00, suv: 1.20, sports: 0.90 },
  'peak-season':     { exotic: 1.15, luxury: 1.15, suv: 1.00, sports: 1.00 },
  'holiday-travel':  { exotic: 0.95, luxury: 1.00, suv: 1.15, sports: 0.90 },
};
export const SCALE_UPLIFT: Record<string, number> = { local: 0.04, regional: 0.10, national: 0.20, global: 0.30 };
export const MAX_BASE_UPLIFT = 0.30;
export const MAX_UPLIFT = 0.35;
export const SCALE_LABELS: Record<string, string> = {
  local: 'Local (under 10K people)',
  regional: 'Regional (10K to 50K)',
  national: 'National (50K to 200K)',
  global: 'Global (200K+)',
};

/**
 * Same vehicle-to-segment rules as the server (supabase/functions/_shared/eventTaxonomy.ts); a test keeps them identical.
 */
// Group-transport and utility vehicles price like SUVs (people, luggage, shuttling).
const SUV_MODEL = /\b(urus|cullinan|escalade|g[- ]?wagon|g ?(?:63|550|800|class)|range rover|velar|defender|bentayga|cayenne|macan|x[3-7]m?|xm|gl[sec] ?\d*[a-z]?|navigator|suburban|tahoe|yukon|durango|hummer|bronco|cybertruck|model [xy]|dbx ?\d*|purosangue|lx ?\d+|rx ?\d+|qx ?\d+|levante|countryman|cx-?\d+|kona|atlas|odyssey|sienna|tacoma|sprinter|v-class|ram|trx|q[5-8]|rsq8|suv|truck|van)\b/i;
const SUPER_MAKES = /^(ferrari|lamborghini|mclaren|bugatti|koenigsegg|pagani|lotus|rimac|fordgt)$/;
const EXOTIC_MODEL = /\b(vantage|db1[12]|dbs|valkyrie|vanquish|mc20|r8|911 (?:turbo|gt3|gt2)|gt3|gt2|huracan|aventador|revuelto|temerario|artura|720s|765lt|570s|600lt|650s|senna|speedtail|sf90|812|296|chiron|veyron|regera|jesko|amg one)\b/i;
const SPORTS_MODEL = /\b(corvette|camaro|mustang|challenger|charger|hellcat|supra|gr86|m[2-8]|amg gt|c63 ?s?|e63 ?s?|rs ?[3-7]|e-?tron gt|taycan|panamera|gt-?r|gt4|slingshot|spider|spyder|roadster|cabrio|convertible|plaid|f-?type|z4|i8)\b/i;

/**
 * Map a vehicle to its pricing segment. Order matters: group-transport/SUV first (a Lamborghini
 * Urus is bought like an SUV), then supercar makes, then named exotic models, Porsche, sports
 * cars, ultra-luxury marques, and finally the luxury default.
 */
export function classifyVehicleSegmentClient(make: unknown, model: unknown): SegmentKey {
  const mk = String(make ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const md = String(model ?? '').trim();
  const text = `${String(make ?? '')} ${md}`;

  if (mk === 'landrover') return 'suv';
  if (SUV_MODEL.test(text)) return 'suv';
  if (SUPER_MAKES.test(mk) || mk === 'astonmartin') return 'exotic';
  if (EXOTIC_MODEL.test(text)) return 'exotic';
  if (mk === 'porsche' || mk === 'mercedesamg' || mk === 'corvette') return 'sports';
  if (/^(rollsroyce|bentley|maybach|mercedesmaybach)$/.test(mk)) return 'luxury';
  if (SPORTS_MODEL.test(text)) return 'sports';
  return 'luxury';
}

export type EventTier = 'major' | 'notable' | 'routine';

/** How well we know an event is real (see the server's evidence ladder). */
export type Evidence = 'curated' | 'verified' | 'listed' | 'unconfirmed';
export const EVIDENCE_WEIGHT: Record<Evidence, number> = { curated: 1, verified: 1, listed: 0.5, unconfirmed: 0 };
export const EVIDENCE_LABELS: Record<Evidence, string> = {
  curated: 'Curated',
  verified: 'Verified',
  listed: 'Listed',
  unconfirmed: 'Unconfirmed',
};
export const EVIDENCE_HELP: Record<Evidence, string> = {
  curated: 'From our own maintained calendar of recurring events. Full weight in pricing.',
  verified: 'We opened the cited page and found this event near this date. Full weight in pricing.',
  listed: 'Found at a known venue with a source, but the page could not confirm it (blocked or script-built). Counts at half weight.',
  unconfirmed: 'No confirmation we can rely on. Shown for context, never used for pricing.',
};
/** Evidence for events from older snapshots that predate the field. */
export const evidenceOf = (e: ImpactEvent): Evidence =>
  e.evidence ?? (e.source === 'calendar' ? 'curated' : e.pricingEligible === false ? 'unconfirmed' : 'listed');

/**
 * A modeled percent shown as a 5-point range ("15-20%"), because the inputs do not justify a point value.
 */
export function pctRange(p: number): string {
  if (p < 3) return '<3%';
  if (p < 5) return '3-5%';
  const lo = Math.floor(p / 5) * 5;
  return `${lo}-${lo + 5}%`;
}

export interface ImpactEvent {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  category: string;
  attendance: number;
  impactScore: number;
  venue?: string;
  audience?: string;
  scale?: string;
  tier?: EventTier;
  evidence?: Evidence;
  pageStatus?: 'confirmed' | 'no-match' | 'unreachable' | 'no-source';
  /** Curated events: result of re-checking the official site for dates inside our window. */
  datesCheck?: 'confirmed' | 'no-match' | 'unreachable' | 'no-source';
  attendanceBasis?: 'estimate' | 'capacity' | 'curated';
  capacity?: number;
  potentialImpact?: Partial<Record<SegmentKey, number>>;
  /** False = shown for context, never used to price. */
  pricingEligible?: boolean;
  segmentImpact?: Partial<Record<SegmentKey, number>>;
  sourceUrls?: string[];
  source?: 'calendar' | 'ai';
}

export type SegmentMap = Partial<Record<SegmentKey, number>>;

/** Whole-number percent effect of a multiplier, e.g. 1.164 -> 16. */
export const pct = (m?: number) => Math.round(((m ?? 1) - 1) * 100);

export const eventTier = (e: ImpactEvent): EventTier => e.tier ?? 'notable';

export function strongestSegment(e: ImpactEvent): { key: SegmentKey; pct: number } | null {
  if (!e.segmentImpact) return null;
  let best: SegmentKey = SEGMENT_KEYS[0];
  for (const k of SEGMENT_KEYS) if ((e.segmentImpact[k] ?? 1) > (e.segmentImpact[best] ?? 1)) best = k;
  return { key: best, pct: pct(e.segmentImpact[best]) };
}

export const eventsOnDay = <T extends ImpactEvent>(events: T[], day: string) =>
  events.filter((e) => e.date <= day && (e.endDate ?? e.date) >= day);

const WEIGHTS = [1, 0.35, 0.15];

/** Fractional uplift per segment on one day, from confirmed events only. */
export function dayUplifts(events: ImpactEvent[], day: string): Record<SegmentKey, number> {
  const today = eventsOnDay(events, day).filter((e) => e.pricingEligible !== false);
  const out = { exotic: 0, sports: 0, luxury: 0, suv: 0 } as Record<SegmentKey, number>;
  for (const k of SEGMENT_KEYS) {
    const sorted = today.map((e) => (e.segmentImpact?.[k] ?? 1) - 1).filter((u) => u > 0).sort((a, b) => b - a);
    let total = 0;
    sorted.slice(0, WEIGHTS.length).forEach((u, i) => { total += u * WEIGHTS[i]; });
    out[k] = Math.min(MAX_UPLIFT, total);
  }
  return out;
}

export const maxUplift = (u: Record<SegmentKey, number>) => Math.max(...SEGMENT_KEYS.map((k) => u[k]));

export interface Headline {
  tone: 'quiet' | 'lift';
  text: string;
  detail?: string;
}

/** Plain-language read of the window, built from the server's numbers (no extra AI call). */
export function buildHeadline(segments: SegmentMap | null, events: ImpactEvent[], peakLabel: string | null): Headline {
  const ranked = SEGMENT_KEYS
    .map((k) => ({ k, p: pct(segments?.[k]) }))
    .sort((a, b) => b.p - a.p);
  const priced = events.filter((e) => e.pricingEligible !== false).length;
  if (!segments || ranked[0].p < 3) {
    return {
      tone: 'quiet',
      text: 'No strong event pressure in this window.',
      detail: priced ? `${priced} confirmed events, none large enough to move rates much.` : 'Rates can follow your base pricing.',
    };
  }
  const [a, b] = ranked;
  const second = b.p >= 3 && b.k !== a.k ? ` and +${pctRange(b.p)} for ${SEGMENT_PHRASE[b.k]}` : '';
  return {
    tone: 'lift',
    text: `Events can support roughly +${pctRange(a.p)} for ${SEGMENT_PHRASE[a.k]}${second}.`,
    detail: `${peakLabel ? `Strongest day ${peakLabel}. ` : ''}${priced} ${priced === 1 ? 'event counts' : 'events count'} toward pricing.`,
  };
}

/** 1,234 -> "1.2K", 299,600 -> "300K", 1,200,000 -> "1.2M". */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

const DAY_MS = 86_400_000;
const eventDays = (e: ImpactEvent) =>
  Math.max(1, Math.round((Date.parse(e.endDate ?? e.date) - Date.parse(e.date)) / DAY_MS) + 1);

/** Estimated people at events on one day: a multi-day event's attendance is spread over its days. */
export const dayAttendance = (events: ImpactEvent[], day: string) =>
  eventsOnDay(events, day).reduce((sum, e) => sum + (e.attendance || 0) / eventDays(e), 0);

/** Peak-day effect per segment across a window, from confirmed events (same rule pricing uses). */
export function windowPeaks(events: ImpactEvent[], days: string[]): Record<SegmentKey, number> {
  const out = { exotic: 0, sports: 0, luxury: 0, suv: 0 } as Record<SegmentKey, number>;
  for (const d of days) {
    const u = dayUplifts(events, d);
    for (const k of SEGMENT_KEYS) out[k] = Math.max(out[k], u[k]);
  }
  return out;
}

/** One-line explanation of a number, step by step, for the "How is this calculated?" disclosure. */
export function explainImpact(e: ImpactEvent, segment: SegmentKey): string[] {
  const evidence = evidenceOf(e);
  const potential = pct((e.potentialImpact ?? e.segmentImpact)?.[segment]);
  const used = pct(e.segmentImpact?.[segment]);
  const weight = AUDIENCE_WEIGHTS[e.audience ?? '']?.[segment];
  const days = Math.max(1, Math.round((Date.parse(e.endDate ?? e.date) - Date.parse(e.date)) / 86_400_000) + 1);
  const steps: string[] = [];
  if (e.source === 'calendar') {
    steps.push(`Size: a curated peak-season entry. Its market-wide premium was set by hand${weight ? `, about +${Math.round(potential / weight)}%` : ''}.`);
  } else {
    const base = SCALE_UPLIFT[e.scale ?? ''];
    steps.push(`Size: ${SCALE_LABELS[e.scale ?? ''] ?? 'unknown size'}${base != null ? ` gives a base of +${Math.round(base * 100)}%` : ''}.`);
  }
  if (weight != null) {
    steps.push(`Who comes: ${AUDIENCE_LABELS[e.audience ?? ''] ?? e.audience} pull ${SEGMENT_PHRASE[segment]} at ${weight.toFixed(2)}x the average.`);
  }
  if (e.source !== 'calendar') {
    steps.push(`Length: ${days} ${days === 1 ? 'day' : 'days'} counts ${days <= 1 ? 'half' : days === 2 ? '80%' : 'in full'}.`);
  }
  steps.push(`Modeled effect if the event is real: about +${potential}% for ${SEGMENT_PHRASE[segment]} (never more than +${Math.round(MAX_UPLIFT * 100)}% in total).`);
  if (evidence === 'listed') steps.push(`Evidence: listed at a venue but not verified on its page, so it counts at half weight: +${used}% is used for pricing.`);
  else if (evidence === 'unconfirmed') steps.push('Evidence: unconfirmed, so it is not used for pricing.');
  else steps.push(`Evidence: ${EVIDENCE_LABELS[evidence].toLowerCase()}, full weight: +${used}% is used for pricing.`);
  return steps;
}

/** One sentence about the date check of a curated event, or null when it was not checked. */
export function datesCheckNote(e: ImpactEvent): string | null {
  if (e.source !== 'calendar' || !e.datesCheck) return null;
  switch (e.datesCheck) {
    case 'confirmed': return 'Dates re-checked on the official site: they fall inside this window.';
    case 'no-match': return 'The official site does not show dates inside this window yet. The window is our standing estimate of when it usually runs.';
    case 'unreachable': return 'The official site could not be reached for a date check. The window is our standing estimate.';
    default: return null;
  }
}
