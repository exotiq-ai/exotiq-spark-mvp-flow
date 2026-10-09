/**
 * Event demand taxonomy (v2).
 *
 * The old engine classified an event by TYPE (concert, sport, ...) and gave it one
 * market-wide score. Pricing needs the opposite: WHO an event brings to town and
 * WHICH vehicles they rent. This module is pure (no Deno or network imports) so it
 * can be unit-tested and shared by the edge functions.
 *
 *   event  -> audience + scale  -> per-segment uplift  -> per-segment multiplier
 *
 * All numbers here are first-pass judgement values. They are meant to be calibrated
 * against the operator's own booking history (see docs: TODO section A, step 6).
 */

export const SEGMENTS = ['exotic', 'sports', 'luxury', 'suv'] as const;
export type Segment = typeof SEGMENTS[number];

export const AUDIENCES = [
  'hnw-business',    // collectors, executives, investors (art fairs, crypto/finance conferences)
  'festival-group',  // groups, luggage, shuttling (music festivals, spring break)
  'family-tourist',  // families and visitors (theme parks, fan conventions, fairs)
  'motorsport-auto', // car people (F1, Barrett-Jackson, endurance racing)
  'sports-fans',     // game-day travel (NFL, NBA, MLB, college)
  'peak-season',     // market-wide luxury peak (Art Basel week, New Year's)
  'holiday-travel',  // general holiday travel
] as const;
export type Audience = typeof AUDIENCES[number];

export const SCALES = ['local', 'regional', 'national', 'global'] as const;
export type Scale = typeof SCALES[number];

/** Relative pull of each audience on each vehicle segment (1.0 = average pull). */
export const AUDIENCE_WEIGHTS: Record<Audience, Record<Segment, number>> = {
  'hnw-business':    { exotic: 1.30, luxury: 1.10, suv: 0.90, sports: 0.70 },
  'festival-group':  { exotic: 0.80, luxury: 0.80, suv: 1.40, sports: 0.90 },
  'family-tourist':  { exotic: 0.80, luxury: 0.90, suv: 1.30, sports: 0.80 },
  'motorsport-auto': { exotic: 1.35, luxury: 0.80, suv: 0.70, sports: 1.20 },
  'sports-fans':     { exotic: 0.90, luxury: 1.00, suv: 1.20, sports: 0.90 },
  'peak-season':     { exotic: 1.15, luxury: 1.15, suv: 1.00, sports: 1.00 },
  'holiday-travel':  { exotic: 0.95, luxury: 1.00, suv: 1.15, sports: 0.90 },
};

/** Peak uplift for an event of a given reach when no explicit calendar surge is known. */
export const SCALE_UPLIFT: Record<Scale, number> = {
  local: 0.04,
  regional: 0.10,
  national: 0.20,
  global: 0.30,
};

/**
 * Hard ceilings. Until the numbers are calibrated on real bookings they stay conservative:
 * no single event's base effect above +30%, and no combined segment effect above +35%.
 */
export const MAX_BASE_UPLIFT = 0.30;
export const MAX_UPLIFT = 0.35;

export const isSegment = (v: unknown): v is Segment => (SEGMENTS as readonly string[]).includes(String(v));
export const isAudience = (v: unknown): v is Audience => (AUDIENCES as readonly string[]).includes(String(v));
export const isScale = (v: unknown): v is Scale => (SCALES as readonly string[]).includes(String(v));

/** Scale from attendance when the source did not say. */
export function scaleFromAttendance(attendance: number): Scale {
  if (attendance >= 200_000) return 'global';
  if (attendance >= 50_000) return 'national';
  if (attendance >= 10_000) return 'regional';
  return 'local';
}

/**
 * The scale the model claims is capped by what the attendance supports (models call every
 * arena game "national"), and an unknown attendance never earns more than "regional".
 */
