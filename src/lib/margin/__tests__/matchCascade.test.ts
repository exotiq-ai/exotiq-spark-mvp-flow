import { describe, it, expect } from "vitest";
import {
  scoreMatch,
  requiresAdminApproval,
  ADMIN_APPROVAL_THRESHOLD,
} from "../matchCascade";

describe("scoreMatch", () => {
  it("returns 1.0 for a plate hit", () => {
    expect(scoreMatch(["license_plate"])).toBe(1);
  });

  it("returns weight for fuzzy-only", () => {
    expect(scoreMatch(["fuzzy_model"])).toBeCloseTo(0.6, 5);
  });

  it("adds a small bonus for corroborating signals", () => {
    expect(scoreMatch(["fuzzy_model", "booking_window"])).toBeCloseTo(0.8, 5);
  });

  it("caps at 1.0", () => {
    expect(scoreMatch(["license_plate", "vin"])).toBe(1);
  });

  it("returns 0 for no signals", () => {
    expect(scoreMatch([])).toBe(0);
  });
});

describe("requiresAdminApproval", () => {
  const today = new Date(Date.UTC(2026, 4, 29));

  it("flags low-confidence", () => {
    expect(
      requiresAdminApproval({
        confidence: ADMIN_APPROVAL_THRESHOLD - 0.01,
        amount: 100,
        expenseDate: today,
        now: today,
      })
    ).toBe(true);
  });

  it("flags large amounts", () => {
    expect(
      requiresAdminApproval({
        confidence: 1,
        amount: 5001,
        expenseDate: today,
        now: today,
      })
    ).toBe(true);
  });

  it("flags stale (>90 day) receipts", () => {
    const old = new Date(Date.UTC(2026, 0, 1));
    expect(
      requiresAdminApproval({ confidence: 1, amount: 50, expenseDate: old, now: today })
    ).toBe(true);
  });

  it("passes fresh, confident, small receipts", () => {
    expect(
      requiresAdminApproval({
        confidence: 0.95,
        amount: 80,
        expenseDate: today,
        now: today,
      })
    ).toBe(false);
  });
});
