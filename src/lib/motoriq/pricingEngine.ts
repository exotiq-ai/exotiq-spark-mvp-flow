/**
 * Pricing engine: a rate recommendation per car, from rules anyone can read.
 *
 * It does not guess a "market rate". It starts from the tenant's own current rate and asks:
 *   1. PACE        Is the next 7 days filling faster or slower than it usually does at this lead time? (own bookings)
 *                  This alone sets the BASE rate recommendation, because the base rate applies from now on.
 *   2. REALIZATION Have guests recently been booking at the listed rate, or below it?
 *   3. EVENTS      Is a confirmed event coming in the next 14 days that lifts this type of car? That is a separate,
 *                  date-specific premium (the app stores one rate per car, so an event must never silently change it).
 * Guard-rails: never below the team's minimum rate, never a change bigger than the caps, no raise when guests already pay
 * less than the listed rate, and no recommendation at all when the listed rate itself looks wrong.
 *
 * The result always says WHY (drivers with their data), WHY NOT MORE (hold reasons) and how sure it is. Deterministic: the
 * same inputs give the same answer, so it can be tested, explained and spoken by a voice agent.
 */
import type { SegmentKey } from "../eventImpact";
import { addDays } from "./facts";
import { niceRange } from "./format";
import type { CohortPace, Confidence, Driver, EventRate, FleetFacts, PriceRecommendation, Provenance, VehicleFacts } from "./types";

// Tunable constants, exported so tests and the UI's "how this works" text can quote them.
export const HORIZON_DAYS = 7;
export const PACE_RAISE_MAX = 0.12; // pace alone can raise at most +12%
export const PACE_RAISE_START = 1.10; // pace must be at least 10% ahead of normal before it counts
export const PACE_RAISE_FULL = 1.50;
export const PACE_LOWER_MAX = 0.10;
export const PACE_LOWER_START = 0.85;
export const PACE_LOWER_FULL = 0.50;
export const EVENT_APPLY_SHARE = 0.5; // the event model is uncalibrated: apply half of its modeled effect
export const MAX_RAISE = 0.25;
export const MAX_LOWER = 0.15;
export const HOLD_BAND = 0.03; // changes under 3% are noise: hold
export const REALIZATION_BLOCK = 0.92; // guests paying under 92% of list: do not raise
export const IDLE_BLOCK_SHARE = 0.15; // a car booked under 15% of the last 30 days: a raise would not help it
export const MIN_BOOKINGS_FOR_LOWER_CONFIDENCE = 25;

/** A run of consecutive days in the next 14 where confirmed events lift this type of car. */
export interface EventWindow {
  from: string;
  to: string;
  /** peak combined uplift over the window, 0 to 0.35, already weighted by how well each event is confirmed */
  uplift: number;
  /** names of the events behind it, strongest first */
  names: string[];
  /** how many of those are curated or verified (full weight) */
  confirmed: number;
  provenance: Provenance;
}

