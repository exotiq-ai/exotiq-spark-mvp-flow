/**
 * "What actually happened": measure a tenant's own results around past events, per vehicle class.
 *
 * For each past curated event (the server's calendar for past dates) we compare two things in the event's window with
 * the same tenant's days in the 28 days before and after (excluding every other curated event window):
 *   - rate: what the booked cars were charged, relative to each car's own typical rate (so a mix of cheap and expensive
 *     cars does not fake a lift);
 *   - demand: how many bookings STARTED per vehicle per day.
 * Each comes with an uncertainty range. We only claim a lift when the whole range is above zero, and say "not enough
 * bookings yet" below a minimum sample. Pure functions, no network.
 */
import { classifyVehicleSegmentClient } from "./eventImpact.ts";
import type { SegmentKey } from "./eventImpact.ts";

export interface LiftBooking {
  vehicle_id: string | null;
  start_date: string;
  end_date: string;
  daily_rate: number | string | null;
  status?: string | null;
}

export interface LiftVehicle {
  id: string;
  make?: string | null;
  model?: string | null;
}

export interface PastEvent {
  name: string;
  /** yyyy-MM-dd */
  startDate: string;
  endDate: string;
  /** what the model predicted for each class, as a multiplier (1.12 = +12%) */
  segmentImpact?: Partial<Record<SegmentKey, number>>;
}

export type Verdict = "clear-lift" | "no-clear-lift" | "lower" | "not-enough-data";

export interface Estimate {
  /** percent change, e.g. 11 means +11% */
  pct: number;
  /** 90% range, in percent */
  lo: number;
  hi: number;
}

export interface LiftResult {
  event: string;
  start: string;
  end: string;
  segment: SegmentKey;
  vehicles: number;
  bookingsInWindow: number;
  bookingsInBaseline: number;
  rate: Estimate | null;
  demand: Estimate | null;
  /** What the model predicted for this class (percent), for comparison. */
  predictedPct: number | null;
  verdict: Verdict;
}

export const MIN_VEHICLES = 3;
export const MIN_WINDOW_BOOKINGS = 8;
export const MIN_BASELINE_BOOKINGS = 20;
const BASELINE_DAYS = 28;
const Z90 = 1.645;
const DAY = 86_400_000;
const COUNTED = new Set(["active", "confirmed", "completed"]);

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const day = (s: string) => Date.parse(s.slice(0, 10));
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sd = (a: number[]) => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const median = (a: number[]) => {
  const b = [...a].sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};

function daysBetween(from: number, to: number): string[] {
  const out: string[] = [];
  for (let t = from; t <= to; t += DAY) out.push(iso(t));
  return out;
}

/** Percent change of a ratio of means with a 90% range (delta method). */
function ratioEstimate(win: number[], base: number[]): Estimate | null {
  if (win.length < 2 || base.length < 2) return null;
  const mw = mean(win), mb = mean(base);
  if (!(mw > 0) || !(mb > 0)) return null;
  const seW = sd(win) / Math.sqrt(win.length), seB = sd(base) / Math.sqrt(base.length);
  const ratio = mw / mb;
  const se = ratio * Math.sqrt((seW / mw) ** 2 + (seB / mb) ** 2);
  return { pct: (ratio - 1) * 100, lo: (ratio - Z90 * se - 1) * 100, hi: (ratio + Z90 * se - 1) * 100 };
}

/** Ratio of two Poisson-ish rates (events per exposure) with a 90% range on the log scale. */
function rateRatioEstimate(winCount: number, winExposure: number, baseCount: number, baseExposure: number): Estimate | null {
  if (winCount < 1 || baseCount < 1 || winExposure <= 0 || baseExposure <= 0) return null;
  const ratio = (winCount / winExposure) / (baseCount / baseExposure);
  const seLog = Math.sqrt(1 / winCount + 1 / baseCount);
  return {
    pct: (ratio - 1) * 100,
    lo: (ratio * Math.exp(-Z90 * seLog) - 1) * 100,
    hi: (ratio * Math.exp(Z90 * seLog) - 1) * 100,
  };
}

function verdictOf(rate: Estimate | null, demand: Estimate | null, enough: boolean): Verdict {
  if (!enough) return "not-enough-data";
  const parts = [rate, demand].filter((e): e is Estimate => !!e);
  if (!parts.length) return "not-enough-data";
  if (parts.some((e) => e.lo > 0)) return "clear-lift";
  if (parts.every((e) => e.hi < 0)) return "lower";
  return "no-clear-lift";
}

