/**
 * Facts: everything MotorIQ states about the fleet is computed here from the tenant's bookings, vehicles and blocked
 * dates. Nothing is read from stored "utilization" or "suggested rate" columns (they are not maintained by anything).
 *
 * Day convention: a rental occupies ceil(hours / 24) dates starting on its start date, at least one. Dates are calendar
 * days in the TENANT'S time zone (a booking at 9 pm in Miami belongs to that evening's date, not to tomorrow's UTC date).
 * Counted bookings are active, confirmed and completed.
 */
import { matchDemandCity } from "../demandCities.ts";
import { classifyVehicleSegment as classifyVehicleSegmentClient } from "../eventTaxonomy.ts";
import type {
  BlockedRow,
  BookingRow,
  CohortPace,
  FleetFacts,
  Metric,
  Occupancy,
  Provenance,
  VehicleFacts,
  VehicleRow,
} from "./types.ts";

const DAY = 86_400_000;
export const COUNTED_STATUSES = new Set(["active", "confirmed", "completed"]);
const MAX_SPAN_DAYS = 400;

// ---------------------------------------------------------------------------
// Day helpers
// ---------------------------------------------------------------------------

export const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const dayMs = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
export const addDays = (d: string, n: number) => ymd(dayMs(d) + n * DAY);

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** A usable IANA zone name, or "UTC" when the value is missing or not a real zone. */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return "UTC"; }
}

/** The calendar day (yyyy-MM-dd) a moment falls on in a time zone. */
export function dayKey(ms: number, tz = "UTC"): string {
  const zone = safeTimeZone(tz);
  let f = dayFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(zone, f);
  }
  return f.format(ms);
}

/** Milliseconds a zone is ahead of UTC at a given moment (negative west of Greenwich). */
export function tzOffsetMs(ms: number, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(tz), hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(ms)) p[part.type] = part.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}

/** The last millisecond of a calendar day in a time zone (handles daylight-saving days). */
export function endOfLocalDay(day: string, tz = "UTC"): number {
  const zone = safeTimeZone(tz);
  const nextMidnightUtc = dayMs(day) + DAY;
  if (zone === "UTC") return nextMidnightUtc - 1;
  let t = nextMidnightUtc - tzOffsetMs(nextMidnightUtc, zone);
  t = nextMidnightUtc - tzOffsetMs(t, zone); // second pass settles days where the offset changes
  return t - 1;
}

/** Dates a booking occupies. */
export function occupiedDays(b: Pick<BookingRow, "start_date" | "end_date">, tz = "UTC"): string[] {
  const s = Date.parse(b.start_date);
  const e = Date.parse(b.end_date);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return [];
  const n = Math.min(MAX_SPAN_DAYS, Math.max(1, Math.ceil((e - s) / DAY)));
  const first = dayKey(s, tz);
  return Array.from({ length: n }, (_, i) => addDays(first, i));
}

/** Rate per occupied day: the booking's own daily rate, else its total spread over its days. */
export function bookingDayRate(b: BookingRow, days: number): number | null {
  const rate = Number(b.daily_rate);
  if (Number.isFinite(rate) && rate > 0) return rate;
  const total = Number(b.total_value);
  if (Number.isFinite(total) && total > 0 && days > 0) return total / days;
  return null;
}

const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

// ---------------------------------------------------------------------------
// Occupancy per car
// ---------------------------------------------------------------------------

interface DayEntry {
  rate: number | null;
  /** earliest booking creation time among bookings covering this day (ms), or null when unknown */
  firstCreated: number | null;
}

interface CarIndex {
  booked: Map<string, DayEntry>;
  blocked: Set<string>;
}

