// Tests for the MotorIQ truth layer: facts from bookings, the pricing engine, the insights, and the formatting.
import { describe, expect, it } from "vitest";
import { addDays, bookingDayRate, computeFleetFacts, occupiedDays } from "../lib/motoriq/facts";
import {
  EVENT_APPLY_SHARE, HOLD_BAND, MAX_LOWER, MAX_RAISE, PACE_RAISE_MAX, recommendRate, recommendRates,
  type EngineContext, type EventWindow,
} from "../lib/motoriq/pricingEngine";
import { eventWindowsFor } from "../lib/motoriq/eventSignal";
import { MAX_INSIGHTS, buildInsights, buildSnapshot } from "../lib/motoriq/insights";
import { niceRange } from "../lib/motoriq/format";
import type { BookingRow, VehicleRow } from "../lib/motoriq/types";
import type { ImpactEvent } from "../lib/eventImpact";

const TODAY = "2026-10-10";
const at = (day: string, hour = 10) => `${day}T${String(hour).padStart(2, "0")}:00:00Z`;

const car = (id: string, o: Partial<VehicleRow> = {}): VehicleRow => ({
  id, name: id, make: "Ferrari", model: "488 Spider", current_rate: 1000, status: "available", location: "Miami", ...o,
});
const booking = (vehicle_id: string, startDay: string, days: number, o: Partial<BookingRow> = {}): BookingRow => ({
  vehicle_id, start_date: at(startDay), end_date: at(addDays(startDay, days)), daily_rate: 1000, status: "confirmed",
  created_at: at(addDays(startDay, -10)), ...o,
});

/** Four exotics in Miami: history is booked every other day (created ~10 days ahead); the next 7 days are as given. */
function cohortFixture(forwardCars: number, opts: { rate?: number; historyEvery?: number } = {}) {
  const ids = ["a", "b", "c", "d"];
  const vehicles = ids.map((id) => car(id, { current_rate: opts.rate ?? 1000 }));
  const bookings: BookingRow[] = [];
  for (const id of ids) {
    for (let back = 60; back >= 1; back--) {
      if (back % (opts.historyEvery ?? 2) === 0) bookings.push(booking(id, addDays(TODAY, -back), 1, { daily_rate: opts.rate ?? 1000 }));
    }
  }
  ids.slice(0, forwardCars).forEach((id) =>
    bookings.push(booking(id, TODAY, 7, { daily_rate: opts.rate ?? 1000, created_at: at(addDays(TODAY, -2)) })),
  );
  return { vehicles, bookings };
}

const ctx = (facts: ReturnType<typeof computeFleetFacts>, o: Partial<EngineContext> = {}): EngineContext => ({
  facts, today: TODAY, minRate: 100, eventWindows: () => [], ...o,
});

describe("facts: days and rates", () => {
  it("counts rental days like the rest of the app: ceil(hours/24), at least one, starting on the start date", () => {
    expect(occupiedDays({ start_date: at("2026-10-10", 10), end_date: at("2026-10-10", 15) })).toEqual(["2026-10-10"]);
    expect(occupiedDays({ start_date: at("2026-10-10", 10), end_date: at("2026-10-13", 10) })).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(occupiedDays({ start_date: at("2026-10-10", 10), end_date: at("2026-10-13", 11) })).toHaveLength(4);
    expect(occupiedDays({ start_date: at("2026-10-13"), end_date: at("2026-10-10") })).toEqual([]);
    expect(occupiedDays({ start_date: "garbage", end_date: at("2026-10-10") })).toEqual([]);
  });

  it("uses the booking's daily rate, else spreads the total over its days", () => {
    expect(bookingDayRate({ vehicle_id: "a", start_date: "", end_date: "", daily_rate: 1200 }, 3)).toBe(1200);
    expect(bookingDayRate({ vehicle_id: "a", start_date: "", end_date: "", daily_rate: 0, total_value: 3000 }, 3)).toBe(1000);
    expect(bookingDayRate({ vehicle_id: "a", start_date: "", end_date: "" }, 3)).toBeNull();
  });
});

