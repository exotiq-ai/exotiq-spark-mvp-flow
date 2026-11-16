/**
 * Fleet → Pricing, Rates & deposit view: each car's daily, 3-hour, 6-hour and multi-day rates and its pickup
 * deposit hold (vehicles.deposit_override_cents; empty = the team default, which is what checkout charges).
 */
export interface RateVehicle {
  id: string;
  current_rate: number | null;
  rate_3hr?: number | null;
  rate_6hr?: number | null;
  rate_multiday?: number | null;
  deposit_override_cents?: number | null;
}

/** One editable row, as typed. */
export interface RateRow {
  id: string;
  daily: string;
  h3: string;
  h6: string;
  multiday: string;
  /** dollars; empty = team default */
  deposit: string;
}

export type RateTier = 'h3' | 'h6' | 'multiday';

export type RateUpdates = Partial<{
  current_rate: number;
  rate_3hr: number | null;
  rate_6hr: number | null;
  rate_multiday: number | null;
  deposit_override_cents: number | null;
}>;

const LABEL: Record<'daily' | RateTier, string> = { daily: 'Daily', h3: '3-hour', h6: '6-hour', multiday: 'Multi-day' };

/** The team's minimum rental rate, or null when the team has not set one (no invented floor). */
export function teamRateFloor(team: { min_rate?: number | null } | null | undefined): number | null {
  const n = Number(team?.min_rate);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const text = (n: number | null | undefined) => (n == null ? '' : String(Number(n)));

export function rateRowFrom(v: RateVehicle): RateRow {
  const dep = v.deposit_override_cents;
  return {
    id: v.id,
    daily: text(v.current_rate),
    h3: text(v.rate_3hr),
    h6: text(v.rate_6hr),
    multiday: text(v.rate_multiday),
    deposit: dep == null ? '' : String(Math.round(Number(dep)) / 100),
  };
}

/** Parse money as typed: "1,250.50", "$900". null = empty, undefined = not valid. */
function money(raw: string): number | null | undefined {
  const s = raw.trim().replace(/^\$/, '').replace(/,/g, '');
  if (s === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  return Number(s);
}

const same = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? a == null && b == null : Math.round(Number(a) * 100) === Math.round(Number(b) * 100);

export function rateRowChanges(
  row: RateRow,
  v: RateVehicle,
  floor: number | null,
): { ok: true; updates: RateUpdates } | { ok: false; error: string } {
  const saved: Record<'daily' | RateTier, number | null> = {
    daily: v.current_rate ?? null,
    h3: v.rate_3hr ?? null,
    h6: v.rate_6hr ?? null,
    multiday: v.rate_multiday ?? null,
  };
  const values: Record<'daily' | RateTier, number | null> = { daily: null, h3: null, h6: null, multiday: null };
  for (const key of ['daily', 'h3', 'h6', 'multiday'] as const) {
    const n = money(row[key]);
    if (n === undefined) return { ok: false, error: `${LABEL[key]}: enter an amount like 450` };
    if (n !== null && n <= 0) return { ok: false, error: `${LABEL[key]} must be more than 0` };
    // The minimum applies to rates being changed; a saved rate nobody touched is left alone.
    if (n !== null && floor !== null && n < floor && !same(n, saved[key])) {
      return { ok: false, error: `${LABEL[key]} must be at least ${floor}` };
    }
    values[key] = n;
  }
  if (values.daily === null) return { ok: false, error: 'Daily rate is required' };

  const dep = money(row.deposit);
  if (dep === undefined) return { ok: false, error: 'Deposit: enter an amount like 1500, or leave empty for the team default' };
  const depositCents = dep === null ? null : Math.round(dep * 100);

  const updates: RateUpdates = {};
  if (!same(values.daily, v.current_rate)) updates.current_rate = values.daily;
  if (!same(values.h3, v.rate_3hr ?? null)) updates.rate_3hr = values.h3;
  if (!same(values.h6, v.rate_6hr ?? null)) updates.rate_6hr = values.h6;
  if (!same(values.multiday, v.rate_multiday ?? null)) updates.rate_multiday = values.multiday;
  if (depositCents !== (v.deposit_override_cents ?? null)) updates.deposit_override_cents = depositCents;
  return { ok: true, updates };
}

/**
 * Fill one tier on every row as a percentage of that row's daily rate (as typed), rounded to the dollar.
 * Rows without a daily rate, or whose result would fall under the team minimum, are left as they were.
 * Nothing is saved: the operator reviews the rows and presses Save.
 */
export function applyTierRule(
  rows: Record<string, RateRow>,
  tier: RateTier,
  percent: number,
  floor: number | null,
): { rows: Record<string, RateRow>; filled: number; skipped: string[] } {
  const next: Record<string, RateRow> = {};
  const skipped: string[] = [];
  let filled = 0;
  for (const [id, row] of Object.entries(rows)) {
    const daily = money(row.daily);
    const value = daily ? Math.round((daily * percent) / 100) : null;
    if (!value || value <= 0 || (floor !== null && value < floor)) {
      skipped.push(id);
      next[id] = row;
      continue;
    }
    next[id] = { ...row, [tier]: String(value) };
    filled++;
  }
  return { rows: next, filled, skipped };
}
