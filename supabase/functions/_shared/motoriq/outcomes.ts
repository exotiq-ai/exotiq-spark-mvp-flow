/**
 * Results: what did the rate changes the tenant actually made do?
 *
 * Two things are measured, each against similar cars as a yardstick (same type of car, same market, no rate change of
 * their own nearby), because "booked 100% on race weekend" means nothing if every car was booked that weekend:
 *
 *  1. Date-specific rates (set by hand or applied from a MotorIQ quote): how many of the nights were booked, how that
 *     compares with similar cars on the same nights, and on nights whose booking was made AFTER the rate was set, what
 *     guests paid above the base rate.
 *  2. Base-rate changes (from the vehicle's change history): bookings the car received in the 14 days after the
 *     change versus the 14 days before, against the same swing for similar cars.
 *
 * This is evidence, not proof: the tenant chose which cars and dates to change, small samples are noisy, and some nights
 * would have booked at the base rate too, so "extra revenue" is an upper bound for the premium. Every result carries its
 * sample sizes and a confidence, and says "not enough to tell" instead of guessing. Pure functions; nothing here
 * changes any price or constant.
 */
import { COUNTED_STATUSES, addDays, bookingDayRate, dayKey, dayMs, occupiedDays, safeTimeZone } from "./facts.ts";
import { niceRange } from "./format.ts";
import type { RateOverride } from "./dateRates.ts";
import type {
  BaseChangeOutcome, BookingRow, Confidence, DateRateOutcome, FleetFacts, OutcomeReport, VehicleFacts,
} from "./types.ts";

/** A row of the vehicle change history for field `current_rate`. */
export interface RateChangeRow {
  vehicle_id: string;
  old_value: string | null;
  new_value: string | null;
  change_source?: string | null;
  created_at: string;
}

export const OUTCOME_WINDOW_DAYS = 14;
/** a base-rate change smaller than this is noise */
export const MIN_CHANGE_PCT = 0.03;
/** how many similar cars we need before comparing at all, and for a medium-confidence result */
export const MIN_CONTROL_CARS = 3;
export const MEDIUM_CONTROL_CARS = 5;
/** demand "held" when the car was booked within this many points of similar cars */
export const HELD_TOLERANCE_PTS = 10;
/** fewer bookings than this around a change (the car and its similar cars together) cannot say anything */
export const MIN_ACTIVITY = 3;
const MAX_WINDOW_NIGHTS = 31;

const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sd = (a: number[]) => {
  const m = mean(a);
  return a.length > 1 && m != null ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0;
};
/** a difference must exceed this many "noise" units before it is called a difference (about a 90% two-sided range) */
const Z90 = 1.645;
const pctWhole = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

interface CarBooking {
  days: string[];
  rate: number | null;
  created: number | null;
  createdDay: string | null;
}

function indexBookings(bookings: readonly BookingRow[], tz: string): Map<string, CarBooking[]> {
  const byCar = new Map<string, CarBooking[]>();
  for (const b of bookings) {
    if (!b.vehicle_id || !COUNTED_STATUSES.has(String(b.status ?? "completed"))) continue;
    const days = occupiedDays(b, tz);
    if (days.length === 0) continue;
    const created = b.created_at ? Date.parse(b.created_at) : NaN;
    const list = byCar.get(b.vehicle_id) ?? [];
    list.push({
      days,
      rate: bookingDayRate(b, days.length),
      created: Number.isFinite(created) ? created : null,
      createdDay: Number.isFinite(created) ? dayKey(created, tz) : null,
    });
    byCar.set(b.vehicle_id, list);
  }
  return byCar;
}

const bookedOn = (list: CarBooking[] | undefined, day: string) => (list ?? []).filter((b) => b.days.includes(day));

// ---------------------------------------------------------------------------
// 1. Date-specific rates
// ---------------------------------------------------------------------------

