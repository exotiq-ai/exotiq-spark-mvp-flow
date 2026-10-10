// Rari and the AI summaries speak from computed facts, never from the stored columns nothing maintains
// (vehicles.utilization, vehicles.suggested_rate, vehicles.revenue). These tests plant loud junk in those
// columns and check that no tool says it, and that every number a tool says matches the bookings.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { executeFunction, formatDateRange, resolveTimeframeWindow } from "../../supabase/functions/_shared/fleet-tools/executor.ts";
import { loadFleetTruth, recommendationFor, sharePct, vehicleInLocation } from "../../supabase/functions/_shared/motoriq/serverFacts.ts";
import { addDays, dayKey } from "../../supabase/functions/_shared/motoriq/facts.ts";
import { fakeDb, type Row } from "./helpers/fakeSupabase";

// ---------------------------------------------------------------------------------------------------------------
// The tenant: 4 Miami exotics + 1 Scottsdale car. Stored columns carry loud junk (99% / $999,999 / $9,999).
// ---------------------------------------------------------------------------------------------------------------
const NOW = Date.parse("2026-10-10T18:00:00Z");
const TZ = "America/New_York";
const TODAY = dayKey(NOW, TZ);
const at = (day: string, hour = 10) => `${day}T${String(hour).padStart(2, "0")}:00:00Z`;
const TEAM = "team-1";

const JUNK = { utilization: 99, revenue: 999999, suggested_rate: 9999 };
const vehicles: Row[] = [
  ...["a", "b", "c", "d"].map((id, i) => ({ id, team_id: TEAM, name: `Ferrari ${id}`, make: "Ferrari", model: ["488 Spider", "F8 Tributo", "812 Superfast", "SF90 Stradale"][i], year: 2022, status: "available", location: "Miami, FL", current_rate: 1000, ...JUNK, created_at: at("2026-01-01", i) })),
  { id: "s", team_id: TEAM, name: "Lamborghini s", make: "Lamborghini", model: "Huracan", year: 2023, status: "available", location: "Scottsdale, AZ", current_rate: 1500, ...JUNK, created_at: at("2026-01-02") },
];

const bookings: Row[] = [];
let n = 0;
const book = (vehicle_id: string, startDay: string, days: number, extra: Row = {}) =>
  bookings.push({ id: `b${n++}`, team_id: TEAM, vehicle_id, start_date: at(startDay), end_date: at(addDays(startDay, days)), status: "confirmed", total_value: 1000 * days, daily_rate: 1000, created_at: at(addDays(startDay, -10)), customer_name: "X", ...extra });
// car a: booked 10 of the last 30 days (about 33%); car b: 3 days; c and d: nothing
for (let i = 0; i < 10; i++) book("a", addDays(TODAY, -2 * i - 1), 1);
book("b", addDays(TODAY, -5), 3);
book("s", addDays(TODAY, -12), 2, { total_value: 3000, daily_rate: 1500 });
book("a", addDays(TODAY, -3), 1, { status: "cancelled" }); // must not count

const tables = () => ({
  teams: [{ id: TEAM, timezone: TZ, min_rate: 150 }],
  locations: [{ team_id: TEAM, name: "Miami", city: "Miami", timezone: TZ }, { team_id: TEAM, name: "Scottsdale", city: "Scottsdale", timezone: "America/Phoenix" }],
  vehicles, bookings,
  vehicle_blocked_dates: [],
  demand_event_snapshots: [],
  maintenance_schedules: [],
});

// The tools read the clock themselves; pin it so the fixtures' dates line up.
beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });

const real = {
  a: Math.round((10 / 30) * 100),
  b: Math.round((3 / 30) * 100),
  fleet: Math.round(((10 + 3 + 2) / (5 * 30)) * 100),
};

const run = (tool: string, args: Row = {}) =>
  executeFunction(tool, args, fakeDb(tables()), "user-1", TEAM) as Promise<Row>;
const flat = (x: unknown) => JSON.stringify(x);

