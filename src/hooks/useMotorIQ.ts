import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useTeam } from "@/contexts/TeamContext";
import { useTenantTimeZone } from "@/hooks/useTenantTimeZone";
import type { ImpactEvent } from "@/lib/eventImpact";
import { addDays, computeFleetFacts, dayKey } from "@/lib/motoriq/facts";
import { buildSnapshot } from "@/lib/motoriq/insights";
import { buildVoiceBrief, type VoiceBrief } from "@/lib/motoriq/voice";
import { eventWindowsFor, EVENT_HORIZON_DAYS } from "@/lib/motoriq/eventSignal";
import { recommendRates } from "@/lib/motoriq/pricingEngine";
import type { BlockedRow, MotorIQSnapshot } from "@/lib/motoriq/types";
import type { RateOverride } from "@/lib/motoriq/dateRates";
import { loadRateChanges, loadRateOverrides, subscribeRateOverrides } from "@/lib/rateOverridesStore";
import { computeOutcomes, type RateChangeRow } from "@/lib/motoriq/outcomes";

/**
 * The single source of MotorIQ truth for the screens (and, later, the voice agent): facts from the tenant's own
 * bookings, a deterministic pricing engine, and ranked insights, all in one snapshot.
 */
export interface MotorIQState {
  snapshot: MotorIQSnapshot | null;
  /** The same snapshot as something a voice agent can say as is (used by Rari). */
  voice: VoiceBrief | null;
  loading: boolean;
  /** false while the markets' events are still loading (the snapshot is usable without them, just without event premiums) */
  eventsReady: boolean;
  /** true when blocked dates could not be read (utilization then ignores blocked days) */
  blockedUnavailable: boolean;
  today: string;
  /** the tenant's time zone everything here is counted and spoken in */
  timeZone: string;
  /** date-specific rates: active ones and recently revoked ones (history); use activeRateOverrides for what is in force */
  rateOverrides: RateOverride[];
  /** date-specific rates in force now or later */
  activeRateOverrides: RateOverride[];
}

// One request per market per day, shared by every component that asks.
const eventCache = new Map<string, Promise<ImpactEvent[]>>();
function loadEvents(city: string, today: string): Promise<ImpactEvent[]> {
  const key = `${city}|${today}`;
  let p = eventCache.get(key);
  if (!p) {
    p = supabase.functions
      .invoke("ai-event-intelligence", { body: { city, startDate: today, endDate: addDays(today, EVENT_HORIZON_DAYS) } })
      .then((res) => (res.error || !Array.isArray(res.data?.events) ? [] : (res.data.events as ImpactEvent[])))
      .catch(() => []);
    eventCache.set(key, p);
  }
  return p;
}

// Several dashboard components read the same snapshot; they share one blocked-dates read for a minute.
const BLOCKED_TTL_MS = 60_000;
const blockedCache = new Map<string, { at: number; p: Promise<{ rows: BlockedRow[]; failed: boolean }> }>();
function loadBlocked(teamKey: string, today: string): Promise<{ rows: BlockedRow[]; failed: boolean }> {
  const key = `${teamKey}|${today}`;
  const hit = blockedCache.get(key);
  if (hit && Date.now() - hit.at < BLOCKED_TTL_MS) return hit.p;
  const p = Promise.resolve(
    (supabase as any)
      .from("vehicle_blocked_dates")
      .select("vehicle_id,start_date,end_date")
      .gte("end_date", addDays(today, -35)),
  ).then(
    ({ data, error }: { data: BlockedRow[] | null; error: unknown }) => (error ? { rows: [], failed: true } : { rows: data ?? [], failed: false }),
    () => ({ rows: [] as BlockedRow[], failed: true }),
  );
  blockedCache.set(key, { at: Date.now(), p });
  return p;
}