function measureDateRate(
  o: RateOverride,
  car: VehicleFacts,
  cars: readonly VehicleFacts[],
  byCar: Map<string, CarBooking[]>,
  overrides: readonly RateOverride[],
  today: string,
  tz: string,
): DateRateOutcome | null {
  const createdMs = Date.parse(o.created_at);
  if (!Number.isFinite(createdMs)) return null;

  // a range revoked before its first night never priced anything
  let last = o.end_date;
  if (o.revoked_at) {
    const revokedDay = dayKey(Date.parse(o.revoked_at), tz);
    if (revokedDay <= o.start_date) return null;
    if (revokedDay <= last) last = addDays(revokedDay, -1);
  }
  const from = o.start_date;
  const span = Math.floor((dayMs(last) - dayMs(from)) / 86_400_000) + 1;
  const nights = Math.min(MAX_WINDOW_NIGHTS, Math.max(0, span));
  if (nights < 1) return null;
  const days = Array.from({ length: nights }, (_, i) => addDays(from, i));
  const to = days[days.length - 1];

  const status: DateRateOutcome["status"] = today < from ? "upcoming" : today <= to ? "running" : "finished";
  const mine = byCar.get(car.id);
  const baseRate = car.currentRate;
  const rate = Number(o.daily_rate);

  let booked = 0;
  let bookedAfter = 0;
  let extra = 0;
  let extraNights = 0;
  for (const d of days) {
    const hits = bookedOn(mine, d);
    if (hits.length === 0) continue;
    booked++;
    const after = hits.filter((h) => h.created != null && h.created >= createdMs);
    if (after.length > 0 && hits.length === after.length) {
      bookedAfter++;
      const paid = after.find((h) => h.rate != null)?.rate;
      if (paid != null && baseRate > 0) { extra += paid - baseRate; extraNights++; }
    }
  }

  // similar cars on the same nights: same type and market, and not carrying a date rate of their own that night.
  // Each is measured over the nights it was eligible; the spread between them is the noise a difference must beat.
  const pool = cars.filter((c) => c.id !== car.id && !c.outOfService && c.segment === car.segment && c.market === car.market);
  const tally = new Map<string, { booked: number; days: number }>();
  for (const d of days) {
    const eligible = pool.filter((c) => !overrides.some((x) => x.vehicle_id === c.id && !x.revoked_at && d >= x.start_date && d <= x.end_date));
    if (eligible.length < MIN_CONTROL_CARS) continue;
    for (const c of eligible) {
      const t = tally.get(c.id) ?? { booked: 0, days: 0 };
      t.days++;
      if (bookedOn(byCar.get(c.id), d).length > 0) t.booked++;
      tally.set(c.id, t);
    }
  }
  const ctrlShares = [...tally.values()].map((t) => t.booked / t.days);
  const controlShare = mean(ctrlShares);
  const controlCars = ctrlShares.length;
  const share = booked / nights;
  const diffPts = controlShare == null ? null : Math.round((share - controlShare) * 100);
  // "softer" needs the car to trail similar cars by more than ordinary variation among them (and by at least the tolerance)
  const softerBy = Math.max(HELD_TOLERANCE_PTS, Math.round(Z90 * sd(ctrlShares) * 100));

  let verdict: DateRateOutcome["verdict"];
  if (status !== "finished") verdict = "too-early";
  else if (diffPts == null) verdict = "no-comparison";
  else verdict = diffPts > -softerBy ? "held" : "softer";

  const confidence: Confidence = status === "finished" && diffPts != null && controlCars >= MEDIUM_CONTROL_CARS && nights >= 2 ? "medium" : "low";
  const extraRevenue = extraNights > 0 ? Math.round(extra) : null;

  const where = `${car.name} ${niceRange(from, to)} at ${money(rate)}`;
  let sentence: string;
  const bookedText = `${booked} of ${plural(nights, "night")} booked`;
  const cmp = controlShare == null ? "" : ` (similar cars: ${pctWhole(controlShare)} booked)`;
  if (status === "upcoming") sentence = `${where}: ${bookedText} so far.`;
  else if (status === "running") sentence = `${where}: ${bookedText} so far${cmp}. It is still running.`;
  else if (verdict === "no-comparison") sentence = `${where}: ${bookedText}. There were too few similar cars to compare with.`;
  else {
    const held = verdict === "held" ? "Demand held." : "Demand was softer than for similar cars.";
    const pay = extraRevenue != null && extraRevenue > 0
      ? ` Nights booked after you set it paid about ${money(extraRevenue)} more than the base rate.`
      : "";
    sentence = `${where}: ${bookedText}${cmp}. ${held}${pay}`;
  }

  return {
    kind: "date-rate", id: o.id, vehicleId: car.id, name: car.name, from, to, rate, baseRate,
    source: o.source, reason: o.reason ?? null, status, nights, bookedNights: booked, bookedAfter, share,
    controlShare, controlCars, diffPts, extraRevenue, verdict, confidence, sentence,
  };
}

// ---------------------------------------------------------------------------
// 2. Base-rate changes
// ---------------------------------------------------------------------------

const num = (v: string | null | undefined) => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

function createdIn(list: CarBooking[] | undefined, fromDay: string, toDayExclusive: string): CarBooking[] {
  return (list ?? []).filter((b) => b.createdDay != null && b.createdDay >= fromDay && b.createdDay < toDayExclusive);
}

