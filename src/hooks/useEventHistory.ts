import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { matchDemandCity } from "@/lib/demandCities";
import { latestPerEvent, measurePastEvents, type LiftBooking, type LiftResult, type LiftVehicle, type PastEvent } from "@/lib/eventLift";

export type HistoryStatus = "idle" | "loading" | "ready" | "no-fleet" | "no-bookings" | "error";

export interface EventHistory {
  status: HistoryStatus;
  results: LiftResult[];
  fleetCount: number;
  bookingCount: number;
  pastEvents: number;
}

const EMPTY: EventHistory = { status: "idle", results: [], fleetCount: 0, bookingCount: 0, pastEvents: 0 };
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

interface FleetVehicle { id: string; make?: string | null; model?: string | null; location?: string | null }
interface FleetBooking { vehicle_id?: string | null; start_date: string; end_date: string; daily_rate?: number | string | null; status?: string | null }

/**
 * For the selected market, find the tenant's own cars there, ask the server for the curated calendar over the span of
 * their booking history, and measure what their bookings did around each past event (see lib/eventLift.ts).
 */
export function useEventHistory(city: string, bookings: FleetBooking[], vehicles: FleetVehicle[]): EventHistory {
  const [calendar, setCalendar] = useState<PastEvent[] | null>(null);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  const cityVehicles = useMemo<LiftVehicle[]>(
    () => vehicles.filter((v) => matchDemandCity(v.location)?.value === city).map((v) => ({ id: v.id, make: v.make, model: v.model })),
    [vehicles, city],
  );
  const ids = useMemo(() => new Set(cityVehicles.map((v) => v.id)), [cityVehicles]);
  const cityBookings = useMemo<LiftBooking[]>(
    () => bookings.filter((b) => b.vehicle_id && ids.has(b.vehicle_id)).map((b) => ({
      vehicle_id: b.vehicle_id!, start_date: b.start_date, end_date: b.end_date, daily_rate: b.daily_rate ?? null, status: b.status ?? null,
    })),
    [bookings, ids],
  );

  const range = useMemo(() => {
    if (!cityBookings.length) return null;
    const first = Math.min(...cityBookings.map((b) => Date.parse(b.start_date.slice(0, 10))));
    const from = Math.max(first - 35 * DAY, Date.now() - 890 * DAY);
    return { start: iso(from), end: iso(Date.now()) };
  }, [cityBookings]);

  useEffect(() => {
    if (!range || ids.size === 0) { setCalendar(null); return; }
    const mine = ++seq.current;
    setError(false);
    supabase.functions.invoke("ai-event-intelligence", { body: { city, startDate: range.start, endDate: range.end, calendarOnly: true } })
      .then((res) => {
        if (mine !== seq.current) return;
        if (res.error || !Array.isArray(res.data?.events)) { setError(true); setCalendar(null); return; }
        setCalendar(res.data.events.map((e: any) => ({ name: e.name, startDate: e.date, endDate: e.endDate ?? e.date, segmentImpact: e.segmentImpact })));
      })
      .catch(() => { if (mine === seq.current) { setError(true); setCalendar(null); } });
  }, [city, range?.start, range?.end, ids.size]);

  return useMemo<EventHistory>(() => {
    if (cityVehicles.length === 0) return { ...EMPTY, status: "no-fleet" };
    if (cityBookings.length === 0) return { ...EMPTY, status: "no-bookings", fleetCount: cityVehicles.length };
    if (error) return { ...EMPTY, status: "error", fleetCount: cityVehicles.length, bookingCount: cityBookings.length };
    if (!calendar) return { ...EMPTY, status: "loading", fleetCount: cityVehicles.length, bookingCount: cityBookings.length };
    const today = iso(Date.now());
    const past = latestPerEvent(calendar, today);
    const results = measurePastEvents({ events: past, allEventWindows: calendar, bookings: cityBookings, vehicles: cityVehicles });
    return { status: "ready", results, fleetCount: cityVehicles.length, bookingCount: cityBookings.length, pastEvents: past.length };
  }, [calendar, cityBookings, cityVehicles, error]);
}
