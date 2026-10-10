/**
 * Event demand engine v2: finds events for a market and turns each one into a
 * per-vehicle-segment demand effect. Shared by the live card endpoint
 * (`ai-event-intelligence`) and the nightly precompute (`precompute-event-intelligence`).
 *
 * Pipeline:  curated calendar  +  venue-first web search  +  anchor-event web search
 *            -> sanitize, de-duplicate -> audience/scale -> segment impact -> eligibility
 */
import { aiWebSearchEnabled, aiWebSearchJson } from "./aiProvider.ts";
import {
  AUDIENCES,
  CALENDAR_META,
  SCALES,
  SEGMENTS,
  audienceFromCategory,
  CALENDAR_ALIASES,
  CALENDAR_SOURCES,
  cleanUrls,
  EVIDENCE_WEIGHT,
  durationFactor,
  effectiveScale,
  evidenceFor,
  isAudience,
  isScale,
  weightImpact,
  impactTier,
  legacyImpactScore,
  marketMultiplier,
  scaleFromAttendance,
  segmentImpactFor,
  windowSegmentMultipliers,
  type Audience,
  type Evidence,
  type ImpactTier,
  type Scale,
  type SegmentImpact,
} from "./eventTaxonomy.ts";
import { matchVenue, venuePromptList } from "./demandVenues.ts";
import type { PageCheck, PageCheckStatus } from "./eventVerify.ts";
import {
  EVENT_CATEGORIES,
  getRelevantPeakSeasons,
  type DemandCity,
  type EventCategory,
} from "./demandCities.ts";

export const RESULT_VERSION = 3;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface EngineEvent {
  id: string;
  name: string;
  date: string;
  endDate: string;
  /** Legacy type, kept for the filter menu and older callers. */
  category: EventCategory;
  attendance: number;
  /** Legacy 0-100 score = strongest segment's effect. */
  impactScore: number;
  description: string;
  source: 'calendar' | 'ai';
  confidence: 'high' | 'medium';
  venue?: string;
  venueMatched: boolean;
  audience: Audience;
  scale: Scale;
  sourceUrls: string[];
  /** How well we know the event is real: curated, verified on its source page, listed at a venue, or unconfirmed. */
  evidence: Evidence;
  /** Result of fetching the cited page (AI events only; absent when no check was run). */
  pageStatus?: PageCheckStatus;
  /** Curated events: did the official site, checked recently, show dates inside our window? */
  datesCheck?: PageCheckStatus;
  /** A schedule conflict that no source settles (e.g. two home games days apart). */
  conflict?: boolean;
  /** Where the attendance figure comes from: a model/organizer estimate, or the venue's capacity as an upper bound. */
  attendanceBasis: 'estimate' | 'capacity' | 'curated';
  /** Venue capacity when known (approximate). */
  capacity?: number;
  /** True when the evidence lets this event move a price (weight above zero). */
  pricingEligible: boolean;
  /** Multiplier per vehicle segment AFTER the evidence weight: what pricing actually uses. 1.0 = no effect. */
  segmentImpact: SegmentImpact;
  /** The effect if the event were fully confirmed (what an unconfirmed event is shown with). */
  potentialImpact: SegmentImpact;
  /** major / notable / routine, by strongest segment effect (the UI hides routine by default). */
  tier: ImpactTier;
  /** When the nightly search last saw this event (ISO). Used to keep events across noisy runs. */
  seenAt?: string;
}

const clampAttendance = (n: unknown) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(2_000_000, Math.round(v));
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function calendarEvents(citySlug: string, start: string, end: string): EngineEvent[] {
  return getRelevantPeakSeasons(citySlug, start, end).map((season) => {
    const meta = CALENDAR_META[season.name] ?? {
      audience: audienceFromCategory(season.category),
      scale: scaleFromAttendance(season.attendance),
    };
    const segmentImpact = segmentImpactFor(meta.audience, meta.scale, season.surge);
    return {
      id: `peak-${slug(season.name)}-${season.startDate}`,
      name: season.name,
      date: season.startDate,
      endDate: season.endDate,
      category: season.category,
      attendance: season.attendance,
      impactScore: legacyImpactScore(segmentImpact),
      description: season.description,
      source: 'calendar',
      confidence: 'high',
      venueMatched: false,
      audience: meta.audience,
      scale: meta.scale,
      sourceUrls: CALENDAR_SOURCES[season.name] ? [CALENDAR_SOURCES[season.name]] : [],
      evidence: 'curated',
      attendanceBasis: 'curated',
      pricingEligible: true,
      segmentImpact,
      potentialImpact: segmentImpact,
      tier: impactTier(segmentImpact),
    };
  });
}

