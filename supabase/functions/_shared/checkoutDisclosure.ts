// The hosted Stripe Checkout of a marketplace booking charges only the operator's rental. The Exotiq part
// (platform fee, state rental fee, processing, protection) is charged right after, off-session, by
// rent-payment-webhook, and appears on the card statement as EXOTIQ RENT. The storefront says so before the
// renter reaches Stripe; this note says it on the Stripe page itself, next to the pay button.

export type ExotiqLegSnapshot = {
  platform_fee_cents?: number | string | null;
  protection_total_cents?: number | string | null;
  state_fee_cents?: number | string | null;
  processing_fee_cents?: number | string | null;
};

/** The Exotiq charge, summed the same way rent-payment-webhook sums it. */
export function exotiqLegCents(b: ExotiqLegSnapshot): number {
  return Math.round(
    Number(b.platform_fee_cents ?? 0) +
      Number(b.protection_total_cents ?? 0) +
      Number(b.state_fee_cents ?? 0) +
      Number(b.processing_fee_cents ?? 0),
  );
}

/** Text for Checkout's custom_text.submit.message, or null when there is no Exotiq charge. Stripe allows 1200 characters. */
export function separateChargeNotice(b: ExotiqLegSnapshot, currency: string): string | null {
  const cents = exotiqLegCents(b);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  let amount: string;
  try {
    amount = new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    amount = `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
  const protection = Number(b.protection_total_cents ?? 0) > 0 ? " and protection" : "";
  return `This payment is the rental only. Your card will also be charged ${amount} by EXOTIQ RENT for trip fees${protection}, as a separate charge on your statement.`;
}
