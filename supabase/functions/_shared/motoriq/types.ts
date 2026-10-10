/**
 * MotorIQ data contracts.
 *
 * Everything the MotorIQ screens (and later the Rari voice agent) present is one of these objects, produced by pure
 * functions from the tenant's own data. Three rules:
 *   1. A number always travels with its sample size and where it came from (`Provenance`).
 *   2. Missing or thin data produces `null` plus a reason, never a guess.
 *   3. Every user-facing object carries a `speakable` sentence in plain language, so a voice agent can say exactly what
 *      the screen shows without re-deriving or re-wording the numbers.
 */
import type { Segment as SegmentKey } from "../eventTaxonomy.ts";

export type Confidence = "high" | "medium" | "low";

/** Where a number comes from and how much data stands behind it. */
export interface Provenance {
  /** Plain-language source, e.g. "your bookings, last 30 days". */
  source: string;
  /** Number of records or days the figure rests on. */
  n: number;
  /** yyyy-MM-dd the figure is as of. */
  asOf: string;
}

/** A measured value; `value` is null when there is not enough data, with the reason in `note`. */
export interface Metric {
  value: number | null;
  provenance: Provenance;
  note?: string;
}

export interface BookingRow {
  id?: string;
  vehicle_id: string | null;
  start_date: string;
  end_date: string;
  daily_rate?: number | string | null;
  total_value?: number | string | null;
  status?: string | null;
  created_at?: string | null;
}

export interface VehicleRow {
  id: string;
  name?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  current_rate: number | string;
  status?: string | null;
  location?: string | null;
  location_id?: string | null;
  archived_at?: string | null;
  trashed_at?: string | null;
}

export interface BlockedRow {
  vehicle_id: string;
  start_date: string;
  end_date: string;
}

export interface Occupancy {
  booked: number;
  available: number;
  /** booked / available, or null when no day was available */
  share: number | null;
}

export interface VehicleFacts {
  id: string;
  name: string;
  make: string;
  model: string;
  segment: SegmentKey;
  /** market slug from the vehicle's location, or "other" */
  market: string;
  currentRate: number;
  /** Booked share of the last 30 days (computed from bookings, never from a stored column). */
  trailing30: Occupancy;
  trailing7: Occupancy;
  prior7: Occupancy;
  forward7: Occupancy;
  forward14: Occupancy;
  forward30: Occupancy;
  /** Available but unbooked dates in the next 14 days (yyyy-MM-dd). */
  openDates14: string[];
  /** What guests who booked this car in the last 30 days were charged per day, on average. */
  achievedRate: Metric;
  /** achievedRate / currentRate, or null when fewer than 3 bookings. */
  rateRealization: Metric;
  /** revenue from booked days in the last 30 days at their booked daily rates; null when no day was booked */
  earnedLast30: number | null;
  bookingsCreated30: number;
  /** Whole days since the car last started a booking, or null if it never has. */
  daysSinceLastStart: number | null;
  /** True when the car is out of service (maintenance) and excluded from fleet figures. */
  outOfService: boolean;
}

export interface CohortPace {
  /** "segment|market" */
  key: string;
  segment: SegmentKey;
  market: string;
  vehicles: number;
  /** current on-the-books share of the next 7 days, lead-matched against history */
  forwardShare: number | null;
  /** what the same lead times looked like over the last 60 days */
  historicalShare: number | null;
  /** forwardShare / historicalShare, or null when history is too thin */
  pace: number | null;
  provenance: Provenance;
  note?: string;
}

export interface FleetFacts {
  asOf: string;
  /** the tenant's IANA time zone every day in these facts is counted in */
  timeZone: string;
  vehicles: VehicleFacts[];
  fleet: {
    vehicles: number;
    trailing30: Occupancy;
    /** the last 7 days and the 7 days before that (weekly digest) */
    trailing7: Occupancy;
    prior7: Occupancy;
    forward7: Occupancy;
    forward14: Occupancy;
    forward30: Occupancy;
    /** Daily rates of booked days still ahead (next 30 days). */
    bookedRevenueNext30: Metric;
    /** Daily rates of booked days in the last 30 days. */
    earnedLast30: Metric;
    /** Same measure for the 30 days before that, for comparison. */
    earnedPrev30: Metric;
    openDays14: number;
    /** bookings created in the last 7 days vs the 7 before */
    pickups: { last7: number; prev7: number; provenance: Provenance };
  };
  cohorts: CohortPace[];
}

// ---------------------------------------------------------------------------
// Pricing recommendations
// ---------------------------------------------------------------------------

export type PriceAction = "raise" | "lower" | "hold";

export interface Driver {
  id: "pace" | "realization" | "floor" | "cap" | "data";
  label: string;
  /** Percent effect on the rate this driver contributed (signed), 0 for guard-rails. */
  effectPct: number;
  detail: string;
  provenance: Provenance;
}