/** Calendar names plus the other names the web uses for them, for de-duplicating AI results. */
export function calendarNamesWithAliases(events: EngineEvent[]): string[] {
  return events.flatMap((e) => [e.name, ...(CALENDAR_ALIASES[e.name] ?? [])]);
}

/** Reject anything the model returns that is malformed or outside the window. */
export function sanitizeAiEvent(raw: unknown, city: DemandCity, start: string, end: string): EngineEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  const name = typeof e.name === 'string' ? e.name.trim().slice(0, 120) : '';
  if (!name) return null;

  const date = typeof e.date === 'string' && ISO_DATE.test(e.date) ? e.date : null;
  if (!date) return null;
  const endDate = typeof e.endDate === 'string' && ISO_DATE.test(e.endDate) && e.endDate >= date ? e.endDate : date;
  if (endDate < start || date > end) return null;

  const category = (EVENT_CATEGORIES as readonly string[]).includes(String(e.category))
    ? (e.category as EventCategory)
    : 'community';
  const modelAttendance = clampAttendance(e.attendance);

  const venueRaw = typeof e.venue === 'string' ? e.venue.trim().slice(0, 120) : '';
  const venue = matchVenue(city.value, venueRaw);

  // A single-day event at a venue with a known capacity cannot draw more than the venue holds, and a missing estimate
  // falls back to the capacity (shown as "up to").
  const singleDay = endDate === date;
  const capacity = venue?.capacity;
  let attendance = modelAttendance;
  let attendanceBasis: EngineEvent['attendanceBasis'] = 'estimate';
  if (capacity && singleDay && venue && venue.kind !== 'convention' && venue.kind !== 'resort' && venue.kind !== 'festival-grounds') {
    if (modelAttendance === 0 || modelAttendance >= capacity) { attendance = capacity; attendanceBasis = 'capacity'; }
  }

  // The model names who comes and how far; the numbers are computed here, never taken from the model.
  const audience: Audience = isAudience(e.audience) ? e.audience : audienceFromCategory(category);
  const scale: Scale = effectiveScale(isScale(e.scale) ? e.scale : scaleFromAttendance(attendance), attendance);
  const sourceUrls = cleanUrls(e.sourceUrls);
  const potentialImpact = segmentImpactFor(audience, scale, null, durationFactor(date, endDate));

  return finalizeEvent({
    id: `ai-${slug(name).slice(0, 40)}-${date}`,
    name,
    date,
    endDate,
    category,
    attendance,
    impactScore: legacyImpactScore(potentialImpact),
    description: typeof e.description === 'string' ? e.description.slice(0, 240) : '',
    source: 'ai',
    confidence: 'medium',
    venue: venue?.name ?? (venueRaw || undefined),
    venueMatched: !!venue,
    audience,
    scale,
    sourceUrls,
    evidence: 'unconfirmed',
    attendanceBasis,
    capacity,
    pricingEligible: false,
    segmentImpact: potentialImpact,
    potentialImpact,
    tier: impactTier(potentialImpact),
  });
}

/**
 * Recompute everything that depends on the evidence: the tier of trust, the weight it earns, and the effect pricing may
 * use. Call again after the cited page has been checked or a schedule conflict found.
 */
export function finalizeEvent(e: EngineEvent): EngineEvent {
  const evidence = evidenceFor({
    source: e.source,
    venueMatched: e.venueMatched,
    sourceUrls: e.sourceUrls,
    pageStatus: e.pageStatus,
    conflict: e.conflict,
  });
  const weight = EVIDENCE_WEIGHT[evidence];
  return {
    ...e,
    evidence,
    pricingEligible: weight > 0,
    confidence: evidence === 'curated' || evidence === 'verified' ? 'high' : 'medium',
    segmentImpact: weightImpact(e.potentialImpact, weight),
  };
}

/** Attach the result of the page check to each event, in order. */
export function applyVerification(events: EngineEvent[], checks: PageCheck[]): EngineEvent[] {
  return events.map((e, i) => (checks[i] ? finalizeEvent({ ...e, pageStatus: checks[i].status }) : e));
}