describe("facts: occupancy comes from bookings, not stored columns", () => {
  it("computes trailing and forward shares, ignoring the stored utilization column", () => {
    const vehicles = [{ ...car("a"), utilization: 99 } as VehicleRow, car("b")];
    const bookings = [
      booking("a", addDays(TODAY, -10), 5), // 5 trailing days
      booking("a", addDays(TODAY, 1), 2), // 2 forward days
      booking("b", addDays(TODAY, -3), 1),
    ];
    const f = computeFleetFacts({ vehicles, bookings, today: TODAY });
    const a = f.vehicles.find((v) => v.id === "a")!;
    expect(a.trailing30.booked).toBe(5);
    expect(a.trailing30.share).toBeCloseTo(5 / 30);
    expect(a.forward7.booked).toBe(2);
    expect(f.fleet.trailing30.booked).toBe(6);
    expect(f.fleet.trailing30.available).toBe(60);
  });

  it("does not count cancelled, requested or expired bookings", () => {
    const f = computeFleetFacts({
      vehicles: [car("a")],
      bookings: ["cancelled", "requested", "payment_expired", "refunded"].map((status, i) => booking("a", addDays(TODAY, 1 + i), 1, { status })),
      today: TODAY,
    });
    expect(f.vehicles[0].forward7.booked).toBe(0);
  });

  it("removes blocked days from availability and ignores archived cars; maintenance cars leave the fleet figures", () => {
    const f = computeFleetFacts({
      vehicles: [car("a"), car("m", { status: "maintenance" }), car("x", { archived_at: "2026-01-01T00:00:00Z" })],
      bookings: [booking("a", addDays(TODAY, 1), 2)],
      blocked: [{ vehicle_id: "a", start_date: at(addDays(TODAY, 4), 0), end_date: at(addDays(TODAY, 5), 0) }],
      today: TODAY,
    });
    expect(f.vehicles.map((v) => v.id).sort()).toEqual(["a", "m"]);
    expect(f.fleet.vehicles).toBe(1);
    const a = f.vehicles.find((v) => v.id === "a")!;
    expect(a.forward7.available).toBe(5); // 7 days minus 2 blocked
    expect(a.forward7.booked).toBe(2);
    expect(a.openDates14.includes(addDays(TODAY, 4))).toBe(false);
  });

  it("states booked revenue at the booked daily rates and reports 'no data' instead of zero", () => {
    const f = computeFleetFacts({ vehicles: [car("a")], bookings: [booking("a", addDays(TODAY, 1), 3, { daily_rate: 500 })], today: TODAY });
    expect(f.fleet.bookedRevenueNext30.value).toBe(1500);
    expect(f.fleet.earnedLast30.value).toBeNull();
    expect(f.fleet.earnedLast30.note).toBeTruthy();
  });

  it("measures what guests accepted lately, and needs 3 bookings before comparing with the listed rate", () => {
    const mk = (n: number) =>
      computeFleetFacts({
        vehicles: [car("a", { current_rate: 1000 })],
        bookings: Array.from({ length: n }, (_, i) => booking("a", addDays(TODAY, 5 + i), 1, { daily_rate: 800, created_at: at(addDays(TODAY, -3 - i)) })),
        today: TODAY,
      }).vehicles[0];
    expect(mk(2).rateRealization.value).toBeNull();
    expect(mk(3).rateRealization.value).toBeCloseTo(0.8);
    expect(mk(3).achievedRate.provenance.n).toBe(3);
  });
});

describe("facts: booking pace", () => {
  it("finds a planted +50% pace (75% booked ahead vs 50% normally)", () => {
    const { vehicles, bookings } = cohortFixture(3);
    const f = computeFleetFacts({ vehicles, bookings, today: TODAY });
    const c = f.cohorts.find((x) => x.key === "exotic|miami")!;
    expect(c.historicalShare).toBeCloseTo(0.5, 1);
    expect(c.forwardShare).toBeGreaterThan(0.7);
    expect(c.pace).toBeGreaterThan(1.4);
  });

  it("says it cannot tell when there is too little history", () => {
    const f = computeFleetFacts({ vehicles: [car("a"), car("b")], bookings: [booking("a", addDays(TODAY, -5), 1)], today: TODAY });
    expect(f.cohorts[0].pace).toBeNull();
    expect(f.cohorts[0].note).toMatch(/needs 12/);
  });

  it("says it cannot tell when bookings have no creation date", () => {
    const { vehicles, bookings } = cohortFixture(2);
    const f = computeFleetFacts({ vehicles, bookings: bookings.map((b) => ({ ...b, created_at: null })), today: TODAY });
    expect(f.cohorts.find((x) => x.key === "exotic|miami")!.pace).toBeNull();
  });
});

