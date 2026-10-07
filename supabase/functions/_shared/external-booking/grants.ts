import { BookingApiError } from './errors.ts';
import type { Principal } from './auth.ts';

export type GrantAction = 'rental_requests:read' | 'checkout:handoff';
export interface BookingGrant { id: string; issuer: string; subject: string; clientId: string; customerId: string; operatorId: string; bookingId: string; actions: readonly GrantAction[]; expiresAt: string; revokedAt: string | null; }
export interface GrantTarget { grantId: string; operatorId: string; bookingId: string; }
export interface GrantStore { getGrant: (id: string) => Promise<BookingGrant | null>; }
export class GrantAccessError extends BookingApiError {
  readonly reason: 'grant_expired' | 'grant_revoked';
  constructor(reason: 'grant_expired' | 'grant_revoked') { super('forbidden'); this.reason = reason; }
}
function exactOwner(row: BookingGrant, principal: Principal, target: GrantTarget): boolean {
  return !!principal.customerId && principal.operatorId === target.operatorId && row.id === target.grantId && row.operatorId === target.operatorId && row.bookingId === target.bookingId && row.customerId === principal.customerId && row.issuer === principal.issuer && row.subject === principal.subject && row.clientId === principal.clientId;
}
/** A recovery disposition authorizes no operation. Fresh customer authentication
 * and explicit review are mandatory at hosted completion in plan 08. */
export function recoveryDisposition(grant: BookingGrant, principal: Principal, target: GrantTarget, now = new Date()): 'active' | 'fresh_customer_authorization' | 'explicit_new_delegation' {
  if (!exactOwner(grant, principal, target)) throw new BookingApiError('not_found');
  if (grant.revokedAt !== null) return 'explicit_new_delegation';
  const expiry = Date.parse(grant.expiresAt);
  if (!Number.isFinite(expiry) || !Number.isFinite(now.getTime())) throw new BookingApiError('upstream_unavailable');
  return expiry <= now.getTime() ? 'fresh_customer_authorization' : 'active';
}
export async function requireBookingGrant(store: GrantStore, principal: Principal, target: GrantTarget, action: GrantAction, now = new Date()): Promise<BookingGrant> {
  let grant;
  try { grant = await store.getGrant(target.grantId); } catch { throw new BookingApiError('upstream_unavailable'); }
  if (!grant || !exactOwner(grant, principal, target)) throw new BookingApiError('not_found');
  const disposition = recoveryDisposition(grant, principal, target, now);
  if (disposition === 'explicit_new_delegation') throw new GrantAccessError('grant_revoked');
  if (disposition === 'fresh_customer_authorization') throw new GrantAccessError('grant_expired');
  if (!principal.scopes.includes(action) || !grant.actions.includes(action)) throw new BookingApiError('forbidden');
  return grant;
}
export interface ConsentReceipt { id: string; issuer: string; subject: string; clientId: string; customerId: string; operatorId: string; quoteId: string; termsHash: string; action: string; expiresAt: string; consumedAt: string | null; }
export interface ReceiptBinding { operatorId: string; quoteId: string; termsHash: string; action: 'rental_requests:create'; }
/** Policy assertion only; authoritative consumption MUST occur with the booking
 * and durable retry ledger in one database transaction (plan 06). */
export function assertReceiptBinding(receipt: ConsentReceipt, principal: Principal, binding: ReceiptBinding, now = new Date()): void {
  if (!principal.customerId || principal.operatorId !== binding.operatorId || receipt.issuer !== principal.issuer || receipt.subject !== principal.subject || receipt.clientId !== principal.clientId || receipt.customerId !== principal.customerId || receipt.operatorId !== binding.operatorId || receipt.quoteId !== binding.quoteId || receipt.termsHash !== binding.termsHash || receipt.action !== binding.action || receipt.consumedAt !== null) throw new BookingApiError('consent_mismatch');
  const expiry = Date.parse(receipt.expiresAt);
  if (!Number.isFinite(expiry) || !Number.isFinite(now.getTime())) throw new BookingApiError('upstream_unavailable');
  if (expiry <= now.getTime()) throw new BookingApiError('consent_expired');
}
export function safeGrantAudit(grant: BookingGrant, action: 'created' | 'revoked' | 'renewed') {
  return { grant_id: grant.id, operator_id: grant.operatorId, booking_id: grant.bookingId, action };
}