function buildIndex(vehicles: VehicleRow[], bookings: BookingRow[], blocked: BlockedRow[], tz: string): Map<string, CarIndex> {
  const idx = new Map<string, CarIndex>();
  for (const v of vehicles) idx.set(v.id, { booked: new Map(), blocked: new Set() });

  for (const b of bookings) {
    if (!b.vehicle_id || !COUNTED_STATUSES.has(String(b.status ?? "completed"))) continue;
    const car = idx.get(b.vehicle_id);
    if (!car) continue;
    const days = occupiedDays(b, tz);
    const rate = bookingDayRate(b, days.length);
    const created = b.created_at ? Date.parse(b.created_at) : NaN;
    for (const d of days) {
      const cur = car.booked.get(d);
      const firstCreated = Number.isFinite(created)
        ? cur?.firstCreated != null ? Math.min(cur.firstCreated, created) : created
        : cur?.firstCreated ?? null;
      car.booked.set(d, { rate: Math.max(cur?.rate ?? 0, rate ?? 0) || null, firstCreated });
    }
  }

  for (const r of blocked) {
    const car = idx.get(r.vehicle_id);
    if (!car) continue;
    const s = Date.parse(r.start_date);
    const e = Date.parse(r.end_date);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) continue;
    const first = dayKey(s, tz);
    const n = Math.min(MAX_SPAN_DAYS, Math.floor((dayMs(dayKey(e, tz)) - dayMs(first)) / DAY) + 1);
    for (const d of range(first, n)) car.blocked.add(d);
  }
  return idx;
}

function occupancy(car: CarIndex, from: string, n: number): Occupancy {
  let booked = 0;
  let available = 0;
  for (const d of range(from, n)) {
    if (car.blocked.has(d)) continue;
    available++;
    if (car.booked.has(d)) booked++;
  }
  return { booked, available, share: available > 0 ? booked / available : null };
}

const sumOcc = (parts: Occupancy[]): Occupancy => {
  const booked = parts.reduce((s, p) => s + p.booked, 0);
  const available = parts.reduce((s, p) => s + p.available, 0);
  return { booked, available, share: available > 0 ? booked / available : null };
};

const prov = (source: string, n: number, asOf: string): Provenance => ({ source, n, asOf });

// ---------------------------------------------------------------------------
// Cohort pace: is the near future filling faster or slower than it usually does at this lead time?
// ---------------------------------------------------------------------------

const PACE_HORIZON = 7;
const PACE_LOOKBACK = 60;

function cohortPace(
  key: string,
  segment: CohortPace["segment"],
  market: string,
  ids: string[],
  idx: Map<string, CarIndex>,
  bookings: BookingRow[],
  today: string,
  tz: string,
): CohortPace {
  const asOf = today;
  const base = { key, segment, market, vehicles: ids.length };
  const none = (note: string, n = 0): CohortPace => ({
    ...base, forwardShare: null, historicalShare: null, pace: null, provenance: prov("your bookings, last 60 days", n, asOf), note,
  });
  if (ids.length < 2) return none("Fewer than 2 cars of this type in this market.");

  const idSet = new Set(ids);
  const cohortBookings = bookings.filter((b) => b.vehicle_id && idSet.has(b.vehicle_id) && COUNTED_STATUSES.has(String(b.status ?? "completed")));
  const lookbackStart = addDays(today, -PACE_LOOKBACK);
  const inLookback = cohortBookings.filter((b) => occupiedDays(b, tz).some((d) => d >= lookbackStart && d < today));
  const missingCreated = inLookback.filter((b) => !b.created_at).length;
  if (inLookback.length < 12) return none(`Only ${inLookback.length} bookings in the last 60 days (needs 12).`, inLookback.length);
  if (missingCreated / inLookback.length > 0.3) return none("Many bookings have no creation date, so booking pace cannot be measured.", inLookback.length);

  // forward: share of cohort car-days already booked, per lead k (days ahead)
  const fwd: number[] = [];
  for (let k = 0; k < PACE_HORIZON; k++) {
    const day = addDays(today, k);
    let booked = 0, available = 0;
    for (const id of ids) {
      const car = idx.get(id)!;
      if (car.blocked.has(day)) continue;
      available++;
      if (car.booked.has(day)) booked++;
    }
    if (available > 0) fwd.push(booked / available);
  }
  if (!fwd.length) return none("No cars available in the next 7 days.", inLookback.length);

  // history: for each past day d and lead k, was the car already booked k days before d?
  const hist: number[] = [];
  for (let k = 0; k < PACE_HORIZON; k++) {
    let covered = 0, available = 0;
    for (let back = 1; back <= PACE_LOOKBACK; back++) {
      const d = addDays(today, -back);
      const cutoff = endOfLocalDay(addDays(d, -k), tz); // end of the (local) day k days before d
      for (const id of ids) {
        const car = idx.get(id)!;
        if (car.blocked.has(d)) continue;
        available++;
        const e = car.booked.get(d);
        if (e && e.firstCreated != null && e.firstCreated <= cutoff) covered++;
      }
    }
    if (available > 0) hist.push(covered / available);
  }
  const forwardShare = fwd.reduce((s, x) => s + x, 0) / fwd.length;
  const historicalShare = hist.length ? hist.reduce((s, x) => s + x, 0) / hist.length : null;
  if (historicalShare == null || historicalShare < 0.05) {
    return { ...base, forwardShare, historicalShare, pace: null, provenance: prov("your bookings, last 60 days", inLookback.length, asOf), note: "History is too thin to say what is normal." };
  }
  return {
    ...base,
    forwardShare,
    historicalShare,
    pace: forwardShare / historicalShare,
    provenance: prov("your bookings, last 60 days", inLookback.length, asOf),
  };
}

