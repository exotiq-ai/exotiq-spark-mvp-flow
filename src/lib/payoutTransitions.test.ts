import { describe, it, expect } from "vitest";
import {
  allowedActions,
  canTransition,
  isOutstanding,
  isVoided,
  sumOutstanding,
  sumLiveObligations,
} from "./payoutTransitions";

describe("payout transition matrix", () => {
  it("pending allows mark_paid and void, not reopen", () => {
    expect(allowedActions("pending")).toEqual(["mark_paid", "void"]);
    expect(canTransition("pending", "mark_paid")).toBe(true);
    expect(canTransition("pending", "void")).toBe(true);
    expect(canTransition("pending", "reopen")).toBe(false);
  });

  it("scheduled behaves like pending", () => {
    expect(allowedActions("scheduled")).toEqual(["mark_paid", "void"]);
  });

  it("paid can only be voided", () => {
    expect(allowedActions("paid")).toEqual(["void"]);
    expect(canTransition("paid", "mark_paid")).toBe(false);
    expect(canTransition("paid", "void")).toBe(true);
  });

  it("voided can only be reopened", () => {
    expect(allowedActions("voided")).toEqual(["reopen"]);
    expect(canTransition("voided", "mark_paid")).toBe(false);
    expect(canTransition("voided", "reopen")).toBe(true);
  });

  it("unknown status allows nothing", () => {
    expect(allowedActions("weird")).toEqual([]);
  });
});

describe("amount inclusion rules", () => {
  const rows = [
    { status: "pending", net_to_partner: 100 },
    { status: "scheduled", net_to_partner: 50 },
    { status: "paid", net_to_partner: 200 },
    { status: "voided", net_to_partner: 999 },
  ];

  it("isOutstanding only pending/scheduled", () => {
    expect(isOutstanding("pending")).toBe(true);
    expect(isOutstanding("scheduled")).toBe(true);
    expect(isOutstanding("paid")).toBe(false);
    expect(isOutstanding("voided")).toBe(false);
  });

  it("isVoided covers voided and cancelled", () => {
    expect(isVoided("voided")).toBe(true);
    expect(isVoided("cancelled")).toBe(true);
    expect(isVoided("paid")).toBe(false);
  });

  it("sumOutstanding adds only pending + scheduled", () => {
    expect(sumOutstanding(rows)).toBe(150);
  });

  it("sumLiveObligations excludes voided but keeps paid", () => {
    expect(sumLiveObligations(rows)).toBe(350);
  });
});