/**
 * A football-style home schedule cannot have two big stadium games a few days apart. When two such events at the same
 * venue are closer than that, any of them the source page did not confirm is marked conflicted (unconfirmed).
 */
export function markScheduleConflicts(events: EngineEvent[], citySlug: string, minGapDays = 5): EngineEvent[] {
  const looksLikeGame = (e: EngineEvent) =>
    e.source === 'ai' && e.category === 'sports' && /\bvs\.?\b|\bv\.?\s/i.test(e.name) && e.attendance >= 40_000 &&
    matchVenue(citySlug, e.venue)?.kind === 'stadium';
  const byVenue = new Map<string, EngineEvent[]>();
  for (const e of events) if (looksLikeGame(e)) {
    const key = matchVenue(citySlug, e.venue)!.name;
    byVenue.set(key, [...(byVenue.get(key) ?? []), e]);
  }
  const flagged = new Set<string>();
  for (const list of byVenue.values()) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i++) {
      const gap = (Date.parse(sorted[i].date) - Date.parse(sorted[i - 1].date)) / 86_400_000;
      if (gap < minGapDays) for (const x of [sorted[i - 1], sorted[i]]) if (x.pageStatus !== 'confirmed') flagged.add(x.id);
    }
  }
  return events.map((e) => (flagged.has(e.id) ? finalizeEvent({ ...e, conflict: true }) : e));
}

/** Token-overlap duplicate test: "Rolling Loud Miami" vs "Rolling Loud Miami 2026". */
export function isDuplicateName(candidate: string, existing: Iterable<string>): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
  const cand = new Set(norm(candidate));
  if (cand.size === 0) return false;
  for (const other of existing) {
    const tokens = norm(other);
    if (tokens.length === 0) continue;
    const shared = tokens.filter((t) => cand.has(t)).length;
    if (shared / Math.min(cand.size, tokens.length) >= 0.6) return true;
  }
  return false;
}

const OUTPUT_SPEC =
  "Return ONLY a JSON array (no prose). Each item: " +
  '{"name": official event name, "venue": venue name or "", "date": "YYYY-MM-DD" (first day), "endDate": "YYYY-MM-DD", ' +
  `"category": one of ${EVENT_CATEGORIES.join('|')}, ` +
  `"audience": one of ${AUDIENCES.join('|')}, "scale": one of ${SCALES.join('|')}, ` +
  '"attendance": estimated total attendance (number), "description": one short line, ' +
  '"sourceUrls": [1-2 URLs of pages that confirm this event and its date]}. ' +
  "Return [] if nothing is confirmed.";

const DEFINITIONS = `Definitions:
- audience: hnw-business = collectors, executives, investors (art fairs, crypto/finance conferences, galas, golf/tennis hospitality); festival-group = groups travelling together with luggage (music festivals, spring break, big concerts); family-tourist = families and visitors (theme parks, fairs, fan conventions, ski season); motorsport-auto = car enthusiasts (F1, IndyCar, NASCAR, endurance racing, car auctions and shows); sports-fans = game-day travel (NFL, NBA, MLB, NHL, college); peak-season = a market-wide luxury peak (e.g. Art Basel week); holiday-travel = general holiday weekends.
- scale: local = under 10,000 people; regional = 10,000 to 50,000; national = 50,000 to 200,000 or drawing travellers from other states; global = over 200,000 or world-famous.
- Skip anything under roughly 3,000 expected attendees and skip recurring all-season entries (e.g. "Yankees home season"): list individual dated events.`;

function venuePrompt(city: DemandCity, start: string, end: string): string {
  return `You are an event researcher for a luxury and exotic car rental company in ${city.promptName}.
Find the confirmed events between ${start} and ${end} at these venues (look up each venue's own event calendar first; include concerts, shows, games, races and fairs):
${venuePromptList(city.value)}

${DEFINITIONS}
Every date must fall between ${start} and ${end}. Only include events you can confirm on a venue, promoter or ticketing page. Do not invent events.`;
}

