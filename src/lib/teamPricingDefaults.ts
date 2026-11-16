/**
 * Team pricing defaults shown in Fleet → Pricing: minimum rental rate, default deposit hold and the gas / re-fuelling
 * fee. All live on the team row (teams.min_rate, default_deposit_cents, gas_fee_*), so every staff member and every
 * booking uses the same values.
 */
export interface TeamPricingFields {
  min_rate?: number | null;
  default_deposit_cents?: number | null;
  gas_fee_enabled?: boolean | null;
  gas_fee_amount?: number | null;
  gas_fee_default_on?: boolean | null;
}

/** The old built-in gas fee, used until a team row carries its own (i.e. before migration 20261116010000). */
export const GAS_FEE_FALLBACK = { gasFeeEnabled: true, gasFeeAmount: 20, gasFeeDefaultOn: true } as const;

export function gasFeeFromTeam(team: TeamPricingFields | null | undefined) {
  const amount = Number(team?.gas_fee_amount);
  return {
    gasFeeEnabled: typeof team?.gas_fee_enabled === 'boolean' ? team.gas_fee_enabled : GAS_FEE_FALLBACK.gasFeeEnabled,
    gasFeeAmount: team?.gas_fee_amount != null && Number.isFinite(amount) && amount >= 0 ? amount : GAS_FEE_FALLBACK.gasFeeAmount,
    gasFeeDefaultOn: typeof team?.gas_fee_default_on === 'boolean' ? team.gas_fee_default_on : GAS_FEE_FALLBACK.gasFeeDefaultOn,
  };
}

export interface TeamDefaultsForm {
  minRate: string;
  /** dollars */
  deposit: string;
  gasEnabled: boolean;
  gasAmount: string;
  gasDefaultOn: boolean;
}

export function teamDefaultsFormFrom(team: TeamPricingFields | null | undefined): TeamDefaultsForm {
  const gas = gasFeeFromTeam(team);
  return {
    minRate: team?.min_rate != null ? String(Number(team.min_rate)) : '',
    deposit: team?.default_deposit_cents != null ? String(Number(team.default_deposit_cents) / 100) : '',
    gasEnabled: gas.gasFeeEnabled,
    gasAmount: String(gas.gasFeeAmount),
    gasDefaultOn: gas.gasFeeDefaultOn,
  };
}

/** Money as typed ("2,000.50", "$20"). null = empty, undefined = not valid. */
function money(raw: string): number | null | undefined {
  const s = raw.trim().replace(/^\$/, '').replace(/,/g, '');
  if (s === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  return Number(s);
}

export type TeamDefaultsUpdates = Partial<{
  min_rate: number | null;
  default_deposit_cents: number | null;
  gas_fee_enabled: boolean;
  gas_fee_amount: number;
  gas_fee_default_on: boolean;
}>;

export function teamDefaultsChanges(
  form: TeamDefaultsForm,
  team: TeamPricingFields | null | undefined,
): { ok: true; updates: TeamDefaultsUpdates } | { ok: false; error: string } {
  const minRate = money(form.minRate);
  if (minRate === undefined) return { ok: false, error: 'Minimum rate: enter an amount like 100, or leave it empty' };
  const deposit = money(form.deposit);
  if (deposit === undefined) return { ok: false, error: 'Deposit: enter an amount like 1500, or leave it empty' };
  const gasAmount = money(form.gasAmount);
  if (gasAmount === undefined || gasAmount === null) return { ok: false, error: 'Gas fee: enter an amount like 20 (0 for none)' };

  const saved = teamDefaultsFormFrom(team);
  const gas = gasFeeFromTeam(team);
  const updates: TeamDefaultsUpdates = {};
  if ((minRate ?? null) !== (team?.min_rate != null ? Number(team.min_rate) : null)) updates.min_rate = minRate;
  const depositCents = deposit === null ? null : Math.round(deposit * 100);
  if (depositCents !== (team?.default_deposit_cents ?? null)) updates.default_deposit_cents = depositCents;
  if (form.gasEnabled !== saved.gasEnabled) updates.gas_fee_enabled = form.gasEnabled;
  if (Math.round(gasAmount * 100) !== Math.round(gas.gasFeeAmount * 100)) updates.gas_fee_amount = gasAmount;
  if (form.gasDefaultOn !== saved.gasDefaultOn) updates.gas_fee_default_on = form.gasDefaultOn;
  return { ok: true, updates };
}