export interface EngineContext {
  facts: FleetFacts;
  today: string;
  /** the team's minimum daily rate (never recommend below it) */
  minRate: number;
  eventWindows: (market: string, segment: SegmentKey) => EventWindow[];
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const pct0 = (x: number) => Math.round(x * 100);

function roundStep(rate: number): number {
  const step = rate < 300 ? 5 : rate < 1000 ? 10 : rate < 3000 ? 25 : 50;
  return Math.round(rate / step) * step;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pluralCars = (n: number) => `${n} ${n === 1 ? "car" : "cars"}`;

export function recommendRate(v: VehicleFacts, ctx: EngineContext): PriceRecommendation {
  const window = { from: ctx.today, to: addDays(ctx.today, HORIZON_DAYS - 1) };
  const cohort: CohortPace | undefined = ctx.facts.cohorts.find((c) => c.key === `${v.segment}|${v.market}`);
  const drivers: Driver[] = [];
  const holdReasons: string[] = [];
  const L = v.currentRate;

  const hold = (reason: string): PriceRecommendation => ({
    vehicleId: v.id,
    name: v.name,
    action: "hold",
    currentRate: L,
    recommendedRate: L,
    changePct: 0,
    confidence: "low",
    window,
    drivers: [],
    holdReasons: [reason],
    eventRates: [],
    estimate: null,
    speakable: `${v.name}: keep ${money(L)} a day. ${reason}`,
  });
  if (!(L > 0)) return hold("This car has no daily rate set.");
  if (v.outOfService) return hold("This car is out of service.");
  if (L < ctx.minRate) {
    return hold(`Its listed rate (${money(L)}) is below your minimum rate (${money(ctx.minRate)}), which looks like a data mistake. Fix the rate first and suggestions will follow.`);
  }

  // 1. PACE (sets the base rate) -----------------------------------------------------------------------------------
  let raise = 0;
  let lower = 0;
  let paceKnown = false;
  if (cohort?.pace != null) {
    paceKnown = true;
    const p = cohort.pace;
    raise = PACE_RAISE_MAX * clamp((p - PACE_RAISE_START) / (PACE_RAISE_FULL - PACE_RAISE_START), 0, 1);
    lower = PACE_LOWER_MAX * clamp((PACE_LOWER_START - p) / (PACE_LOWER_START - PACE_LOWER_FULL), 0, 1);
    const fwd = pct0(cohort.forwardShare ?? 0);
    const hist = pct0(cohort.historicalShare ?? 0);
    const detail = `The next 7 days are ${fwd}% booked for your ${pluralCars(cohort.vehicles)} of this type here; at this point in the week you are usually ${hist}% booked (last 60 days). That is ${Math.abs(pct0(p - 1))}% ${p >= 1 ? "ahead of" : "behind"} normal.`;
    if (raise > 0) drivers.push({ id: "pace", label: "Filling faster than usual", effectPct: pct0(raise), detail, provenance: cohort.provenance });
    else if (lower > 0) drivers.push({ id: "pace", label: "Filling slower than usual", effectPct: -pct0(lower), detail, provenance: cohort.provenance });
  } else {
    holdReasons.push(`Booking pace: ${cohort?.note ?? "not enough bookings of this type here to know what is normal."}`);
  }

  // 2. EVENTS (separate, date-specific) -------------------------------------------------------------------------------
  const windows = ctx.eventWindows(v.market, v.segment);
  const soonEvent = windows.some((w) => w.from <= addDays(ctx.today, 2));

  // 3. GUARD-RAILS on the base rate ---------------------------------------------------------------------------------------
  const real = v.rateRealization.value;
  if (raise > 0 && real != null && real < REALIZATION_BLOCK) {
    holdReasons.push(`Guests have been booking this car at ${pct0(real)}% of your listed rate (${v.achievedRate.provenance.n} bookings in the last 30 days), so a higher list price is unlikely to hold.`);
    drivers.push({ id: "realization", label: "Booked below list price", effectPct: 0, detail: `Average booked rate ${money(v.achievedRate.value ?? 0)} vs listed ${money(L)}.`, provenance: v.achievedRate.provenance });
    raise = 0;
  }
  if (raise > 0 && (v.trailing30.share ?? 0) < IDLE_BLOCK_SHARE) {
    holdReasons.push(`This car was booked only ${pct0(v.trailing30.share ?? 0)}% of the last 30 days: raising the price would not fix that.`);
    raise = 0;
  }
  if (lower > 0) {
    const soon = v.openDates14.filter((d) => d <= addDays(ctx.today, 2)).length;
    if (soon === 0) {
      holdReasons.push("The next 3 days are already booked, so a lower price would not add bookings.");
      lower = 0;
    } else if (soonEvent) {
      holdReasons.push("A confirmed event starts within 3 days, so this is not the moment to lower the price.");
      lower = 0;
    }
  }

  const rawChange = raise > 0 ? Math.min(MAX_RAISE, raise) : -Math.min(MAX_LOWER, lower);
  let base = roundStep(L * (1 + rawChange));
  if (base < ctx.minRate) {
    base = Math.max(ctx.minRate, L);
    drivers.push({ id: "floor", label: "Minimum rate", effectPct: 0, detail: `Your minimum rate is ${money(ctx.minRate)}.`, provenance: v.achievedRate.provenance });
  }
  const changePct = (base - L) / L;
  const action = Math.abs(changePct) < HOLD_BAND ? "hold" : changePct > 0 ? "raise" : "lower";
  const finalBase = action === "hold" ? L : base;

  // event premiums on top of the base we recommend
  // A discount to fill slow days this week must not drag the event dates down with it: quote off the listed rate then.
  const quoteBase = action === "lower" ? L : finalBase;
  const eventRates: EventRate[] = windows.map((w) => {
    const premium = Math.min(MAX_RAISE, EVENT_APPLY_SHARE * w.uplift);
    return {
      from: w.from,
      to: w.to,
      premiumPct: pct0(premium),
      rate: roundStep(quoteBase * (1 + premium)),
      names: w.names,
      confirmed: w.confirmed,
      provenance: w.provenance,
    };
  }).filter((e) => e.premiumPct >= 1 && e.rate > quoteBase);

  const confidence = confidenceOf(v, cohort, paceKnown);

  if (action === "hold") {
    if (!holdReasons.length) holdReasons.push("Nothing in your recent bookings points clearly up or down for the base rate.");
    return {
      vehicleId: v.id, name: v.name, action: "hold", currentRate: L, recommendedRate: L, changePct: 0, confidence,
      window, drivers, holdReasons, eventRates, estimate: null,
      speakable: `${v.name}: keep ${money(L)} a day. ${holdReasons[0]}${eventRates.length ? ` ${eventLine(eventRates[0])}` : ""}`,
    };
  }
  if (action === "lower" && confidence === "low") {
    return { ...hold("Bookings look slow, but there is not enough history to be confident a lower price would help."), drivers, eventRates };
  }

  // value of acting: only for raises, only with the assumption spelled out
  const openDays = v.openDates14.filter((d) => d <= window.to).length;
  const fill = v.trailing30.share;
  const estimate =
    action === "raise" && openDays > 0 && fill != null && fill > 0
      ? {
          extraRevenue: Math.round((base - L) * openDays * fill),
          openDays,
          assumption: `${openDays} open ${openDays === 1 ? "day" : "days"} this week, each booking at your recent fill rate (${pct0(fill)}%) and guests accepting the higher price.`,
        }
      : null;

  return {
    vehicleId: v.id, name: v.name, action, currentRate: L, recommendedRate: base, changePct: Math.round(changePct * 1000) / 1000,
    confidence, window, drivers, holdReasons, eventRates, estimate,
    speakable: `${v.name}: ${action} the base rate from ${money(L)} to ${money(base)} a day, ${changePct > 0 ? "up" : "down"} ${Math.abs(pct0(changePct))} percent, because ${drivers[0]?.label.toLowerCase() ?? "of recent bookings"}. Confidence ${confidence}.${eventRates.length ? ` ${eventLine(eventRates[0])}` : ""}`,
  };
}

function eventLine(e: EventRate): string {
  return `For ${niceRange(e.from, e.to)} (${e.names.slice(0, 2).join(", ")}), quote about ${money(e.rate)} a day, ${e.premiumPct} percent more.`;
}

function confidenceOf(v: VehicleFacts, cohort: CohortPace | undefined, paceKnown: boolean): Confidence {
  let score = 0;
  if (paceKnown && cohort) {
    score += cohort.provenance.n >= MIN_BOOKINGS_FOR_LOWER_CONFIDENCE ? 2 : 1;
    if (cohort.vehicles >= 3) score += 0.5;
  }
  if (v.rateRealization.value != null) score += v.achievedRate.provenance.n >= 5 ? 1 : 0.5;
  return score >= 2.5 ? "high" : score >= 1.5 ? "medium" : "low";
}

export function recommendRates(ctx: EngineContext): PriceRecommendation[] {
  return ctx.facts.vehicles.filter((v) => !v.outOfService).map((v) => recommendRate(v, ctx));
}