function anchorPrompt(city: DemandCity, start: string, end: string): string {
  return `You are an event researcher for a luxury and exotic car rental company in ${city.promptName} (within about ${city.radiusKm} km of the center).
Find the confirmed major events between ${start} and ${end} that are NOT ordinary concerts or games at the big venues: conferences and trade shows (especially crypto, finance, technology, real estate, boating, automotive, fashion), art and culture fairs, music and food festivals, motorsport and car events (races, auctions, concours, Cars & Coffee type gatherings of national note), galas and golf or tennis tournaments, and major holiday weekends specific to this market.

${DEFINITIONS}
Every date must fall between ${start} and ${end}. Only include events you can confirm on an organizer or credible news page. Do not invent events.`;
}

/**
 * The venue search and the anchor search can both find the same event under different names ("III Points Music
 * Festival" / "III Points 2026"). Keep one per event: prefer the record at a known venue, then the one with more sources.
 */
export function collapseSameEvents(events: EngineEvent[], cityName = ''): EngineEvent[] {
  const cityWords = new Set(cityName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean));
  const score = (e: EngineEvent) => (e.venueMatched ? 2 : 0) + Math.min(e.sourceUrls.length, 2);
  const kept: EngineEvent[] = [];
  for (const e of events) {
    const i = kept.findIndex((k) => looksSameEvent(k, e, cityWords));
    if (i < 0) kept.push(e);
    else if (score(e) > score(kept[i])) kept[i] = e;
  }
  return kept;
}

export interface SearchOutcome {
  events: EngineEvent[];
  /** Number of raw items returned by the model across both searches. */
  rawCount: number;
  /** Searches that returned nothing usable (null) rather than an empty list. */
  failedSearches: number;
  totalSearches: number;
}

/** Venue-first and anchor searches run in parallel; a failure of one still yields the other. */
export async function searchCityEvents(
  city: DemandCity,
  start: string,
  end: string,
  opts: { signal?: AbortSignal; maxCalls?: number; existingNames?: Iterable<string> } = {},
): Promise<SearchOutcome> {
  if (!aiWebSearchEnabled()) {
    return { events: [], rawCount: 0, failedSearches: 0, totalSearches: 0 };
  }
  const run = (prompt: string) =>
    aiWebSearchJson(prompt, opts.signal, { outputSpec: OUTPUT_SPEC, maxCalls: opts.maxCalls });

  const results = await Promise.all([
    run(venuePrompt(city, start, end)),
    run(anchorPrompt(city, start, end)),
  ]);

  const seen = new Set<string>(opts.existingNames ?? []);
  const events: EngineEvent[] = [];
  let rawCount = 0;
  let failed = 0;
  for (const raws of results) {
    if (!raws) { failed++; continue; }
    rawCount += raws.length;
    for (const raw of raws.slice(0, 60)) {
      const evt = sanitizeAiEvent(raw, city, start, end);
      if (!evt) continue;
      if (isDuplicateName(evt.name, seen)) continue;
      events.push(evt);
      seen.add(evt.name);
    }
  }
  return { events: collapseSameEvents(events, city.promptName), rawCount, failedSearches: failed, totalSearches: results.length };
}

/** Assemble the response the card and the pricing function read. */
export function buildResult(events: EngineEvent[], start: string, end: string) {
  const strongest = (e: EngineEvent) => Math.max(...SEGMENTS.map((s) => (e.potentialImpact ?? e.segmentImpact)[s]));
  const sorted = [...events].sort((a, b) => strongest(b) - strongest(a) || a.date.localeCompare(b.date));
  const eligible = sorted.filter((e) => e.pricingEligible);

  const segmentMultipliers = windowSegmentMultipliers(eligible, start, end);
  const avgImpact = sorted.length ? sorted.reduce((sum, e) => sum + e.impactScore, 0) / sorted.length : 0;

  return {
    version: RESULT_VERSION,
    events: sorted,
    /** Peak-day multiplier per vehicle segment from confirmed events. */
    segmentMultipliers,
    /** Mean of the segments, kept for callers that only know one number. */
    demandMultiplier: Math.round(marketMultiplier(segmentMultipliers) * 100) / 100,
    summary: {
      peakDate: sorted[0]?.date ?? null,
      totalEvents: sorted.length,
      avgImpact: Math.round(avgImpact),
      totalAttendance: sorted.reduce((sum, e) => sum + (e.attendance || 0), 0),
      pricingEvents: eligible.length,
      evidence: {
        curated: sorted.filter((e) => e.evidence === 'curated').length,
        verified: sorted.filter((e) => e.evidence === 'verified').length,
        listed: sorted.filter((e) => e.evidence === 'listed').length,
        unconfirmed: sorted.filter((e) => e.evidence === 'unconfirmed').length,
      },
      sources: {
        calendar: sorted.filter((e) => e.source === 'calendar').length,
        ai: sorted.filter((e) => e.source === 'ai').length,
      },
    },
  };
}