describe("pricing engine: base rate comes from pace and guard-rails", () => {
  it("holds, and says why, when pace cannot be measured", () => {
    const f = computeFleetFacts({ vehicles: [car("a"), car("b")], bookings: [], today: TODAY });
    const r = recommendRate(f.vehicles[0], ctx(f));
    expect(r.action).toBe("hold");
    expect(r.recommendedRate).toBe(r.currentRate);
    expect(r.holdReasons.join(" ")).toMatch(/pace/i);
  });

  it("raises when the week fills much faster than usual, capped and rounded, with its working shown", () => {
    const { vehicles, bookings } = cohortFixture(4); // 100% booked ahead vs 50% normally
    const f = computeFleetFacts({ vehicles, bookings, today: TODAY });
    const r = recommendRate(f.vehicles[0], ctx(f));
    expect(r.action).toBe("raise");
    expect(r.changePct).toBeGreaterThan(HOLD_BAND);
    expect(r.changePct).toBeLessThanOrEqual(PACE_RAISE_MAX + 0.01);
    expect(r.recommendedRate % 25).toBe(0); // rounded to the step for this price band
    expect(r.drivers.find((d) => d.id === "pace")?.detail).toMatch(/booked/);
    expect(r.drivers.every((d) => d.provenance.source && d.provenance.asOf)).toBe(true);
    expect(r.speakable).toMatch(/raise the base rate/);
  });

  it("does not raise a car that guests have been booking below its listed rate", () => {
    const { vehicles, bookings } = cohortFixture(4);
    // twelve recent bookings at 800 against a 1000 list: recent guests paid about 89% of list
    const extra = Array.from({ length: 12 }, (_, i) => booking("a", addDays(TODAY, 8 + i), 1, { daily_rate: 800, created_at: at(addDays(TODAY, -2 - i)) }));
    const f = computeFleetFacts({ vehicles, bookings: [...bookings, ...extra], today: TODAY });
    const r = recommendRate(f.vehicles.find((v) => v.id === "a")!, ctx(f));
    expect(r.action).toBe("hold");
    expect(r.holdReasons.join(" ")).toMatch(/below|booking this car at/i);
  });

  it("does not raise the price of a car that is hardly ever booked", () => {
    const { vehicles, bookings } = cohortFixture(4);
    const f = computeFleetFacts({ vehicles: [...vehicles, car("idle")], bookings, today: TODAY });
    const idle = f.vehicles.find((v) => v.id === "idle")!;
    expect(idle.trailing30.share).toBe(0);
    // idle car shares the cohort pace but has no bookings of its own
    const r = recommendRate(idle, ctx(f));
    expect(r.action).toBe("hold");
    expect(r.holdReasons.join(" ")).toMatch(/booked only/);
  });

  it("lowers when the week is far behind normal and the car has open days in the next 3 days", () => {
    const { vehicles, bookings } = cohortFixture(0); // nothing booked ahead vs 50% normally
    const f = computeFleetFacts({ vehicles, bookings, today: TODAY });
    const r = recommendRate(f.vehicles[0], ctx(f));
    expect(r.action).toBe("lower");
    expect(r.changePct).toBeLessThan(-HOLD_BAND);
    expect(r.changePct).toBeGreaterThanOrEqual(-MAX_LOWER - 0.01);
    expect(r.estimate).toBeNull(); // no invented upside for a discount
  });

  it("never recommends below the minimum rate, and treats a listed rate under it as bad data (the $2 car)", () => {
    const { vehicles, bookings } = cohortFixture(4);
    const f = computeFleetFacts({ vehicles: [...vehicles, car("bad", { current_rate: 2 })], bookings, today: TODAY });
    const bad = recommendRate(f.vehicles.find((v) => v.id === "bad")!, ctx(f, { minRate: 100 }));
    expect(bad.action).toBe("hold");
    expect(bad.recommendedRate).toBe(2);
    expect(bad.holdReasons[0]).toMatch(/data mistake/);
    for (const r of recommendRates(ctx(f, { minRate: 100 })).filter((x) => x.action !== "hold")) expect(r.recommendedRate).toBeGreaterThanOrEqual(100);
  });

  it("never changes a rate by more than the caps", () => {
    const { vehicles, bookings } = cohortFixture(4);
    const f = computeFleetFacts({ vehicles, bookings, today: TODAY });
    for (const r of recommendRates(ctx(f))) {
      expect(r.changePct).toBeLessThanOrEqual(MAX_RAISE + 0.02);
      expect(r.changePct).toBeGreaterThanOrEqual(-MAX_LOWER - 0.02);
    }
  });

  it("is deterministic and always explains itself in words without NaN or undefined", () => {
    const { vehicles, bookings } = cohortFixture(3);
    const f = computeFleetFacts({ vehicles, bookings, today: TODAY });
    const a = recommendRates(ctx(f));
    const b = recommendRates(ctx(f));
    expect(a).toEqual(b);
    for (const r of a) {
      expect(r.speakable.length).toBeGreaterThan(10);
      expect(r.speakable).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(Number.isFinite(r.recommendedRate)).toBe(true);
    }
  });
});

