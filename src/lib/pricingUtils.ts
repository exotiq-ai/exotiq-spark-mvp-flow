import { startOfDay, differenceInCalendarDays } from "date-fns";

/**
 * Duration type for rate tier pricing.
 * - '3hr' / '6hr': flat tier rate, no day multiplication
 * - 'daily': single-day rental using current_rate (24hr rate)
 * - 'multiday': 2+ calendar days, uses rate_multiday per day (falls back to current_rate)
 */
export type RentalDurationType = '3hr' | '6hr' | 'daily' | 'multiday';

export interface BookingPricingParams {
  startDate: string | Date;
  endDate: string | Date;
  /**
   * The applicable rate for this booking.
   * - For 3hr/6hr: pass the flat tier rate (rate_3hr or rate_6hr)
   * - For daily: pass current_rate (the 24hr rate — preserved name for backwards compatibility)
   * - For multiday: pass rate_multiday if set, otherwise current_rate
   */
  dailyRate: number;
  discountAmount?: number;
  gasFee?: number;
  gasFeeWaived?: boolean;
  deliveryFee?: number;
  /** Defaults to 'daily' for backwards compatibility with existing callers */
  durationType?: RentalDurationType;
}

export interface BookingPricing {
  rentalDays: number;
  rentalSubtotal: number;
  discountAmount: number;
  gasFee: number;
  deliveryFee: number;
  grandTotal: number;
}

/**
 * Calculate rental days using calendar-day comparison (ignores time).
 * Minimum 1 day.
 */
export function calculateRentalDays(startDate: string | Date, endDate: string | Date): number {
  const start = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  return Math.max(1, differenceInCalendarDays(end, start));
}

/**
 * Single source of truth for booking total calculation.
 * All dialogs that display or save a booking total must use this function.
 *
 * Formula varies by duration type:
 * - 3hr/6hr: rentalSubtotal = dailyRate (flat tier rate, no multiplication)
 * - daily:   rentalSubtotal = dailyRate × 1
 * - multiday: rentalSubtotal = dailyRate × rentalDays
 *
 * Then: grandTotal = rentalSubtotal - discount + gasFee + deliveryFee
 */
export function calculateBookingTotal(params: BookingPricingParams): BookingPricing {
  const durationType = params.durationType || 'daily';
  const rentalDays = calculateRentalDays(params.startDate, params.endDate);

  let rentalSubtotal: number;
  if (durationType === '3hr' || durationType === '6hr') {
    // Hourly tiers: flat rate, no day multiplication
    rentalSubtotal = params.dailyRate;
  } else {
    // daily or multiday: rate × days
    rentalSubtotal = params.dailyRate * rentalDays;
  }

  const discountAmount = Math.min(params.discountAmount || 0, rentalSubtotal);
  const gasFee = params.gasFeeWaived ? 0 : (params.gasFee ?? 0);
  const deliveryFee = params.deliveryFee || 0;
  const grandTotal = Math.max(0, rentalSubtotal - discountAmount + gasFee + deliveryFee);

  return {
    rentalDays,
    rentalSubtotal,
    discountAmount,
    gasFee,
    deliveryFee,
    grandTotal,
  };
}

/** Default gas/re-fueling fee (fallback when no tenant setting exists) */
export const DEFAULT_GAS_FEE = 20.00;

/**
 * Resolve the gas fee amount for the current tenant.
 * Returns the tenant-configured amount, or falls back to DEFAULT_GAS_FEE.
 */
export function getGasFeeForTeam(teamGasFeeAmount?: number): number {
  return teamGasFeeAmount != null && teamGasFeeAmount >= 0 ? teamGasFeeAmount : DEFAULT_GAS_FEE;
}

/** Standard mileage overage rate tiers */
export const MILEAGE_RATE_TIERS = [
  { value: "1.99", label: "$1.99/mi" },
  { value: "2.99", label: "$2.99/mi" },
  { value: "3.49", label: "$3.49/mi" },
  { value: "3.99", label: "$3.99/mi" },
  { value: "4.49", label: "$4.49/mi" },
  { value: "4.99", label: "$4.99/mi" },
];

/**
 * Get the display label for a rental duration type.
 */
export function getDurationLabel(durationType: RentalDurationType): string {
  switch (durationType) {
    case '3hr': return '3-Hour';
    case '6hr': return '6-Hour';
    case 'daily': return 'Daily';
    case 'multiday': return 'Multi-Day';
    default: return 'Daily';
  }
}

/**
 * Determine the appropriate rate for a given duration type and vehicle rates.
 * Returns the tier rate if available, or falls back to current_rate.
 */
export function getRateForDuration(
  durationType: RentalDurationType,
  currentRate: number,
  rate3hr?: number | null,
  rate6hr?: number | null,
  rateMultiday?: number | null,
): number {
  switch (durationType) {
    case '3hr': return rate3hr ?? currentRate;
    case '6hr': return rate6hr ?? currentRate;
    case 'multiday': return rateMultiday ?? currentRate;
    case 'daily':
    default:
      return currentRate;
  }
}

/**
 * Get available duration types for a vehicle based on which rate tiers are set.
 * 'daily' is always available (uses current_rate).
 * 'multiday' is always available (falls back to current_rate if rate_multiday is null).
 */
export function getAvailableDurations(
  rate3hr?: number | null,
  rate6hr?: number | null,
): RentalDurationType[] {
  const durations: RentalDurationType[] = [];
  if (rate3hr != null) durations.push('3hr');
  if (rate6hr != null) durations.push('6hr');
  durations.push('daily');
  durations.push('multiday');
  return durations;
}
