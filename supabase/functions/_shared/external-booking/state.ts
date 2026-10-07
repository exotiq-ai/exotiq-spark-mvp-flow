import { BACKEND_STATUSES, NEXT_ACTIONS, timestampInstant } from './contracts.ts';
import { BookingApiError } from './errors.ts';

export type BackendStatus = typeof BACKEND_STATUSES[number];
export const INVENTORY_BLOCKING_STATUSES: readonly BackendStatus[] = ['pending_documents', 'requested', 'pending_payment', 'pending', 'confirmed', 'active'];
export interface StateEvidence {
  status: string;
  authoritative: boolean;
  created_at: string;
  pickup_at: string;
  payment_due_at: string | null;
  identity_verified: boolean | null;
  reconciliation_pending?: boolean;
  operator_payment: { present: boolean; settled: boolean | null };
  exotiq_payment: { present: boolean; settled: boolean | null };
}
const hours = (count: number) => count * 3600000;
function timestamp(value: string): number {
  const instant = timestampInstant(value);
  if (instant === null) throw new BookingApiError('upstream_unavailable');
  return instant;
}
/** Matches current _shared/rentFormat.ts: min(approval+48h,pickup-2h).
 * Deadline does not cancel a row; actual reconciliation/state transition owns release.
 */
export function computePaymentDueAt(pickupAt: string, approvedAt: string): string {
  return new Date(Math.min(timestamp(approvedAt) + hours(48), timestamp(pickupAt) - hours(2))).toISOString();
}

/** Read-only projection, never a state machine writer or expiry scheduler.
 * Evidence must be loaded under verified principal/booking scope and settlement
 * reconciliation. Payment-intent IDs, UI redirects, email matches and annotations
 * alone are insufficient evidence. 'none_required' Exotiq reference requires an
 * authoritative zero charge/ledger proof before settled=true.
 */
export function mapRentalState(evidence: StateEvidence, now: number) {
  if (!evidence.authoritative || !Number.isFinite(now) || !(BACKEND_STATUSES as readonly string[]).includes(evidence.status)) throw new BookingApiError('upstream_unavailable');
  const created = timestamp(evidence.created_at);
  timestamp(evidence.pickup_at);
  if (created > now) throw new BookingApiError('upstream_unavailable');
  const status = evidence.status as BackendStatus;
  const inventory_blocked = INVENTORY_BLOCKING_STATUSES.includes(status);
  const noFinancialActivity = evidence.operator_payment.present === false && evidence.exotiq_payment.present === false && evidence.operator_payment.settled === false && evidence.exotiq_payment.settled === false;
  const fullySettled = evidence.operator_payment.settled === true && evidence.exotiq_payment.settled === true;
  const paymentDue = evidence.payment_due_at === null ? null : timestamp(evidence.payment_due_at);
  const payment_due_at = paymentDue === null ? null : new Date(paymentDue).toISOString();
  let next_action: typeof NEXT_ACTIONS[number];
  let deadline: number | null = null;
  let can_checkout = false;
  switch (status) {
    case 'pending_documents':
      next_action = 'verify_identity';
      // Source expire_unverified_holds explicitly excludes any paid/partial leg.
      if (noFinancialActivity) deadline = created + hours(24);
      break;
    case 'requested':
      next_action = 'await_operator';
      if (noFinancialActivity) deadline = created + hours(72);
      break;
    case 'pending':
      next_action = 'await_operator';
      // Legacy pending has no documented 24h/72h marketplace expiry policy.
      break;
    case 'pending_payment':
      if (paymentDue === null) throw new BookingApiError('upstream_unavailable');
      deadline = paymentDue;
      if (evidence.identity_verified === false) next_action = 'verify_identity';
      else if (evidence.identity_verified !== true || evidence.reconciliation_pending === true || fullySettled || paymentDue <= now || evidence.operator_payment.settled === null || evidence.exotiq_payment.settled === null) next_action = 'await_reconciliation';
      else if (evidence.operator_payment.present || evidence.exotiq_payment.present || evidence.operator_payment.settled || evidence.exotiq_payment.settled) next_action = 'await_payment_settlement';
      else { next_action = 'hosted_checkout'; can_checkout = true; }
      break;
    case 'confirmed':
    case 'active':
      // Preserve stored source state; refuse unsafe API projection rather than
      // relabeling an unproven stored confirmed row as another invented state.
      if (evidence.identity_verified !== true || !fullySettled) throw new BookingApiError('upstream_unavailable');
      next_action = status === 'confirmed' ? 'confirmed' : 'rental_active';
      break;
    case 'payment_expired': next_action = 'expired'; break;
    default: next_action = status;
  }
  return {
    status, next_action, inventory_blocked,
    hold_expires_at: deadline === null ? null : new Date(deadline).toISOString(), payment_due_at,
    can_expire: (status === 'pending_documents' || status === 'requested') && noFinancialActivity && deadline !== null && deadline <= now,
    can_checkout,
  };
}
export function mapAvailability(available: boolean | null, authoritative: boolean) {
  if (!authoritative || typeof available !== 'boolean') return { availability: 'UNKNOWN' as const, reason_code: 'upstream_unavailable' as const, retry_after_seconds: 30 };
  return { availability: available ? 'AVAILABLE' as const : 'UNAVAILABLE' as const };
}
/** Route authorization layer supplies trusted lookup/grant predicates after JWT
 * verification. Never derive them from caller booleans, ref possession or email.
 * Missing and every cross-tenant/customer/revoked/expired/scope miss are identical.
 */
export function requireBookingRead(access: { bookingExists: boolean; customerMatches: boolean; operatorMatches: boolean; grantActive: boolean; scopeGranted: boolean }): void {
  if (access.bookingExists !== true || access.customerMatches !== true || access.operatorMatches !== true || access.grantActive !== true || access.scopeGranted !== true) throw new BookingApiError('not_found');
}
