import { describe, it, expect, afterEach } from 'vitest';
import { dayKey, endOfLocalDay, occupiedDays, safeTimeZone, tzOffsetMs } from '../lib/motoriq/facts';

// The dashboard computes fleet facts for every day of every booking. Building an
// Intl.DateTimeFormat per call made a revisit to Home block the browser for ~9 s.
const RealDTF = Intl.DateTimeFormat;
let constructed = 0;

function countFormatters() {
  constructed = 0;
  const Counting = function (this: unknown, ...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
    constructed++;
    return new RealDTF(...args);
  } as unknown as typeof Intl.DateTimeFormat;
  Counting.supportedLocalesOf = RealDTF.supportedLocalesOf;
  (Intl as { DateTimeFormat: typeof Intl.DateTimeFormat }).DateTimeFormat = Counting;
}

afterEach(() => {
  (Intl as { DateTimeFormat: typeof Intl.DateTimeFormat }).DateTimeFormat = RealDTF;
});

describe('MotorIQ time-zone helpers', () => {
  it('builds a formatter once per zone, not once per call', () => {
    countFormatters();
    const zone = 'Pacific/Chatham'; // not used elsewhere in the suite, so its caches start cold
    const start = Date.parse('2026-03-01T12:00:00Z');
    for (let i = 0; i < 2000; i++) {
      safeTimeZone(zone);
      tzOffsetMs(start + i * 3_600_000, zone);
      dayKey(start + i * 3_600_000, zone);
    }
    expect(constructed).toBeLessThanOrEqual(3);
  });

  it('remembers an invalid zone too, and still falls back to UTC', () => {
    countFormatters();
    for (let i = 0; i < 100; i++) expect(safeTimeZone('Not/AZone')).toBe('UTC');
    expect(constructed).toBeLessThanOrEqual(1);
    expect(safeTimeZone(null)).toBe('UTC');
    expect(safeTimeZone('')).toBe('UTC');
  });

  it('gives the same offsets across a daylight-saving change', () => {
    const ny = 'America/New_York';
    expect(tzOffsetMs(Date.parse('2026-03-08T06:00:00Z'), ny)).toBe(-5 * 3_600_000); // before the change
    expect(tzOffsetMs(Date.parse('2026-03-08T08:00:00Z'), ny)).toBe(-4 * 3_600_000); // after
    expect(tzOffsetMs(Date.parse('2026-07-01T00:00:00Z'), 'UTC')).toBe(0);
    expect(endOfLocalDay('2026-03-08', ny)).toBe(Date.parse('2026-03-09T04:00:00Z') - 1);
  });

  it('still counts a Miami evening booking on its local date', () => {
    const days = occupiedDays(
      { start_date: '2026-11-20T02:00:00Z', end_date: '2026-11-21T02:00:00Z' }, // 9 pm Miami, one night
      'America/New_York',
    );
    expect(days).toEqual(['2026-11-19']);
  });
});
