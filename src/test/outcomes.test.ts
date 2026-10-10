// Results: what the tenant's own date rates and base-rate changes did, measured against similar cars.
// Every scenario plants a known answer.
import { describe, expect, it } from "vitest";
import { addDays, computeFleetFacts } from "../lib/motoriq/facts";
import { computeOutcomes, type RateChangeRow } from "../lib/motoriq/outcomes";
import type { RateOverride } from "../lib/motoriq/dateRates";
import type { BookingRow, VehicleRow } from "../lib/motoriq/types";

const TODAY = "2026-10-30";
const at = (day: string, hour = 10) => `${day}T${String(hour).padStart(2, "0")}:00:00Z`;
const ids = ["a", "b", "c", "d", "e", "f", "g"]; // a is the car we change; b..g are similar cars (6)
const cars = (n = ids.length): VehicleRow[] =>
  ids.slice(0, n).map((id) => ({ id, name: `Ferrari ${id}`, make: "Ferrari", model: "488 Spider", current_rate: 1000, status: "available", location: "Miami" }));
const booking = (vehicle_id: string, startDay: string, nights: number, o: Partial<BookingRow> = {}): BookingRow => ({
  vehicle_id, start_date: at(startDay), end_date: at(addDays(startDay, nights)), daily_rate: 1000, status: "confirmed",
  created_at: at(addDays(startDay, -20)), ...o,
});
const rateRow = (o: Partial<RateOverride> = {}): RateOverride => ({
  id: "o1", vehicle_id: "a", start_date: "2026-10-16", end_date: "2026-10-18", daily_rate: 1500, source: "motoriq",
  reason: "Test Rally", created_at: at("2026-10-05"), revoked_at: null, ...o,
});
const run = (v: VehicleRow[], bookings: BookingRow[], overrides: RateOverride[], rateChanges: RateChangeRow[] = [], today = TODAY) =>
  computeOutcomes({ facts: computeFleetFacts({ vehicles: v, bookings, today, tz: "UTC" }), bookings, overrides, rateChanges, today, tz: "UTC" });

/** the controls b, c, d (3 of 6) are booked on the three nights; e, f, g are not */
const controlsHalfBooked = () => ["b", "c", "d"].map((id) => booking(id, "2026-10-16", 3));

