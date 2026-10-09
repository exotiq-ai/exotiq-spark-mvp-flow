import { supabase } from "@/integrations/supabase/client";
import { addDays } from "@/lib/motoriq/facts";
import type { RateOverride } from "@/lib/motoriq/dateRates";

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
      .gte("end_date", addDays(today, -45)),
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
  listeners.forEach((l) => l());
}

export function subscribeRateOverrides(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