function measureBaseChanges(
  changes: readonly RateChangeRow[],
  cars: readonly VehicleFacts[],
  byCar: Map<string, CarBooking[]>,
  today: string,
  tz: string,
): BaseChangeOutcome[] {
  const byId = new Map(cars.map((c) => [c.id, c]));
  // every meaningful change, with its local day, so a "similar car" that changed its own rate nearby is not a yardstick
  const meaningful = changes
    .map((c) => {
      const from = num(c.old_value);
      const to = num(c.new_value);
      const t = Date.parse(c.created_at);
      if (!(from > 0) || !(to > 0) || !Number.isFinite(t)) return null;
      const changePct = (to - from) / from;
      if (Math.abs(changePct) < MIN_CHANGE_PCT) return null;
      return { row: c, from, to, changePct, at: dayKey(t, tz) };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const N = OUTCOME_WINDOW_DAYS;
  const out: BaseChangeOutcome[] = [];
  for (const m of meaningful) {
    const car = byId.get(m.row.vehicle_id);
    if (!car || car.outOfService) continue;
    const daysSince = Math.floor((dayMs(today) - dayMs(m.at)) / 86_400_000);
    if (daysSince < 0) continue;
    const beforeFrom = addDays(m.at, -N);
    const afterTo = addDays(m.at, N);
    const mine = byCar.get(car.id);
    const before = createdIn(mine, beforeFrom, m.at);
    const after = createdIn(mine, m.at, afterTo);
    const status = daysSince >= N ? "finished" : "measuring";

    const quietFrom = addDays(m.at, -2 * N);
    const pool = cars.filter((c) => {
      if (c.id === car.id || c.outOfService || c.segment !== car.segment || c.market !== car.market) return false;
      return !meaningful.some((x) => x.row.vehicle_id === c.id && x.at >= quietFrom && x.at <= afterTo);
    });
    const ctrlBefore = pool.map((c) => createdIn(byCar.get(c.id), beforeFrom, m.at).length);
    const ctrlAfter = pool.map((c) => createdIn(byCar.get(c.id), m.at, afterTo).length);
    const comparable = pool.length >= MIN_CONTROL_CARS;
    const cb = comparable ? mean(ctrlBefore) : null;
    const ca = comparable ? mean(ctrlAfter) : null;
    const activity = before.length + after.length + ctrlBefore.reduce((x, y) => x + y, 0) + ctrlAfter.reduce((x, y) => x + y, 0);

    // The car must have moved by more than similar cars ordinarily differ from each other, and by more than counting
    // noise (about the square root of the bookings counted), before it is called more or fewer.
    let verdict: BaseChangeOutcome["verdict"];
    let why = "";
    let diff = 0;
    let noise = 1;
    if (status === "measuring") verdict = "too-early";
    else if (cb == null || ca == null) { verdict = "no-comparison"; why = "Too few similar cars to compare with."; }
    else if (ca === 0 && after.length === 0 && cb >= MIN_ACTIVITY) {
      verdict = "no-comparison";
      why = "No bookings were recorded for any similar car in the 14 days after either, so there is nothing to compare with (the booking record may have stopped in that period).";
    } else if (activity < MIN_ACTIVITY) { verdict = "no-comparison"; why = "There were hardly any bookings around that date, so nothing can be read from it."; }
    else {
      diff = (after.length - before.length) - (ca - cb);
      noise = Math.max(sd(ctrlAfter.map((x, i) => x - ctrlBefore[i])), Math.sqrt(Math.max(1, cb + ca)));
      verdict = Math.abs(diff) >= Z90 * noise ? (diff > 0 ? "more-bookings" : "fewer-bookings") : "similar";
    }
    const confidence: Confidence =
      status === "finished" && (verdict === "more-bookings" || verdict === "fewer-bookings" || verdict === "similar") && pool.length >= MEDIUM_CONTROL_CARS && cb! + ca! >= MIN_ACTIVITY ? "medium" : "low";

    const dir = m.changePct > 0 ? "raised" : "lowered";
    const head = `${car.name}: you ${dir} the base rate from ${money(m.from)} to ${money(m.to)} on ${niceRange(m.at, m.at)}.`;
    const fmt = (x: number) => (Math.round(x * 10) / 10).toString();
    let sentence: string;
    if (verdict === "too-early") sentence = `${head} It has been ${plural(daysSince, "day")}; I need ${N} to compare (${plural(after.length, "booking")} made so far).`;
    else if (verdict === "no-comparison") sentence = `${head} Bookings made: ${before.length} in the ${N} days before, ${after.length} after. ${why}`;
    else {
      const read = verdict === "more-bookings" ? "More bookings than similar cars" : verdict === "fewer-bookings" ? "Fewer bookings than similar cars" : "About the same as similar cars";
      sentence = `${head} Bookings made: ${before.length} in the ${N} days before, ${after.length} after; similar cars averaged ${fmt(cb!)} then ${fmt(ca!)}. ${read}.`;
    }

    out.push({
      kind: "base-rate", id: `${m.row.vehicle_id}|${m.row.created_at}`, vehicleId: car.id, name: car.name, at: m.at,
      from: m.from, to: m.to, changePct: Math.round(m.changePct * 1000) / 1000, source: m.row.change_source ?? null,
      daysSince, before: before.length, after: after.length, controlCars: pool.length, controlBefore: cb, controlAfter: ca,
      verdict, confidence, sentence,
    });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export function computeOutcomes(input: {
  facts: FleetFacts;
  bookings: readonly BookingRow[];
  overrides: readonly RateOverride[];
  rateChanges: readonly RateChangeRow[];
  today: string;
  tz?: string;
}): OutcomeReport | null {
  const tz = safeTimeZone(input.tz ?? input.facts.timeZone);
  const { facts, today } = input;
  const byCar = indexBookings(input.bookings, tz);
  const byId = new Map(facts.vehicles.map((v) => [v.id, v]));

  const dateRates = input.overrides
    .map((o) => {
      const car = byId.get(o.vehicle_id);
      return car ? measureDateRate(o, car, facts.vehicles, byCar, input.overrides, today, tz) : null;
    })
    .filter((x): x is DateRateOutcome => x != null)
    .sort((a, b) => (a.from < b.from ? 1 : -1));
  const baseChanges = measureBaseChanges(input.rateChanges, facts.vehicles, byCar, today, tz);

  if (dateRates.length === 0 && baseChanges.length === 0) return null;

  const finished = dateRates.filter((d) => d.status === "finished");
  const compared = finished.filter((d) => d.verdict === "held" || d.verdict === "softer");
  const held = compared.filter((d) => d.verdict === "held").length;
  const softer = compared.length - held;
  const extraRevenue = Math.round(finished.reduce((s, d) => s + (d.extraRevenue ?? 0), 0));
  const liveRates = dateRates.filter((d) => d.status !== "finished").length;

  let headline: string | null = null;
  if (compared.length > 0) {
    const softText = softer > 0 ? ` and was softer on ${softer}` : "";
    const extraText = extraRevenue > 0 ? ` Nights booked after you set the rates paid about ${money(extraRevenue)} more than your base rates.` : "";
    headline = `Of ${plural(compared.length, "finished date rate")} I could compare with similar cars, demand held on ${held}${softText}.${extraText}`;
  } else if (liveRates > 0) {
    const nights = dateRates.filter((d) => d.status !== "finished");
    const b = nights.reduce((s, d) => s + d.bookedNights, 0);
    const n = nights.reduce((s, d) => s + d.nights, 0);
    headline = `${plural(liveRates, "date rate")} ${liveRates === 1 ? "is" : "are"} live or coming up: ${b} of ${plural(n, "night")} booked so far. I will have results once they finish.`;
  } else if (baseChanges.length > 0) {
    const readable = baseChanges.filter((c) => c.verdict === "more-bookings" || c.verdict === "fewer-bookings" || c.verdict === "similar");
    const measuring = baseChanges.filter((c) => c.verdict === "too-early").length;
    if (readable.length > 0) {
      const more = readable.filter((c) => c.verdict === "more-bookings").length;
      const fewer = readable.filter((c) => c.verdict === "fewer-bookings").length;
      const same = readable.length - more - fewer;
      const parts = [more > 0 ? `${more} drew more bookings` : null, fewer > 0 ? `${fewer} drew fewer` : null, same > 0 ? `${same} about the same` : null].filter(Boolean);
      headline = `Of your base-rate changes I could compare ${readable.length} with similar cars: ${parts.join(", ")}.`;
    } else if (measuring > 0) {
      headline = `${plural(measuring, "recent base-rate change")} ${measuring === 1 ? "is" : "are"} still being measured; I need ${OUTCOME_WINDOW_DAYS} days of bookings after a change.`;
    }
  }
  const caveat = compared.length > 0
    ? " This is your own data, compared with similar cars; you chose which cars and dates, so it is evidence rather than proof, and nights that booked after the rate was set might also have booked at the base rate."
    : "";

  return {
    asOf: today,
    dateRates,
    baseChanges,
    summary: { comparedRates: compared.length, held, softer, extraRevenue, liveRates },
    headline,
    speakable: headline ? `${headline}${caveat}` : null,
    provenance: {
      source: "your bookings and the rate changes you made, compared with similar cars",
      n: dateRates.length + baseChanges.length,
      asOf: today,
    },
  };
}