export type EngineResult = ReturnType<typeof buildResult>;

/** Events from a stored result that overlap [start, end]. */
export function sliceEvents(events: EngineEvent[], start: string, end: string): EngineEvent[] {
  return events.filter((e) => e.endDate >= start && e.date <= end);
}

const MERGE_KEEP_MS = 7 * 86_400_000;

/**
 * Combine tonight's search with the previous snapshot. Web search recall varies from run to run
 * (one night finds 66 events, the next 33), so an event stays for up to a week after it was last
 * seen, as long as it has not happened yet. Fresh results always win.
 */
/** Words too generic to identify an event ("music festival", "2026", "tour"). */
const GENERIC_WORDS = new Set([
  'music', 'festival', 'fest', 'tour', 'live', 'show', 'annual', 'conference', 'expo', 'exposition', 'meeting', 'world',
  'concert', 'the', 'and', 'presents', 'vs', 'game', 'weekend', 'week', 'day', 'night', 'series', 'championship', 'classic',
  'national', 'international', 'summit', 'forum', 'convention', 'fair', 'show', '2026', '2027', '2028',
]);

const significantWords = (name: string, cityWords: Set<string>) =>
  name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !GENERIC_WORDS.has(w) && !cityWords.has(w));

/**
 * Two records describe the same event when their dates overlap and they share a distinctive word
 * ("III Points Music Festival" vs "III Points 2026"), or when their names are near-identical.
 */
export function looksSameEvent(a: EngineEvent, b: EngineEvent, cityWords: Set<string> = new Set()): boolean {
  if (isDuplicateName(a.name, [b.name]) && a.date <= b.endDate && b.date <= a.endDate) return true;
  const overlap = a.date <= b.endDate && b.date <= a.endDate;
  if (!overlap) return false;
  const wb = new Set(significantWords(b.name, cityWords));
  return significantWords(a.name, cityWords).some((w) => wb.has(w));
}

/**
 * Combine tonight's search with the previous snapshot. Web search recall varies from run to run
 * (one night finds 66 events, the next 33), so an event stays for up to a week after it was last
 * seen, as long as it has not happened yet. Fresh results always win, including when the same event
 * comes back under a slightly different name.
 */
export function mergeSnapshotEvents(
  previous: EngineEvent[],
  fresh: EngineEvent[],
  now = new Date(),
  cityName = '',
): EngineEvent[] {
  const today = now.toISOString().slice(0, 10);
  const stamp = now.toISOString();
  const cityWords = new Set(cityName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean));
  const out: EngineEvent[] = fresh.map((e) => ({ ...e, seenAt: stamp }));
  for (const old of previous) {
    if (old.endDate < today) continue;
    if (!old.evidence || !old.potentialImpact) continue; // written by an older version of the rules: never carried forward
    const seen = old.seenAt ? Date.parse(old.seenAt) : 0;
    if (now.getTime() - seen > MERGE_KEEP_MS) continue;
    if (out.some((e) => e.id === old.id || looksSameEvent(e, old, cityWords))) continue;
    out.push(old);
  }
  return out;
}

/** Key under which a curated event's date check is stored: one check per event per occurrence. */
export const calendarCheckKey = (e: { name: string; date: string }) => `${e.name}|${e.date}`;

/** Curated events of a window that have an official page we can check. */
export function checkableCalendarEvents(events: EngineEvent[]): EngineEvent[] {
  return events.filter((e) => e.source === 'calendar' && e.sourceUrls.length > 0 && Date.parse(e.endDate) - Date.parse(e.date) <= 21 * 86_400_000);
}

/** Attach stored date checks to curated events. */
export function applyCalendarChecks(events: EngineEvent[], checks: Record<string, { status: PageCheckStatus; checkedAt?: string }> | null | undefined): EngineEvent[] {
  if (!checks) return events;
  return events.map((e) => (e.source === 'calendar' && checks[calendarCheckKey(e)] ? { ...e, datesCheck: checks[calendarCheckKey(e)].status } : e));
}
