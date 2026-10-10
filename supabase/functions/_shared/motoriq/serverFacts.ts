/**
 * Server-side loader for the MotorIQ facts: the same computation the app screens use, for everything that speaks
 * for the business (Rari's tools, the daily brief, the weekly digest, reports).
 *
 * Why this exists: the stored `vehicles.utilization` and `vehicles.suggested_rate` columns are not maintained by
 * anything (stored utilization correlated 0.06 with real bookings), so nothing that talks to a tenant may read them.
 * Everything here is computed from the tenant's own bookings, in the tenant's own time zone.
 */
import { computeFleetFacts, dayKey, addDays, safeTimeZone } from "./facts.ts";
import { recommendRate, recommendRates } from "./pricingEngine.ts";
import type { RateOverride } from "./dateRates.ts";
import type { BlockedRow, BookingRow, FleetFacts, Occupancy, PriceRecommendation, VehicleFacts, VehicleRow } from "./types.ts";

// Structural type so this file does not depend on a particular supabase-js version.
type Db = { from: (table: string) => any };

const BOOKING_LOOKBACK_DAYS = 90;
const BOOKING_LIMIT = 5000;
const VEHICLE_COLUMNS = "id,name,make,model,year,status,location,location_id,current_rate,daily_rate,archived_at,trashed_at";

export interface FleetTruth {
  facts: FleetFacts;
  /** tenant-local today, yyyy-MM-dd */
  today: string;
  timeZone: string;
  minRate: number;
  /** the location this was narrowed to, when one was asked for */
  scope: string | null;
  byId: Map<string, VehicleFacts>;
  /** the raw vehicle rows behind the facts (name, location, status), by id */
  rows: Map<string, VehicleRow>;
  /** date-specific rates (active and recently revoked) */
  overrides: RateOverride[];
  /** true when blocked dates could not be read (utilization then ignores blocked days) */
  blockedUnavailable: boolean;
  /** true when bookings hit the row limit and older ones may be missing */
  bookingsTruncated: boolean;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/** A vehicle belongs to a location when its location text names it ("Scottsdale" in "Scottsdale, AZ"). */
export function vehicleInLocation(v: { location?: string | null }, location: string): boolean {
  const want = norm(location);
  const have = norm(v.location);
  return want.length > 0 && have.length > 0 && (have.includes(want) || want.includes(have));
}

/**
 * Loads the tenant's fleet, bookings and blocked dates and computes the facts. Team scoping is by `teamId`
 * (never from tool input). `location` narrows to one location and uses that location's time zone.
 */
export async function loadFleetTruth(
  supabase: Db,
  teamId: string,
  opts: { location?: string | null; nowMs?: number } = {},
): Promise<FleetTruth> {
  const nowMs = opts.nowMs ?? Date.now();

  const [{ data: team }, { data: locs }, { data: vehicleRows }] = await Promise.all([
    supabase.from("teams").select("timezone,min_rate").eq("id", teamId).maybeSingle(),
    supabase.from("locations").select("name,city,timezone").eq("team_id", teamId),
    supabase.from("vehicles").select(VEHICLE_COLUMNS).eq("team_id", teamId),
  ]);

  let vehicles = ((vehicleRows ?? []) as VehicleRow[]).filter((v) => !v.archived_at && !v.trashed_at);
  const wanted = opts.location ? String(opts.location).trim() : "";
  if (wanted) vehicles = vehicles.filter((v) => vehicleInLocation(v, wanted));

  // time zone: the asked-for location's, else the team's, else UTC
  const locRow = wanted
    ? (locs ?? []).find((l: any) => norm(l.name) === norm(wanted) || norm(l.city) === norm(wanted) || vehicleInLocation({ location: l.name }, wanted))
    : null;
  const timeZone = safeTimeZone(locRow?.timezone || team?.timezone);
  const today = dayKey(nowMs, timeZone);
  const minRate = Number(team?.min_rate) || 100;

  const from = addDays(today, -BOOKING_LOOKBACK_DAYS);
  const ids = vehicles.map((v) => v.id);
  let bookings: BookingRow[] = [];
  let bookingsTruncated = false;
  let blocked: BlockedRow[] = [];
  let blockedUnavailable = false;
  let overrides: RateOverride[] = [];

  if (ids.length > 0) {
    const [{ data: bk }, { data: bl, error: blErr }, { data: ov }] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,vehicle_id,start_date,end_date,daily_rate,total_value,status,created_at")
        .eq("team_id", teamId)
        .gte("end_date", from)
        .order("start_date", { ascending: false })
        .limit(BOOKING_LIMIT),
      supabase
        .from("vehicle_blocked_dates")
        .select("vehicle_id,start_date,end_date")
        .eq("team_id", teamId)
        .gte("end_date", addDays(today, -35)),
      supabase
        .from("vehicle_rate_overrides")
        .select("id,vehicle_id,start_date,end_date,daily_rate,source,reason,event_ref,created_at,revoked_at")
        .eq("team_id", teamId)
        .gte("end_date", addDays(today, -45)),
    ]);
    overrides = ((ov ?? []) as RateOverride[]).filter((o) => new Set(ids).has(o.vehicle_id));
    const idSet = new Set(ids);
    bookings = ((bk ?? []) as BookingRow[]).filter((b) => b.vehicle_id && idSet.has(b.vehicle_id));
    bookingsTruncated = (bk ?? []).length >= BOOKING_LIMIT;
    if (blErr) blockedUnavailable = true;
    else blocked = ((bl ?? []) as BlockedRow[]).filter((b) => idSet.has(b.vehicle_id));
  }

  const facts = computeFleetFacts({ vehicles, bookings, blocked, overrides, today, tz: timeZone });
  return {
    facts,
    today,
    timeZone,
    minRate,
    scope: wanted || null,
    byId: new Map(facts.vehicles.map((v) => [v.id, v])),
    rows: new Map(vehicles.map((v) => [v.id, v])),
    overrides,
    blockedUnavailable,
    bookingsTruncated,
  };
}

