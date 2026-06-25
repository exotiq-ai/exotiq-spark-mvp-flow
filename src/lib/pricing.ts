// Pure pricing math — single source of truth for booking totals.
//
// Used by both the client booking dialogs and the `create-payment` edge
// function. The server is authoritative; the client is for live UI.
//
// Math is mathematically identical to today's behaviour when
// `tax_rate_percent = 0` and `tax_inclusive = false`: subtotal == base,
// tax_amount == 0, total == base. This is the US default and guarantees
// no behavioural change for existing customers.

export interface BookingPricingInput {
  daily_rate: number;
  days: number;
  delivery_fee?: number;
  gas_fee?: number;
  gas_fee_waived?: boolean;
  adjustments?: number;       // signed; positive adds, negative subtracts
  discount_amount?: number;   // positive number to subtract
}

export interface TaxConfig {
  tax_rate_percent: number;   // 0..100
  tax_inclusive: boolean;
}

export interface BookingTotals {
  base: number;        // pre-tax line-item sum (or tax-inclusive gross when inclusive)
  subtotal: number;    // pre-tax amount
  tax_amount: number;
  total: number;       // what the customer actually pays
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeBookingTotals(
  input: BookingPricingInput,
  tax: TaxConfig,
): BookingTotals {
  const daily = Math.max(0, input.daily_rate || 0);
  const days = Math.max(0, input.days || 0);
  const delivery = Math.max(0, input.delivery_fee || 0);
  const gas = input.gas_fee_waived ? 0 : Math.max(0, input.gas_fee || 0);
  const adj = input.adjustments || 0;
  const discount = Math.max(0, input.discount_amount || 0);

  const base = Math.max(0, daily * days + delivery + gas + adj - discount);
  const rate = Math.max(0, Math.min(100, tax.tax_rate_percent || 0));

  if (rate === 0) {
    return { base, subtotal: round2(base), tax_amount: 0, total: round2(base) };
  }

  if (tax.tax_inclusive) {
    const subtotal = base / (1 + rate / 100);
    const tax_amount = base - subtotal;
    return {
      base: round2(base),
      subtotal: round2(subtotal),
      tax_amount: round2(tax_amount),
      total: round2(base),
    };
  }

  const tax_amount = base * (rate / 100);
  return {
    base: round2(base),
    subtotal: round2(base),
    tax_amount: round2(tax_amount),
    total: round2(base + tax_amount),
  };
}
