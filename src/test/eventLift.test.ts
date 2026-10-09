// Tests for the event demand engine (run by `npm test` via vitest).
import { test } from "vitest";
import assert from "node:assert/strict";
import { latestPerEvent, measurePastEvents, type LiftBooking, type LiftVehicle } from "../lib/eventLift";

// deterministic noise
let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const DAY = 86_400_000;

const vehicles = (n: number, make = "Ferrari", model = "488 Spider"): LiftVehicle[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${make}-${i}`, make, model }));

/** Each car books ~every 4 days for 3 days at its own base rate; inside the window, rates and booking frequency can rise. */
function simulate(vs: LiftVehicle[], opts: { rateLift: number; startsMultiplier: number; window: [string, string]; from: string; to: string }) {
  const out: LiftBooking[] = [];
  const w0 = Date.parse(opts.window[0]), w1 = Date.parse(opts.window[1]);
  vs.forEach((v, vi) => {
    const base = 800 + vi * 60;
    for (let t = Date.parse(opts.from); t <= Date.parse(opts.to); t += DAY) {
      const inside = t >= w0 && t <= w1;
      const p = 0.25 * (inside ? opts.startsMultiplier : 1);
      if (rnd() < p) {
        const rate = base * (1 + (inside ? opts.rateLift : 0)) * (0.95 + rnd() * 0.1);
        out.push({ vehicle_id: v.id, start_date: iso(t), end_date: iso(t + 2 * DAY), daily_rate: Math.round(rate), status: "completed" });
      }
    }
  });
  return out;
}

const WINDOW: [string, string] = ["2026-05-02", "2026-05-06"];
const ev = [{ name: "Test Grand Prix", startDate: WINDOW[0], endDate: WINDOW[1], segmentImpact: { exotic: 1.2 } }];

test("finds a planted +25% rate lift and raised demand", () => {
  seed = 42;
  const vs = vehicles(12);
  const bookings = simulate(vs, { rateLift: 0.25, startsMultiplier: 2.5, window: WINDOW, from: "2026-03-01", to: "2026-07-01" });
  const r = measurePastEvents({ events: ev, allEventWindows: ev, bookings, vehicles: vs }).find((x) => x.segment === "exotic")!;
  assert.equal(r.verdict, "clear-lift");
  assert.ok(r.rate && r.rate.pct > 12 && r.rate.pct < 40, `rate ${r.rate?.pct}`);
  assert.ok(r.rate!.lo > 0, "the whole range is above zero");
  assert.ok(r.demand && r.demand.pct > 50, `demand ${r.demand?.pct}`);
  assert.equal(r.predictedPct, 20);
});

test("flat data rarely claims a lift (no false positives beyond what a 90% range allows)", () => {
  let clear = 0;
  for (let run = 0; run < 20; run++) {
    seed = 1000 + run;
    const vs = vehicles(12);
    const bookings = simulate(vs, { rateLift: 0, startsMultiplier: 1, window: WINDOW, from: "2026-03-01", to: "2026-07-01" });
    const r = measurePastEvents({ events: ev, allEventWindows: ev, bookings, vehicles: vs }).find((x) => x.segment === "exotic")!;
    if (r.verdict === "clear-lift") clear++;
  }
  assert.ok(clear <= 5, `${clear} of 20 flat runs claimed a lift`);
});

test("too little data says so instead of guessing", () => {
  seed = 7;
  const vs = vehicles(3);
  const bookings = simulate(vs, { rateLift: 0.3, startsMultiplier: 1, window: WINDOW, from: "2026-04-28", to: "2026-05-10" });
  const r = measurePastEvents({ events: ev, allEventWindows: ev, bookings, vehicles: vs }).find((x) => x.segment === "exotic")!;
  assert.equal(r.verdict, "not-enough-data");
  assert.equal(r.rate, null);
});

test("a class with fewer than 3 cars is skipped; other classes are measured separately", () => {
  seed = 5;
  const vs = [...vehicles(12), ...vehicles(2, "Lamborghini", "Urus")];
  const bookings = simulate(vs, { rateLift: 0.1, startsMultiplier: 1, window: WINDOW, from: "2026-03-01", to: "2026-07-01" });
  const out = measurePastEvents({ events: ev, allEventWindows: ev, bookings, vehicles: vs });
  assert.ok(out.some((x) => x.segment === "exotic"));
  assert.ok(!out.some((x) => x.segment === "suv"), "two SUVs are not enough to say anything");
});

test("baseline days never include another event's window", () => {
  seed = 11;
  const vs = vehicles(10);
  // a second event right before the first, with huge rates: it must not pollute the baseline of the first
  const other = { startDate: "2026-04-20", endDate: "2026-04-28" };
  const bookings: LiftBooking[] = [
    ...simulate(vs, { rateLift: 0, startsMultiplier: 1, window: WINDOW, from: "2026-03-01", to: "2026-07-01" }),
    ...vs.flatMap((v) => Array.from({ length: 4 }, (_, i) => ({ vehicle_id: v.id, start_date: iso(Date.parse("2026-04-21") + i * DAY), end_date: iso(Date.parse("2026-04-23") + i * DAY), daily_rate: 9000, status: "completed" }))),
  ];
  const r = measurePastEvents({ events: ev, allEventWindows: [...ev, other], bookings, vehicles: vs }).find((x) => x.segment === "exotic")!;
  assert.ok(!r.rate || r.rate.pct < 25, `baseline polluted: ${r.rate?.pct}`);
});

test("latestPerEvent keeps the most recent past occurrence of each event", () => {
  const out = latestPerEvent([
    { name: "A", endDate: "2025-05-04" }, { name: "A", endDate: "2026-05-04" }, { name: "B", endDate: "2026-11-01" }, { name: "C", endDate: "2026-02-01" },
  ], "2026-10-10");
  assert.deepEqual(out.map((e) => `${e.name}:${e.endDate}`).sort(), ["A:2026-05-04", "C:2026-02-01"]);
});
