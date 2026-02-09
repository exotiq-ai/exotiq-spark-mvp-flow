import { startOfDay, differenceInCalendarDays } from "date-fns";

export interface BookingPricingParams {
  startDate: string | Date;
  endDate: string | Date;
  dailyRate: number;
  discountAmount?: number;
  gasFee?: number;
  gasFeeWaived?: boolean;
  deliveryFee?: number;
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
 * Formula: (dailyRate × rentalDays) - discount + gasFee + deliveryFee
 */
export function calculateBookingTotal(params: BookingPricingParams): BookingPricing {
  const rentalDays = calculateRentalDays(params.startDate, params.endDate);
  const rentalSubtotal = params.dailyRate * rentalDays;
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

/** Default gas/re-fueling fee */
export const DEFAULT_GAS_FEE = 20.00;

/** Standard mileage overage rate tiers */
export const MILEAGE_RATE_TIERS = [
  { value: "1.99", label: "$1.99/mi" },
  { value: "2.99", label: "$2.99/mi" },
  { value: "3.49", label: "$3.49/mi" },
  { value: "3.99", label: "$3.99/mi" },
  { value: "4.49", label: "$4.49/mi" },
  { value: "4.99", label: "$4.99/mi" },
];
