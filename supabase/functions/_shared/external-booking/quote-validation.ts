import { assertQuotePrincipal, normalizeAuthority, quoteFingerprint, type QuotePrincipal, type QuoteSnapshot } from './quotes.ts';

export interface QuoteConsent {
  id: string; quote_id: string; customer_id: string; operator_id: string;
  issuer: string; subject: string; client_id: string; action: string;
  terms_hash: string; expires_at: string; consumed_at: string | null;
}
export type QuoteValidation =
  | { outcome: 'valid'; snapshot: QuoteSnapshot }
  | { outcome: 'quote_changed' | 'quote_expired' | 'consent_mismatch' | 'upstream_unavailable' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Pure preflight, no write/consumption/hold. Never use a preflight result as an
 * atomic guarantee: request RPC06 must lock stored quote AND receipt FOR UPDATE,
 * rerun external_quote_authority in that transaction under inventory serialization,
 * compare full JSONB and both persisted revisions, then insert from stored values
 * and mark both quote/receipt consumed atomically. Client totals are never inputs.
 * Price/terms changes require a NEW quote and NEW hosted consent receipt. Expiry
 * neither releases inventory nor extends an existing booking/approval deadline.
 */
export async function validateQuoteForRequest(snapshot: QuoteSnapshot, currentAuthority: unknown, principal: QuotePrincipal, consent: QuoteConsent, now: number): Promise<QuoteValidation> {
  if (!Number.isFinite(now)) return { outcome: 'upstream_unavailable' };
  if (!snapshot || !snapshot.authority || !snapshot.authority.window || !uuid.test(snapshot.quote_id) ||
    [snapshot.pricing_version,snapshot.terms_version,snapshot.terms_hash].some((hash) => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) ||
    snapshot.terms_hash !== snapshot.terms_version || snapshot.holds_inventory !== false) return { outcome: 'upstream_unavailable' };
  try { assertQuotePrincipal(principal); } catch { return { outcome: 'consent_mismatch' }; }
  if (!snapshot || !snapshot.principal || !consent || !Array.isArray(principal.scopes) || !principal.scopes.includes('rental_requests:create') ||
    ['subject', 'customerId', 'issuer', 'audience', 'clientId'].some((key) => snapshot.principal[key as keyof QuotePrincipal] !== principal[key as keyof QuotePrincipal])) return { outcome: 'consent_mismatch' };
  const expires = Date.parse(snapshot.expires_at), created = Date.parse(snapshot.created_at);
  if (!Number.isFinite(expires) || !Number.isFinite(created) || created > now || expires <= created || expires - created > 900000) return { outcome: 'upstream_unavailable' };
  if (expires <= now) return { outcome: 'quote_expired' };
  if (snapshot.consumed_booking_id !== null || consent.consumed_at !== null || !uuid.test(consent.id) ||
    consent.quote_id !== snapshot.quote_id || consent.customer_id !== principal.customerId ||
    consent.operator_id !== snapshot.authority.window.operator_id || consent.issuer !== principal.issuer ||
    consent.subject !== principal.subject || consent.client_id !== principal.clientId ||
    consent.action !== 'rental_requests:create' || consent.terms_hash !== snapshot.terms_hash ||
    !Number.isFinite(Date.parse(consent.expires_at)) || Date.parse(consent.expires_at) <= now ||
    Date.parse(consent.expires_at) > expires) return { outcome: 'consent_mismatch' };
  try {
    const original = normalizeAuthority(snapshot.authority), current = normalizeAuthority(currentAuthority);
    const checked = Date.parse(current.availability_checked_at);
    if (checked > now || now - checked > 30000) return { outcome: 'upstream_unavailable' };
    if (await quoteFingerprint(original) !== await quoteFingerprint(current)) return { outcome: 'quote_changed' };
    return { outcome: 'valid', snapshot };
  } catch { return { outcome: 'upstream_unavailable' }; }
}
