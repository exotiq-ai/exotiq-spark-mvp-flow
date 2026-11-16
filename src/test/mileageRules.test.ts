import { describe, it, expect } from 'vitest';
import { mileageRowFrom, mileageRowChanges, mileageRuleSource } from '@/lib/mileageRules';

const car = {
  id: 'v1',
  name: 'Huracán EVO',
  default_mileage_limit: 200,
  mileage_overage_rate: 2.25,
  unlimited_mileage: false,
};
const team = { default_mileage_limit: 200, default_mileage_overage_rate: 2.25 };

describe('mileageRowFrom', () => {
  it('turns a vehicle into editable text, rates with cents', () => {
    expect(mileageRowFrom(car)).toEqual({ id: 'v1', miles: '200', rate: '2.25', unlimited: false });
    expect(mileageRowFrom({ ...car, mileage_overage_rate: 6, default_mileage_limit: null, unlimited_mileage: null }))
      .toEqual({ id: 'v1', miles: '', rate: '6.00', unlimited: false });
  });
});

describe('mileageRowChanges', () => {
  it('is empty when nothing changed', () => {
    expect(mileageRowChanges(mileageRowFrom(car), car)).toEqual({ ok: true, updates: {} });
  });

  it('sends only the fields that changed', () => {
    const row = { ...mileageRowFrom(car), rate: '3.10' };
    expect(mileageRowChanges(row, car)).toEqual({ ok: true, updates: { mileage_overage_rate: 3.1 } });
  });

  it('turns unlimited on without touching the stored allowance and rate', () => {
    const row = { ...mileageRowFrom(car), unlimited: true };
    expect(mileageRowChanges(row, car)).toEqual({ ok: true, updates: { unlimited_mileage: true } });
  });

  it('clears a field left empty', () => {
    const row = { ...mileageRowFrom(car), miles: '' };
    expect(mileageRowChanges(row, car)).toEqual({ ok: true, updates: { default_mileage_limit: null } });
  });

  it('refuses miles that are not a whole number of zero or more', () => {
    for (const miles of ['-5', '12.5', 'abc']) {
      expect(mileageRowChanges({ ...mileageRowFrom(car), miles }, car).ok).toBe(false);
    }
  });

  it('refuses a rate finer than a cent or negative', () => {
    expect(mileageRowChanges({ ...mileageRowFrom(car), rate: '2.255' }, car).ok).toBe(false);
    expect(mileageRowChanges({ ...mileageRowFrom(car), rate: '-1' }, car).ok).toBe(false);
  });
});

describe('mileageRuleSource', () => {
  it('says which rule a car follows', () => {
    expect(mileageRuleSource(car, team)).toBe('team');
    expect(mileageRuleSource({ ...car, mileage_overage_rate: 3 }, team)).toBe('custom');
    expect(mileageRuleSource({ ...car, unlimited_mileage: true }, team)).toBe('unlimited');
    expect(mileageRuleSource({ ...car, default_mileage_limit: null, mileage_overage_rate: null }, team)).toBe('none');
  });

  it('calls a car custom when the team has no defaults', () => {
    expect(mileageRuleSource(car, { default_mileage_limit: null, default_mileage_overage_rate: null })).toBe('custom');
  });

  it('compares rates to the cent', () => {
    expect(mileageRuleSource({ ...car, mileage_overage_rate: 2.250000001 }, team)).toBe('team');
  });
});
