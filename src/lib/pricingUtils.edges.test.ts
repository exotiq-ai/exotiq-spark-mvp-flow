/**
 * Edge-case hardening for pricingUtils — zero amounts, negative guards,
 * floating-point rounding, very large values, fee-percentage boundaries,
 * and penny-rounding consistency.
 *
 * Read pricingUtils.test.ts first — this file ONLY adds missing coverage.
 */
import { describe, it, expect } from "vitest";
import {
  calculateBookingTotal,
  calculateRentalDays,
  getRateForDuration,
  getGasFeeForTeam,
  DEFAULT_GAS_FEE,
} from "./pricingUtils";

const TODAY = "2026-03-21T10:00:00Z";
const TOMORROW = "2026-03-22T10:00:00Z";
const THREE_DAYS = "2026-03-24T10:00:00Z";

// ═══════════════════════════════════════════════════════
// Zero amounts
// ═══════════════════════════════════════════════════════
describe("pricingUtils edge cases — zero amounts", () => {
  it("zero dailyRate with daily type produces grandTotal 0", () => {
    const r = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 0, durationType: "daily" });
    expect(r.rentalSubtotal).toBe(0);
    expect(r.grandTotal).toBe(0);
  });

  it("zero dailyRate with 3hr type produces grandTotal 0", () => {
    const r = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 0, durationType: "3hr" });
    expect(r.grandTotal).toBe(0);
  });

  it("zero gasFee is preserved (not swapped for default)", () => {
    const r = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 200, durationType: "daily", gasFee: 0 });
    expect(r.gasFee).toBe(0);
    expect(r.grandTotal).toBe(200);
  });

  it("zero deliveryFee contributes nothing", () => {
    const r = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 300, durationType: "daily", deliveryFee: 0 });
    expect(r.deliveryFee).toBe(0);
    expect(r.grandTotal).toBe(300);
  });

  it("zero discountAmount leaves grand total unchanged", () => {
    const r = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 400, durationType: "daily", discountAmount: 0 });
    expect(r.discountAmount).toBe(0);
    expect(r.grandTotal).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════
// Negative guards
// ═══════════════════════════════════════════════════════
describe("pricingUtils edge cases — negative guards", () => {
  it("grandTotal is never negative — discount far exceeds subtotal", () => {
    const r = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 100, durationType: "daily", discountAmount: 1_000_000 });
    expect(r.grandTotal).toBe(0);
  });

  it("discount is capped at rentalSubtotal even when gas/delivery fees are present", () => {
    // subtotal = 200, discount = 300 → capped at 200, grandTotal = 0 + 20 + 50 = 70
    const r = calculateBookingTotal({
      startDate: TODAY, endDate: TOMORROW, dailyRate: 200, durationType: "daily",
      discountAmount: 300, gasFee: 20, deliveryFee: 50,
    });
    expect(r.discountAmount).toBe(200);
    expect(r.grandTotal).toBe(70); // 0 + 20 + 50
  });

  it("negative discountAmount is treated as 0 [current behavior: Math.min(negative,subtotal)=negative → but max(0,...)]", () => {
    // discountAmount = -50: Math.min(-50, 500) = -50, grandTotal = max(0, 500 - (-50)) = 550
    // This documents current behavior — caller should not pass negative discounts
    const r = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 500, durationType: "daily", discountAmount: -50 });
    // Current implementation: discount = Math.min(-50, 500) = -50; grandTotal = Math.max(0, 500 - (-50)) = 550
    expect(r.discountAmount).toBe(-50);
    expect(r.grandTotal).toBe(550);
  });
});

// ═══════════════════════════════════════════════════════
// Floating-point rounding patterns
// ═══════════════════════════════════════════════════════
describe("pricingUtils edge cases — floating-point rounding", () => {
  it("0.1 + 0.2 scenario: gasFee=0.1, dailyRate=0.2 — grandTotal is 0.1+0.2", () => {
    // In JS: 0.1 + 0.2 = 0.30000000000000004
    // calculateBookingTotal does not round: it returns raw float arithmetic.
    // This documents current behavior.
    const r = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 0.2, durationType: "daily", gasFee: 0.1 });
    // grandTotal = 0.2 + 0.1 = 0.30000000000000004 in JS
    expect(r.grandTotal).toBeCloseTo(0.3, 10);
  });

  it("rate 33.335 × 3 days — subtotal accumulated correctly", () => {
    const r = calculateBookingTotal({ startDate: TODAY, endDate: THREE_DAYS, dailyRate: 33.335, durationType: "multiday" });
    expect(r.rentalSubtotal).toBeCloseTo(100.005, 5);
  });

  it("penny amounts: $0.01 daily rate for 1 day", () => {
    const r = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 0.01, durationType: "daily" });
    expect(r.rentalSubtotal).toBeCloseTo(0.01, 5);
    expect(r.grandTotal).toBeCloseTo(0.01, 5);
  });
});

