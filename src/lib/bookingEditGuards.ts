/**
 * Marketplace-booking edit guard.
 *
 * Once a marketplace booking is in the payment window or fully paid, the
 * price the renter accepted (and possibly already paid) is frozen. Any
 * operator "Update" that reprices, moves dates, or shifts pickup would
 * silently charge a different amount than the renter agreed to — see the
 * pre-launch handoff findings #10 and #14.
 *
 * Callers: EnhancedBookingDialog, EditBookingDialog, and any underlying
 * update mutation. Defense-in-depth: UI hides the field AND the mutation
 * refuses if the field slipped through anyway.
 */
export interface BookingLockFields {
  booking_source?: string | null;
  status?: string | null;
}

// Live CHECK on bookings.status allows: pending, confirmed, active, completed,
// cancelled, requested, pending_documents, pending_payment, declined, refunded,
// payment_expired. Once the renter has committed money (pending_payment) or
// beyond, the price/dates the renter accepted are frozen. `pending_documents`
// is where confirmIfFullyPaid parks a paid booking that's still awaiting ID —
// it MUST be locked or Edit reprices from vehicle.current_rate.
const LOCKED_STATUSES = new Set([
  "pending_payment",
  "pending_documents",
  "confirmed",
  "active",
  "completed",
]);

export function isMarketplaceLocked(b: BookingLockFields | null | undefined): boolean {
  if (!b) return false;
  if (b.booking_source !== "marketplace") return false;
  return LOCKED_STATUSES.has(b.status ?? "");
}

/**
 * Fields that must NOT be edited on a locked marketplace booking. Notes,
 * internal-only flags, and inspection metadata remain editable.
 */
export const LOCKED_FIELDS = [
  "start_date",
  "end_date",
  "pickup_time",
  "pickup_location",
  "daily_rate",
  "total_value",
  "platform_fee_cents",
  "protection_total_cents",
  "protection_tier",
] as const;
