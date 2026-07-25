/**
 * Cluster A helper: canonical "did the renter's card actually get charged?"
 * check for marketplace bookings. Mirrors the SQL helper
 * public.booking_has_captured_leg(bookings).
 *
 * ANY of these three means real money moved and refund paths must be used
 * instead of a plain status flip:
 *   - operator_payment_intent_id (Checkout destination charge captured)
 *   - exotiq_payment_intent_id   (Exotiq fee/protection leg captured)
 *   - paid_at                    (both legs cleared → status='confirmed')
 *
 * Do not add new criteria without also updating the SQL helper — the two
 * must stay in lockstep or expiry sweep / cancel / refund will disagree.
 */
export interface BookingPaymentFields {
  operator_payment_intent_id?: string | null;
  exotiq_payment_intent_id?: string | null;
  paid_at?: string | null;
}

export function isPaidOrCaptured(
  booking: BookingPaymentFields | null | undefined,
): boolean {
  if (!booking) return false;
  return Boolean(
    booking.operator_payment_intent_id ||
      booking.exotiq_payment_intent_id ||
      booking.paid_at,
  );
}