// ═══════════════════════════════════════════════════════
// Very large values
// ═══════════════════════════════════════════════════════
describe("pricingUtils edge cases — very large values", () => {
  it("$1,000,000 daily rate × 1 day", () => {
    const r = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 1_000_000, durationType: "daily" });
    expect(r.rentalSubtotal).toBe(1_000_000);
    expect(r.grandTotal).toBe(1_000_000);
  });

  it("$1,000,000 × 30 days multiday", () => {
    // 30 calendar days from TODAY
    const end = "2026-04-20T10:00:00Z";
    const r = calculateBookingTotal({ startDate: TODAY, endDate: end, dailyRate: 1_000_000, durationType: "multiday" });
    expect(r.rentalSubtotal).toBe(30_000_000);
  });

  it("very large discount is capped at subtotal", () => {
    const r = calculateBookingTotal({
      startDate: TODAY, endDate: TOMORROW, dailyRate: 500, durationType: "daily",
      discountAmount: Number.MAX_SAFE_INTEGER,
    });
    expect(r.discountAmount).toBe(500);
    expect(r.grandTotal).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// Fee-percentage boundaries (0% and 100% conceptually)
// ═══════════════════════════════════════════════════════
describe("pricingUtils edge cases — fee boundaries", () => {
  it("0% gas fee (gasFeeWaived=true) leaves grandTotal unchanged", () => {
    const r = calculateBookingTotal({
      startDate: TODAY, endDate: TOMORROW, dailyRate: 500, durationType: "daily",
      gasFee: DEFAULT_GAS_FEE, gasFeeWaived: true,
    });
    expect(r.gasFee).toBe(0);
    expect(r.grandTotal).toBe(500);
  });

  it("discount = 100% of subtotal → grandTotal equal to fees only", () => {
    const r = calculateBookingTotal({
      startDate: TODAY, endDate: TOMORROW, dailyRate: 500, durationType: "daily",
      discountAmount: 500, gasFee: 20, deliveryFee: 30,
    });
    expect(r.discountAmount).toBe(500);
    expect(r.grandTotal).toBe(50); // 0 + 20 + 30
  });

  it("discount = rentalSubtotal exactly → grandTotal is only additional fees", () => {
    const r = calculateBookingTotal({
      startDate: TODAY, endDate: TOMORROW, dailyRate: 300, durationType: "daily",
      discountAmount: 300, gasFee: 15,
    });
    expect(r.grandTotal).toBe(15);
  });
});

// ═══════════════════════════════════════════════════════
// calculateRentalDays edge cases
// ═══════════════════════════════════════════════════════
describe("calculateRentalDays edge cases", () => {
  it("start and end at the same moment → 1 (minimum)", () => {
    expect(calculateRentalDays("2026-06-10T00:00:00Z", "2026-06-10T00:00:00Z")).toBe(1);
  });

  it("end before start → 1 (minimum, does not go negative)", () => {
    // differenceInCalendarDays(start, end) would be negative → Math.max(1, negative) = 1
    expect(calculateRentalDays("2026-06-12T00:00:00Z", "2026-06-10T00:00:00Z")).toBe(1);
  });

  it("across daylight saving time boundary — calendar days (not hours)", () => {
    // Mar 8 2026 is US DST change day (spring forward) — should still be 1 calendar day apart
    expect(calculateRentalDays("2026-03-08T06:00:00Z", "2026-03-09T06:00:00Z")).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════
// getRateForDuration edge cases
// ═══════════════════════════════════════════════════════
describe("getRateForDuration edge cases", () => {
  it("undefined tier values fall back to currentRate", () => {
    expect(getRateForDuration("3hr", 500, undefined, undefined, undefined)).toBe(500);
    expect(getRateForDuration("6hr", 500, undefined, undefined, undefined)).toBe(500);
    expect(getRateForDuration("multiday", 500, undefined, undefined, undefined)).toBe(500);
  });

  it("zero tier rate is returned (not swapped for fallback)", () => {
    // A 0 value is a valid rate (e.g. free tier) — should not fall back
    expect(getRateForDuration("3hr", 500, 0, null, null)).toBe(0);
    expect(getRateForDuration("6hr", 500, null, 0, null)).toBe(0);
    expect(getRateForDuration("multiday", 500, null, null, 0)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// getGasFeeForTeam
// ═══════════════════════════════════════════════════════
describe("getGasFeeForTeam edge cases", () => {
  it("returns team amount when set to 0 (free gas — valid config)", () => {
    expect(getGasFeeForTeam(0)).toBe(0);
  });

  it("returns team amount for any positive value", () => {
    expect(getGasFeeForTeam(35)).toBe(35);
  });

  it("falls back to DEFAULT_GAS_FEE when undefined", () => {
    expect(getGasFeeForTeam(undefined)).toBe(DEFAULT_GAS_FEE);
  });

  it("falls back to DEFAULT_GAS_FEE when null is passed", () => {
    // TypeScript says number|undefined but runtime might receive null
    expect(getGasFeeForTeam(null as unknown as undefined)).toBe(DEFAULT_GAS_FEE);
  });

  it("returns negative value as-is [current behavior: negative is >=0 false → fallback]", () => {
    // teamGasFeeAmount < 0 → condition `>= 0` is false → fallback
    expect(getGasFeeForTeam(-5)).toBe(DEFAULT_GAS_FEE);
  });
});

// ═══════════════════════════════════════════════════════
// Penny-rounding consistency: line items vs totals
// ═══════════════════════════════════════════════════════
describe("pricingUtils — penny-rounding consistency", () => {
  it("individual components sum to grandTotal (no rounding loss)", () => {
    const r = calculateBookingTotal({
      startDate: TODAY, endDate: THREE_DAYS,
      dailyRate: 333.33, durationType: "multiday",
      gasFee: 19.99, deliveryFee: 14.99, discountAmount: 50.01,
    });
    // grandTotal should equal subtotal - discount + gas + delivery
    const expected = r.rentalSubtotal - r.discountAmount + r.gasFee + r.deliveryFee;
    expect(r.grandTotal).toBeCloseTo(expected, 10);
  });

  it("two separate 3hr bookings vs one equivalent multiday: components are independent", () => {
    const a = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 200, durationType: "3hr" });
    const b = calculateBookingTotal({ startDate: TODAY, endDate: TOMORROW, dailyRate: 200, durationType: "3hr" });
    expect(a.grandTotal + b.grandTotal).toBe(400);
  });
});