describe("pricing engine: events are date-specific premiums, never a silent base-rate change", () => {
  const window: EventWindow = { from: addDays(TODAY, 6), to: addDays(TODAY, 7), uplift: 0.2, names: ["Big Fest"], confirmed: 1, provenance: { source: "events", n: 1, asOf: TODAY } };

  it("leaves the base rate alone and adds a premium for the event dates (half of the modeled effect)", () => {
    const f = computeFleetFacts({ vehicles: [car("a"), car("b")], bookings: [], today: TODAY });
    const r = recommendRate(f.vehicles[0], ctx(f, { eventWindows: () => [window] }));
    expect(r.action).toBe("hold");
    expect(r.recommendedRate).toBe(1000);
    expect(r.eventRates).toHaveLength(1);
    expect(r.eventRates[0].premiumPct).toBe(Math.round(EVENT_APPLY_SHARE * 0.2 * 100));
    expect(r.eventRates[0].rate).toBe(1100);
    expect(r.speakable).toMatch(/quote about/);
  });

  it("does not lower a price into an event that starts within 3 days", () => {
    const { vehicles, bookings } = cohortFixture(0);
    const f = computeFleetFacts({ vehicles, bookings, today: TODAY });
    const soon: EventWindow = { ...window, from: addDays(TODAY, 1), to: addDays(TODAY, 2) };
    expect(recommendRate(f.vehicles[0], ctx(f, { eventWindows: () => [soon] })).action).toBe("hold");
    expect(recommendRate(f.vehicles[0], ctx(f)).action).toBe("lower");
  });

  it("builds windows from the strongest days only, so a small neighbouring event does not stretch the big one", () => {
    const mk = (id: string, date: string, endDate: string, exotic: number): ImpactEvent => ({
      id, name: id, date, endDate, category: "sports", attendance: 1000, impactScore: 60, source: "calendar", evidence: "curated", pricingEligible: true,
      segmentImpact: { exotic, sports: exotic, luxury: exotic, suv: exotic },
    });
    const events = [mk("Fair", TODAY, addDays(TODAY, 13), 1.06), mk("Race", addDays(TODAY, 6), addDays(TODAY, 8), 1.3)];
    const w = eventWindowsFor(events, "exotic", TODAY);
    expect(w).toHaveLength(1);
    expect(w[0].from).toBe(addDays(TODAY, 6));
    expect(w[0].to).toBe(addDays(TODAY, 8));
    expect(w[0].names[0]).toBe("Race");
  });

  it("gives unconfirmed events no weight", () => {
    const e: ImpactEvent = {
      id: "u", name: "Maybe", date: TODAY, endDate: TODAY, category: "concerts", attendance: 1000, impactScore: 60, source: "ai", evidence: "unconfirmed",
      pricingEligible: false, segmentImpact: { exotic: 1, sports: 1, luxury: 1, suv: 1 }, potentialImpact: { exotic: 1.3, sports: 1.3, luxury: 1.3, suv: 1.3 },
    };
    expect(eventWindowsFor([e], "exotic", TODAY)).toEqual([]);
  });
});

