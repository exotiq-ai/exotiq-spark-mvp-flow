import { describe, it, expect } from "vitest";
import {
  calculateRentalDays,
  calculateBookingTotal,
  getRateForDuration,
  getAvailableDurations,
  getDurationLabel,
  DEFAULT_GAS_FEE,
} from "./pricingUtils";

// ─── Vehicle fixture: exotic car with all tiers set ───
const VEHICLE = {
  current_rate: 500,  // 24hr daily rate
  rate_3hr: 200,
  rate_6hr: 350,
  rate_multiday: 450,
};

const TODAY = "2026-03-21T10:00:00Z";
const TODAY_END_3HR = "2026-03-21T13:00:00Z";
const TODAY_END_6HR = "2026-03-21T16:00:00Z";
const TOMORROW = "2026-03-22T10:00:00Z";
const THREE_DAYS = "2026-03-24T10:00:00Z";

// ═══════════════════════════════════════════════════════
// 1. calculateRentalDays
// ═══════════════════════════════════════════════════════
describe("calculateRentalDays", () => {
  it("returns 1 for same-day (3hr rental)", () => {
    expect(calculateRentalDays(TODAY, TODAY_END_3HR)).toBe(1);
  });

  it("returns 1 for same-day (6hr rental)", () => {
    expect(calculateRentalDays(TODAY, TODAY_END_6HR)).toBe(1);
  });

  it("returns 1 for overnight (next calendar day)", () => {
    expect(calculateRentalDays(TODAY, TOMORROW)).toBe(1);
  });

  it("returns 3 for a 3-day span", () => {
    expect(calculateRentalDays(TODAY, THREE_DAYS)).toBe(3);
  });

  it("never returns 0 — minimum is 1", () => {
    // same instant
    expect(calculateRentalDays(TODAY, TODAY)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════
// 2. calculateBookingTotal — 3-Hour Rentals
// ═══════════════════════════════════════════════════════
describe("calculateBookingTotal — 3hr tier", () => {
  it("uses flat rate, no day multiplication", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: TODAY_END_3HR,
      dailyRate: VEHICLE.rate_3hr,
      durationType: "3hr",
    });
    expect(result.rentalSubtotal).toBe(200);
    expect(result.rentalDays).toBe(1); // same day
    expect(result.grandTotal).toBe(200);
  });

  it("flat rate holds even if dates span multiple days (edge case)", () => {
    // Shouldn't happen in practice, but the logic must not multiply
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: THREE_DAYS,
      dailyRate: VEHICLE.rate_3hr,
      durationType: "3hr",
    });
    expect(result.rentalSubtotal).toBe(200); // flat, NOT 200×3
    expect(result.rentalDays).toBe(3); // days still calculated
  });

  it("applies gas fee on top of flat rate", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: TODAY_END_3HR,
      dailyRate: VEHICLE.rate_3hr,
      durationType: "3hr",
      gasFee: DEFAULT_GAS_FEE,
    });
    expect(result.grandTotal).toBe(220); // 200 + 20
  });

  it("waives gas fee when flagged", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: TODAY_END_3HR,
      dailyRate: VEHICLE.rate_3hr,
      durationType: "3hr",
      gasFee: DEFAULT_GAS_FEE,
      gasFeeWaived: true,
    });
    expect(result.gasFee).toBe(0);
    expect(result.grandTotal).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════
// 3. calculateBookingTotal — 6-Hour Rentals
// ═══════════════════════════════════════════════════════
describe("calculateBookingTotal — 6hr tier", () => {
  it("uses flat rate, no day multiplication", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: TODAY_END_6HR,
      dailyRate: VEHICLE.rate_6hr,
      durationType: "6hr",
    });
    expect(result.rentalSubtotal).toBe(350);
    expect(result.grandTotal).toBe(350);
  });

  it("applies discount capped at subtotal", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: TODAY_END_6HR,
      dailyRate: VEHICLE.rate_6hr,
      durationType: "6hr",
      discountAmount: 400, // more than subtotal
    });
    expect(result.discountAmount).toBe(350); // capped
    expect(result.grandTotal).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// 4. calculateBookingTotal — Daily (24hr)
// ═══════════════════════════════════════════════════════
describe("calculateBookingTotal — daily tier", () => {
  it("multiplies rate × 1 day", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: TOMORROW,
      dailyRate: VEHICLE.current_rate,
      durationType: "daily",
    });
    expect(result.rentalSubtotal).toBe(500);
    expect(result.rentalDays).toBe(1);
  });

  it("defaults to daily when durationType omitted (backward compat)", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: TOMORROW,
      dailyRate: VEHICLE.current_rate,
      // no durationType
    });
    expect(result.rentalSubtotal).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════
// 5. calculateBookingTotal — Multi-Day
// ═══════════════════════════════════════════════════════
describe("calculateBookingTotal — multiday tier", () => {
  it("uses multiday rate × days", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: THREE_DAYS, // 3 days
      dailyRate: VEHICLE.rate_multiday,
      durationType: "multiday",
    });
    expect(result.rentalSubtotal).toBe(1350); // 450 × 3
    expect(result.rentalDays).toBe(3);
  });

  it("falls back to current_rate when rate_multiday is null", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: THREE_DAYS,
      dailyRate: VEHICLE.current_rate, // caller passes fallback
      durationType: "multiday",
    });
    expect(result.rentalSubtotal).toBe(1500); // 500 × 3
  });

  it("full pricing with all fees", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: THREE_DAYS,
      dailyRate: VEHICLE.rate_multiday,
      durationType: "multiday",
      gasFee: DEFAULT_GAS_FEE,
      deliveryFee: 50,
      discountAmount: 100,
    });
    // 450×3 = 1350 - 100 + 20 + 50 = 1320
    expect(result.rentalSubtotal).toBe(1350);
    expect(result.discountAmount).toBe(100);
    expect(result.gasFee).toBe(20);
    expect(result.deliveryFee).toBe(50);
    expect(result.grandTotal).toBe(1320);
  });
});

