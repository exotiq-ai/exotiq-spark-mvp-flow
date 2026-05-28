// Partner payout state machine — shared, testable logic.
// Mirrors the server-side fn_transition_payout guards so the UI can disable
// illegal actions before a round-trip.

export type PayoutStatus = "pending" | "scheduled" | "paid" | "voided";
export type PayoutAction = "mark_paid" | "void" | "reopen";

export interface PayoutLike {
  status: string;
  net_to_partner: number;
}

// Which actions are legal from a given status.
export const allowedActions = (status: string): PayoutAction[] => {
  switch (status) {
    case "pending":
    case "scheduled":
      return ["mark_paid", "void"];
    case "paid":
      return ["void"];
    case "voided":
      return ["reopen"];
    default:
      return [];
  }
};

export const canTransition = (status: string, action: PayoutAction): boolean =>
  allowedActions(status).includes(action);

// Whether the row counts as an outstanding obligation the operator still owes.
export const isOutstanding = (status: string): boolean =>
  status === "pending" || status === "scheduled";

// Whether the row should be excluded from all margin math.
export const isVoided = (status: string): boolean =>
  status === "voided" || status === "cancelled";

// Outstanding total: only pending/scheduled obligations.
export const sumOutstanding = (payouts: PayoutLike[]): number =>
  payouts
    .filter((p) => isOutstanding(p.status))
    .reduce((s, p) => s + Number(p.net_to_partner || 0), 0);

// Real obligations for net margin: everything except voided/cancelled.
export const sumLiveObligations = (payouts: PayoutLike[]): number =>
  payouts
    .filter((p) => !isVoided(p.status))
    .reduce((s, p) => s + Number(p.net_to_partner || 0), 0);

export const ACTION_LABELS: Record<PayoutAction, string> = {
  mark_paid: "Mark Paid",
  void: "Void",
  reopen: "Re-open",
};