describe("fleet facts on the server", () => {
  it("computes utilization from bookings, in the tenant's zone, ignoring the stored columns", async () => {
    const t = await loadFleetTruth(fakeDb(tables()), TEAM, { nowMs: NOW });
    expect(t.timeZone).toBe(TZ);
    expect(t.today).toBe(TODAY);
    expect(t.minRate).toBe(150);
    expect(sharePct(t.byId.get("a")!.trailing30)).toBe(real.a);
    expect(sharePct(t.byId.get("b")!.trailing30)).toBe(real.b);
    expect(sharePct(t.byId.get("c")!.trailing30)).toBe(0);
    expect(sharePct(t.facts.fleet.trailing30)).toBe(real.fleet);
  });

  it("narrows to one location and uses that location's own time zone", async () => {
    const t = await loadFleetTruth(fakeDb(tables()), TEAM, { location: "Scottsdale", nowMs: NOW });
    expect(t.facts.vehicles.map((v) => v.id)).toEqual(["s"]);
    expect(t.timeZone).toBe("America/Phoenix");
    expect(vehicleInLocation({ location: "Scottsdale, AZ" }, "scottsdale")).toBe(true);
    expect(vehicleInLocation({ location: "Miami, FL" }, "scottsdale")).toBe(false);
  });

  it("gives a car with no history an honest recommendation, never the stored suggested rate", async () => {
    const t = await loadFleetTruth(fakeDb(tables()), TEAM, { nowMs: NOW });
    const rec = recommendationFor(t, "c")!;
    expect(rec.recommendedRate).not.toBe(9999);
    expect(rec.speakable.length).toBeGreaterThan(0);
  });
});

describe("Rari's fleet tools never repeat the stored junk", () => {
  const tools: Array<[string, Row]> = [
    ["get_fleet_vehicles", {}],
    ["getFleetMetrics", {}],
    ["getLocationMetrics", {}],
    ["getLocationMetrics", { location: "Miami" }],
    ["getTopPerformers", { metric: "utilization" }],
    ["getTopPerformers", { metric: "revenue" }],
    ["getPricingRecommendation", { vehicleName: "Lamborghini" }],
    ["getFleetPricingOverview", {}],
    ["compareLocations", {}],
    ["getIdleVehicles", { daysIdle: 7 }],
    ["getRariInsights", {}],
  ];
  for (const [tool, args] of tools) {
    it(`${tool} ${JSON.stringify(args)}`, async () => {
      const out = await run(tool, args);
      const text = flat(out);
      expect(out.error, text).toBeUndefined();
      expect(text).not.toMatch(/99%|999,?999|\$9,?999\b|9999/);
      expect(String(out.summary ?? "").length).toBeGreaterThan(0);
    });
  }

  it("says the real fleet utilization and where it comes from", async () => {
    const out = await run("getFleetMetrics");
    expect(out.averageUtilization).toBe(`${real.fleet}%`);
    expect(out.utilizationPeriod).toBe("last 30 days");
    expect(String(out.howUtilizationIsMeasured)).toMatch(/your own bookings/);
  });

  it("lists each car with measured utilization and what bookings earned it", async () => {
    const out = await run("get_fleet_vehicles");
    const a = (out.vehicles as Row[]).find((v) => v.name.includes("488 Spider"))!;
    expect(a.utilization).toContain(`${real.a}%`);
    expect(a.revenue).toMatch(/last 30 days/);
  });

  it("ranks cars by measured utilization, busiest first", async () => {
    const out = await run("getTopPerformers", { metric: "utilization", limit: 2 });
    const names = (out.performers as Row[]).map((p) => p.name);
    expect(names[0]).toContain("488 Spider");
    expect((out.performers as Row[])[0].utilization).toBe(`${real.a}%`);
  });

  it("ranks all-time revenue from bookings, counting only counted statuses", async () => {
    const out = await run("getTopPerformers", { metric: "revenue" });
    const top = (out.performers as Row[])[0];
    expect(top.name).toContain("488 Spider");
    expect(top.revenueRaw).toBe(10_000); // ten counted days; the cancelled booking is excluded
  });

  it("recommends a rate from the engine, with its reasons, and never from suggested_rate", async () => {
    const out = await run("getPricingRecommendation", { vehicleName: "Lamborghini" });
    expect(["raise", "lower", "hold"]).toContain(out.action);
    expect(String(out.suggestedRate)).not.toContain("9999");
    expect(String(out.basedOn)).toMatch(/your own bookings/);
  });

  it("compares locations on last-30-day facts", async () => {
    const out = await run("compareLocations");
    const miami = (out.locations as Row[]).find((l) => l.location.startsWith("Miami"))!;
    expect(miami.utilizationPeriod).toBe("last 30 days");
    expect(miami.avgUtilization).toBe(`${Math.round(((10 + 3) / (4 * 30)) * 100)}%`);
  });

  it("explains idle cars with open days and the engine's advice, not a made-up revenue loss", async () => {
    const out = await run("getIdleVehicles", { daysIdle: 7 });
    expect(out).not.toHaveProperty("potentialRevenueLoss");
    expect(out.openDaysNext14).toBeGreaterThan(0);
  });
});