// ═══════════════════════════════════════════════════════
// 6. Same-day scenario: two bookings on one vehicle
// ═══════════════════════════════════════════════════════
describe("Same-day double booking scenario", () => {
  it("3hr morning + 6hr afternoon priced independently", () => {
    const morning = calculateBookingTotal({
      startDate: "2026-03-21T09:00:00Z",
      endDate: "2026-03-21T12:00:00Z",
      dailyRate: VEHICLE.rate_3hr,
      durationType: "3hr",
      gasFee: DEFAULT_GAS_FEE,
    });

    const afternoon = calculateBookingTotal({
      startDate: "2026-03-21T13:00:00Z",
      endDate: "2026-03-21T19:00:00Z",
      dailyRate: VEHICLE.rate_6hr,
      durationType: "6hr",
      gasFee: DEFAULT_GAS_FEE,
    });

    expect(morning.grandTotal).toBe(220);   // 200 + 20
    expect(afternoon.grandTotal).toBe(370); // 350 + 20
    
    // Combined revenue from same vehicle, same day
    const totalRevenue = morning.grandTotal + afternoon.grandTotal;
    expect(totalRevenue).toBe(590);
    // More than a single daily rental ($500 + $20 = $520)
    expect(totalRevenue).toBeGreaterThan(520);
  });

  it("two 3hr rentals on same day", () => {
    const rental1 = calculateBookingTotal({
      startDate: "2026-03-21T08:00:00Z",
      endDate: "2026-03-21T11:00:00Z",
      dailyRate: VEHICLE.rate_3hr,
      durationType: "3hr",
    });
    const rental2 = calculateBookingTotal({
      startDate: "2026-03-21T14:00:00Z",
      endDate: "2026-03-21T17:00:00Z",
      dailyRate: VEHICLE.rate_3hr,
      durationType: "3hr",
    });
    expect(rental1.grandTotal + rental2.grandTotal).toBe(400); // 200 + 200
  });
});

// ═══════════════════════════════════════════════════════
// 7. getRateForDuration
// ═══════════════════════════════════════════════════════
describe("getRateForDuration", () => {
  it("returns rate_3hr for 3hr duration", () => {
    expect(getRateForDuration("3hr", 500, 200, 350, 450)).toBe(200);
  });

  it("returns rate_6hr for 6hr duration", () => {
    expect(getRateForDuration("6hr", 500, 200, 350, 450)).toBe(350);
  });

  it("returns current_rate for daily", () => {
    expect(getRateForDuration("daily", 500, 200, 350, 450)).toBe(500);
  });

  it("returns rate_multiday for multiday", () => {
    expect(getRateForDuration("multiday", 500, 200, 350, 450)).toBe(450);
  });

  it("falls back to current_rate when tier rate is null", () => {
    expect(getRateForDuration("3hr", 500, null, null, null)).toBe(500);
    expect(getRateForDuration("6hr", 500, null, null, null)).toBe(500);
    expect(getRateForDuration("multiday", 500, null, null, null)).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════
// 8. getAvailableDurations
// ═══════════════════════════════════════════════════════
describe("getAvailableDurations", () => {
  it("shows all 4 when all tiers set", () => {
    const durations = getAvailableDurations(200, 350);
    expect(durations).toEqual(["3hr", "6hr", "daily", "multiday"]);
  });

  it("hides 3hr when rate_3hr is null", () => {
    const durations = getAvailableDurations(null, 350);
    expect(durations).toEqual(["6hr", "daily", "multiday"]);
    expect(durations).not.toContain("3hr");
  });

  it("hides 6hr when rate_6hr is null", () => {
    const durations = getAvailableDurations(200, null);
    expect(durations).toEqual(["3hr", "daily", "multiday"]);
  });

  it("only daily + multiday when no hourly tiers", () => {
    const durations = getAvailableDurations(null, null);
    expect(durations).toEqual(["daily", "multiday"]);
  });

  it("daily and multiday are always available", () => {
    const durations = getAvailableDurations(undefined, undefined);
    expect(durations).toContain("daily");
    expect(durations).toContain("multiday");
  });
});

// ═══════════════════════════════════════════════════════
// 9. getDurationLabel
// ═══════════════════════════════════════════════════════
describe("getDurationLabel", () => {
  it("returns correct labels", () => {
    expect(getDurationLabel("3hr")).toBe("3-Hour");
    expect(getDurationLabel("6hr")).toBe("6-Hour");
    expect(getDurationLabel("daily")).toBe("Daily");
    expect(getDurationLabel("multiday")).toBe("Multi-Day");
  });
});

// ═══════════════════════════════════════════════════════
// 10. Edge cases & guardrails
// ═══════════════════════════════════════════════════════
describe("Edge cases", () => {
  it("grandTotal never goes negative", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: TODAY_END_3HR,
      dailyRate: 100,
      durationType: "3hr",
      discountAmount: 9999,
    });
    expect(result.grandTotal).toBe(0);
  });

  it("discount capped at rentalSubtotal", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: TODAY_END_3HR,
      dailyRate: 200,
      durationType: "3hr",
      discountAmount: 500,
    });
    expect(result.discountAmount).toBe(200);
  });

  it("zero daily rate produces zero total", () => {
    const result = calculateBookingTotal({
      startDate: TODAY,
      endDate: THREE_DAYS,
      dailyRate: 0,
      durationType: "multiday",
    });
    expect(result.grandTotal).toBe(0);
  });
});
