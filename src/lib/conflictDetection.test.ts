/**
 * Exhaustive tests for checkBookingConflicts and isBlockingBooking.
 * All behavior-pinning tests are labeled [current behavior] in their names.
 */
import { describe, it, expect } from "vitest";
import {
  checkBookingConflicts,
  isBlockingBooking,
  hasBlockingOverlap,
} from "./conflictDetection";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Maintenance = Database["public"]["Tables"]["maintenance_schedules"]["Row"];

// ─── Fixtures ───────────────────────────────────────────────────────────────

const VEHICLE = "vehicle-aaa";
const OTHER_VEHICLE = "vehicle-bbb";

/** Minimal Booking stub — only conflict-relevant fields need real values. */
const mkBooking = (
  id: string,
  vehicle_id: string,
  start_date: string,
  end_date: string,
  status: string | null = "confirmed"
): Booking =>
  ({
    id,
    vehicle_id,
    start_date,
    end_date,
    status,
    // all other fields are unused by checkBookingConflicts
    user_id: "user-1",
    customer_name: "Test",
    daily_rate: 500,
    pickup_location: "HQ",
    total_value: 500,
    platform_fee_amount: 50,
    platform_fee_base: 500,
    platform_fee_percent_snapshot: 10,
    booking_source: "manual",
  } as Booking);

/** Minimal Maintenance stub */
const mkMaintenance = (
  id: string,
  vehicle_id: string,
  scheduled_date: string,
  maintenance_type = "Oil Change",
  status: string | null = "scheduled"
): Maintenance =>
  ({
    id,
    vehicle_id,
    scheduled_date,
    maintenance_type,
    status,
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as Maintenance);

// ─── isBlockingBooking ───────────────────────────────────────────────────────

describe("isBlockingBooking", () => {
  it("confirmed blocks", () => {
    expect(isBlockingBooking("confirmed")).toBe(true);
  });

  it("pending blocks", () => {
    expect(isBlockingBooking("pending")).toBe(true);
  });

  it("cancelled does NOT block", () => {
    expect(isBlockingBooking("cancelled")).toBe(false);
  });

  it("completed does NOT block", () => {
    expect(isBlockingBooking("completed")).toBe(false);
  });

  it("null status blocks [current behavior: null treated as blocking]", () => {
    expect(isBlockingBooking(null)).toBe(true);
  });

  it("unknown status string blocks [current behavior: unknown treated as blocking]", () => {
    expect(isBlockingBooking("anything_else")).toBe(true);
  });
});

// ─── No-conflict baseline ────────────────────────────────────────────────────

describe("checkBookingConflicts — no conflict", () => {
  it("returns hasConflict=false with empty arrays", () => {
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T10:00:00Z", end_date: "2026-06-11T10:00:00Z" },
      [],
      []
    );
    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
    expect(result.suggestions).toHaveLength(0);
  });

  it("different vehicle_id never conflicts", () => {
    const existing = mkBooking("b1", OTHER_VEHICLE, "2026-06-10T00:00:00Z", "2026-06-12T00:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T00:00:00Z", end_date: "2026-06-11T00:00:00Z" },
      [existing],
      []
    );
    expect(result.hasConflict).toBe(false);
  });

  it("fully non-overlapping booking 5+ days apart has no conflict", () => {
    const existing = mkBooking("b1", VEHICLE, "2026-06-01T10:00:00Z", "2026-06-03T10:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T10:00:00Z", end_date: "2026-06-12T10:00:00Z" },
      [existing],
      []
    );
    expect(result.hasConflict).toBe(false);
  });
});

// ─── Direct overlap — three branch shapes ────────────────────────────────────

describe("checkBookingConflicts — direct overlap", () => {
  it("branch 1: new start falls inside existing range", () => {
    // newStart >= existingStart && newStart < existingEnd
    const existing = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-11T08:00:00Z", end_date: "2026-06-13T08:00:00Z" },
      [existing],
      []
    );
    expect(result.hasConflict).toBe(true);
    const ov = result.conflicts.find((c) => c.type === "overlap");
    expect(ov).toBeDefined();
    expect(ov?.severity).toBe("critical");
    expect(ov?.bookingIds).toContain("b1");
  });

  it("branch 2: new end falls inside existing range", () => {
    // newEnd > existingStart && newEnd <= existingEnd
    const existing = mkBooking("b1", VEHICLE, "2026-06-11T08:00:00Z", "2026-06-13T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [existing],
      []
    );
    expect(result.hasConflict).toBe(true);
    const ov = result.conflicts.find((c) => c.type === "overlap");
    expect(ov).toBeDefined();
    expect(ov?.severity).toBe("critical");
  });

  it("branch 3: new range contains existing range (engulfment)", () => {
    // newStart <= existingStart && newEnd >= existingEnd
    const existing = mkBooking("b1", VEHICLE, "2026-06-11T08:00:00Z", "2026-06-12T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-13T08:00:00Z" },
      [existing],
      []
    );
    expect(result.hasConflict).toBe(true);
    const ov = result.conflicts.find((c) => c.type === "overlap");
    expect(ov).toBeDefined();
  });

  it("identical start/end = overlap (contained + same)", () => {
    const existing = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [existing],
      []
    );
    expect(result.hasConflict).toBe(true);
  });
});