/** The base-rate recommendation for one car (no event premiums; those come from the event tools). */
export function recommendationFor(truth: FleetTruth, vehicleId: string): PriceRecommendation | null {
  const v = truth.byId.get(vehicleId);
  if (!v) return null;
  return recommendRate(v, { facts: truth.facts, today: truth.today, minRate: truth.minRate, eventWindows: () => [] });
}

/** Base-rate recommendations for every car that can be rented (no event premiums). */
export function recommendAll(truth: FleetTruth): PriceRecommendation[] {
  return recommendRates({ facts: truth.facts, today: truth.today, minRate: truth.minRate, eventWindows: () => [] });
}

// ---------------------------------------------------------------------------
// Plain-language pieces (shared by Rari's tools and the written summaries)
// ---------------------------------------------------------------------------

/** "37%" or null when no day was available. */
export function sharePct(o: Occupancy | null | undefined): number | null {
  return o && o.share != null ? Math.round(o.share * 100) : null;
}

/** "37% booked over the last 30 days" or an honest "no available days" sentence. */
export function utilizationText(o: Occupancy | null | undefined, period = "over the last 30 days"): string {
  const p = sharePct(o);
  return p == null ? `not enough data to measure utilization ${period}` : `${p}% of available days booked ${period}`;
}

/** Fleet average across cars that can be rented, as a whole percent, or null. */
export function fleetUtilizationPct(truth: FleetTruth): number | null {
  return sharePct(truth.facts.fleet.trailing30);
}

/** Cars by measured utilization (trailing 30 days), highest first; cars with nothing to measure sort last. */
export function rankByUtilization(truth: FleetTruth): VehicleFacts[] {
  return [...truth.facts.vehicles]
    .filter((v) => !v.outOfService)
    .sort((a, b) => (b.trailing30.share ?? -1) - (a.trailing30.share ?? -1));
}

/** How the numbers were measured; Rari quotes this when asked "how do you know". */
export function methodNote(truth: FleetTruth): string {
  const parts = [
    "Utilization is the share of available car-days that were booked, counted from your own bookings in your time zone",
    "cancelled and requested bookings and blocked or maintenance days are left out",
  ];
  if (truth.bookingsTruncated) parts.push("only the most recent bookings could be read, so older figures may be low");
  if (truth.blockedUnavailable) parts.push("blocked dates could not be read, so blocked days are counted as available");
  return `${parts.join("; ")}.`;
}