describe("Rari's event tool uses the tenant's markets and says how sure it is", () => {
  it("never states a generic market statistic", async () => {
    const out = await run("getEventImpact", {});
    expect(flat(out)).not.toMatch(/15-30%|15-25%|typically/i);
    expect(String(out.summary)).toBeTruthy();
  });

  it("reads curated and searched events near the tenant's cars, with evidence and a modeled caveat", async () => {
    const t = tables();
    t.demand_event_snapshots = [{
      city: "miami",
      calendar_checks: null,
      events: [{
        id: "e1", name: "Test Rally", date: addDays(TODAY, 3), endDate: addDays(TODAY, 4), category: "sports", attendance: 40000,
        evidence: "verified", tier: "major", pricingEligible: true,
        segmentImpact: { exotic: 1.18, sports: 1.1, luxury: 1.05, suv: 1 }, potentialImpact: { exotic: 1.18, sports: 1.1, luxury: 1.05, suv: 1 },
      }, {
        id: "e2", name: "Rumor Night", date: addDays(TODAY, 2), endDate: addDays(TODAY, 2), category: "music", attendance: 900,
        evidence: "unconfirmed", tier: "notable", pricingEligible: false,
        segmentImpact: { exotic: 1, sports: 1, luxury: 1, suv: 1 }, potentialImpact: { exotic: 1.2, sports: 1, luxury: 1, suv: 1 },
      }],
    }];
    const out = await executeFunction("getEventImpact", {}, fakeDb(t), "user-1", TEAM) as Row;
    const names = (out.events as Row[]).map((e) => e.name);
    expect(names).toContain("Test Rally");
    expect(names).not.toContain("Rumor Night"); // unconfirmed events are never stated as fact
    const rally = (out.events as Row[]).find((e) => e.name === "Test Rally")!;
    expect(rally.howSure).toBe("verified");
    expect(rally.modeledLiftForYourCars).toBe("about 18%");
    expect(String(out.caveat)).toMatch(/not yet measured/);
  });
});

describe("Rari speaks in the tenant's time zone", () => {
  // 10:30 pm on October 10 in Miami is already October 11 in UTC.
  const LATE = Date.parse("2026-10-11T02:30:00Z");

  it("starts 'today' at local midnight, not UTC midnight", () => {
    vi.setSystemTime(LATE);
    try {
      const ny = resolveTimeframeWindow("today", "America/New_York");
      expect(ny.start).toBe("2026-10-10T04:00:00.000Z");
      expect(ny.end).toBe("2026-10-11T03:59:59.999Z");
      expect(resolveTimeframeWindow("today").start).toBe("2026-10-11T00:00:00.000Z");
      expect(resolveTimeframeWindow("week", "America/New_York").start).toBe("2026-10-03T04:00:00.000Z");
    } finally {
      vi.setSystemTime(NOW);
    }
  });

  it("reads timestamps as local dates and leaves date-only strings alone", () => {
    // 9 pm on October 10 in Miami = 01:00Z on October 11
    expect(formatDateRange("2026-10-11T01:00:00Z", "2026-10-13T14:00:00Z", "America/New_York")).toBe("October 10 to 13, 2026");
    expect(formatDateRange("2026-10-11T01:00:00Z", "2026-10-13T14:00:00Z")).toBe("October 11 to 13, 2026");
    expect(formatDateRange("2026-10-12", "2026-10-14", "Pacific/Auckland")).toBe("October 12 to 14, 2026");
  });

  it("builds today's schedule from the tenant's local day and says times in their zone", async () => {
    vi.setSystemTime(LATE);
    try {
      const t = tables();
      t.bookings = [
        // 9 pm local on Oct 10: a pickup today in Miami (it is Oct 11 in UTC)
        { id: "p1", team_id: TEAM, booking_ref: "BK-1", customer_name: "Ana", vehicle_name: "Ferrari", start_date: "2026-10-11T01:00:00Z", end_date: "2026-10-13T01:00:00Z", status: "confirmed" },
        // 9 am local on Oct 11: tomorrow in Miami
        { id: "p2", team_id: TEAM, booking_ref: "BK-2", customer_name: "Bo", vehicle_name: "Lambo", start_date: "2026-10-11T13:00:00Z", end_date: "2026-10-14T13:00:00Z", status: "confirmed" },
      ] as Row[];
      const out = await executeFunction("get_todays_schedule", {}, fakeDb(t), "user-1", TEAM) as Row;
      expect(out.date).toBe("2026-10-10");
      expect(out.timeZone).toBe(TZ);
      expect((out.check_outs as Row[]).map((c) => c.ref)).toEqual(["BK-1"]);
      expect((out.check_outs as Row[])[0].timeLocal).toBe("9:00 PM");
    } finally {
      vi.setSystemTime(NOW);
    }
  });
});

