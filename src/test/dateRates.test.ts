// Date-specific rates: the TypeScript mirror of the SQL functions (same cases as supabase/tests/vehicle_rate_overrides.test.sql),
// the wall-clock night count, and the pricing engine comparing bookings with the rate that was listed when they were made.
import { describe, expect, it } from "vitest";
import { overrideForDay, rateForDay, type RateOverride } from "../lib/motoriq/dateRates";
import { quoteNightly, stayNights } from "../lib/motoriq/quote";
import { priceExtensionNights } from "../lib/motoriq/extensionPricing";
import { addDays, computeFleetFacts, occupiedDays } from "../lib/motoriq/facts";
import type { BookingRow, VehicleRow } from "../lib/motoriq/types";

const V = "car-1";
const ov = (o: Partial<RateOverride> & Pick<RateOverride, "start_date" | "end_date" | "daily_rate" | "source">, i = 0): RateOverride => ({
  id: `o${i}`, vehicle_id: V, created_at: `2026-10-01T12:0${i}:00Z`, revoked_at: null, ...o,
});

describe("date rates: which rate applies on a day", () => {
  it("manual beats MotorIQ beats the base rate", () => {
    const list = [
      ov({ start_date: "2026-10-16", end_date: "2026-10-17", daily_rate: 2000, source: "motoriq" }, 1),
      ov({ start_date: "2026-10-17", end_date: "2026-10-17", daily_rate: 2500, source: "manual" }, 2),
    ];
    expect(rateForDay(list, V, "2026-10-16", 1000)).toMatchObject({ rate: 2000, source: "motoriq" });
    expect(rateForDay(list, V, "2026-10-17", 1000)).toMatchObject({ rate: 2500, source: "manual" });
    expect(rateForDay(list, V, "2026-10-18", 1000)).toMatchObject({ rate: 1000, source: "base", overrideId: null });
  });

  it("ignores revoked ranges and other cars; the newest of the same source wins", () => {
    const list = [
      ov({ start_date: "2026-10-16", end_date: "2026-10-17", daily_rate: 2000, source: "motoriq", revoked_at: "2026-10-02T00:00:00Z" }, 1),
      ov({ start_date: "2026-10-16", end_date: "2026-10-17", daily_rate: 1800, source: "motoriq" }, 2),
      { ...ov({ start_date: "2026-10-16", end_date: "2026-10-17", daily_rate: 9999, source: "manual" }, 3), vehicle_id: "other" },
    ];
    expect(overrideForDay(list, V, "2026-10-16")?.daily_rate).toBe(1800);
  });

  it("knows what was in force at a past moment (for comparing an old booking with its listed price)", () => {
    const list = [ov({ start_date: "2026-10-16", end_date: "2026-10-17", daily_rate: 2000, source: "motoriq", created_at: "2026-10-05T00:00:00Z", revoked_at: "2026-10-08T00:00:00Z" })];
    const at = (iso: string) => rateForDay(list, V, "2026-10-16", 1000, Date.parse(iso)).rate;
    expect(at("2026-10-04T00:00:00Z")).toBe(1000); // before it was applied
    expect(at("2026-10-06T00:00:00Z")).toBe(2000); // while in force
    expect(at("2026-10-09T00:00:00Z")).toBe(1000); // after it was reverted
  });
});

describe("date rates: quoting a stay", () => {
  const list = [
    ov({ start_date: "2026-10-16", end_date: "2026-10-17", daily_rate: 2000, source: "motoriq" }, 1),
    ov({ start_date: "2026-10-17", end_date: "2026-10-17", daily_rate: 2500, source: "manual" }, 2),
  ];

  it("breaks a stay into nights and sums them", () => {
    const q = quoteNightly(list, V, "2026-10-16T17:00:00Z", "2026-10-19T17:00:00Z", "America/Phoenix", 1000);
    expect(q.nights).toBe(3);
    expect(q.breakdown.map((d) => [d.date, d.rate, d.source])).toEqual([["2026-10-16", 2000, "motoriq"], ["2026-10-17", 2500, "manual"], ["2026-10-18", 1000, "base"]]);
    expect(q.total).toBe(5500);
    expect(q.average).toBeCloseTo(5500 / 3);
    expect(q.hasOverrides).toBe(true);
  });

  it("uses a duration-tier rate on days without an override", () => {
    const q = quoteNightly(list, V, "2026-10-16T17:00:00Z", "2026-10-19T17:00:00Z", "America/Phoenix", 1000, 700);
    expect(q.breakdown[2].rate).toBe(700);
    expect(q.breakdown[0].rate).toBe(2000);
  });

  it("no overrides means the base rate on every night", () => {
    const q = quoteNightly([], V, "2026-10-16T17:00:00Z", "2026-10-18T17:00:00Z", "America/Phoenix", 1000);
    expect(q).toMatchObject({ nights: 2, total: 2000, hasOverrides: false });
  });

  it("counts nights on the local wall clock across a daylight-saving change", () => {
    // Oct 31 10:00 EDT to Nov 2 10:00 EST: 49 elapsed hours, two calendar nights (DST ends Nov 1)
    const q = quoteNightly([], V, "2026-10-31T14:00:00Z", "2026-11-02T15:00:00Z", "America/New_York", 1000);
    expect(q.nights).toBe(2);
    expect(q.breakdown.map((d) => d.date)).toEqual(["2026-10-31", "2026-11-01"]);
    // and the facts count the same days
    expect(occupiedDays({ start_date: "2026-10-31T14:00:00Z", end_date: "2026-11-02T15:00:00Z" }, "America/New_York")).toEqual(["2026-10-31", "2026-11-01"]);
  });

  it("starts on the local date, handles zero-length and reversed stays, and falls back to UTC for a bad zone", () => {
    expect(quoteNightly([], V, "2026-10-11T01:00:00Z", "2026-10-11T12:00:00Z", "America/New_York", 1000).breakdown[0].date).toBe("2026-10-10");
    expect(quoteNightly([], V, "2026-10-11T01:00:00Z", "2026-10-11T12:00:00Z", "America/Phoenix", 1000).breakdown[0].date).toBe("2026-10-10");
    expect(stayNights(Date.parse("2026-10-12T10:00:00Z"), Date.parse("2026-10-12T10:00:00Z"), "UTC")).toBe(1);
    expect(stayNights(Date.parse("2026-10-12T10:00:00Z"), Date.parse("2026-10-11T10:00:00Z"), "UTC")).toBe(0);
    expect(quoteNightly([], V, "2026-10-12T10:00:00Z", "2026-10-13T10:00:00Z", "Mars/Olympus", 1000).timeZone).toBe("UTC");
  });
});

