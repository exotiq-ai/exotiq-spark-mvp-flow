// Pure helpers mirroring SQL logic in generate_recurring_expenses().
// Kept frontend-side so we can unit-test next_run_at advancement and preview
// upcoming runs in the Recurring templates UI without a round-trip.

export type Cadence = "monthly" | "quarterly" | "annual";

/**
 * Advance a recurring template's next_run_at by one cycle, clamping day_of_month
 * to the last day of the target month (so e.g. day=31 in Feb -> 28/29).
 */
export function advanceNextRun(
  current: Date,
  cadence: Cadence,
  dayOfMonth: number
): Date {
  const y = current.getUTCFullYear();
  const m = current.getUTCMonth();
  const monthsToAdd = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
  const targetMonth = m + monthsToAdd;
  const targetY = y + Math.floor(targetMonth / 12);
  const targetM = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(dayOfMonth, 1), lastDay);
  return new Date(Date.UTC(targetY, targetM, day, 12, 0, 0));
}

/** True if the template is due to run (next_run_at <= now). */
export function isDue(nextRunAt: Date, now: Date = new Date()): boolean {
  return nextRunAt.getTime() <= now.getTime();
}