// ─── Boundary semantics (half-open interval) ─────────────────────────────────

describe("checkBookingConflicts — exact boundary cases [current behavior]", () => {
  /**
   * Implementation uses:
   *   overlap if: (newStart >= existingStart && newStart < existingEnd)  ← newStart===existingEnd is NOT caught here
   *            || (newEnd > existingStart && newEnd <= existingEnd)       ← newEnd===existingStart is NOT caught here
   *            || (newStart <= existingStart && newEnd >= existingEnd)
   *
   * So:
   *   newStart === existingEnd  → no overlap (newStart < existingEnd is false)
   *   newEnd   === existingStart → no overlap (newEnd > existingStart is false)
   */
  it("newStart === existingEnd: no direct overlap [half-open semantics]", () => {
    const existing = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-12T08:00:00Z", end_date: "2026-06-14T08:00:00Z" },
      [existing],
      []
    );
    const overlapConflicts = result.conflicts.filter((c) => c.type === "overlap");
    expect(overlapConflicts).toHaveLength(0);
  });

  it("newEnd === existingStart: no direct overlap [half-open semantics]", () => {
    const existing = mkBooking("b1", VEHICLE, "2026-06-14T08:00:00Z", "2026-06-16T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-12T08:00:00Z", end_date: "2026-06-14T08:00:00Z" },
      [existing],
      []
    );
    const overlapConflicts = result.conflicts.filter((c) => c.type === "overlap");
    expect(overlapConflicts).toHaveLength(0);
  });

  it("1ms inside each boundary IS an overlap", () => {
    const existing = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00.000Z", "2026-06-12T08:00:00.000Z");
    // newStart = existingEnd - 1ms
    const result = checkBookingConflicts(
      {
        vehicle_id: VEHICLE,
        start_date: "2026-06-12T07:59:59.999Z",
        end_date: "2026-06-14T08:00:00.000Z",
      },
      [existing],
      []
    );
    expect(result.conflicts.some((c) => c.type === "overlap")).toBe(true);
  });
});

// ─── Status filtering ─────────────────────────────────────────────────────────

describe("checkBookingConflicts — status filtering", () => {
  const overlappingDates = {
    start_date: "2026-06-10T08:00:00Z",
    end_date: "2026-06-12T08:00:00Z",
  };

  it("cancelled booking is ignored — no conflict", () => {
    const b = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z", "cancelled");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, ...overlappingDates },
      [b],
      []
    );
    expect(result.hasConflict).toBe(false);
  });

  it("completed booking is ignored — no conflict", () => {
    const b = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z", "completed");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, ...overlappingDates },
      [b],
      []
    );
    expect(result.hasConflict).toBe(false);
  });

  it("confirmed booking BLOCKS [current behavior]", () => {
    const b = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z", "confirmed");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, ...overlappingDates },
      [b],
      []
    );
    expect(result.hasConflict).toBe(true);
  });

  it("pending booking BLOCKS [current behavior]", () => {
    const b = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z", "pending");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, ...overlappingDates },
      [b],
      []
    );
    expect(result.hasConflict).toBe(true);
  });

  it("null status BLOCKS [current behavior: null treated as blocking]", () => {
    const b = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z", null);
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, ...overlappingDates },
      [b],
      []
    );
    expect(result.hasConflict).toBe(true);
  });

  it("unknown status BLOCKS [current behavior: unknown treated as blocking]", () => {
    const b = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z", "awaiting_payment");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, ...overlappingDates },
      [b],
      []
    );
    expect(result.hasConflict).toBe(true);
  });
});

// ─── Self-exclusion via id (edit flow) ───────────────────────────────────────

