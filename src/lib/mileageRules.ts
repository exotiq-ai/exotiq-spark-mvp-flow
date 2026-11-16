import { parseMileageRate } from '@/lib/mileage';

/** The mileage fields of a vehicle that the Settings fleet table edits. */
export interface MileageVehicle {
  id: string;
  default_mileage_limit?: number | null;
  mileage_overage_rate?: number | null;
  unlimited_mileage?: boolean | null;
}

export interface MileageTeamDefaults {
  default_mileage_limit?: number | null;
  default_mileage_overage_rate?: number | null;
}

/** One editable row, as the operator types it. */
export interface MileageRow {
  id: string;
  miles: string;
  rate: string;
  unlimited: boolean;
}

export type MileageUpdates = Partial<Pick<MileageVehicle, 'default_mileage_limit' | 'mileage_overage_rate' | 'unlimited_mileage'>>;

export function mileageRowFrom(v: MileageVehicle): MileageRow {
  return {
    id: v.id,
    miles: v.default_mileage_limit != null ? String(v.default_mileage_limit) : '',
    rate: v.mileage_overage_rate != null ? Number(v.mileage_overage_rate).toFixed(2) : '',
    unlimited: v.unlimited_mileage === true,
  };
}

const sameRate = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? a == null && b == null : Math.round(Number(a) * 100) === Math.round(Number(b) * 100);

/**
 * What saving this row would change on the vehicle: only the fields that differ.
 * Turning unlimited on keeps the stored allowance and rate, so turning it off again restores them.
 */
export function mileageRowChanges(
  row: MileageRow,
  v: MileageVehicle,
): { ok: true; updates: MileageUpdates } | { ok: false; error: string } {
  const milesText = row.miles.trim();
  let miles: number | null = null;
  if (milesText !== '') {
    if (!/^\d+$/.test(milesText)) return { ok: false, error: 'Miles per day must be a whole number of zero or more' };
    miles = Number(milesText);
  }
  const rate = parseMileageRate(row.rate);
  if (rate === undefined) return { ok: false, error: 'Enter the rate like 2.25' };

  const updates: MileageUpdates = {};
  if (miles !== (v.default_mileage_limit ?? null)) updates.default_mileage_limit = miles;
  if (!sameRate(rate, v.mileage_overage_rate ?? null)) updates.mileage_overage_rate = rate;
  if (row.unlimited !== (v.unlimited_mileage === true)) updates.unlimited_mileage = row.unlimited;
  return { ok: true, updates };
}

/** Which rule a car follows, for the tag in the table. */
export function mileageRuleSource(v: MileageVehicle, team: MileageTeamDefaults): 'unlimited' | 'team' | 'custom' | 'none' {
  if (v.unlimited_mileage === true) return 'unlimited';
  if (v.default_mileage_limit == null && v.mileage_overage_rate == null) return 'none';
  const teamHasDefaults = team.default_mileage_limit != null || team.default_mileage_overage_rate != null;
  if (
    teamHasDefaults &&
    (v.default_mileage_limit ?? null) === (team.default_mileage_limit ?? null) &&
    sameRate(v.mileage_overage_rate ?? null, team.default_mileage_overage_rate ?? null)
  ) {
    return 'team';
  }
  return 'custom';
}