export function useMotorIQ(): MotorIQState {
  const { vehicles, bookings, loading } = useLocationFilteredFleet();
  const { currentTeam, currentLocation, selectedLocationId } = useTeam();
  const timeZone = useTenantTimeZone();
  const today = dayKey(Date.now(), timeZone);

  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
  const [blockedUnavailable, setBlockedUnavailable] = useState(false);
  const [rateOverrides, setRateOverrides] = useState<RateOverride[]>([]);
  const [rateChanges, setRateChanges] = useState<RateChangeRow[]>([]);
  const [overridesVersion, setOverridesVersion] = useState(0);
  const [eventsByMarket, setEventsByMarket] = useState<Record<string, ImpactEvent[]>>({});
  const [eventsReady, setEventsReady] = useState(false);

  // Blocked dates (maintenance, personal use...): they are not available to rent, so they leave the denominator.
  useEffect(() => {
    let alive = true;
    loadBlocked(currentTeam?.id ?? "none", today).then(({ rows, failed }) => {
      if (!alive) return;
      setBlockedUnavailable(failed);
      setBlocked(rows);
    });
    return () => { alive = false; };
  }, [today, currentTeam?.id]);

  // Date-specific rates: reload whenever one is applied or reverted anywhere in the app.
  useEffect(() => subscribeRateOverrides(() => setOverridesVersion((v) => v + 1)), []);
  useEffect(() => {
    let alive = true;
    loadRateOverrides(currentTeam?.id ?? "none", today).then(({ rows }) => { if (alive) setRateOverrides(rows); });
    loadRateChanges(currentTeam?.id ?? "none", today).then(({ rows }) => { if (alive) setRateChanges(rows); });
    return () => { alive = false; };
  }, [today, currentTeam?.id, overridesVersion]);

  const facts = useMemo(
    () => computeFleetFacts({ vehicles: vehicles as any[], bookings: bookings as any[], blocked, overrides: rateOverrides, today, tz: timeZone }),
    [vehicles, bookings, blocked, rateOverrides, today, timeZone],
  );
  const activeRateOverrides = useMemo(
    () => rateOverrides.filter((o) => !o.revoked_at && o.end_date >= today),
    [rateOverrides, today],
  );

  // events for each market the tenant's cars are in
  const marketsKey = useMemo(
    () => [...new Set(facts.vehicles.filter((v) => !v.outOfService && v.market !== "other").map((v) => v.market))].sort().join(","),
    [facts],
  );
  useEffect(() => {
    let alive = true;
    const markets = marketsKey ? marketsKey.split(",") : [];
    if (markets.length === 0) { setEventsByMarket({}); setEventsReady(true); return; }
    setEventsReady(false);
    Promise.all(markets.map(async (m) => [m, await loadEvents(m, today)] as const)).then((pairs) => {
      if (!alive) return;
      setEventsByMarket(Object.fromEntries(pairs));
      setEventsReady(true);
    });
    return () => { alive = false; };
  }, [marketsKey, today]);

  const snapshot = useMemo<MotorIQSnapshot | null>(() => {
    if (loading) return null;
    const minRate = Number((currentTeam as any)?.min_rate) || 100;
    const recommendations = recommendRates({
      facts, today, minRate,
      eventWindows: (market, segment) => eventWindowsFor(eventsByMarket[market] ?? [], segment, today),
    });
    // What the rates the tenant applied actually did (date rates and base-rate changes), against similar cars.
    const outcomes = computeOutcomes({ facts, bookings: bookings as any[], overrides: rateOverrides, rateChanges, today, tz: timeZone });
    return buildSnapshot({ facts, recommendations, eventsByMarket, outcomes, scope: selectedLocationId !== "all" && currentLocation?.name ? currentLocation.name : "all locations" });
  }, [loading, facts, eventsByMarket, currentTeam, currentLocation, selectedLocationId, today, bookings, rateOverrides, rateChanges, timeZone]);

  const voice = useMemo(() => (snapshot ? buildVoiceBrief(snapshot, { nowMs: Date.now() }) : null), [snapshot]);

  return { snapshot, voice, loading, eventsReady, blockedUnavailable, today, timeZone, rateOverrides, activeRateOverrides };
}