describe("Rari's rate advice matches the engine's numbers", () => {
  it("states a lowering as a signed whole percent and dollar change", async () => {
    // Four Miami exotics booked every other day for 60 days (made long ago), one fresh booking so the feed is live,
    // and nothing booked for the coming week: the engine lowers.
    const t = tables();
    const rows: Row[] = [];
    let k = 0;
    for (const id of ["a", "b", "c", "d"]) {
      for (let back = 60; back >= 1; back -= 2) {
        rows.push({ id: `h${k++}`, team_id: TEAM, vehicle_id: id, start_date: at(addDays(TODAY, -back)), end_date: at(addDays(TODAY, -back + 1)), status: "confirmed", total_value: 1000, daily_rate: 1000, created_at: at(addDays(TODAY, -back - 30)) });
      }
    }
    rows.push({ id: "fresh", team_id: TEAM, vehicle_id: "a", start_date: at(addDays(TODAY, 25)), end_date: at(addDays(TODAY, 27)), status: "confirmed", total_value: 2000, daily_rate: 1000, created_at: at(addDays(TODAY, -1)) });
    t.bookings = rows;
    const out = await executeFunction("getPricingRecommendation", { vehicleName: "488 Spider" }, fakeDb(t), "user-1", TEAM) as Row;
    expect(out.action).toBe("lower");
    const rec = recommendationFor(await loadFleetTruth(fakeDb(t), TEAM, { nowMs: NOW }), "a")!;
    expect(out.suggestedRate).toBe(`$${rec.recommendedRate}`);
    expect(out.percentChange).toBe(`${Math.round(rec.changePct * 100)}%`);
    expect(out.percentChange).toMatch(/^-\d+%$/);
    expect(out.difference).toBe(`-$${rec.currentRate - rec.recommendedRate}`);
    expect(out.summary).toBe(rec.speakable);
  });
});

describe("Rari's booking hold is priced like a booking made on screen", () => {
  const hold = (db: any) => executeFunction("create_booking_hold", { vehicle_id: "a", customer_name: "Ana Test", start_date: "2026-10-16T17:00:00Z", end_date: "2026-10-19T17:00:00Z" }, db, "user-1", TEAM) as Promise<Row>;

  it("uses the database's nightly quote and records the breakdown", async () => {
    const t = tables();
    t.bookings = []; // each test gets its own bookings
    const quote = { nights: 3, total: 5500, average: 5500 / 3, time_zone: "America/Phoenix", has_overrides: true,
      breakdown: [{ date: "2026-10-16", rate: 2000, source: "motoriq" }, { date: "2026-10-17", rate: 2500, source: "manual" }, { date: "2026-10-18", rate: 1000, source: "base" }] };
    const out = await hold(fakeDb(t, { quote_nightly: quote }));
    expect(out.success).toBe(true);
    const saved = (t.bookings as Row[]).find((b) => b.customer_name === "Ana Test")!;
    expect(saved.total_value).toBe(5500);
    expect(saved.daily_rate).toBeCloseTo(5500 / 3);
    expect(saved.rate_breakdown.nights).toHaveLength(3);
    expect(saved.rate_breakdown.origin).toBe("rari_voice");
    expect(String(out.summary)).toMatch(/\$5,500.*special rates on 2 nights/);
  });

  it("falls back to days x the base rate if the quote cannot be read", async () => {
    const t = tables();
    t.bookings = [];
    const out = await hold(fakeDb(t, { quote_nightly: { __error: "boom" } }));
    expect(out.success).toBe(true);
    const saved = (t.bookings as Row[]).find((b) => b.customer_name === "Ana Test")!;
    expect(saved.total_value).toBe(1000 * 3);
    expect(saved.daily_rate).toBe(1000);
    expect(saved.rate_breakdown).toBeNull();
  });
});