describe("pricing engine: bookings are compared with the rate that was listed when they were made", () => {
  const TODAY = "2026-10-10";
  const at = (day: string, hour = 10) => `${day}T${String(hour).padStart(2, "0")}:00:00Z`;
  const car: VehicleRow = { id: V, name: V, make: "Ferrari", model: "488 Spider", current_rate: 1000, status: "available", location: "Miami" };
  // three bookings made in the last week for the event weekend, each at the 1,500 event rate
  const bookings: BookingRow[] = [0, 1, 2].map((i) => ({
    vehicle_id: V, start_date: at(addDays(TODAY, 6 + i * 2)), end_date: at(addDays(TODAY, 7 + i * 2)),
    daily_rate: 1500, status: "confirmed", created_at: at(addDays(TODAY, -3 + i)),
  }));

  it("without date rates, guests paying 1,500 against a 1,000 list look like they pay 150% of list", () => {
    const f = computeFleetFacts({ vehicles: [car], bookings, today: TODAY });
    expect(f.vehicles[0].rateRealization.value).toBeCloseTo(1.5);
  });

  it("with the event rate applied when they booked, guests are paying exactly what was listed", () => {
    const overrides: RateOverride[] = [ov({ start_date: addDays(TODAY, 5), end_date: addDays(TODAY, 12), daily_rate: 1500, source: "motoriq", created_at: at(addDays(TODAY, -5)) })];
    const f = computeFleetFacts({ vehicles: [car], bookings, overrides, today: TODAY });
    expect(f.vehicles[0].rateRealization.value).toBeCloseTo(1);
  });

  it("a rate reverted before they booked does not count as listed", () => {
    const overrides: RateOverride[] = [ov({ start_date: addDays(TODAY, 5), end_date: addDays(TODAY, 12), daily_rate: 1500, source: "motoriq", created_at: at(addDays(TODAY, -9)), revoked_at: at(addDays(TODAY, -6)) })];
    const f = computeFleetFacts({ vehicles: [car], bookings, overrides, today: TODAY });
    expect(f.vehicles[0].rateRealization.value).toBeCloseTo(1.5);
  });
});

describe("extension pricing: each added night is the date rate in force, else the rate entered", () => {
  const rows = [
    { night: "2026-10-16", rate: "1500.00", source: "motoriq" },
    { night: "2026-10-17", rate: "1000.00", source: "base" },
    { night: "2026-10-18", rate: 2000, source: "manual" },
  ];

  it("sums the nights and says whether date rates applied", () => {
    const p = priceExtensionNights(rows, 100000, 3, "2026-10-16");
    expect(p.nights.map((n) => [n.date, n.rateCents, n.source])).toEqual([["2026-10-16", 150000, "motoriq"], ["2026-10-17", 100000, "base"], ["2026-10-18", 200000, "manual"]]);
    expect(p.subtotalCents).toBe(450000);
    expect(p.averageRateCents).toBe(150000);
    expect(p.hasDateRates).toBe(true);
  });

  it("prices a night the database did not return at the entered rate (never zero)", () => {
    const p = priceExtensionNights(rows.slice(0, 1), 90000, 3, "2026-10-16");
    expect(p.nights.map((n) => n.rateCents)).toEqual([150000, 90000, 90000]);
  });

  it("falls back to a flat charge when the lookup failed", () => {
    const p = priceExtensionNights(null, 90000, 2, "2026-10-16");
    expect(p).toMatchObject({ subtotalCents: 180000, averageRateCents: 90000, hasDateRates: false });
  });

  it("rounds the average to a cent and handles zero nights", () => {
    const p = priceExtensionNights([{ night: "2026-10-16", rate: 1000, source: "base" }, { night: "2026-10-17", rate: 1000, source: "base" }, { night: "2026-10-18", rate: 1000.01, source: "manual" }], 100000, 3, "2026-10-16");
    expect(p.subtotalCents).toBe(300001);
    expect(p.averageRateCents).toBe(100000);
    expect(priceExtensionNights([], 100000, 0, "2026-10-16")).toMatchObject({ subtotalCents: 0, averageRateCents: 0, nights: [] });
  });
});