describe("checkBookingConflicts — self-exclusion when editing", () => {
  it("booking with same id as newBooking.id is excluded", () => {
    const existing = mkBooking("booking-self", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const result = checkBookingConflicts(
      {
        id: "booking-self", // same id → should be excluded
        vehicle_id: VEHICLE,
        start_date: "2026-06-10T08:00:00Z",
        end_date: "2026-06-12T08:00:00Z",
      },
      [existing],
      []
    );
    expect(result.hasConflict).toBe(false);
  });

  it("different id still triggers conflict even if same dates", () => {
    const existing = mkBooking("booking-other", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const result = checkBookingConflicts(
      {
        id: "booking-self",
        vehicle_id: VEHICLE,
        start_date: "2026-06-10T08:00:00Z",
        end_date: "2026-06-12T08:00:00Z",
      },
      [existing],
      []
    );
    expect(result.hasConflict).toBe(true);
  });
});

// ─── Buffer warnings ──────────────────────────────────────────────────────────

describe("checkBookingConflicts — buffer warnings (4-hour rule)", () => {
  /**
   * Buffer check: if newStart > existingEnd and gap < 4h → warning.
   *               if existingStart > newEnd and gap < 4h → warning.
   */

  it("2h gap after existing end → buffer warning", () => {
    // existing ends at 10:00, new starts at 12:00 (2h gap < 4h)
    const existing = mkBooking("b1", VEHICLE, "2026-06-10T06:00:00Z", "2026-06-10T10:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T12:00:00Z", end_date: "2026-06-10T18:00:00Z" },
      [existing],
      []
    );
    expect(result.hasConflict).toBe(true);
    const buf = result.conflicts.find((c) => c.type === "buffer");
    expect(buf).toBeDefined();
    expect(buf?.severity).toBe("warning");
    expect(buf?.message).toContain("2 hours");
  });

  it("3h gap before existing start → buffer warning", () => {
    // new ends at 10:00, existing starts at 13:00 (3h gap < 4h)
    const existing = mkBooking("b1", VEHICLE, "2026-06-10T13:00:00Z", "2026-06-10T18:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T07:00:00Z", end_date: "2026-06-10T10:00:00Z" },
      [existing],
      []
    );
    expect(result.hasConflict).toBe(true);
    const buf = result.conflicts.find((c) => c.type === "buffer");
    expect(buf).toBeDefined();
    expect(buf?.severity).toBe("warning");
  });

  it("exactly 4h gap → NO buffer warning", () => {
    // existing ends at 10:00, new starts at 14:00 (exactly 4h)
    const existing = mkBooking("b1", VEHICLE, "2026-06-10T06:00:00Z", "2026-06-10T10:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T14:00:00Z", end_date: "2026-06-10T20:00:00Z" },
      [existing],
      []
    );
    const buffers = result.conflicts.filter((c) => c.type === "buffer");
    expect(buffers).toHaveLength(0);
  });

  it("more than 4h gap → NO buffer warning", () => {
    // existing ends at 10:00, new starts at 15:00 (5h gap)
    const existing = mkBooking("b1", VEHICLE, "2026-06-10T06:00:00Z", "2026-06-10T10:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T15:00:00Z", end_date: "2026-06-10T20:00:00Z" },
      [existing],
      []
    );
    const buffers = result.conflicts.filter((c) => c.type === "buffer");
    expect(buffers).toHaveLength(0);
  });

  it("buffer suggestion mentions buffer time addition", () => {
    const existing = mkBooking("b1", VEHICLE, "2026-06-10T06:00:00Z", "2026-06-10T10:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T12:00:00Z", end_date: "2026-06-10T18:00:00Z" },
      [existing],
      []
    );
    expect(result.suggestions).toContain("Add buffer time between bookings for vehicle preparation");
  });
});

// ─── Maintenance conflicts ────────────────────────────────────────────────────

