/**
 * Bridge from the event engine's payload to the pricing engine: for one type of car, on which dates in the next 14 days do
 * CONFIRMED events lift demand, by how much, and which events are behind it? Evidence weighting is already inside each
 * event's `segmentImpact` (curated and verified count in full, listed at half, unconfirmed not at all).
 */
import { dayUplifts, evidenceOf, eventsOnDay, type ImpactEvent, type SegmentKey } from "../eventImpact";
import { addDays } from "./facts";
import type { EventWindow } from "./pricingEngine";

export const EVENT_HORIZON_DAYS = 14;
const MIN_UPLIFT = 0.02; // below 2% is noise
const PEAK_SHARE = 0.6; // a window is the days within 60% of the strongest lift in the horizon

export function eventWindowsFor(events: ImpactEvent[], segment: SegmentKey, today: string, days = EVENT_HORIZON_DAYS): EventWindow[] {
  if (!events.length) return [];
  const daily: Array<{ day: string; uplift: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    daily.push({ day: d, uplift: dayUplifts(events, d)[segment] });
  }
  // Only the PEAK days are quoted: days within 60% of the strongest lift in the horizon. Chained small events (a fair
  // next to a race weekend) must not stretch the big event's premium over two weeks.
  const maxUplift = Math.max(...daily.map((d) => d.uplift));
  const threshold = Math.max(MIN_UPLIFT, PEAK_SHARE * maxUplift);
  const windows: EventWindow[] = [];
  let cur: typeof daily = [];
  const flush = () => {
    if (!cur.length) return;
    const from = cur[0].day;
    const to = cur[cur.length - 1].day;
    const peakDay = cur.reduce((b, x) => (x.uplift > b.uplift ? x : b), cur[0]);
    const names = new Map<string, number>();
    let confirmed = 0;
    for (const x of cur) {
      for (const e of eventsOnDay(events, x.day)) {
        if (e.pricingEligible === false) continue;
        const gain = (e.segmentImpact?.[segment] ?? 1) - 1;
        if (gain <= 0) continue;
        if (!names.has(e.name)) { names.set(e.name, gain); const ev = evidenceOf(e); if (ev === "curated" || ev === "verified") confirmed++; }
      }
    }
    windows.push({
      from,
      to,
      uplift: peakDay.uplift,
      names: [...names.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n),
      confirmed,
      provenance: { source: "events in your market, confirmed and weighted by evidence", n: names.size, asOf: today },
    });
    cur = [];
  };
  for (const d of daily) {
    if (d.uplift >= threshold) cur.push(d);
    else flush();
  }
  flush();
  return windows;
}
