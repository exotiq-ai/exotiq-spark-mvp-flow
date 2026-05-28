import { describe, it, expect } from "vitest";
import { buildPartnerStatement, type StatementPayout } from "./partnerStatement";

const mk = (over: Partial<StatementPayout>): StatementPayout => ({
  id: Math.random().toString(),
  status: "pending",
  net_to_partner: 0,
  gross_rental_base: 0,
  platform_fee_amount: 0,
  net_after_fee: 0,
  paid_at: null,
  created_at: "2026-05-15T00:00:00.000Z",
  ...over,
});

describe("buildPartnerStatement", () => {
  const rows: StatementPayout[] = [
    mk({ status: "paid", net_to_partner: 100, gross_rental_base: 200, platform_fee_amount: 20 }),
    mk({ status: "pending", net_to_partner: 50, gross_rental_base: 90, platform_fee_amount: 9 }),
    mk({ status: "scheduled", net_to_partner: 30, gross_rental_base: 60, platform_fee_amount: 6 }),
    mk({ status: "voided", net_to_partner: 999, gross_rental_base: 999, platform_fee_amount: 99 }),
  ];

  it("groups by status", () => {
    const s = buildPartnerStatement(rows);
    expect(s.paid).toHaveLength(1);
    expect(s.pending).toHaveLength(2);
    expect(s.voided).toHaveLength(1);
  });

  it("computes lifetime/outstanding/voided totals", () => {
    const s = buildPartnerStatement(rows);
    expect(s.totals.lifetimePaid).toBe(100);
    expect(s.totals.outstanding).toBe(80);
    expect(s.totals.voided).toBe(999);
    expect(s.totals.count).toBe(4);
  });

  it("excludes voided from gross/fees rollup", () => {
    const s = buildPartnerStatement(rows);
    expect(s.totals.grossBase).toBe(350);
    expect(s.totals.platformFees).toBe(35);
  });

  it("ignores out-of-range rows", () => {
    const s = buildPartnerStatement(rows, { start: "2026-05-01T00:00:00.000Z", end: "2026-05-20T00:00:00.000Z" });
    expect(s.totals.count).toBe(4);
    const empty = buildPartnerStatement(rows, { start: "2027-01-01T00:00:00.000Z" });
    expect(empty.totals.count).toBe(0);
    expect(empty.totals.lifetimePaid).toBe(0);
  });
});