describe("date rates: did demand hold, and what did the premium bring in?", () => {
  it("a finished rate that booked fully while similar cars were half booked held, and counts the extra only on later bookings", () => {
    const bookings = [
      ...controlsHalfBooked(),
      booking("a", "2026-10-16", 1, { created_at: at("2026-10-01"), daily_rate: 1000 }), // made before the rate was set: no premium
      booking("a", "2026-10-17", 2, { created_at: at("2026-10-10"), daily_rate: 1500 }), // made after: 2 nights x $500 over base
    ];
    const r = run(cars(), bookings, [rateRow()])!;
    const d = r.dateRates[0];
    expect(d).toMatchObject({ status: "finished", nights: 3, bookedNights: 3, bookedAfter: 2, verdict: "held", controlCars: 6 });
    expect(d.controlShare).toBeCloseTo(0.5);
    expect(d.diffPts).toBe(50);
    expect(d.extraRevenue).toBe(1000);
    expect(d.confidence).toBe("medium");
    expect(r.summary).toMatchObject({ comparedRates: 1, held: 1, softer: 0, extraRevenue: 1000 });
    expect(r.headline).toMatch(/demand held on 1/);
    expect(r.headline).toMatch(/\$1,000 more/);
    expect(r.speakable).toMatch(/evidence rather than proof/);
  });

  it("a finished rate that booked far less than similar cars is softer, and says so", () => {
    const everyone = ["b", "c", "d", "e", "f", "g"].map((id) => booking(id, "2026-10-16", 3));
    const r = run(cars(), [...everyone, booking("a", "2026-10-16", 1, { created_at: at("2026-10-10"), daily_rate: 1500 })], [rateRow()])!;
    const d = r.dateRates[0];
    expect(d.verdict).toBe("softer");
    expect(d.diffPts).toBe(-67);
    expect(d.sentence).toMatch(/softer than for similar cars/);
    expect(r.summary).toMatchObject({ held: 0, softer: 1 });
  });

  it("a rate that has not finished is 'too early' and reports nights booked so far", () => {
    const running = run(cars(), controlsHalfBooked(), [rateRow({ start_date: "2026-10-29", end_date: "2026-11-02" })])!.dateRates[0];
    expect(running).toMatchObject({ status: "running", verdict: "too-early" });
    expect(running.sentence).toMatch(/still running/);
    const upcoming = run(cars(), [], [rateRow({ start_date: "2026-11-10", end_date: "2026-11-12" })])!.dateRates[0];
    expect(upcoming).toMatchObject({ status: "upcoming", verdict: "too-early", bookedNights: 0 });
    expect(run(cars(), [], [rateRow({ start_date: "2026-11-10", end_date: "2026-11-12" })])!.headline).toMatch(/live or coming up/);
  });

  it("with fewer than three similar cars it refuses to compare", () => {
    const r = run(cars(3), [booking("a", "2026-10-16", 3)], [rateRow()])!;
    expect(r.dateRates[0]).toMatchObject({ verdict: "no-comparison", controlShare: null, diffPts: null, confidence: "low" });
    expect(r.dateRates[0].sentence).toMatch(/too few similar cars/);
  });

  it("a different type of car, or a car with its own date rate that night, is not a yardstick", () => {
    const mixed = cars().map((c, i) => (i >= 4 ? { ...c, make: "Toyota", model: "Camry" } : c)); // e,f,g are not exotics
    const r1 = run(mixed, [booking("a", "2026-10-16", 3)], [rateRow()])!;
    expect(r1.dateRates[0].controlCars).toBe(3); // only b, c, d
    const withOwn = [rateRow(), rateRow({ id: "o2", vehicle_id: "b" }), rateRow({ id: "o3", vehicle_id: "c" })];
    const r2 = run(cars(), [booking("a", "2026-10-16", 3)], withOwn)!;
    const a = r2.dateRates.find((d) => d.vehicleId === "a")!;
    expect(a.controlCars).toBe(4); // b and c carry their own rates; d..g remain
  });

  it("ignores a range revoked before its first night and shortens one revoked part way", () => {
    expect(run(cars(), [], [rateRow({ revoked_at: at("2026-10-10") }), rateRow({ id: "o9", vehicle_id: "b", start_date: "2026-11-05", end_date: "2026-11-08", revoked_at: at("2026-11-01") })])).toBeNull();
    const partial = run(cars(), [], [rateRow({ revoked_at: at("2026-10-18", 8) })])!.dateRates[0];
    expect(partial.to).toBe("2026-10-17"); // reverted on the 18th: only the 16th and 17th were priced
    expect(partial.nights).toBe(2);
  });

  it("returns nothing when no rate has been changed", () => {
    expect(run(cars(), controlsHalfBooked(), [])).toBeNull();
  });
});