/**
 * Measure each past event for each vehicle class that has enough cars. `allEventWindows` lists every curated window of
 * the market (past and present) so baseline days never fall inside another event.
 */
export function measurePastEvents(opts: {
  events: PastEvent[];
  allEventWindows: Array<{ startDate: string; endDate: string }>;
  bookings: LiftBooking[];
  vehicles: LiftVehicle[];
}): LiftResult[] {
  const seg = new Map<string, SegmentKey>();
  const perSegment = new Map<SegmentKey, Set<string>>();
  for (const v of opts.vehicles) {
    const s = classifyVehicleSegmentClient(v.make, v.model);
    seg.set(v.id, s);
    perSegment.set(s, (perSegment.get(s) ?? new Set()).add(v.id));
  }

  // Usable bookings with each car's own typical rate, so a rate index of 1.0 means "its usual price".
  const rates = new Map<string, number[]>();
  const usable = opts.bookings.filter((b) => {
    const r = Number(b.daily_rate);
    return b.vehicle_id && seg.has(b.vehicle_id) && Number.isFinite(r) && r > 0 && COUNTED.has(String(b.status ?? "completed")) &&
      day(b.end_date) >= day(b.start_date);
  });
  for (const b of usable) rates.set(b.vehicle_id!, [...(rates.get(b.vehicle_id!) ?? []), Number(b.daily_rate)]);
  const typical = new Map<string, number>();
  for (const [id, list] of rates) if (list.length >= 3) typical.set(id, median(list));

  const blocked = new Set<string>();
  for (const w of opts.allEventWindows) for (const d of daysBetween(day(w.startDate), day(w.endDate))) blocked.add(d);

  const results: LiftResult[] = [];
  for (const ev of opts.events) {
    const winDays = daysBetween(day(ev.startDate), day(ev.endDate));
    if (winDays.length < 1) continue;
    const baseDays = [
      ...daysBetween(day(ev.startDate) - BASELINE_DAYS * DAY, day(ev.startDate) - DAY),
      ...daysBetween(day(ev.endDate) + DAY, day(ev.endDate) + BASELINE_DAYS * DAY),
    ].filter((d) => !blocked.has(d));
    const winSet = new Set(winDays), baseSet = new Set(baseDays);

    for (const [segment, ids] of perSegment) {
      if (ids.size < MIN_VEHICLES) continue;
      const mine = usable.filter((b) => ids.has(b.vehicle_id!));
      const overlaps = (b: LiftBooking, set: Set<string>) =>
        daysBetween(day(b.start_date), day(b.end_date)).some((d) => set.has(d));
      const inWin = mine.filter((b) => overlaps(b, winSet));
      const inBase = mine.filter((b) => overlaps(b, baseSet));

      const idx = (b: LiftBooking) => {
        const t = typical.get(b.vehicle_id!);
        return t ? Number(b.daily_rate) / t : NaN;
      };
      const rate = ratioEstimate(inWin.map(idx).filter(Number.isFinite), inBase.map(idx).filter(Number.isFinite));
      const startsWin = mine.filter((b) => winSet.has(b.start_date.slice(0, 10))).length;
      const startsBase = mine.filter((b) => baseSet.has(b.start_date.slice(0, 10))).length;
      const demand = rateRatioEstimate(startsWin, winDays.length * ids.size, startsBase, baseDays.length * ids.size);

      const enough = inWin.length >= MIN_WINDOW_BOOKINGS && inBase.length >= MIN_BASELINE_BOOKINGS && baseDays.length >= 14;
      const predicted = ev.segmentImpact?.[segment];
      results.push({
        event: ev.name,
        start: ev.startDate,
        end: ev.endDate,
        segment,
        vehicles: ids.size,
        bookingsInWindow: inWin.length,
        bookingsInBaseline: inBase.length,
        rate: enough ? rate : null,
        demand: enough ? demand : null,
        predictedPct: predicted ? Math.round((predicted - 1) * 100) : null,
        verdict: verdictOf(rate, demand, enough),
      });
    }
  }
  return results;
}

/** The most recent past occurrence of each named event, so "last time" is one line per event. */
export function latestPerEvent<T extends { name: string; endDate: string }>(past: T[], today: string): T[] {
  const best = new Map<string, T>();
  for (const e of past) {
    if (e.endDate >= today) continue;
    const cur = best.get(e.name);
    if (!cur || e.endDate > cur.endDate) best.set(e.name, e);
  }
  return [...best.values()];
}
