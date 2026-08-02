/**
 * Go-Live smoke test — shared types and pure helpers.
 *
 * The runner itself lives in the `admin-smoke-run` edge function (it needs
 * the Stripe secret key). Everything here is pure so it can be unit tested
 * and reused by the Super Admin UI.
 */

export type SmokeScenario = "subscription" | "marketplace_booking" | "refund";
export type SmokeMode = "live" | "test";
export type SmokeRunStatus = "running" | "passed" | "failed" | "cancelled";
export type SmokeStepState = "pending" | "running" | "passed" | "failed" | "awaiting_user";

export interface SmokeStep {
  key: string;
  label: string;
  state: SmokeStepState;
  detail?: string;
  /** Set on the manual pay step so the UI can surface the Checkout link. */
  action_url?: string | null;
  at?: string;
}

export interface SmokeRun {
  id: string;
  scenario: SmokeScenario;
  mode: SmokeMode;
  status: SmokeRunStatus;
  steps: SmokeStep[];
  context: Record<string, unknown>;
  amount_cents: number;
  cleanup_state: "pending" | "done" | "failed" | "not_needed";
  parent_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export const SCENARIO_LABELS: Record<SmokeScenario, string> = {
  subscription: "A · Subscription checkout",
  marketplace_booking: "B · Marketplace booking",
  refund: "C · Refund",
};

export const STEP_BLUEPRINTS: Record<SmokeScenario, Array<Pick<SmokeStep, "key" | "label">>> = {
  subscription: [
    { key: "session", label: "Create live subscription Checkout session" },
    { key: "pay", label: "Pay with a real card (manual)" },
    { key: "active", label: "Session completed and subscription active" },
    { key: "webhook", label: "Platform webhook recorded the event" },
    { key: "reverse", label: "Subscription cancelled and invoice refunded" },
  ],
  marketplace_booking: [
    { key: "tenant", label: "Pick live-ready tenant and cheapest vehicle" },
    { key: "quote", label: "Quote booking and snapshot every fee" },
    { key: "booking", label: "Create, approve and generate renter Checkout" },
    { key: "pay", label: "Pay with a real card (manual)" },
    { key: "captured", label: "Both legs captured (operator + Exotiq)" },
    { key: "parity", label: "Charged amounts match the snapshot to the cent" },
    { key: "split", label: "Destination charge routed to the operator account" },
  ],
  refund: [
    { key: "refund", label: "Refund the booking via rent-refund-booking" },
    { key: "stripe", label: "Both legs show refunded in Stripe" },
    { key: "ledger", label: "Booking status and ledger reflect the reversal" },
    { key: "orphans", label: "No orphan payment rows left behind" },
  ],
};

export function buildSteps(scenario: SmokeScenario): SmokeStep[] {
  return STEP_BLUEPRINTS[scenario].map((s) => ({ ...s, state: "pending" as SmokeStepState }));
}

/** A run is passed only when every step passed; failed as soon as one fails. */
export function computeRunStatus(steps: SmokeStep[]): SmokeRunStatus {
  if (steps.some((s) => s.state === "failed")) return "failed";
  if (steps.length > 0 && steps.every((s) => s.state === "passed")) return "passed";
  return "running";
}

export function nextActionableStep(steps: SmokeStep[]): SmokeStep | undefined {
  return steps.find((s) => s.state === "pending" || s.state === "running" || s.state === "awaiting_user");
}

export interface FeeSnapshot {
  operator_total_cents: number;
  platform_fee_cents: number;
  protection_total_cents: number;
  state_fee_cents: number;
  processing_fee_cents: number;
}

export interface ChargedAmounts {
  operator_charged_cents: number;
  exotiq_charged_cents: number;
}

export interface ParityResult {
  ok: boolean;
  expected_exotiq_cents: number;
  diffs: Array<{ leg: "operator" | "exotiq"; expected: number; actual: number; delta: number }>;
}

/**
 * The Exotiq leg is the sum of the four snapshotted fee components (see
 * rent-payment-webhook / rent-retry-exotiq-leg); the operator leg is the
 * rental total. Any drift here is real money mispriced.
 */
export function checkFeeParity(snapshot: FeeSnapshot, charged: ChargedAmounts): ParityResult {
  const expectedExotiq =
    snapshot.platform_fee_cents +
    snapshot.protection_total_cents +
    snapshot.state_fee_cents +
    snapshot.processing_fee_cents;

  const diffs = [
    {
      leg: "operator" as const,
      expected: snapshot.operator_total_cents,
      actual: charged.operator_charged_cents,
      delta: charged.operator_charged_cents - snapshot.operator_total_cents,
    },
    {
      leg: "exotiq" as const,
      expected: expectedExotiq,
      actual: charged.exotiq_charged_cents,
      delta: charged.exotiq_charged_cents - expectedExotiq,
    },
  ].filter((d) => d.delta !== 0);

  return { ok: diffs.length === 0, expected_exotiq_cents: expectedExotiq, diffs };
}

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);
}
