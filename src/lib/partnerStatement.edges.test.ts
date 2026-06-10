/**
 * Edge-case hardening for partnerStatement — zero amounts, floating-point,
 * large values, empty inputs, range boundaries, and platform-fee math pinning.
 */
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

// ═══════════════════════════════════════════════════════
// Empty input
// ═══════════════════════════════════════════════════════
describe("buildPartnerStatement — empty input", () => {
  it("returns zeroed totals and empty arrays for []", () => {
    const s = buildPartnerStatement([]);
    expect(s.totals.lifetimePaid).toBe(0);
    expect(s.totals.outstanding).toBe(0);
    expect(s.totals.voided).toBe(0);
    expect(s.totals.grossBase).toBe(0);
    expect(s.totals.platformFees).toBe(0);
    expect(s.totals.count).toBe(0);
    expect(s.paid).toHaveLength(0);
    expect(s.pending).toHaveLength(0);
    expect(s.voided).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════
// Zero amounts
// ═══════════════════════════════════════════════════════
describe("buildPartnerStatement — zero amounts", () => {
  it("rows with zero net_to_partner contribute 0 to totals", () => {
    const rows = [
      mk({ status: "paid", net_to_partner: 0, gross_rental_base: 0, platform_fee_amount: 0 }),
      mk({ status: "pending", net_to_partner: 0, gross_rental_base: 0, platform_fee_amount: 0 }),
    ];
    const s = buildPartnerStatement(rows);
    expect(s.totals.lifetimePaid).toBe(0);
    expect(s.totals.outstanding).toBe(0);
    expect(s.totals.grossBase).toBe(0);
    expect(s.totals.platformFees).toBe(0);
    expect(s.totals.count).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════
// Platform-fee math exhaustive pinning
// ═══════════════════════════════════════════════════════
describe("buildPartnerStatement — platform-fee math", () => {
  it("grossBase includes paid + pending, excludes voided", () => {
    const rows = [
      mk({ status: "paid", gross_rental_base: 1000, platform_fee_amount: 100 }),
      mk({ status: "pending", gross_rental_base: 500, platform_fee_amount: 50 }),
      mk({ status: "scheduled", gross_rental_base: 200, platform_fee_amount: 20 }),
      mk({ status: "voided", gross_rental_base: 9999, platform_fee_amount: 999 }),
    ];
    const s = buildPartnerStatement(rows);
    // grossBase = paid + pending + scheduled (outstanding includes scheduled)
    expect(s.totals.grossBase).toBe(1700); // 1000 + 500 + 200
    expect(s.totals.platformFees).toBe(170); // 100 + 50 + 20
  });

  it("platform fee % consistency: 10% fee on each row sums correctly", () => {
    const rows = [
      mk({ status: "paid", gross_rental_base: 200, platform_fee_amount: 20, net_to_partner: 180 }),
      mk({ status: "paid", gross_rental_base: 300, platform_fee_amount: 30, net_to_partner: 270 }),
    ];
    const s = buildPartnerStatement(rows);
    expect(s.totals.grossBase).toBe(500);
    expect(s.totals.platformFees).toBe(50);
    expect(s.totals.lifetimePaid).toBe(450); // 180 + 270
    // fee% should be consistent: 50/500 = 10%
    expect(s.totals.platformFees / s.totals.grossBase).toBeCloseTo(0.1, 10);
  });

  it("zero platform fee row does not distort totals", () => {
    const rows = [
      mk({ status: "paid", gross_rental_base: 500, platform_fee_amount: 0, net_to_partner: 500 }),
    ];
    const s = buildPartnerStatement(rows);
    expect(s.totals.platformFees).toBe(0);
    expect(s.totals.grossBase).toBe(500);
  });

  it("100% platform fee: all gross becomes fee, net=0", () => {
    const rows = [
      mk({ status: "paid", gross_rental_base: 400, platform_fee_amount: 400, net_to_partner: 0 }),
    ];
    const s = buildPartnerStatement(rows);
    expect(s.totals.grossBase).toBe(400);
    expect(s.totals.platformFees).toBe(400);
    expect(s.totals.lifetimePaid).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// Floating-point rounding
// ═══════════════════════════════════════════════════════
describe("buildPartnerStatement — floating-point", () => {
  it("0.1 + 0.2 amounts accumulate correctly", () => {
    const rows = [
      mk({ status: "paid", net_to_partner: 0.1, gross_rental_base: 0.1, platform_fee_amount: 0.01 }),
      mk({ status: "paid", net_to_partner: 0.2, gross_rental_base: 0.2, platform_fee_amount: 0.02 }),
    ];
    const s = buildPartnerStatement(rows);
    expect(s.totals.lifetimePaid).toBeCloseTo(0.3, 10);
    expect(s.totals.grossBase).toBeCloseTo(0.3, 10);
  });

  it("fractional fee amounts sum without catastrophic precision loss", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      mk({ status: "paid", net_to_partner: 33.33, gross_rental_base: 37.04, platform_fee_amount: 3.70 })
    );
    const s = buildPartnerStatement(rows);
    expect(s.totals.lifetimePaid).toBeCloseTo(333.3, 5);
    expect(s.totals.grossBase).toBeCloseTo(370.4, 5);
    expect(s.totals.platformFees).toBeCloseTo(37.0, 5);
  });
});

// ═══════════════════════════════════════════════════════
// Very large values
// ═══════════════════════════════════════════════════════
describe("buildPartnerStatement — very large values", () => {
  it("$1M net_to_partner paid row", () => {
    const rows = [mk({ status: "paid", net_to_partner: 1_000_000 })];
    const s = buildPartnerStatement(rows);
    expect(s.totals.lifetimePaid).toBe(1_000_000);
  });

  it("large voided amount stays in voided total only", () => {
    const rows = [
      mk({ status: "voided", net_to_partner: 999_999, gross_rental_base: 999_999, platform_fee_amount: 99_999 }),
      mk({ status: "paid", net_to_partner: 100, gross_rental_base: 111, platform_fee_amount: 11 }),
    ];
    const s = buildPartnerStatement(rows);
    expect(s.totals.voided).toBe(999_999);
    expect(s.totals.lifetimePaid).toBe(100);
    expect(s.totals.grossBase).toBe(111); // voided excluded
    expect(s.totals.platformFees).toBe(11);
  });
});

// ═══════════════════════════════════════════════════════
// Date range filtering — boundary precision
// ═══════════════════════════════════════════════════════
describe("buildPartnerStatement — date range boundaries", () => {
  const rows = [
    mk({ created_at: "2026-05-01T00:00:00.000Z", status: "paid", net_to_partner: 100 }),
    mk({ created_at: "2026-05-15T12:00:00.000Z", status: "paid", net_to_partner: 200 }),
    mk({ created_at: "2026-05-31T23:59:59.999Z", status: "paid", net_to_partner: 300 }),
    mk({ created_at: "2026-06-01T00:00:00.000Z", status: "paid", net_to_partner: 999 }),
  ];

  it("start boundary is inclusive", () => {
    const s = buildPartnerStatement(rows, { start: "2026-05-01T00:00:00.000Z" });
    expect(s.totals.count).toBe(4);
  });

  it("end boundary is inclusive", () => {
    const s = buildPartnerStatement(rows, { end: "2026-05-31T23:59:59.999Z" });
    expect(s.totals.count).toBe(3);
  });

  it("range excludes rows outside both start and end", () => {
    const s = buildPartnerStatement(rows, {
      start: "2026-05-10T00:00:00.000Z",
      end: "2026-05-20T00:00:00.000Z",
    });
    expect(s.totals.count).toBe(1);
    expect(s.totals.lifetimePaid).toBe(200);
  });

  it("empty range returns zeroed statement", () => {
    const s = buildPartnerStatement(rows, {
      start: "2027-01-01T00:00:00.000Z",
      end: "2027-12-31T00:00:00.000Z",
    });
    expect(s.totals.count).toBe(0);
    expect(s.totals.lifetimePaid).toBe(0);
  });

  it("no range filter includes all rows", () => {
    const s = buildPartnerStatement(rows);
    expect(s.totals.count).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════
// Status grouping completeness
// ═══════════════════════════════════════════════════════
describe("buildPartnerStatement — status grouping", () => {
  it("scheduled rows are outstanding (pending array)", () => {
    const rows = [
      mk({ status: "scheduled", net_to_partner: 75 }),
    ];
    const s = buildPartnerStatement(rows);
    expect(s.pending).toHaveLength(1);
    expect(s.totals.outstanding).toBe(75);
  });

  it("cancelled rows are voided (isVoided covers cancelled)", () => {
    const rows = [
      mk({ status: "cancelled", net_to_partner: 50 }),
    ];
    const s = buildPartnerStatement(rows);
    expect(s.voided).toHaveLength(1);
    expect(s.totals.voided).toBe(50);
  });

  it("unknown status rows appear in count but not in paid/pending/voided groups", () => {
    const rows = [
      mk({ status: "unknown_future_status", net_to_partner: 123 }),
    ];
    const s = buildPartnerStatement(rows);
    expect(s.totals.count).toBe(1);
    expect(s.paid).toHaveLength(0);
    expect(s.pending).toHaveLength(0);
    expect(s.voided).toHaveLength(0);
    // Not included in any totals
    expect(s.totals.lifetimePaid).toBe(0);
    expect(s.totals.outstanding).toBe(0);
  });
});
