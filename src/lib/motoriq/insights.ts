/**
 * Insights: the short list of things worth a tenant's attention, in plain language, each with its numbers, where they
 * came from, how sure we are, and what to do. Built only from facts and recommendations (see facts.ts, pricingEngine.ts).
 * If nothing deserves attention the list says so instead of padding.
 */
import { SEGMENT_PHRASE, evidenceOf, pctRange, pct as impactPct, type ImpactEvent, type SegmentKey } from "../eventImpact";
import { addDays } from "./facts";
import { niceRange } from "./format";
import type { FleetFacts, Insight, MotorIQSnapshot, OutcomeReport, PriceRecommendation, Provenance } from "./types";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pc = (x: number | null | undefined) => (x == null ? "n/a" : `${Math.round(x * 100)}%`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (names: string[], max = 3) =>
  names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} and ${names.length - max} more`;

const MARKET_LABEL: Record<string, string> = {
  miami: "Miami", tampa: "Tampa", orlando: "Orlando", scottsdale: "Scottsdale", phoenix: "Phoenix", denver: "Denver",
  "los-angeles": "Los Angeles", "las-vegas": "Las Vegas", "new-york": "New York", chicago: "Chicago", dallas: "Dallas", atlanta: "Atlanta", other: "your market",
};
const SEG_NOUN: Record<SegmentKey, string> = { exotic: "exotics", sports: "sports cars", luxury: "luxury cars", suv: "SUVs" };

export const MAX_INSIGHTS = 6;

export function buildInsights(input: {
  facts: FleetFacts;
  recommendations: PriceRecommendation[];
  eventsByMarket: Record<string, ImpactEvent[]>;
  today: string;
  /** what the tenant's own applied rates did (see outcomes.ts) */
  outcomes?: OutcomeReport | null;
}): Insight[] {
  const { facts, recommendations, eventsByMarket, today, outcomes } = input;
  const out: Insight[] = [];
  const marketOf = new Map(facts.vehicles.map((v) => [v.id, v.market]));

  // 1. PRICE ACTIONS ------------------------------------------------------------------------------------------
  const raises = recommendations.filter((r) => r.action === "raise" && r.confidence !== "low");
  const lowers = recommendations.filter((r) => r.action === "lower" && r.confidence !== "low");
  const raiseValue = raises.reduce((s, r) => s + (r.estimate?.extraRevenue ?? 0), 0);
  // a single small change is noise here (it still shows in the Pricing tab)
  if (raises.length && (raises.length >= 3 || raiseValue >= 100)) {
    const extra = raiseValue;
    const avg = raises.reduce((s, r) => s + r.changePct, 0) / raises.length;
    const reasons = tally(raises.flatMap((r) => r.drivers.filter((d) => d.effectPct > 0).map((d) => d.id)));
    const provenance = dedupe(raises.flatMap((r) => r.drivers.map((d) => d.provenance)));
    out.push({
      id: "price-raise",
      kind: "price-action",
      priority: 100 + Math.min(extra / 100, 50),
      headline: `Raise the rate on ${plural(raises.length, "car")} for the next 7 days`,
      body: `${list(raises.map((r) => r.name))}: ${reasonSentence(reasons)} Average change +${Math.round(avg * 100)}%.`,
      metrics: [
        { label: "Cars", value: String(raises.length) },
        { label: "Average change", value: `+${Math.round(avg * 100)}%` },
        ...(extra > 0 ? [{ label: "If open days fill as usual", value: `about +${money(extra)}` }] : []),
      ],
      provenance,
      confidence: lowestConfidence(raises),
      actions: [
        { kind: "apply-rates", label: "Review and apply", vehicleIds: raises.map((r) => r.vehicleId) },
        { kind: "open-pricing", label: "See why" },
      ],
      speakable: `I recommend raising the rate on ${plural(raises.length, "car")} for the next 7 days, about ${Math.round(avg * 100)} percent on average. ${reasonSentence(reasons)}${extra > 0 ? ` If their open days fill the way they usually do, that is roughly ${money(extra)} more.` : ""}`,
    });
  }
  if (lowers.length) {
    out.push({
      id: "price-lower",
      kind: "price-action",
      priority: 90,
      headline: `Consider lowering ${plural(lowers.length, "car")} to fill open days`,
      body: `${list(lowers.map((r) => r.name))}: bookings are coming in slower than usual and these cars have open days in the next 3 days.`,
      metrics: [{ label: "Cars", value: String(lowers.length) }, { label: "Average change", value: `${Math.round((lowers.reduce((s, r) => s + r.changePct, 0) / lowers.length) * 100)}%` }],
      provenance: dedupe(lowers.flatMap((r) => r.drivers.map((d) => d.provenance))),
      confidence: lowestConfidence(lowers),
      actions: [{ kind: "apply-rates", label: "Review and apply", vehicleIds: lowers.map((r) => r.vehicleId) }, { kind: "open-pricing", label: "See why" }],
      speakable: `Bookings for ${plural(lowers.length, "car")} are slower than usual and they have open days in the next three days. Lowering their rate could help fill them.`,
    });
  }

  // 2. PACE by group of cars ------------------------------------------------------------------------------------
  for (const c of facts.cohorts) {
    if (c.pace == null || c.provenance.n < 20 || c.vehicles < 3) continue;
    const delta = c.pace - 1;
    if (Math.abs(delta) < 0.15) continue;
    const where = MARKET_LABEL[c.market] ?? c.market;
    const faster = delta > 0;
    out.push({
      id: `pace-${c.key}`,
      kind: "pace",
      priority: 50 + Math.min(Math.abs(delta) * 60, 30) + Math.min(c.vehicles, 10),
      headline: `Your ${SEG_NOUN[c.segment]} in ${where} are filling ${Math.round(Math.abs(delta) * 100)}% ${faster ? "faster" : "slower"} than usual`,
      body: `The next 7 days are ${pc(c.forwardShare)} booked across ${plural(c.vehicles, "car")}. At this point in the week you are normally ${pc(c.historicalShare)} booked.`,
      metrics: [
        { label: "Booked now", value: pc(c.forwardShare) },
        { label: "Usually by now", value: pc(c.historicalShare) },
      ],
      provenance: [c.provenance],
      confidence: c.provenance.n >= 40 ? "high" : "medium",
      actions: [{ kind: "open-pricing", label: faster ? "See rate suggestions" : "Review rates" }],
      speakable: `Your ${SEG_NOUN[c.segment]} in ${where} are filling ${Math.round(Math.abs(delta) * 100)} percent ${faster ? "faster" : "slower"} than usual. The next seven days are ${pc(c.forwardShare)} booked, and you are normally ${pc(c.historicalShare)} booked by now.`,
    });
  }

  // 3. EVENTS in the next 14 days (confirmed only) ----------------------------------------------------------------
  const horizonEnd = addDays(today, 13);
  const seen = new Set<string>();
  const upcoming: Array<{ e: ImpactEvent; market: string }> = [];
  for (const [market, evs] of Object.entries(eventsByMarket)) {
    for (const e of evs) {
      const ev = evidenceOf(e);
      if (ev !== "curated" && ev !== "verified") continue;
      if ((e.endDate ?? e.date) < today || e.date > horizonEnd) continue;
      if (e.tier === "routine") continue;
      if (seen.has(`${market}|${e.name}|${e.date}`)) continue;
      seen.add(`${market}|${e.name}|${e.date}`);
      upcoming.push({ e, market });
    }
  }
  upcoming.sort((a, b) => peak(b.e) - peak(a.e));
  for (const { e, market } of upcoming.slice(0, 2)) {
    const segs = (Object.keys(SEGMENT_PHRASE) as SegmentKey[])
      .map((k) => ({ k, p: impactPct(e.segmentImpact?.[k]) }))
      .filter((x) => x.p >= 5)
      .sort((a, b) => b.p - a.p);
    if (!segs.length) continue;
    const where = MARKET_LABEL[market] ?? market;
    const when = niceRange(e.date, e.endDate ?? e.date);
    const quoted = recommendations.filter((r) => marketOf.get(r.vehicleId) === market && r.eventRates.some((er) => er.from <= (e.endDate ?? e.date) && er.to >= e.date && er.names.includes(e.name)));
    const quoteAvg = quoted.length ? Math.round(quoted.reduce((sum, r) => sum + (r.eventRates.find((er) => er.names.includes(e.name))?.premiumPct ?? 0), 0) / quoted.length) : 0;
    const quoteLine = quoted.length ? ` Suggested quote for those dates: about +${quoteAvg}% on ${plural(quoted.length, "car")} (your base rates stay as they are).` : "";
    const attendance = e.attendance > 0 ? `${e.attendanceBasis === "capacity" ? "up to " : "about "}${e.attendance.toLocaleString("en-US")} people` : null;
    out.push({
      id: `event-${market}-${e.id}`,
      kind: "event",
      priority: 60 + peak(e) * 100,
      headline: `${e.name} in ${where}: ${evidenceOf(e) === "verified" ? "confirmed" : "on the calendar"} (${when})`,
      body: `${attendance ? `${attendance[0].toUpperCase()}${attendance.slice(1)} expected. ` : ""}Modeled to lift ${list(segs.slice(0, 3).map((s) => `${SEGMENT_PHRASE[s.k]} +${pctRange(s.p)}`), 3)}. These are modeled ranges, not yet measured on your results.${quoteLine}`,
      metrics: [
        ...(attendance ? [{ label: "People", value: e.attendance.toLocaleString("en-US") }] : []),
        { label: "Strongest effect", value: `${SEGMENT_PHRASE[segs[0].k]} +${pctRange(segs[0].p)}` },
        ...(quoted.length ? [{ label: "Suggested quote", value: `+${quoteAvg}% on ${quoted.length} cars` }] : []),
      ],
      provenance: [{ source: evidenceOf(e) === "verified" ? "the event's own cited page, checked by us" : "our curated event calendar", n: 1, asOf: today }],
      confidence: evidenceOf(e) === "verified" ? "high" : "medium",
      actions: [{ kind: "open-pricing", label: "See rates for these dates" }, { kind: "open-forecast", label: "See the forecast" }],
      speakable: `${e.name} in ${where} runs ${when}${attendance ? `, with ${attendance}` : ""}. It is modeled to lift ${segs[0].k === "suv" ? "SUVs" : SEGMENT_PHRASE[segs[0].k]} the most.${quoted.length ? ` I suggest quoting about ${quoteAvg} percent more on ${plural(quoted.length, "car")} for those dates, without changing the base rates.` : ""}`,
    });
  }

  // 4. OPEN DAYS soon ------------------------------------------------------------------------------------------------
  const live = facts.vehicles.filter((v) => !v.outOfService);
  const free3 = live.filter((v) => v.openDates14.filter((d) => d <= addDays(today, 2)).length >= 3);
  if (live.length >= 5 && free3.length / live.length >= 0.4) {
    out.push({
      id: "gap-soon",
      kind: "gap",
      priority: 45,
      headline: `${plural(free3.length, "car")} of ${live.length} are free for the next 3 days`,
      body: `Fleet booked share for the next 7 days is ${pc(facts.fleet.forward7.share)}. Open days this close in are hardest to fill at full price.`,
      metrics: [{ label: "Free all 3 days", value: String(free3.length) }, { label: "Next 7 days booked", value: pc(facts.fleet.forward7.share) }],
      provenance: [{ source: "your bookings and blocked dates", n: live.length, asOf: today }],
      confidence: "high",
      actions: [{ kind: "open-calendar", label: "Open the calendar" }],
      speakable: `${plural(free3.length, "car")} out of ${live.length} are free for the next three days. The fleet is ${pc(facts.fleet.forward7.share)} booked for the next seven.`,
    });
  }

  // 5. BOOKED BELOW LIST PRICE ----------------------------------------------------------------------------------------
  const below = live.filter((v) => v.rateRealization.value != null && v.rateRealization.value < 0.9 && v.achievedRate.provenance.n >= 5);
  if (below.length) {
    out.push({
      id: "realization",
      kind: "realization",
      priority: 55 + Math.min(below.length * 3, 15),
      headline: `${plural(below.length, "car")} ${below.length === 1 ? "is" : "are"} booking below the listed rate`,
      body: `${list(below.map((v) => `${v.name} (${pc(v.rateRealization.value)} of list)`))}. Guests have recently paid less than the price shown, so raising these would likely not hold.`,
      metrics: [{ label: "Cars", value: String(below.length) }],
      provenance: [{ source: "bookings made in the last 30 days", n: below.reduce((s, v) => s + v.achievedRate.provenance.n, 0), asOf: today }],
      confidence: "high",
      actions: [{ kind: "open-vehicle", label: "Review these cars", vehicleIds: below.map((v) => v.id) }],
      speakable: `${plural(below.length, "car")} ${below.length === 1 ? "is" : "are"} booking below the listed rate, so I would not raise ${below.length === 1 ? "it" : "them"}.`,
    });
  }

  // 6. IDLE CARS -----------------------------------------------------------------------------------------------------------
  const idle = live.filter((v) => v.daysSinceLastStart != null && v.daysSinceLastStart >= 30 && (v.forward30.share ?? 0) < 0.1);
  if (idle.length) {
    out.push({
      id: "idle",
      kind: "idle",
      priority: 40 + Math.min(idle.length, 10),
      headline: `${plural(idle.length, "car")} ${idle.length === 1 ? "has" : "have"} not started a booking in 30 days or more`,
      body: `${list(idle.map((v) => `${v.name} (${v.daysSinceLastStart} days)`))}, and almost nothing is booked ahead.`,
      metrics: [{ label: "Cars", value: String(idle.length) }],
      provenance: [{ source: "your bookings", n: idle.length, asOf: today }],
      confidence: "high",
      actions: [{ kind: "open-vehicle", label: "Review these cars", vehicleIds: idle.map((v) => v.id) }],
      speakable: `${plural(idle.length, "car")} ${idle.length === 1 ? "has" : "have"} not started a booking in 30 days or more and almost nothing is booked ahead.`,
    });
  }

  // 7. MONEY already booked ---------------------------------------------------------------------------------------------
  const next = facts.fleet.bookedRevenueNext30;
  const last = facts.fleet.earnedLast30;
  if (next.value != null && last.value != null) {
    out.push({
      id: "revenue",
      kind: "revenue",
      priority: 30,
      headline: `${money(next.value)} is already booked for the next 30 days`,
      body: `The last 30 days earned ${money(last.value)}. Bookings still arrive, so this number grows before those days arrive.`,
      metrics: [{ label: "Booked, next 30 days", value: money(next.value) }, { label: "Earned, last 30 days", value: money(last.value) }],
      provenance: [next.provenance, last.provenance],
      confidence: "high",
      actions: [{ kind: "open-calendar", label: "Open the calendar" }],
      speakable: `You have ${money(next.value)} already booked for the next 30 days. The last 30 days earned ${money(last.value)}.`,
    });
  }

  // 7b. RESULTS of the rates the tenant applied (only once at least one finished date rate could be compared)
  if (outcomes && outcomes.summary.comparedRates > 0 && outcomes.headline) {
    const s = outcomes.summary;
    const compared = outcomes.dateRates.filter((d) => d.verdict === "held" || d.verdict === "softer" || d.verdict === "unclear");
    out.push({
      id: "results-date-rates",
      kind: "results",
      priority: 55,
      headline: `Your date rates: demand held on ${s.held} of ${s.comparedRates}`,
      body: outcomes.headline,
      metrics: [
        { label: "Compared with similar cars", value: String(s.comparedRates) },
        { label: "Demand held", value: String(s.held) },
        ...(s.extraRevenue > 0 ? [{ label: "Paid above base rate", value: `about ${money(s.extraRevenue)}` }] : []),
      ],
      provenance: [outcomes.provenance],
      confidence: compared.some((d) => d.confidence === "medium") ? "medium" : "low",
      actions: [],
      speakable: outcomes.speakable ?? outcomes.headline,
    });
  }

  // 8. DATA the engine cannot use -------------------------------------------------------------------------------------------
  if (facts.fleet.pickups.last7 + facts.fleet.pickups.prev7 === 0 && facts.vehicles.length > 0) {
    out.push({
      id: "data-no-recent",
      kind: "data",
      priority: 20,
      headline: "No new bookings in the last 14 days",
      body: "Booking pace and price acceptance are learned from recent bookings, so rate suggestions will mostly say hold until new bookings come in.",
      metrics: [],
      provenance: [facts.fleet.pickups.provenance],
      confidence: "high",
      actions: [],
      speakable: "There have been no new bookings in the last 14 days, so I do not have fresh pace data and will mostly suggest holding rates.",
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, MAX_INSIGHTS);
}

// ---------------------------------------------------------------------------

function peak(e: ImpactEvent): number {
  const v = e.segmentImpact ?? {};
  return Math.max(0, ...Object.values(v).map((x) => (x ?? 1) - 1));
}

function tally(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = (out[id] ?? 0) + 1;
  return out;
}

function reasonSentence(t: Record<string, number>): string {
  return t.pace ? `${plural(t.pace, "car")} filling faster than usual.` : "Recent bookings point up.";
}

const ORDER = { high: 3, medium: 2, low: 1 } as const;
function lowestConfidence(recs: PriceRecommendation[]): "high" | "medium" | "low" {
  return recs.reduce<"high" | "medium" | "low">((lo, r) => (ORDER[r.confidence] < ORDER[lo] ? r.confidence : lo), "high");
}

function dedupe(p: Provenance[]): Provenance[] {
  const seen = new Set<string>();
  return p.filter((x) => (seen.has(x.source) ? false : (seen.add(x.source), true)));
}

// ---------------------------------------------------------------------------
// Snapshot: one object for the screen and for the voice agent
// ---------------------------------------------------------------------------

export function buildSummary(facts: FleetFacts, recommendations: PriceRecommendation[], scope: string): string {
  const live = facts.fleet.vehicles;
  const changes = recommendations.filter((r) => r.action !== "hold" && r.confidence !== "low").length;
  const parts = [
    `${plural(live, "car")} ${scope === "all locations" ? "across all locations" : `in ${scope}`}.`,
    `The next 7 days are ${pc(facts.fleet.forward7.share)} booked; the last 30 days were ${pc(facts.fleet.trailing30.share)} utilized.`,
    changes > 0
      ? `${plural(changes, "rate change")} ${changes === 1 ? "is" : "are"} suggested for this week.`
      : "No rate changes are suggested right now.",
  ];
  return parts.join(" ");
}

export function buildSnapshot(input: {
  facts: FleetFacts;
  recommendations: PriceRecommendation[];
  eventsByMarket: Record<string, ImpactEvent[]>;
  scope: string;
  outcomes?: OutcomeReport | null;
}): MotorIQSnapshot {
  const insights = buildInsights({ facts: input.facts, recommendations: input.recommendations, eventsByMarket: input.eventsByMarket, today: input.facts.asOf, outcomes: input.outcomes });
  return {
    asOf: input.facts.asOf,
    timeZone: input.facts.timeZone,
    scope: input.scope,
    summary: buildSummary(input.facts, input.recommendations, input.scope),
    facts: input.facts,
    recommendations: input.recommendations,
    insights,
    outcomes: input.outcomes ?? null,
  };
}

