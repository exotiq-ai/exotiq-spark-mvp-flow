import { describe, it, expect } from "vitest";
import { advanceNextRun, isDue } from "../recurring";

describe("advanceNextRun", () => {
  it("advances monthly normally", () => {
    const next = advanceNextRun(new Date(Date.UTC(2026, 0, 15)), "monthly", 15);
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-15");
  });

  it("clamps day 31 across short months", () => {
    const next = advanceNextRun(new Date(Date.UTC(2026, 0, 31)), "monthly", 31);
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("handles February leap year for annual", () => {
    const next = advanceNextRun(new Date(Date.UTC(2027, 1, 28)), "annual", 29);
    // 2028 is leap -> 29 is valid
    expect(next.toISOString().slice(0, 10)).toBe("2028-02-29");
  });

  it("advances quarterly across year boundary", () => {
    const next = advanceNextRun(new Date(Date.UTC(2026, 10, 10)), "quarterly", 10);
    expect(next.toISOString().slice(0, 10)).toBe("2027-02-10");
  });

  it("isDue returns true when next_run_at is in the past", () => {
    expect(isDue(new Date(Date.now() - 1000))).toBe(true);
    expect(isDue(new Date(Date.now() + 60_000))).toBe(false);
  });
});
