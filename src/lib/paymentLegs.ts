// Marketplace bookings are paid in two charges: the operator's rental (a destination charge to the operator's
// Stripe account) and a separate Exotiq charge (platform fee, state rental fee, processing, protection), which is
// Exotiq's money. rent-payment-webhook and rent-extend-booking record the Exotiq charge on the booking as a
// payment row of type "fee" / "extension_fees" so the booking shows what the renter paid, but it is not the
// operator's revenue and must not count towards what the operator was paid.
export const EXOTIQ_FEE_PAYMENT_TYPES: ReadonlySet<string> = new Set(['fee', 'extension_fees']);

type HasPaymentType = { payment_type?: string | null };

export const isExotiqFeePayment = (p: HasPaymentType | null | undefined): boolean =>
  EXOTIQ_FEE_PAYMENT_TYPES.has(String(p?.payment_type ?? ''));

/** The operator's own payments: everything except the Exotiq charge of marketplace bookings. */
export const operatorPayments = <T extends HasPaymentType>(payments: readonly T[] | null | undefined): T[] =>
  (payments ?? []).filter((p) => !isExotiqFeePayment(p));

/** The Exotiq charge rows only (paid by the renter to Exotiq). */
export const exotiqFeePayments = <T extends HasPaymentType>(payments: readonly T[] | null | undefined): T[] =>
  (payments ?? []).filter((p) => isExotiqFeePayment(p));
