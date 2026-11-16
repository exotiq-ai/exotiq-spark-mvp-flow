import { describe, it, expect } from 'vitest';
import { rateRowFrom, rateRowChanges, applyTierRule, teamRateFloor } from '@/lib/rateRules';

const car = {
  id: 'v1',
  current_rate: 1200,
  rate_3hr: 450,
  rate_6hr: null,
  rate_multiday: 1000,
  deposit_override_cents: 250000,
};

describe('teamRateFloor', () => {
  it("is the team's own minimum, or none", () => {
    expect(teamRateFloor({ min_rate: 150 })).toBe(150);
    expect(teamRateFloor({ min_rate: null })).toBeNull();
    expect(teamRateFloor({ min_rate: 0 })).toBeNull();
    expect(teamRateFloor(null)).toBeNull();
  });
});

describe('rateRowFrom', () => {
  it('turns a car into editable text; deposit in dollars', () => {
    expect(rateRowFrom(car)).toEqual({ id: 'v1', daily: '1200', h3: '450', h6: '', multiday: '1000', deposit: '2500' });
    expect(rateRowFrom({ ...car, deposit_override_cents: null }).deposit).toBe('');
    expect(rateRowFrom({ ...car, deposit_override_cents: 12345 }).deposit).toBe('123.45');
  });
});

describe('rateRowChanges', () => {
  it('is empty when nothing changed', () => {
    expect(rateRowChanges(rateRowFrom(car), car, null)).toEqual({ ok: true, updates: {} });
  });

  it('sends only what changed, and clears a tier left empty', () => {
    const row = { ...rateRowFrom(car), h3: '', h6: '700' };
    expect(rateRowChanges(row, car, null)).toEqual({ ok: true, updates: { rate_3hr: null, rate_6hr: 700 } });
  });

  it('stores the deposit in cents, empty = team default', () => {
    expect(rateRowChanges({ ...rateRowFrom(car), deposit: '1999.99' }, car, null))
      .toEqual({ ok: true, updates: { deposit_override_cents: 199999 } });
    expect(rateRowChanges({ ...rateRowFrom(car), deposit: '' }, car, null))
      .toEqual({ ok: true, updates: { deposit_override_cents: null } });
    expect(rateRowChanges({ ...rateRowFrom(car), deposit: '0' }, car, null))
      .toEqual({ ok: true, updates: { deposit_override_cents: 0 } });
  });

  it('requires a daily rate', () => {
    const r = rateRowChanges({ ...rateRowFrom(car), daily: '' }, car, null);
    expect(r.ok).toBe(false);
  });

  it('refuses a rate below the team minimum, naming it', () => {
    const r = rateRowChanges({ ...rateRowFrom(car), h3: '90' }, car, 150);
    expect(r).toEqual({ ok: false, error: '3-hour must be at least 150' });
  });

  it('does not flag a saved rate under the minimum that nobody edited', () => {
    const cheap = { ...car, current_rate: 2, rate_3hr: null, rate_multiday: null };
    expect(rateRowChanges(rateRowFrom(cheap), cheap, 100)).toEqual({ ok: true, updates: {} });
    // editing another field on that car is still fine
    expect(rateRowChanges({ ...rateRowFrom(cheap), deposit: '1000' }, cheap, 100))
      .toEqual({ ok: true, updates: { deposit_override_cents: 100000 } });
    // but typing a new rate under the minimum is refused
    expect(rateRowChanges({ ...rateRowFrom(cheap), daily: '3' }, cheap, 100).ok).toBe(false);
  });

  it('refuses nonsense and amounts finer than a cent', () => {
    expect(rateRowChanges({ ...rateRowFrom(car), daily: 'abc' }, car, null).ok).toBe(false);
    expect(rateRowChanges({ ...rateRowFrom(car), h6: '-5' }, car, null).ok).toBe(false);
    expect(rateRowChanges({ ...rateRowFrom(car), multiday: '10.555' }, car, null).ok).toBe(false);
    expect(rateRowChanges({ ...rateRowFrom(car), deposit: '-1' }, car, null).ok).toBe(false);
  });

  it('accepts a leading $ and cents', () => {
    expect(rateRowChanges({ ...rateRowFrom(car), daily: '$1,250.50' }, car, null))
      .toEqual({ ok: true, updates: { current_rate: 1250.5 } });
  });
});

describe('applyTierRule', () => {
  const cars = [
    car,
    { ...car, id: 'v2', current_rate: 200, rate_multiday: null },
    { ...car, id: 'v3', current_rate: 0 },
  ];
  const rows = Object.fromEntries(cars.map((c) => [c.id, rateRowFrom(c)]));

  it('fills a tier from each daily rate, rounded to the dollar, without saving', () => {
    const { rows: next, filled, skipped } = applyTierRule(rows, 'multiday', 85, null);
    expect(next.v1.multiday).toBe('1020');
    expect(next.v2.multiday).toBe('170');
    expect(filled).toBe(2);
    expect(skipped).toEqual(['v3']); // no daily rate
    expect(rows.v1.multiday).toBe('1000'); // input untouched
  });

  it('uses the daily rate as typed, not as saved', () => {
    const typed = { ...rows, v1: { ...rows.v1, daily: '1000' } };
    expect(applyTierRule(typed, 'h3', 40, null).rows.v1.h3).toBe('400');
  });

  it('skips cars where the result would be under the team minimum', () => {
    const { rows: next, skipped } = applyTierRule(rows, 'h3', 50, 150);
    expect(next.v1.h3).toBe('600');
    expect(next.v2.h3).toBe(rows.v2.h3); // 100 < 150: left as it was
    expect(skipped).toEqual(['v2', 'v3']);
  });
});