// ---------------------------------------------------------------------------
// The facts
// ---------------------------------------------------------------------------

export function computeFleetFacts(input: {
  vehicles: VehicleRow[];
  bookings: BookingRow[];
  blocked?: BlockedRow[];
  /** the tenant's local date (yyyy-MM-dd) */
  today: string;
  /** the tenant's IANA time zone; days are calendar days there (default UTC) */
  tz?: string;
}): FleetFacts {
  const { today } = input;
  const tz = safeTimeZone(input.tz);
  const live = input.vehicles.filter((v) => !v.archived_at && !v.trashed_at);
  const idx = buildIndex(live, input.bookings, input.blocked ?? [], tz);
  const countedAll = input.bookings.filter((b) => b.vehicle_id && COUNTED_STATUSES.has(String(b.status ?? "completed")));

  const vehicleFacts: VehicleFacts[] = live.map((v) => {
    const car = idx.get(v.id)!;
    const currentRate = Number(v.current_rate) || 0;
    const makeStr = String(v.make ?? "");
    const modelStr = String(v.model ?? "");

    // What guests charged in the last 30 days of bookings made (what the market accepted lately)
    const recent = countedAll.filter((b) => {
      if (b.vehicle_id !== v.id || !b.created_at) return false;
      const c = Date.parse(b.created_at);
      if (!Number.isFinite(c)) return false;
      const made = dayKey(c, tz);
      return made >= addDays(today, -29) && made <= today;
    });
    const rates = recent.map((b) => bookingDayRate(b, occupiedDays(b, tz).length)).filter((r): r is number => r != null);
    const achieved = rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null;
    const src = "bookings made in the last 30 days";

    const starts = countedAll
      .filter((b) => b.vehicle_id === v.id)
      .map((b) => dayKey(Date.parse(b.start_date), tz))
      .filter((d) => d <= today);
    const lastStart = starts.length ? starts.sort().pop()! : null;

    // booked-day revenue over the last 30 days, same definition as the fleet figure
    let earned = 0, earnedDays = 0;
    for (const d of range(addDays(today, -30), 30)) {
      const e = car.booked.get(d);
      if (!e || car.blocked.has(d)) continue;
      earnedDays++;
      earned += e.rate ?? 0;
    }

    const forward14 = occupancy(car, today, 14);
    const open14 = range(today, 14).filter((d) => !car.blocked.has(d) && !car.booked.has(d));

    return {
      id: v.id,
      name: v.name || [v.year, makeStr, modelStr].filter(Boolean).join(" ") || "Vehicle",
      make: makeStr,
      model: modelStr,
      segment: classifyVehicleSegmentClient(makeStr, modelStr),
      market: matchDemandCity(v.location)?.value ?? "other",
      currentRate,
      trailing30: occupancy(car, addDays(today, -30), 30),
      trailing7: occupancy(car, addDays(today, -7), 7),
      prior7: occupancy(car, addDays(today, -14), 7),
      forward7: occupancy(car, today, 7),
      forward14,
      forward30: occupancy(car, today, 30),
      openDates14: open14,
      achievedRate: {
        value: achieved,
        provenance: prov(src, rates.length, today),
        ...(rates.length === 0 ? { note: "No bookings were made for this car in the last 30 days." } : {}),
      },
      rateRealization: {
        value: rates.length >= 3 && currentRate > 0 && achieved != null ? achieved / currentRate : null,
        provenance: prov(src, rates.length, today),
        ...(rates.length < 3 ? { note: "Needs at least 3 recent bookings to compare with your listed rate." } : {}),
      },
      earnedLast30: earnedDays > 0 ? Math.round(earned) : null,
      bookingsCreated30: recent.length,
      daysSinceLastStart: lastStart ? Math.round((dayMs(today) - dayMs(lastStart)) / DAY) : null,
      outOfService: String(v.status ?? "").toLowerCase() === "maintenance",
    };
  });

  const active = vehicleFacts.filter((v) => !v.outOfService);
  const activeIds = new Set(active.map((v) => v.id));
  const revenueOn = (from: string, n: number): { total: number; days: number } => {
    let total = 0, days = 0;
    for (const id of activeIds) {
      const car = idx.get(id)!;
      for (const d of range(from, n)) {
        const e = car.booked.get(d);
        if (!e || car.blocked.has(d)) continue;
        days++;
        total += e.rate ?? 0;
      }
    }
    return { total, days };
  };
  const rev = (from: string, source: string): Metric => {
    const r = revenueOn(from, 30);
    return { value: r.days > 0 ? Math.round(r.total) : null, provenance: prov(source, r.days, today), ...(r.days === 0 ? { note: "No booked days in this period." } : {}) };
  };

  const pickups = (from: string, to: string) =>
    input.bookings.filter((b) => {
      if (!b.created_at || !COUNTED_STATUSES.has(String(b.status ?? "completed"))) return false;
      const made = dayKey(Date.parse(b.created_at), tz);
      return made >= from && made <= to;
    }).length;

  // cohorts: same type of car in the same market
  const groups = new Map<string, VehicleFacts[]>();
  for (const v of active) groups.set(`${v.segment}|${v.market}`, [...(groups.get(`${v.segment}|${v.market}`) ?? []), v]);
  const cohorts: CohortPace[] = [...groups.entries()].map(([key, list]) =>
    cohortPace(key, list[0].segment, list[0].market, list.map((v) => v.id), idx, input.bookings, today, tz),
  );

  return {
    asOf: today,
    timeZone: tz,
    vehicles: vehicleFacts,
    fleet: {
      vehicles: active.length,
      trailing30: sumOcc(active.map((v) => v.trailing30)),
      trailing7: sumOcc(active.map((v) => v.trailing7)),
      prior7: sumOcc(active.map((v) => v.prior7)),
      forward7: sumOcc(active.map((v) => v.forward7)),
      forward14: sumOcc(active.map((v) => v.forward14)),
      forward30: sumOcc(active.map((v) => v.forward30)),
      bookedRevenueNext30: rev(today, "booked days in the next 30 days at their booked daily rates"),
      earnedLast30: rev(addDays(today, -30), "booked days in the last 30 days at their booked daily rates"),
      earnedPrev30: rev(addDays(today, -60), "booked days in the 30 days before that"),
      openDays14: active.reduce((s, v) => s + v.openDates14.length, 0),
      pickups: {
        last7: pickups(addDays(today, -6), today),
        prev7: pickups(addDays(today, -13), addDays(today, -7)),
        provenance: prov("bookings by the date they were made", pickups(addDays(today, -13), today), today),
      },
    },
    cohorts,
  };
}
