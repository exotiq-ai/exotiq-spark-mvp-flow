// Pure scoring helpers mirroring server-side match cascade in
// supabase/functions/parse-expense-receipt. Used for client preview and tests.

export type MatchSignal =
  | "license_plate"
  | "vin"
  | "fuzzy_model"
  | "maintenance_window"
  | "booking_window";

export const SIGNAL_WEIGHTS: Record<MatchSignal, number> = {
  license_plate: 1.0,
  vin: 1.0,
  fuzzy_model: 0.6,
  maintenance_window: 0.85,
  booking_window: 0.75,
};

export function scoreMatch(signals: MatchSignal[]): number {
  if (signals.length === 0) return 0;
  // Take the strongest signal; bump if multiple corroborating signals.
  const top = Math.max(...signals.map((s) => SIGNAL_WEIGHTS[s]));
  const bonus = signals.length > 1 ? 0.05 : 0;
  return Math.min(1, top + bonus);
}

export const ADMIN_APPROVAL_THRESHOLD = 0.85;
export const ADMIN_AMOUNT_THRESHOLD = 5000;
export const STALE_EXPENSE_DAYS = 90;

export function requiresAdminApproval(opts: {
  confidence: number;
  amount: number;
  expenseDate: Date;
  now?: Date;
}): boolean {
  const now = opts.now ?? new Date();
  const ageDays = (now.getTime() - opts.expenseDate.getTime()) / 86_400_000;
  return (
    opts.confidence < ADMIN_APPROVAL_THRESHOLD ||
    opts.amount > ADMIN_AMOUNT_THRESHOLD ||
    ageDays > STALE_EXPENSE_DAYS
  );
}