describe("base-rate changes: bookings in the 14 days after versus before, against similar cars", () => {
  const change = (o: Partial<RateChangeRow> = {}): RateChangeRow => ({
    vehicle_id: "a", old_value: "1000", new_value: "1200", change_source: "ai_pricing", created_at: at("2026-10-01"), ...o,
  });
  // bookings are MADE (created_at) on the given days
  const made = (id: string, day: string, n = 1) =>
    Array.from({ length: n }, (_, i) => booking(id, addDays(day, 30 + i * 2), 1, { created_at: at(day, 9 + (i % 12)) }));

  it("more bookings than similar cars after a change is reported with the numbers behind it", () => {
    const bookings = [
      ...made("a", "2026-09-25", 1), ...made("a", "2026-10-05", 4),
      ...["b", "c", "d", "e", "f", "g"].flatMap((id) => [...made(id, "2026-09-26", 1), ...made(id, "2026-10-06", 1)]),
    ];
    const r = run(cars(), bookings, [], [change()])!;
    const c = r.baseChanges[0];
    expect(c).toMatchObject({ before: 1, after: 4, controlCars: 6, controlBefore: 1, controlAfter: 1, verdict: "more-bookings", confidence: "low" }); // similar cars averaged only 1 booking a period: too thin for more
    expect(c.sentence).toMatch(/raised the base rate from \$1,000 to \$1,200/);
    expect(c.sentence).toMatch(/1 in the 14 days before, 4 after; similar cars averaged 1 then 1/);
  });

  it("with busier similar cars the same read earns medium confidence", () => {
    const bookings = [
      ...made("a", "2026-09-25", 1), ...made("a", "2026-10-05", 8),
      ...["b", "c", "d", "e", "f", "g"].flatMap((id) => [...made(id, "2026-09-26", 2), ...made(id, "2026-10-06", 2)]),
    ];
    const c = run(cars(), bookings, [], [change()])!.baseChanges[0];
    expect(c).toMatchObject({ controlBefore: 2, controlAfter: 2, verdict: "more-bookings", confidence: "medium" });
  });

  it("a swing that similar cars ordinarily show is not a difference (counts of 20 are noisy)", () => {
    // the car goes 20 -> 10 bookings made; similar cars go 20 -> 12 on average, with a spread between them
    const spread = (n: number) => made("b", "2026-09-26", n);
    const bookings = [
      ...made("a", "2026-09-25", 20), ...made("a", "2026-10-05", 10),
      ...spread(20), ...made("b", "2026-10-06", 12),
      ...made("c", "2026-09-26", 18), ...made("c", "2026-10-06", 10),
      ...made("d", "2026-09-26", 22), ...made("d", "2026-10-06", 14),
      ...made("e", "2026-09-26", 19), ...made("e", "2026-10-06", 11),
      ...made("f", "2026-09-26", 21), ...made("f", "2026-10-06", 13),
      ...made("g", "2026-09-26", 20), ...made("g", "2026-10-06", 12),
    ];
    expect(run(cars(), bookings, [], [change()])!.baseChanges[0].verdict).toBe("similar");
  });

  it("when bookings stop being recorded for every car, it says there is nothing to compare (not 'fewer bookings')", () => {
    const bookings = [
      ...made("a", "2026-09-25", 23),
      ...["b", "c", "d", "e", "f", "g"].flatMap((id) => made(id, "2026-09-26", 16)),
    ]; // nobody has a booking made after the change
    const c = run(cars(), bookings, [], [change()])!.baseChanges[0];
    expect(c.verdict).toBe("no-comparison");
    expect(c.sentence).toMatch(/booking record may have stopped/);
  });

  it("with hardly any bookings around the date, it reads nothing from it", () => {
    const c = run(cars(), made("a", "2026-10-05", 1), [], [change()])!.baseChanges[0];
    expect(c.verdict).toBe("no-comparison");
    expect(c.sentence).toMatch(/hardly any bookings/);
  });

  it("a change under 3% is noise, and a change that is too recent is 'too early'", () => {
    expect(run(cars(), made("a", "2026-10-05", 3), [], [change({ new_value: "1020" })])).toBeNull();
    const recent = run(cars(), made("a", "2026-10-25", 2), [], [change({ created_at: at("2026-10-24") })])!.baseChanges[0];
    expect(recent.verdict).toBe("too-early");
    expect(recent.daysSince).toBe(6);
    expect(recent.sentence).toMatch(/I need 14 to compare/);
  });

  it("a similar car that changed its own rate nearby is not a yardstick; with too few left, no comparison", () => {
    const changes = [change(), ...["b", "c", "d", "e"].map((id) => change({ vehicle_id: id, created_at: at("2026-10-03") }))];
    const r = run(cars(), made("a", "2026-10-05", 2), [], changes)!;
    const a = r.baseChanges.find((c) => c.vehicleId === "a")!;
    expect(a.controlCars).toBe(2); // only f and g stayed quiet
    expect(a.verdict).toBe("no-comparison");
  });

  it("a lowering is described as a lowering", () => {
    const r = run(cars(), [], [], [change({ old_value: "1200", new_value: "1000" })])!;
    expect(r.baseChanges[0].sentence).toMatch(/lowered the base rate from \$1,200 to \$1,000/);
  });
});

describe("the headline says something useful or nothing", () => {
  it("has no headline when every base-rate change was unreadable (so the card stays off the screen)", () => {
    const changes: RateChangeRow[] = [{ vehicle_id: "a", old_value: "1000", new_value: "1200", change_source: "ai_pricing", created_at: at("2026-10-01") }];
    const r = run(cars(), [], [], changes)!;
    expect(r.baseChanges[0].verdict).toBe("no-comparison");
    expect(r.headline).toBeNull();
  });

  it("summarises the readable base-rate changes in counts", () => {
    const made = (id: string, day: string, n: number) => Array.from({ length: n }, (_, i) => booking(id, addDays(day, 30 + i * 2), 1, { created_at: at(day, 9 + (i % 12)) }));
    const bookings = [...made("a", "2026-09-25", 1), ...made("a", "2026-10-05", 8), ...["b", "c", "d", "e", "f", "g"].flatMap((id) => [...made(id, "2026-09-26", 2), ...made(id, "2026-10-06", 2)])];
    const r = run(cars(), bookings, [], [{ vehicle_id: "a", old_value: "1000", new_value: "1200", change_source: "ai_pricing", created_at: at("2026-10-01") }])!;
    expect(r.headline).toBe("Of your base-rate changes I could compare 1 with similar cars: 1 drew more bookings.");
  });
});
