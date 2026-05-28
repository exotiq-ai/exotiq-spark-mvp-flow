// Per-partner statement aggregation — pure, testable logic shared by the
// statement drawer and the CSV/print exporters.
import { isOutstanding, isVoided } from "./payoutTransitions";

export interface StatementPayout {
  id: string;
  status: string;
  net_to_partner: number;
  gross_rental_base: number;
  platform_fee_amount: number;
  net_after_fee: number;
  paid_at: string | null;
  created_at: string;
}

export interface StatementTotals {
  lifetimePaid: number;
  outstanding: number;
  voided: number;
  grossBase: number;
  platformFees: number;
  count: number;
}

export interface PartnerStatement {
  totals: StatementTotals;
  paid: StatementPayout[];
  pending: StatementPayout[];
  voided: StatementPayout[];
}

const isPaid = (status: string) => status === "paid";

// Optional ISO date range filter (inclusive) applied on created_at.
export function buildPartnerStatement(
  payouts: StatementPayout[],
  range?: { start?: string; end?: string }
): PartnerStatement {
  const inRange = (p: StatementPayout) => {
    if (!range) return true;
    const t = new Date(p.created_at).getTime();
    if (range.start && t < new Date(range.start).getTime()) return false;
    if (range.end && t > new Date(range.end).getTime()) return false;
    return true;
  };

  const rows = payouts.filter(inRange);

  const paid = rows.filter((p) => isPaid(p.status));
  const pending = rows.filter((p) => isOutstanding(p.status));
  const voided = rows.filter((p) => isVoided(p.status));

  const sum = (arr: StatementPayout[], key: keyof StatementPayout) =>
    arr.reduce((s, p) => s + Number((p[key] as number) || 0), 0);

  return {
    totals: {
      lifetimePaid: sum(paid, "net_to_partner"),
      outstanding: sum(pending, "net_to_partner"),
      voided: sum(voided, "net_to_partner"),
      grossBase: sum([...paid, ...pending], "gross_rental_base"),
      platformFees: sum([...paid, ...pending], "platform_fee_amount"),
      count: rows.length,
    },
    paid,
    pending,
    voided,
  };
}
