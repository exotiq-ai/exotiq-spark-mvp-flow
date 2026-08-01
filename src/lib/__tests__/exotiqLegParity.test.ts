import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The Exotiq leg is charged in two places: rent-payment-webhook (first
 * attempt) and rent-retry-exotiq-leg (ops retry after a decline). They must
 * sum the exact same four fee components — a mismatch silently undercharges
 * every retried booking.
 */
const COMPONENTS = [
  "platform_fee_cents",
  "protection_total_cents",
  "state_fee_cents",
  "processing_fee_cents",
];

const read = (fn: string) =>
  readFileSync(path.resolve(__dirname, `../../../supabase/functions/${fn}/index.ts`), "utf8");

const sumComponents = (source: string, anchor: string): string[] => {
  const start = source.indexOf(anchor);
  expect(start, `anchor "${anchor}" not found`).toBeGreaterThan(-1);
  const block = source.slice(start, start + 600);
  return COMPONENTS.filter((c) => block.includes(c));
};

describe("Exotiq leg fee parity", () => {
  it("retry sums the same four components as the webhook", () => {
    const retry = sumComponents(read("rent-retry-exotiq-leg"), "const exotiqCents =");
    const webhook = sumComponents(
      read("rent-payment-webhook"),
      "Number(bookingRow.platform_fee_cents ?? 0)",
    );
    expect(retry.sort()).toEqual(COMPONENTS.slice().sort());
    expect(webhook.sort()).toEqual(COMPONENTS.slice().sort());
    expect(retry.sort()).toEqual(webhook.sort());
  });

  it("retry selects every component column from the booking row", () => {
    const source = read("rent-retry-exotiq-leg");
    const selectLine = source.split("\n").find((l) => l.includes("exotiq_leg_attempt") && l.includes("team_id"));
    expect(selectLine).toBeTruthy();
    for (const component of COMPONENTS) {
      expect(selectLine).toContain(component);
    }
  });
});
