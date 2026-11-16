import { calculateRentalDays } from '@/lib/pricingUtils';

/**
 * Mileage allowance and overage for one booking.
 *
 * Included miles = miles per day × days, where days is the larger of the booked
 * days and the days the car was actually kept (a late return earns its extra
 * days; an early return keeps the days that were paid for).
 */
export interface MileageInput {
  perDayAllowance: number | null | undefined;
  ratePerMile: number | null | undefined;
  pickupOdometer: number | null | undefined;
  returnOdometer: number | null | undefined;
  startDate: string | Date;
  endDate: string | Date;
  /** When the car actually came back; omit before check-in. */
  returnedAt?: string | Date | null;
}

export interface MileageResult {
  /** no_rule: the booking has no allowance or no rate, so nothing is charged. */
  status: 'ok' | 'no_rule' | 'no_readings';
  perDay: number;
  rate: number;
  bookedDays: number;
  daysKept: number | null;
  days: number;
  included: number;
  milesDriven: number;
  overMiles: number;
  charge: number;
}

const positive = (n: number | null | undefined): n is number =>
  n != null && Number.isFinite(Number(n)) && Number(n) > 0;

export function computeMileageOverage(input: MileageInput): MileageResult {
  const bookedDays = calculateRentalDays(input.startDate, input.endDate);
  const daysKept = input.returnedAt ? calculateRentalDays(input.startDate, input.returnedAt) : null;
  const days = Math.max(bookedDays, daysKept ?? 0);

  const hasRule =
    input.perDayAllowance != null &&
    Number.isFinite(Number(input.perDayAllowance)) &&
    Number(input.perDayAllowance) >= 0 &&
    input.ratePerMile != null &&
    Number.isFinite(Number(input.ratePerMile)) &&
    Number(input.ratePerMile) >= 0;

  const perDay = hasRule ? Number(input.perDayAllowance) : 0;
  const rate = hasRule ? Number(input.ratePerMile) : 0;
  const included = perDay * days;

  const hasReadings = positive(input.pickupOdometer) && positive(input.returnOdometer);
  const milesDriven = hasReadings
    ? Math.max(0, Number(input.returnOdometer) - Number(input.pickupOdometer))
    : 0;

  const status: MileageResult['status'] = !hasRule ? 'no_rule' : !hasReadings ? 'no_readings' : 'ok';
  const overMiles = status === 'ok' ? Math.max(0, milesDriven - included) : 0;
  const charge = Math.round(overMiles * rate * 100) / 100;

  return { status, perDay, rate, bookedDays, daysKept, days, included, milesDriven, overMiles, charge };
}

/**
 * Parse a per-mile rate typed by an operator ("2.25", "$6").
 * null = left empty; undefined = not a valid rate (negative, or finer than a cent).
 */
export function parseMileageRate(raw: string): number | null | undefined {
  const s = raw.trim().replace(/^\$/, '');
  if (s === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  return Number(s);
}
