import { describe, it, expect } from 'vitest';
import { gasFeeFromTeam, teamDefaultsFormFrom, teamDefaultsChanges } from '@/lib/teamPricingDefaults';

const team = {
  min_rate: 150,
  default_deposit_cents: 150000,
  gas_fee_enabled: true,
  gas_fee_amount: 25,
  gas_fee_default_on: false,
};

describe('gasFeeFromTeam', () => {
  it("reads the team's own gas fee", () => {
    expect(gasFeeFromTeam(team)).toEqual({ gasFeeEnabled: true, gasFeeAmount: 25, gasFeeDefaultOn: false });
  });

  it('uses the old built-in defaults until the team has values (before the migration)', () => {
    expect(gasFeeFromTeam({})).toEqual({ gasFeeEnabled: true, gasFeeAmount: 20, gasFeeDefaultOn: true });
    expect(gasFeeFromTeam(null)).toEqual({ gasFeeEnabled: true, gasFeeAmount: 20, gasFeeDefaultOn: true });
  });

  it('keeps a real zero fee and a switched-off fee', () => {
    expect(gasFeeFromTeam({ gas_fee_amount: 0, gas_fee_enabled: false }).gasFeeAmount).toBe(0);
    expect(gasFeeFromTeam({ gas_fee_amount: 0, gas_fee_enabled: false }).gasFeeEnabled).toBe(false);
  });
});

describe('teamDefaultsChanges', () => {
  const form = () => teamDefaultsFormFrom(team);

  it('round-trips the saved values with no changes', () => {
    expect(form()).toEqual({ minRate: '150', deposit: '1500', gasEnabled: true, gasAmount: '25', gasDefaultOn: false });
    expect(teamDefaultsChanges(form(), team)).toEqual({ ok: true, updates: {} });
  });

  it('writes the minimum rate to the team, empty = no minimum', () => {
    expect(teamDefaultsChanges({ ...form(), minRate: '200' }, team)).toEqual({ ok: true, updates: { min_rate: 200 } });
    expect(teamDefaultsChanges({ ...form(), minRate: '' }, team)).toEqual({ ok: true, updates: { min_rate: null } });
  });

  it('stores the deposit in cents', () => {
    expect(teamDefaultsChanges({ ...form(), deposit: '2,000.50' }, team))
      .toEqual({ ok: true, updates: { default_deposit_cents: 200050 } });
    expect(teamDefaultsChanges({ ...form(), deposit: '' }, team))
      .toEqual({ ok: true, updates: { default_deposit_cents: null } });
  });

  it('saves the gas fee fields that changed', () => {
    expect(teamDefaultsChanges({ ...form(), gasEnabled: false, gasAmount: '30' }, team))
      .toEqual({ ok: true, updates: { gas_fee_enabled: false, gas_fee_amount: 30 } });
  });

  it('refuses bad amounts', () => {
    expect(teamDefaultsChanges({ ...form(), minRate: '-1' }, team).ok).toBe(false);
    expect(teamDefaultsChanges({ ...form(), deposit: 'abc' }, team).ok).toBe(false);
    expect(teamDefaultsChanges({ ...form(), gasAmount: '' }, team).ok).toBe(false);
    expect(teamDefaultsChanges({ ...form(), gasAmount: '1.234' }, team).ok).toBe(false);
  });
});