describe("checkBookingConflicts — maintenance schedule conflicts", () => {
  it("maintenance scheduled_date inside booking range → conflict", () => {
    const m = mkMaintenance("m1", VEHICLE, "2026-06-11T10:00:00Z", "Oil Change", "scheduled");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [],
      [m]
    );
    expect(result.hasConflict).toBe(true);
    const mc = result.conflicts.find((c) => c.type === "maintenance");
    expect(mc).toBeDefined();
    expect(mc?.severity).toBe("critical");
    expect(mc?.message).toContain("Oil Change");
  });

  it("maintenance scheduled_date at booking start (boundary — inclusive) → conflict", () => {
    const m = mkMaintenance("m1", VEHICLE, "2026-06-10T08:00:00Z", "Inspection", "scheduled");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [],
      [m]
    );
    expect(result.hasConflict).toBe(true);
  });

  it("maintenance scheduled_date at booking end (boundary — inclusive) → conflict", () => {
    const m = mkMaintenance("m1", VEHICLE, "2026-06-12T08:00:00Z", "Tire Rotation", "scheduled");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [],
      [m]
    );
    expect(result.hasConflict).toBe(true);
  });

  it("maintenance scheduled_date before booking start → no conflict", () => {
    const m = mkMaintenance("m1", VEHICLE, "2026-06-09T08:00:00Z", "Oil Change", "scheduled");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [],
      [m]
    );
    const mc = result.conflicts.filter((c) => c.type === "maintenance");
    expect(mc).toHaveLength(0);
  });

  it("maintenance scheduled_date after booking end → no conflict", () => {
    const m = mkMaintenance("m1", VEHICLE, "2026-06-13T08:00:00Z", "Oil Change", "scheduled");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [],
      [m]
    );
    const mc = result.conflicts.filter((c) => c.type === "maintenance");
    expect(mc).toHaveLength(0);
  });

  it("completed maintenance is ignored [current behavior]", () => {
    const m = mkMaintenance("m1", VEHICLE, "2026-06-11T10:00:00Z", "Oil Change", "completed");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [],
      [m]
    );
    const mc = result.conflicts.filter((c) => c.type === "maintenance");
    expect(mc).toHaveLength(0);
  });

  it("maintenance for different vehicle is ignored", () => {
    const m = mkMaintenance("m1", OTHER_VEHICLE, "2026-06-11T10:00:00Z", "Oil Change", "scheduled");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [],
      [m]
    );
    expect(result.hasConflict).toBe(false);
  });

  it("maintenance suggestion included when critical maintenance conflict", () => {
    const m = mkMaintenance("m1", VEHICLE, "2026-06-11T10:00:00Z", "Oil Change", "scheduled");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [],
      [m]
    );
    expect(result.suggestions).toContain("Consider selecting a different vehicle or date range");
  });
});

// ─── Multi-conflict aggregation ───────────────────────────────────────────────

describe("checkBookingConflicts — multi-conflict aggregation", () => {
  it("two overlapping bookings produce two overlap conflicts", () => {
    const b1 = mkBooking("b1", VEHICLE, "2026-06-09T08:00:00Z", "2026-06-11T08:00:00Z");
    const b2 = mkBooking("b2", VEHICLE, "2026-06-11T06:00:00Z", "2026-06-13T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [b1, b2],
      []
    );
    const overlaps = result.conflicts.filter((c) => c.type === "overlap");
    expect(overlaps.length).toBeGreaterThanOrEqual(2);
  });

  it("both overlap and maintenance conflicts together — all present", () => {
    const b1 = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const m1 = mkMaintenance("m1", VEHICLE, "2026-06-11T10:00:00Z", "Brake Check");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [b1],
      [m1]
    );
    expect(result.conflicts.some((c) => c.type === "overlap")).toBe(true);
    expect(result.conflicts.some((c) => c.type === "maintenance")).toBe(true);
  });

  it("hasConflict=true when any conflict exists", () => {
    const b1 = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [b1],
      []
    );
    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("each conflict includes bookingIds for overlap", () => {
    const b1 = mkBooking("booking-alpha", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [b1],
      []
    );
    const ov = result.conflicts.find((c) => c.type === "overlap");
    expect(ov?.bookingIds).toContain("booking-alpha");
  });
});

// ─── Suggestions wiring ───────────────────────────────────────────────────────

describe("checkBookingConflicts — suggestions wiring", () => {
  it("no conflicts → no suggestions", () => {
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-20T08:00:00Z", end_date: "2026-06-22T08:00:00Z" },
      [],
      []
    );
    expect(result.suggestions).toHaveLength(0);
  });

  it("critical overlap → vehicle/date suggestion", () => {
    const b1 = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [b1],
      []
    );
    expect(result.suggestions).toContain("Consider selecting a different vehicle or date range");
  });

  it("buffer-only conflict → buffer suggestion only", () => {
    // 2h gap → buffer warning only, no overlap
    const existing = mkBooking("b1", VEHICLE, "2026-06-10T06:00:00Z", "2026-06-10T10:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T12:00:00Z", end_date: "2026-06-10T18:00:00Z" },
      [existing],
      []
    );
    expect(result.suggestions).toContain("Add buffer time between bookings for vehicle preparation");
    // No critical conflict → no vehicle/date suggestion
    expect(result.suggestions).not.toContain("Consider selecting a different vehicle or date range");
  });

  it("individual conflict entries include their own suggestion field", () => {
    const b1 = mkBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const result = checkBookingConflicts(
      { vehicle_id: VEHICLE, start_date: "2026-06-10T08:00:00Z", end_date: "2026-06-12T08:00:00Z" },
      [b1],
      []
    );
    const ov = result.conflicts.find((c) => c.type === "overlap");
    expect(ov?.suggestion).toBeTruthy();
  });
});

