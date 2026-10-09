/**
 * Date-specific rates, mirrored from the SQL functions `rate_for_day` and `quote_nightly`
 * (supabase/migrations/20261011000000_vehicle_rate_overrides.sql), which are the source of truth for what a night
 * costs. This copy exists so screens can show rates instantly for many cars and days, and so the pricing engine can
 * compare a booking with the rate that applied when it was made. Keep the two in step; the tests use the same cases.
 *
 * Precedence on a day: a manual override beats a MotorIQ override beats the base rate.
 */

export type OverrideSource = "manual" | "motoriq";

export interface RateOverride {
  id: string;
  vehicle_id: string;
  /** local calendar days, yyyy-MM-dd, inclusive */
  start_date: string;
  end_date: string;
  daily_rate: number | string;
  source: OverrideSource;
  reason?: string | null;
  event_ref?: string | null;
  created_at: string;
  revoked_at?: string | null;
}

export interface DayRate {
  rate: number;
  source: OverrideSource | "base";
  overrideId: string | null;
}

/**
 * The override in force for a car on a day. With `atMs`, the one that was in force at that moment (created before it and
 * not yet revoked), which is how a past booking is compared with the rate it was made at. Without it, active ones only.
 */
export function overrideForDay(overrides: readonly RateOverride[], vehicleId: string, day: string, atMs?: number): RateOverride | null {
  let best: RateOverride | null = null;
  for (const o of overrides) {
    if (o.vehicle_id !== vehicleId || day < o.start_date || day > o.end_date) continue;
    if (atMs == null) {
      if (o.revoked_at) continue;
    } else {
      const created = Date.parse(o.created_at);
      const revoked = o.revoked_at ? Date.parse(o.revoked_at) : Infinity;
      if (!(created <= atMs && atMs < revoked)) continue;
    }
    if (!best) { best = o; continue; }
    const better =
      (o.source === "manual" && best.source !== "manual") ||
      (o.source === best.source && Date.parse(o.created_at) > Date.parse(best.created_at));
    if (better) best = o;
  }
  return best;
}

/** The rate for one day: the override in force, else `baseRate` (the car's rate, or a duration-tier rate). */
export function rateForDay(overrides: readonly RateOverride[], vehicleId: string, day: string, baseRate: number, atMs?: number): DayRate {
  const o = overrideForDay(overrides, vehicleId, day, atMs);
  return o ? { rate: Number(o.daily_rate), source: o.source, overrideId: o.id } : { rate: baseRate, source: "base", overrideId: null };
}

/**
 * How an event quote (dates + rate) stands against a car's active date rates:
 * `applied` an exact MotorIQ range exists for those dates; `stale` it exists but at a different rate (the quote moved);
 * `manual` a rate set by hand covers some of those days and takes priority, so applying the quote would change nothing.
 */
export function quoteState(
  overrides: readonly RateOverride[],
  q: { from: string; to: string; rate: number },
): { applied: RateOverride | null; stale: boolean; manual: RateOverride | null } {
  const active = overrides.filter((o) => !o.revoked_at);
  const applied = active.find((o) => o.source === "motoriq" && o.start_date === q.from && o.end_date === q.to) ?? null;
  const manual = active.find((o) => o.source === "manual" && o.start_date <= q.to && o.end_date >= q.from) ?? null;
  const stale = !!applied && Math.round(Number(applied.daily_rate) * 100) !== Math.round(q.rate * 100);
  return { applied, stale, manual };
}
