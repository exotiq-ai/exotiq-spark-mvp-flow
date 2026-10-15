import { supabase } from "@/integrations/supabase/client";
import { addDays } from "@/lib/motoriq/facts";
import type { RateOverride } from "@/lib/motoriq/dateRates";
import type { RateChangeRow } from "@/lib/motoriq/outcomes";

/**
 * Date-specific rates for the signed-in team, shared by every component that needs them for a minute, and reloaded
 * everywhere when one is applied or reverted. Includes revoked rows from the recent past: the pricing engine needs
 * to know what was listed when a booking was made.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; p: Promise<{ rows: RateOverride[]; failed: boolean }> }>();
const listeners = new Set<() => void>();

export function loadRateOverrides(teamKey: string, today: string): Promise<{ rows: RateOverride[]; failed: boolean }> {
  const key = `${teamKey}|${today}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p;
  const p = Promise.resolve(
    (supabase as any)
      .from("vehicle_rate_overrides")
      .select("id,vehicle_id,start_date,end_date,daily_rate,source,reason,event_ref,created_at,revoked_at")
      .gte("end_date", addDays(today, -90)),
  ).then(
    ({ data, error }: { data: RateOverride[] | null; error: unknown }) => (error ? { rows: [], failed: true } : { rows: data ?? [], failed: false }),
    () => ({ rows: [] as RateOverride[], failed: true }),
  );
  cache.set(key, { at: Date.now(), p });
  return p;
}

/** Forget what was loaded and tell every subscriber to reload (after an apply or revert). */
export function invalidateRateOverrides() {
  cache.clear();
  changeCache.clear();
  listeners.forEach((l) => l());
}

export function subscribeRateOverrides(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * The team's base-rate changes from the vehicle change history (last 120 days), for measuring what they did.
 * Reloaded together with the date rates whenever one is applied or reverted.
 */
const changeCache = new Map<string, { at: number; p: Promise<{ rows: RateChangeRow[]; failed: boolean }> }>();
export function loadRateChanges(teamKey: string, today: string): Promise<{ rows: RateChangeRow[]; failed: boolean }> {
  const key = `${teamKey}|${today}`;
  const hit = changeCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p;
  const p = Promise.resolve(
    (supabase as any)
      .from("vehicle_change_log")
      .select("vehicle_id,old_value,new_value,change_source,created_at")
      .eq("field_name", "current_rate")
      .gte("created_at", `${addDays(today, -120)}T00:00:00Z`)
      .order("created_at", { ascending: false })
      .limit(500),
  ).then(
    ({ data, error }: { data: RateChangeRow[] | null; error: unknown }) => (error ? { rows: [], failed: true } : { rows: data ?? [], failed: false }),
    () => ({ rows: [] as RateChangeRow[], failed: true }),
  );
  changeCache.set(key, { at: Date.now(), p });
  return p;
}