describe("insights", () => {
  const rich = () => {
    const { vehicles, bookings } = cohortFixture(4);
    const facts = computeFleetFacts({ vehicles, bookings, today: TODAY });
    const recommendations = recommendRates(ctx(facts));
    return { facts, recommendations };
  };

  it("leads with a price action when several cars have a confident change, and carries numbers, sources and a spoken version", () => {
    const { facts, recommendations } = rich();
    const insights = buildInsights({ facts, recommendations, eventsByMarket: {}, today: TODAY });
    const top = insights[0];
    expect(top.kind).toBe("price-action");
    expect(top.headline).toMatch(/Raise the rate on \d+ cars?/);
    expect(top.provenance.length).toBeGreaterThan(0);
    expect(top.actions.some((a) => a.kind === "apply-rates" && (a.vehicleIds?.length ?? 0) > 0)).toBe(true);
    expect(top.speakable).not.toMatch(/NaN|undefined/);
  });

  it("says plainly when there is nothing new to learn from, instead of padding", () => {
    const facts = computeFleetFacts({ vehicles: [car("a"), car("b")], bookings: [booking("a", addDays(TODAY, -40), 2)], today: TODAY });
    const insights = buildInsights({ facts, recommendations: recommendRates(ctx(facts)), eventsByMarket: {}, today: TODAY });
    expect(insights.some((i) => i.kind === "data")).toBe(true);
    expect(insights.every((i) => i.kind !== "price-action")).toBe(true);
  });

  it("never shows more than the cap, ordered by priority", () => {
    const { facts, recommendations } = rich();
    const events: ImpactEvent[] = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`, name: `Event ${i}`, date: addDays(TODAY, 2 + i), endDate: addDays(TODAY, 2 + i), category: "festivals", attendance: 20000, impactScore: 70, tier: "major",
      source: "calendar", evidence: "curated", pricingEligible: true, segmentImpact: { exotic: 1.2, sports: 1.1, luxury: 1.1, suv: 1.1 },
    }));
    const insights = buildInsights({ facts, recommendations, eventsByMarket: { miami: events }, today: TODAY });
    expect(insights.length).toBeLessThanOrEqual(MAX_INSIGHTS);
    for (let i = 1; i < insights.length; i++) expect(insights[i - 1].priority).toBeGreaterThanOrEqual(insights[i].priority);
  });

  it("only features confirmed events, and states the model is not yet measured on the tenant's results", () => {
    const { facts, recommendations } = rich();
    const base = { category: "concerts", attendance: 5000, impactScore: 60, tier: "major" as const, date: addDays(TODAY, 3), endDate: addDays(TODAY, 3), source: "ai" as const, segmentImpact: { exotic: 1.2, sports: 1.1, luxury: 1.1, suv: 1.1 } };
    const events: ImpactEvent[] = [
      { ...base, id: "v", name: "Verified Show", evidence: "verified", pricingEligible: true },
      { ...base, id: "l", name: "Listed Show", evidence: "listed", pricingEligible: true },
      { ...base, id: "u", name: "Unconfirmed Show", evidence: "unconfirmed", pricingEligible: false },
    ];
    const insights = buildInsights({ facts, recommendations, eventsByMarket: { miami: events }, today: TODAY });
    const names = insights.filter((i) => i.kind === "event").map((i) => i.headline).join(" ");
    expect(names).toContain("Verified Show");
    expect(names).not.toContain("Listed Show");
    expect(names).not.toContain("Unconfirmed Show");
    expect(insights.find((i) => i.kind === "event")!.body).toMatch(/not yet measured/);
  });

  it("builds one snapshot with a plain summary that a voice agent can read as is", () => {
    const { facts, recommendations } = rich();
    const snap = buildSnapshot({ facts, recommendations, eventsByMarket: {}, scope: "all locations" });
    expect(snap.summary).toMatch(/4 cars in all locations/);
    expect(snap.summary).not.toMatch(/NaN|undefined/);
    expect(snap.insights.every((i) => i.speakable.length > 10 && i.provenance.length >= 0)).toBe(true);
  });
});

describe("format", () => {
  it("writes dates the way people say them", () => {
    expect(niceRange("2026-10-16", "2026-10-16")).toBe("Oct 16");
    expect(niceRange("2026-10-16", "2026-10-18")).toBe("Oct 16 to 18");
    expect(niceRange("2026-10-30", "2026-11-02")).toBe("Oct 30 to Nov 2");
  });
});

