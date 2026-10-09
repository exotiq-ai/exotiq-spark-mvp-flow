import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useTeam } from "@/contexts/TeamContext";
import type { ImpactEvent } from "@/lib/eventImpact";
import { addDays, computeFleetFacts } from "@/lib/motoriq/facts";
import { buildSnapshot } from "@/lib/motoriq/insights";
import { buildVoiceBrief, type VoiceBrief } from "@/lib/motoriq/voice";
import { eventWindowsFor, EVENT_HORIZON_DAYS } from "@/lib/motoriq/eventSignal";
import { recommendRates } from "@/lib/motoriq/pricingEngine";
import type { BlockedRow, MotorIQSnapshot } from "@/lib/motoriq/types";

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

export function useMotorIQ(): MotorIQState {
  const { vehicles, bookings, loading } = useLocationFilteredFleet();
  const { currentTeam, currentLocation, selectedLocationId } = useTeam();
  const today = new Date().toISOString().slice(0, 10);

  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
  const [blockedUnavailable, setBlockedUnavailable] = useState(false);
  const [eventsByMarket, setEventsByMarket] = useState<Record<string, ImpactEvent[]>>({});
  const [eventsReady, setEventsReady] = useState(false);

  // Blocked dates (maintenance, personal use...): they are not available to rent, so they leave the denominator.
  useEffect(() => {
    let alive = true;
    (supabase as any)
      .from("vehicle_blocked_dates")
      .select("vehicle_id,start_date,end_date")
      .gte("end_date", addDays(today, -35))
      .then(({ data, error }: { data: BlockedRow[] | null; error: unknown }) => {
        if (!alive) return;
        if (error) { setBlockedUnavailable(true); setBlocked([]); } else { setBlockedUnavailable(false); setBlocked(data ?? []); }
      });
    return () => { alive = false; };
  }, [today, currentTeam?.id]);

  const facts = useMemo(
    () => computeFleetFacts({ vehicles: vehicles as any[], bookings: bookings as any[], blocked, today }),
    [vehicles, bookings, blocked, today],
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
    return buildSnapshot({ facts, recommendations, eventsByMarket, scope: selectedLocationId !== "all" && currentLocation?.name ? currentLocation.name : "all locations" });
  }, [loading, facts, eventsByMarket, currentTeam, currentLocation, selectedLocationId, today]);

  const voice = useMemo(() => (snapshot ? buildVoiceBrief(snapshot) : null), [snapshot]);

  return { snapshot, voice, loading, eventsReady, blockedUnavailable, today };
}