// ─── hasBlockingOverlap ───────────────────────────────────────────────────────

/** Minimal stub for hasBlockingOverlap — only overlap-relevant fields */
const mkSimpleBooking = (
  id: string,
  vehicle_id: string,
  start_date: string,
  end_date: string,
  status: string | null = "confirmed"
) => ({ id, vehicle_id, start_date, end_date, status });

describe("hasBlockingOverlap", () => {
  it("returns false with no bookings", () => {
    expect(
      hasBlockingOverlap(VEHICLE, new Date("2026-06-10T08:00:00Z"), new Date("2026-06-12T08:00:00Z"), [])
    ).toBe(false);
  });

  it("returns true when new range overlaps a confirmed booking", () => {
    const b = mkSimpleBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    expect(
      hasBlockingOverlap(VEHICLE, new Date("2026-06-11T08:00:00Z"), new Date("2026-06-13T08:00:00Z"), [b])
    ).toBe(true);
  });

  it("returns false when ranges are adjacent — start === bEnd (half-open, no overlap)", () => {
    const b = mkSimpleBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    // new start equals existing end — half-open means no overlap
    expect(
      hasBlockingOverlap(VEHICLE, new Date("2026-06-12T08:00:00Z"), new Date("2026-06-14T08:00:00Z"), [b])
    ).toBe(false);
  });

  it("returns false when ranges are adjacent — end === bStart (half-open, no overlap)", () => {
    const b = mkSimpleBooking("b1", VEHICLE, "2026-06-14T08:00:00Z", "2026-06-16T08:00:00Z");
    // new end equals existing start — half-open means no overlap
    expect(
      hasBlockingOverlap(VEHICLE, new Date("2026-06-12T08:00:00Z"), new Date("2026-06-14T08:00:00Z"), [b])
    ).toBe(false);
  });

  it("returns true when new range contains (engulfs) existing booking", () => {
    const b = mkSimpleBooking("b1", VEHICLE, "2026-06-11T08:00:00Z", "2026-06-12T08:00:00Z");
    expect(
      hasBlockingOverlap(VEHICLE, new Date("2026-06-10T08:00:00Z"), new Date("2026-06-13T08:00:00Z"), [b])
    ).toBe(true);
  });

  it("returns false for a cancelled booking that overlaps", () => {
    const b = mkSimpleBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z", "cancelled");
    expect(
      hasBlockingOverlap(VEHICLE, new Date("2026-06-10T08:00:00Z"), new Date("2026-06-12T08:00:00Z"), [b])
    ).toBe(false);
  });

  it("returns false for a completed booking that overlaps", () => {
    const b = mkSimpleBooking("b1", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z", "completed");
    expect(
      hasBlockingOverlap(VEHICLE, new Date("2026-06-10T08:00:00Z"), new Date("2026-06-12T08:00:00Z"), [b])
    ).toBe(false);
  });

  it("returns false for a different vehicle even when dates overlap", () => {
    const b = mkSimpleBooking("b1", OTHER_VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    expect(
      hasBlockingOverlap(VEHICLE, new Date("2026-06-10T08:00:00Z"), new Date("2026-06-12T08:00:00Z"), [b])
    ).toBe(false);
  });

  it("excludeBookingId excludes the self booking (edit flow — no false positive)", () => {
    const b = mkSimpleBooking("booking-self", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    expect(
      hasBlockingOverlap(
        VEHICLE,
        new Date("2026-06-10T08:00:00Z"),
        new Date("2026-06-12T08:00:00Z"),
        [b],
        "booking-self"
      )
    ).toBe(false);
  });

  it("excludeBookingId only excludes the matched id — other overlapping bookings still block", () => {
    const self = mkSimpleBooking("booking-self", VEHICLE, "2026-06-10T08:00:00Z", "2026-06-12T08:00:00Z");
    const other = mkSimpleBooking("booking-other", VEHICLE, "2026-06-11T00:00:00Z", "2026-06-13T00:00:00Z");
    expect(
      hasBlockingOverlap(
        VEHICLE,
        new Date("2026-06-10T08:00:00Z"),
        new Date("2026-06-12T08:00:00Z"),
        [self, other],
        "booking-self"
      )
    ).toBe(true);
  });
});
