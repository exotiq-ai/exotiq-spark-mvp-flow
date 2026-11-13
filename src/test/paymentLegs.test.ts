import { describe, expect, it } from 'vitest';
import { exotiqFeePayments, isExotiqFeePayment, operatorPayments } from '@/lib/paymentLegs';
import { exotiqLegCents, separateChargeNotice } from '../../supabase/functions/_shared/checkoutDisclosure.ts';

// Found in production (2026-11-13, booking BK-03637): a $2.00 rental showed "Paid $8.61, Balance -$6.61" because
// the Exotiq charge ($6.61) was counted as money the operator received; and the Stripe page showed only $2.00.
const rows = [
  { id: 'r', payment_type: 'rental', amount: 2, payment_status: 'completed' },
  { id: 'f', payment_type: 'fee', amount: 6.61, payment_status: 'completed' },
  { id: 'x', payment_type: 'extension_fees', amount: 3, payment_status: 'completed' },
  { id: 'e', payment_type: 'extension_rental', amount: 2, payment_status: 'completed' },
  { id: 'n', payment_type: null, amount: 5, payment_status: 'completed' },
];

describe('marketplace payment legs', () => {
  it('keeps the Exotiq charge out of the operator payments', () => {
    expect(operatorPayments(rows).map((r) => r.id)).toEqual(['r', 'e', 'n']);
    expect(exotiqFeePayments(rows).map((r) => r.id)).toEqual(['f', 'x']);
    expect(isExotiqFeePayment({ payment_type: 'deposit' })).toBe(false);
    expect(operatorPayments(null)).toEqual([]);
  });
  it('gives BK-03637 a zero balance', () => {
    const paid = operatorPayments(rows.slice(0, 2)).reduce((s, p) => s + p.amount, 0);
    expect(2 - paid).toBe(0);
  });
});

describe('Stripe Checkout separate-charge notice', () => {
  const bk03637 = { platform_fee_cents: 20, protection_total_cents: 0, state_fee_cents: 589, processing_fee_cents: 52 };
  it('sums the Exotiq charge like the webhook', () => {
    expect(exotiqLegCents(bk03637)).toBe(661);
  });
  it('names the amount and the statement descriptor', () => {
    const text = separateChargeNotice(bk03637, 'usd')!;
    expect(text).toContain('$6.61');
    expect(text).toContain('EXOTIQ RENT');
    expect(text).not.toContain('protection');
    expect(text.length).toBeLessThanOrEqual(1200);
    expect(separateChargeNotice({ ...bk03637, protection_total_cents: 4500 }, 'usd')).toContain('$51.61 by EXOTIQ RENT for trip fees and protection');
  });
  it('says nothing when there is no Exotiq charge', () => {
    expect(separateChargeNotice({}, 'usd')).toBeNull();
  });
});
