import { describe, it, expect } from "vitest";
import {
  buildSteps,
  computeRunStatus,
  nextActionableStep,
  checkFeeParity,
  formatCents,
} from "@/lib/smokeTest";

describe("smokeTest helpers", () => {
  it("builds a pending step list per scenario", () => {
    const steps = buildSteps("marketplace_booking");
    expect(steps).toHaveLength(7);
    expect(steps.every((s) => s.state === "pending")).toBe(true);
  });

  it("stays running until every step passes", () => {
    const steps = buildSteps("refund");
    expect(computeRunStatus(steps)).toBe("running");
    steps.forEach((s) => (s.state = "passed"));
    expect(computeRunStatus(steps)).toBe("passed");
  });

  it("fails the run as soon as one step fails", () => {
    const steps = buildSteps("subscription");
    steps.forEach((s) => (s.state = "passed"));
    steps[2].state = "failed";
    expect(computeRunStatus(steps)).toBe("failed");
  });

  it("finds the next actionable step", () => {
    const steps = buildSteps("subscription");
    steps[0].state = "passed";
    steps[1].state = "awaiting_user";
    expect(nextActionableStep(steps)?.key).toBe("pay");
  });

  it("passes parity when both legs match the snapshot", () => {
    const snapshot = {
      operator_total_cents: 50000,
      platform_fee_cents: 5000,
      protection_total_cents: 8900,
      state_fee_cents: 589,
      processing_fee_cents: 1780,
    };
    const result = checkFeeParity(snapshot, {
      operator_charged_cents: 50000,
      exotiq_charged_cents: 5000 + 8900 + 589 + 1780,
    });
    expect(result.ok).toBe(true);
    expect(result.expected_exotiq_cents).toBe(16269);
    expect(result.diffs).toHaveLength(0);
  });

  it("reports a per-leg delta when a fee component is dropped", () => {
    const snapshot = {
      operator_total_cents: 50000,
      platform_fee_cents: 5000,
      protection_total_cents: 8900,
      state_fee_cents: 589,
      processing_fee_cents: 1780,
    };
    // Exotiq leg charged without state + processing fees (the old bug).
    const result = checkFeeParity(snapshot, {
      operator_charged_cents: 50000,
      exotiq_charged_cents: 13900,
    });
    expect(result.ok).toBe(false);
    expect(result.diffs).toEqual([
      { leg: "exotiq", expected: 16269, actual: 13900, delta: -2369 },
    ]);
  });

  it("formats cents as currency", () => {
    expect(formatCents(16269)).toBe("$162.69");
    expect(formatCents(0)).toBe("$0.00");
  });
});