/** A premium for the dates of a confirmed event. Not applied through the base rate: the app stores one rate per car. */
export interface EventRate {
  from: string;
  to: string;
  /** the premium on top of the recommended base rate, in percent */
  premiumPct: number;
  /** the rate to quote for those dates */
  rate: number;
  names: string[];
  /** how many of the events are curated or verified (full weight) */
  confirmed: number;
  provenance: Provenance;
}

export interface PriceRecommendation {
  vehicleId: string;
  name: string;
  action: PriceAction;
  currentRate: number;
  recommendedRate: number;
  changePct: number;
  confidence: Confidence;
  /** The window the recommendation is for, yyyy-MM-dd. */
  window: { from: string; to: string };
  drivers: Driver[];
  /** Why we are not recommending a change (or a bigger one). */
  holdReasons: string[];
  /** Premiums for the dates of confirmed events in the next 14 days (shown separately from the base rate). */
  eventRates: EventRate[];
  /** Rough value of acting, with the assumptions it rests on; null when it cannot be stated honestly. */
  estimate: { extraRevenue: number; openDays: number; assumption: string } | null;
  speakable: string;
}

// ---------------------------------------------------------------------------
// Insights (what the Overview shows and Rari says)
// ---------------------------------------------------------------------------

export type InsightKind =
  | "price-action"
  | "pace"
  | "event"
  | "gap"
  | "realization"
  | "idle"
  | "revenue"
  | "results"
  | "data";

export interface InsightAction {
  kind: "apply-rates" | "open-vehicle" | "open-forecast" | "open-calendar" | "open-pricing";
  label: string;
  /** vehicle ids for apply-rates / open-vehicle */
  vehicleIds?: string[];
}

export interface InsightMetric {
  label: string;
  value: string;
}

export interface Insight {
  id: string;
  kind: InsightKind;
  /** Higher is more important. Used only to order. */
  priority: number;
  headline: string;
  body: string;
  metrics: InsightMetric[];
  provenance: Provenance[];
  confidence: Confidence;
  actions: InsightAction[];
  speakable: string;
}

// ---------------------------------------------------------------------------
// Results: what the tenant's own rate changes did (see outcomes.ts)
// ---------------------------------------------------------------------------

/** One date-specific rate (set by hand or applied from a quote) and what happened on its nights. */
export interface DateRateOutcome {
  kind: "date-rate";
  id: string;
  vehicleId: string;
  name: string;
  /** local calendar days, inclusive */
  from: string;
  to: string;
  rate: number;
  /** the car's base rate now */
  baseRate: number;
  source: "manual" | "motoriq";
  reason: string | null;
  /** upcoming: not started; running: some nights left; finished: all nights have passed */
  status: "upcoming" | "running" | "finished";
  nights: number;
  /** nights with a booking (made before or after the rate was set) */
  bookedNights: number;
  /** nights whose booking was made after the rate was set (the ones that could have paid the premium) */
  bookedAfter: number;
  /** bookedNights / nights */
  share: number;
  /** how booked similar cars were on the same nights (average), null when there were too few to compare */
  controlShare: number | null;
  controlCars: number;
  /** share minus controlShare, in percentage points */
  diffPts: number | null;
  /** on nights booked after it was set: what guests paid minus the base rate, summed; null when there were none */
  extraRevenue: number | null;
  verdict: "held" | "softer" | "too-early" | "no-comparison";
  confidence: Confidence;
  sentence: string;
}

/** A base-rate change from the vehicle's history and the bookings made in the 14 days either side of it. */
export interface BaseChangeOutcome {
  kind: "base-rate";
  id: string;
  vehicleId: string;
  name: string;
  /** local day of the change */
  at: string;
  from: number;
  to: number;
  changePct: number;
  source: string | null;
  daysSince: number;
  /** bookings made by this car in the 14 days before and after (after counts so far while measuring) */
  before: number;
  after: number;
  /** average per similar car that did not change its rate nearby */
  controlCars: number;
  controlBefore: number | null;
  controlAfter: number | null;
  verdict: "more-bookings" | "fewer-bookings" | "similar" | "too-early" | "no-comparison";
  confidence: Confidence;
  sentence: string;
}

export interface OutcomeReport {
  asOf: string;
  dateRates: DateRateOutcome[];
  baseChanges: BaseChangeOutcome[];
  summary: {
    /** date rates whose nights have all passed and that could be compared with similar cars */
    comparedRates: number;
    held: number;
    softer: number;
    /** summed over finished date rates */
    extraRevenue: number;
    liveRates: number;
  };
  /** one plain sentence for the screen, or null when there is nothing to report yet */
  headline: string | null;
  speakable: string | null;
  provenance: Provenance;
}

/** Everything a screen or the voice agent needs, in one object. */
export interface MotorIQSnapshot {
  asOf: string;
  timeZone: string;
  scope: string;
  summary: string;
  facts: FleetFacts;
  recommendations: PriceRecommendation[];
  insights: Insight[];
  /** what the tenant's own applied rates did, or null when no date rate or base-rate change has been recorded */
  outcomes: OutcomeReport | null;
}
