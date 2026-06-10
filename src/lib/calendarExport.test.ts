/**
 * Tests for calendarExport — verifies UTC-anchored ICS output (Z suffix).
 */
import { describe, it, expect } from "vitest";
import { generateICS } from "./calendarExport";

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeEvent = (startDate: Date, endDate: Date) => ({
  title: "Test Booking",
  description: "A test event",
  location: "Downtown",
  startDate,
  endDate,
  uid: "test-uid-001",
});

// ─── UTC Z-format assertions ─────────────────────────────────────────────────

describe("generateICS — UTC-anchored datetime format", () => {
  it("DTSTART is emitted with a trailing Z (UTC)", () => {
    const start = new Date("2026-06-10T09:00:00Z");
    const end = new Date("2026-06-11T09:00:00Z");
    const ics = generateICS([makeEvent(start, end)]);
    expect(ics).toContain("DTSTART:20260610T090000Z");
  });

  it("DTEND is emitted with a trailing Z (UTC)", () => {
    const start = new Date("2026-06-10T09:00:00Z");
    const end = new Date("2026-06-11T09:00:00Z");
    const ics = generateICS([makeEvent(start, end)]);
    expect(ics).toContain("DTEND:20260611T090000Z");
  });

  it("DTSTAMP is emitted with a trailing Z (UTC)", () => {
    const start = new Date("2026-06-10T09:00:00Z");
    const end = new Date("2026-06-11T09:00:00Z");
    const ics = generateICS([makeEvent(start, end)]);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  it("known UTC instant produces the correct DTSTART string", () => {
    // 2026-03-15T14:30:00Z → 20260315T143000Z
    const start = new Date("2026-03-15T14:30:00Z");
    const end = new Date("2026-03-16T14:30:00Z");
    const ics = generateICS([makeEvent(start, end)]);
    expect(ics).toContain("DTSTART:20260315T143000Z");
  });

  it("two inputs one hour apart have DTSTART values that differ by exactly 10000 (1 hour in HHmmss)", () => {
    // First event: 09:00 → 20260610T090000Z
    // Second event: 10:00 → 20260610T100000Z
    // The numeric difference in the time portion is 10000
    const start1 = new Date("2026-06-10T09:00:00Z");
    const start2 = new Date("2026-06-10T10:00:00Z");
    const end = new Date("2026-06-11T09:00:00Z");

    const ics1 = generateICS([makeEvent(start1, end)]);
    const ics2 = generateICS([makeEvent(start2, end)]);

    const extractDtstart = (ics: string): string => {
      const m = ics.match(/DTSTART:(\d{8}T\d{6}Z)/);
      if (!m) throw new Error("DTSTART not found");
      return m[1];
    };

    const ts1 = extractDtstart(ics1);
    const ts2 = extractDtstart(ics2);

    // Parse the numeric time portion (HHmmss after the T)
    const time1 = parseInt(ts1.replace(/\D/g, "").slice(8), 10); // last 6 digits
    const time2 = parseInt(ts2.replace(/\D/g, "").slice(8), 10);

    expect(ts1).toBe("20260610T090000Z");
    expect(ts2).toBe("20260610T100000Z");
    expect(time2 - time1).toBe(10000); // 100000 - 90000 = 10000
  });

  it("no floating local-time format (no T without Z)", () => {
    const start = new Date("2026-06-10T09:00:00Z");
    const end = new Date("2026-06-11T09:00:00Z");
    const ics = generateICS([makeEvent(start, end)]);
    // Every datetime in DTSTART/DTEND/DTSTAMP must end in Z
    const dtLines = ics.split("\r\n").filter((l) => l.startsWith("DTSTART:") || l.startsWith("DTEND:") || l.startsWith("DTSTAMP:"));
    dtLines.forEach((line) => {
      expect(line).toMatch(/Z$/);
    });
  });
});

// ─── ICS structure ───────────────────────────────────────────────────────────

describe("generateICS — structure", () => {
  it("wraps output in VCALENDAR", () => {
    const ics = generateICS([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("generates one VEVENT per event", () => {
    const start = new Date("2026-06-10T09:00:00Z");
    const end = new Date("2026-06-11T09:00:00Z");
    const ics = generateICS([makeEvent(start, end), makeEvent(start, end)]);
    const count = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(2);
  });

  it("uses CRLF line endings", () => {
    const start = new Date("2026-06-10T09:00:00Z");
    const end = new Date("2026-06-11T09:00:00Z");
    const ics = generateICS([makeEvent(start, end)]);
    expect(ics).toContain("\r\n");
  });
});
