import { describe, it, expect } from 'vitest';
import { computeMileageOverage, parseMileageRate } from '@/lib/mileage';

const base = {
  perDayAllowance: 200,
  ratePerMile: 2.25,
  pickupOdometer: 10_000,
  returnOdometer: 10_742,
  startDate: '2026-11-01T10:00:00',
  endDate: '2026-11-04T10:00:00', // 3 booked days
};

describe('computeMileageOverage', () => {
  it('multiplies the daily allowance by the rental days', () => {
    const r = computeMileageOverage(base);
    expect(r.status).toBe('ok');
    expect(r.days).toBe(3);
    expect(r.included).toBe(600);
    expect(r.milesDriven).toBe(742);
    expect(r.overMiles).toBe(142);
    expect(r.charge).toBe(319.5);
  });

  it('charges nothing when the miles stay inside the allowance', () => {
    const r = computeMileageOverage({ ...base, returnOdometer: 10_550 });
    expect(r.overMiles).toBe(0);
    expect(r.charge).toBe(0);
  });

  it('counts the actual days kept when the car comes back late', () => {
    const r = computeMileageOverage({ ...base, returnedAt: '2026-11-05T18:00:00' });
    expect(r.bookedDays).toBe(3);
    expect(r.daysKept).toBe(4);
    expect(r.days).toBe(4);
    expect(r.included).toBe(800);
    expect(r.charge).toBe(0);
  });

  it('keeps the booked days when the car comes back early', () => {
    const r = computeMileageOverage({ ...base, returnedAt: '2026-11-02T09:00:00' });
    expect(r.daysKept).toBe(1);
    expect(r.days).toBe(3);
    expect(r.included).toBe(600);
  });

  it('treats a same-day rental as one day', () => {
    const r = computeMileageOverage({
      ...base,
      startDate: '2026-11-01T10:00:00',
      endDate: '2026-11-01T16:00:00',
      returnOdometer: 10_250,
    });
    expect(r.days).toBe(1);
    expect(r.overMiles).toBe(50);
    expect(r.charge).toBe(112.5);
  });

  it('rounds the charge to the cent', () => {
    const r = computeMileageOverage({ ...base, ratePerMile: 1.333, returnOdometer: 10_607 });
    expect(r.overMiles).toBe(7);
    expect(r.charge).toBe(9.33);
  });

  it('does not invent a rule when the booking has no allowance or no rate', () => {
    expect(computeMileageOverage({ ...base, perDayAllowance: null }).status).toBe('no_rule');
    expect(computeMileageOverage({ ...base, ratePerMile: undefined }).status).toBe('no_rule');
    expect(computeMileageOverage({ ...base, perDayAllowance: null }).charge).toBe(0);
  });

  it('waits for both odometer readings', () => {
    expect(computeMileageOverage({ ...base, pickupOdometer: null }).status).toBe('no_readings');
    expect(computeMileageOverage({ ...base, returnOdometer: 0 }).status).toBe('no_readings');
  });

  it('never reports negative miles', () => {
    const r = computeMileageOverage({ ...base, returnOdometer: 9_900 });
    expect(r.milesDriven).toBe(0);
    expect(r.charge).toBe(0);
  });
});

describe('parseMileageRate', () => {
  it('accepts any rate to the cent', () => {
    expect(parseMileageRate('2.25')).toBe(2.25);
    expect(parseMileageRate('$6')).toBe(6);
    expect(parseMileageRate(' 0.5 ')).toBe(0.5);
  });

  it('returns null for empty input and rejects nonsense', () => {
    expect(parseMileageRate('')).toBeNull();
    expect(parseMileageRate('abc')).toBeUndefined();
    expect(parseMileageRate('-1')).toBeUndefined();
    expect(parseMileageRate('2.255')).toBeUndefined();
  });
});