export function effectiveScale(claimed: Scale, attendance: number): Scale {
  const ceiling: Scale = attendance > 0 ? scaleFromAttendance(attendance) : 'regional';
  return SCALES.indexOf(ceiling) < SCALES.indexOf(claimed) ? ceiling : claimed;
}

/** A single night moves rentals far less than a weekend: visitors stay longer for multi-day events. */
export function durationFactor(date: string, endDate?: string): number {
  const days = Math.max(1, Math.round((Date.parse(endDate ?? date) - Date.parse(date)) / 86_400_000) + 1);
  if (days <= 1) return 0.5;
  if (days === 2) return 0.8;
  return 1;
}

/** Best guess at the audience from the legacy category (used only when nothing better is known). */
export function audienceFromCategory(category: string): Audience {
  switch (category) {
    case 'festivals':
    case 'concerts':
      return 'festival-group';
    case 'sports':
      return 'sports-fans';
    case 'conferences':
    case 'performing-arts':
      return 'hnw-business';
    case 'expos':
      return 'family-tourist';
    default:
      return 'holiday-travel';
  }
}

// ---------------------------------------------------------------------------
// Vehicle segment
// ---------------------------------------------------------------------------

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
export function classifyVehicleSegment(make: unknown, model: unknown): Segment {
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

// ---------------------------------------------------------------------------
// Impact model
// ---------------------------------------------------------------------------

export type SegmentImpact = Record<Segment, number>;

/** Uplift for an event: calendar events use their explicit surge, others use their reach. */
export function baseUplift(scale: Scale, calendarSurge?: number | null): number {
  if (typeof calendarSurge === 'number' && Number.isFinite(calendarSurge) && calendarSurge > 1) {
    return Math.min(MAX_BASE_UPLIFT, calendarSurge - 1);
  }
  return Math.min(MAX_BASE_UPLIFT, SCALE_UPLIFT[scale]);
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Per-segment multipliers for ONE event (1.0 = no effect). */
export function segmentImpactFor(
  audience: Audience,
  scale: Scale,
  calendarSurge?: number | null,
  /** 1 for calendar entries (their surge is already a peak-window figure); see durationFactor for AI events. */
  duration = 1,
): SegmentImpact {
  const uplift = baseUplift(scale, calendarSurge) * duration;
  const weights = AUDIENCE_WEIGHTS[audience];
  const out = {} as SegmentImpact;
  for (const seg of SEGMENTS) {
    out[seg] = round3(1 + Math.min(MAX_UPLIFT, uplift * weights[seg]));
  }
  return out;
}

/** Legacy 0-100 score for the UI: the strongest segment's effect, on the old (1+uplift)*60 scale. */
export function legacyImpactScore(impact: SegmentImpact): number {
  const peak = Math.max(...SEGMENTS.map((s) => impact[s]));
  return Math.min(100, Math.max(0, Math.round(peak * 60)));
}

export interface ImpactEvent {
  date: string;
  endDate?: string;
  segmentImpact?: Partial<SegmentImpact>;
  /** Events that are not confirmed must never move a price. Defaults to true when omitted. */
  pricingEligible?: boolean;
}

/**
 * Combine overlapping events for one segment: the strongest counts in full, the next
 * ones at diminishing weight (two festivals on one weekend do not double the price),
 * and the total is capped.
 */
export function combineUplifts(uplifts: number[]): number {
  const sorted = uplifts.filter((u) => u > 0).sort((a, b) => b - a);
  const weights = [1, 0.35, 0.15];
  let total = 0;
  sorted.slice(0, weights.length).forEach((u, i) => { total += u * weights[i]; });
  return Math.min(MAX_UPLIFT, total);
}

/** Events touching a given day (inclusive). */
export function eventsOnDay<T extends ImpactEvent>(events: T[], day: string): T[] {
  return events.filter((e) => e.date <= day && (e.endDate ?? e.date) >= day);
}

/**
 * Multiplier for one segment on one day (or across the whole set when `day` is omitted).
 */
export function segmentMultiplier(events: ImpactEvent[], segment: Segment, day?: string): number {
  const scoped = day ? eventsOnDay(events, day) : events;
  const uplifts = scoped
    .filter((e) => e.pricingEligible !== false)
    .map((e) => (e.segmentImpact?.[segment] ?? 1) - 1);
  return round3(1 + combineUplifts(uplifts));
}

/** Window summary: the peak daily multiplier per segment across [start, end]. */
export function windowSegmentMultipliers(events: ImpactEvent[], start: string, end: string): SegmentImpact {
  const out = { exotic: 1, sports: 1, luxury: 1, suv: 1 } as SegmentImpact;
  const days: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  for (const day of days) {
    const todays = eventsOnDay(events, day);
    if (!todays.length) continue;
    for (const seg of SEGMENTS) {
      out[seg] = Math.max(out[seg], segmentMultiplier(todays, seg));
    }
  }
  return out;
}

/** Market-wide figure kept for older callers: the mean of the four segments. */
export function marketMultiplier(m: SegmentImpact): number {
  return round3(SEGMENTS.reduce((s, k) => s + m[k], 0) / SEGMENTS.length);
}

// ---------------------------------------------------------------------------
// Evidence: how well do we know that an event is real, and what weight may it carry in pricing
// ---------------------------------------------------------------------------

/**
 * curated     our own calendar entry (hand-maintained)
 * verified    the cited page was fetched and shows this event near this date
 * listed      found at a known venue with a source, but the page could not confirm it (blocked, script-rendered)
 * unconfirmed anything else, or a schedule that cannot be right
 */
export type Evidence = 'curated' | 'verified' | 'listed' | 'unconfirmed';

/** Share of an event's modeled effect that may move a price. "Listed" counts half until confirmed. */
export const EVIDENCE_WEIGHT: Record<Evidence, number> = { curated: 1, verified: 1, listed: 0.5, unconfirmed: 0 };

export const EVIDENCE_LABELS: Record<Evidence, string> = {
  curated: 'Curated calendar',
  verified: 'Verified on source page',
  listed: 'Listed at venue, not verified',
  unconfirmed: 'Unconfirmed',
};

export interface Provenance {
  source: 'calendar' | 'ai';
  venueMatched?: boolean;
  sourceUrls?: string[];
  /** Result of fetching the cited page. Undefined when no check was run. */
  pageStatus?: 'confirmed' | 'no-match' | 'unreachable' | 'no-source';
  /** A schedule conflict (for example two home games days apart) with no confirmation to settle it. */
  conflict?: boolean;
}

export function evidenceFor(p: Provenance): Evidence {
  if (p.source === 'calendar') return 'curated';
  if (p.pageStatus === 'confirmed') return 'verified';
  if (p.conflict) return 'unconfirmed';
  const hosts = new Set((p.sourceUrls ?? []).map(hostOf).filter(Boolean));
  if (p.venueMatched && hosts.size >= 1) return 'listed';
  if (hosts.size >= 2) return 'listed';
  return 'unconfirmed';
}

/** Kept for older callers: may this event move a price at all? */
export function isPricingEligible(p: Provenance): boolean {
  return EVIDENCE_WEIGHT[evidenceFor(p)] > 0;
}

/** Scale an impact toward 1.0 (no effect) by the evidence weight. */
export function weightImpact(impact: SegmentImpact, weight: number): SegmentImpact {
  const out = {} as SegmentImpact;
  for (const seg of SEGMENTS) out[seg] = round3(1 + (impact[seg] - 1) * weight);
  return out;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Keep only http(s) URLs, trimmed and bounded. */
export function cleanUrls(input: unknown, max = 4): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const u of input) {
    if (typeof u !== 'string') continue;
    const t = u.trim().slice(0, 300);
    if (/^https?:\/\//i.test(t) && hostOf(t) && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Calendar metadata: audience + scale for each curated PEAK_SEASONS entry
// ---------------------------------------------------------------------------

export const CALENDAR_META: Record<string, { audience: Audience; scale: Scale }> = {
  // Miami
  'Art Basel Miami': { audience: 'peak-season', scale: 'global' },
  'Miami Boat Show': { audience: 'hnw-business', scale: 'national' },
  'Ultra Music Festival': { audience: 'festival-group', scale: 'global' },
  'Miami Grand Prix': { audience: 'motorsport-auto', scale: 'global' },
  'Miami Open Tennis': { audience: 'hnw-business', scale: 'national' },
  'Miami Swim Week': { audience: 'hnw-business', scale: 'regional' },
  'Spring Break Miami': { audience: 'festival-group', scale: 'national' },
  // Tampa
  'Gasparilla Pirate Festival': { audience: 'festival-group', scale: 'regional' },
  'Firestone Grand Prix of St. Petersburg': { audience: 'motorsport-auto', scale: 'national' },
  'Florida State Fair': { audience: 'family-tourist', scale: 'regional' },
  'Florida Strawberry Festival': { audience: 'family-tourist', scale: 'regional' },
  'Gasparilla Distance Classic': { audience: 'sports-fans', scale: 'local' },
  'Buccaneers Home Season': { audience: 'sports-fans', scale: 'regional' },
  'Tampa Bay Boat Show': { audience: 'hnw-business', scale: 'local' },
  'Clearwater Beach Peak Season': { audience: 'family-tourist', scale: 'regional' },
  // Orlando
  'IAAPA Expo': { audience: 'hnw-business', scale: 'national' },
  'MegaCon Orlando': { audience: 'family-tourist', scale: 'regional' },
  'Electric Daisy Carnival Orlando': { audience: 'festival-group', scale: 'national' },
  'Rolex 24 at Daytona': { audience: 'motorsport-auto', scale: 'national' },
  'Daytona 500 Week': { audience: 'motorsport-auto', scale: 'national' },
  'Daytona Bike Week': { audience: 'festival-group', scale: 'national' },
  'Citrus Bowl & Pop-Tarts Bowl': { audience: 'sports-fans', scale: 'regional' },
  'Epcot Food & Wine Festival': { audience: 'family-tourist', scale: 'regional' },
  'Halloween Horror Nights': { audience: 'family-tourist', scale: 'regional' },
  'Orlando Spring Break Peak': { audience: 'family-tourist', scale: 'national' },
  // Scottsdale / Phoenix
  'Barrett-Jackson Auction': { audience: 'motorsport-auto', scale: 'global' },
  'WM Phoenix Open': { audience: 'hnw-business', scale: 'global' },
  'Scottsdale Arabian Horse Show': { audience: 'hnw-business', scale: 'regional' },
  'Spring Training Baseball': { audience: 'sports-fans', scale: 'national' },
  'Scottsdale Arts Festival': { audience: 'hnw-business', scale: 'regional' },
  // Denver
  'National Western Stock Show': { audience: 'family-tourist', scale: 'national' },
  'Denver Ski Season Peak': { audience: 'family-tourist', scale: 'national' },
  'Red Rocks Concert Season': { audience: 'festival-group', scale: 'regional' },
  'Broncos Home Season': { audience: 'sports-fans', scale: 'regional' },
  'Rockies Home Season': { audience: 'sports-fans', scale: 'local' },
  'Cherry Creek Arts Festival': { audience: 'hnw-business', scale: 'regional' },
  // National
  'Christmas & New Years': { audience: 'peak-season', scale: 'global' },
  'Super Bowl Weekend': { audience: 'sports-fans', scale: 'global' },
  'Presidents Day Weekend': { audience: 'holiday-travel', scale: 'national' },
  'Memorial Day Weekend': { audience: 'holiday-travel', scale: 'national' },
  'Independence Day': { audience: 'holiday-travel', scale: 'national' },
  'Labor Day Weekend': { audience: 'holiday-travel', scale: 'national' },
  'Thanksgiving Week': { audience: 'holiday-travel', scale: 'national' },
  'Summer Peak': { audience: 'family-tourist', scale: 'national' },
};

// ---------------------------------------------------------------------------
// Display tier and calendar aliases
// ---------------------------------------------------------------------------

export type ImpactTier = 'major' | 'notable' | 'routine';

/** How much an event matters to pricing, by its strongest segment effect. The UI hides "routine" by default. */
export function impactTier(impact: SegmentImpact): ImpactTier {
  const peak = Math.max(...SEGMENTS.map((s) => impact[s])) - 1;
  if (peak >= 0.15) return 'major';
  if (peak >= 0.07) return 'notable';
  return 'routine';
}

/** Other names the web uses for curated calendar events, so the AI does not list them a second time. */
export const CALENDAR_ALIASES: Record<string, string[]> = {
  'Art Basel Miami': ['Miami Art Week', 'Art Week Miami', 'Art Basel Miami Beach', 'Art Basel'],
  'Miami Grand Prix': ['Formula 1 Miami', 'F1 Miami Grand Prix', 'Miami GP', 'Formula 1 Crypto.com Miami Grand Prix'],
  'Ultra Music Festival': ['Ultra Miami', 'Ultra Music Festival Miami'],
  'Miami Open Tennis': ['Miami Open', 'Miami Open presented by Itau'],
  'Miami Boat Show': ['Progressive Miami International Boat Show', 'Miami International Boat Show'],
  'Barrett-Jackson Auction': ['Barrett-Jackson Scottsdale Auction', 'Barrett Jackson Scottsdale'],
  'WM Phoenix Open': ['Phoenix Open', 'Waste Management Phoenix Open'],
  'Rolex 24 at Daytona': ['Rolex 24', 'Rolex 24 Hours of Daytona'],
  'Daytona 500 Week': ['Daytona 500', 'Daytona Speedweeks'],
  'Super Bowl Weekend': ['Super Bowl', 'Super Bowl LXI', 'Super Bowl LX'],
  'National Western Stock Show': ['National Western Stock Show and Rodeo', 'NWSS'],
  'Cherry Creek Arts Festival': ['Cherry Creek Arts Fest'],
  'Thanksgiving Week': ['Thanksgiving holiday weekend', 'Thanksgiving Day weekend', 'Thanksgiving weekend'],
  'Memorial Day Weekend': ['Memorial Day holiday weekend'],
  'Labor Day Weekend': ['Labor Day holiday weekend'],
};

/**
 * Official sites of the curated events. The nightly job opens them and checks that the dates they show fall inside our
 * window for this year, so a calendar entry whose real dates moved gets flagged instead of silently priced.
 * Broad seasons (summer peak, ski season, home-game seasons) have no single page and stay unchecked on purpose.
 */
export const CALENDAR_SOURCES: Record<string, string> = {
  'Art Basel Miami': 'https://www.artbasel.com/miami-beach',
  'Miami Boat Show': 'https://www.miamiboatshow.com/',
  'Ultra Music Festival': 'https://ultramusicfestival.com/',
  'Miami Grand Prix': 'https://www.f1miamigp.com/',
  'Miami Open Tennis': 'https://www.miamiopen.com/',
  'Gasparilla Pirate Festival': 'https://www.gasparillapiratefest.com/',
  'Florida State Fair': 'https://www.floridastatefair.com/',
  'Florida Strawberry Festival': 'https://flstrawberryfestival.com/',
  'IAAPA Expo': 'https://www.iaapa.org/expos/iaapa-expo',
  'Rolex 24 at Daytona': 'https://www.daytonainternationalspeedway.com/',
  'Daytona 500 Week': 'https://www.daytonainternationalspeedway.com/',
  'Barrett-Jackson Auction': 'https://www.barrett-jackson.com/Events/Event/Details/Scottsdale-Auction',
  'WM Phoenix Open': 'https://wmphoenixopen.com/',
  'National Western Stock Show': 'https://nationalwestern.com/',
  'Cherry Creek Arts Festival': 'https://www.cherryarts.org/',
};
