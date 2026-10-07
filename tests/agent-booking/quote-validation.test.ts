import { describe, expect, it } from 'vitest';
import { validateQuoteForRequest } from '../../supabase/functions/_shared/external-booking/quote-validation';
import { normalizeAuthority } from '../../supabase/functions/_shared/external-booking/quotes';
// Keep synthetic fixtures independent of the consent-unit suite's registration.
const now = Date.parse('2026-10-07T12:00:00Z');
const principal = { subject: 'synthetic-subject', customerId: '40000000-0000-4000-8000-000000000001', issuer: 'https://issuer.example.invalid', audience: 'exotiq-external', clientId: 'synthetic-client', scopes: ['rental_requests:create'] };
const window = { operator_id: '10000000-0000-4000-8000-000000000001', vehicle_id: '20000000-0000-4000-8000-000000000001', pickup_at: '2026-11-01T10:00:00-05:00', return_at: '2026-11-03T10:00:00-05:00', timezone: 'America/New_York', selected_options: ['decline'] };
const current = () => normalizeAuthority({ window, selected_options: ['decline'], availability: 'AVAILABLE', availability_checked_at: new Date(now).toISOString(), pricing: { currency: 'USD', rental_days: 2, daily_rate_cents: 10000, rental_subtotal_cents: 20000, deposit_cents: 0, operator_total_cents: 20000, platform_fee_percent: 10, platform_fee_cents: 2000, protection_tier: 'decline', protection_daily_cents: 0, protection_total_cents: 0, state_fee_cents: 400, processing_fee_cents: 511, exotiq_total_cents: 2911, grand_total_cents: 22911, state_code: 'FL', state_fee_label: 'State rental fee', state_fee_daily_cents: 200, operator_tax_rate: 0, operator_tax_label: 'Tax', operator_tax_cents: 0 }, terms: { operator_tax_inclusive: false, cancellation_policy: '72-hour policy', pickup_address: null, pickup_instructions: null, mileage_limit: 100, mileage_overage_rate: '3.50', deposit_disclosure: 'Separate deposit', currency: 'USD' } });
const snapshot = () => ({ quote_id: '30000000-0000-4000-8000-000000000001', created_at: new Date(now).toISOString(), expires_at: new Date(now + 900000).toISOString(), authority: current(), principal, pricing_version: 'a'.repeat(64), terms_version: 'b'.repeat(64), terms_hash: 'b'.repeat(64), consumed_booking_id: null, holds_inventory: false as const });
const consent = () => ({ id: '50000000-0000-4000-8000-000000000001', quote_id: snapshot().quote_id, customer_id: principal.customerId, operator_id: window.operator_id, issuer: principal.issuer, subject: principal.subject, client_id: principal.clientId, action: 'rental_requests:create', terms_hash: snapshot().terms_hash, expires_at: new Date(now + 900000).toISOString(), consumed_at: null });

describe('quote request preconditions', () => {
  it('returns original immutable values when refreshed authority remains equal', async () => {
    const original = snapshot();
    const refreshed = current(); refreshed.availability_checked_at = new Date(now + 1000).toISOString();
    const result = await validateQuoteForRequest(original, refreshed, principal, consent(), now + 1000);
    expect(result.outcome).toBe('valid');
    expect(result.snapshot).toBe(original);
  });
  it.each(['subject', 'customerId', 'issuer', 'audience', 'clientId'])('rejects different principal %s', async (key) => {
    expect((await validateQuoteForRequest(snapshot(), current(), { ...principal, [key]: 'other' }, consent(), now)).outcome).toBe('consent_mismatch');
  });
  it.each(['quote_id', 'operator_id', 'customer_id', 'issuer', 'subject', 'client_id', 'terms_hash', 'action'])('rejects receipt substitution %s', async (key) => {
    expect((await validateQuoteForRequest(snapshot(), current(), principal, { ...consent(), [key]: 'other' }, now)).outcome).toBe('consent_mismatch');
  });
  it('requires unexpired unused quote and receipt, never extends either deadline', async () => {
    expect((await validateQuoteForRequest(snapshot(), current(), principal, consent(), now + 900000)).outcome).toBe('quote_expired');
    expect((await validateQuoteForRequest({ ...snapshot(), consumed_booking_id: window.vehicle_id }, current(), principal, consent(), now)).outcome).toBe('consent_mismatch');
    expect((await validateQuoteForRequest(snapshot(), current(), principal, { ...consent(), consumed_at: new Date(now).toISOString() }, now)).outcome).toBe('consent_mismatch');
    expect((await validateQuoteForRequest(snapshot(), current(), principal, { ...consent(), expires_at: new Date(now).toISOString() }, now)).outcome).toBe('consent_mismatch');
  });
  it('detects any changed cent, price label, terms, options or rental window', async () => {
    for (const update of [
      (a) => { a.pricing.deposit_cents = 1; },
      (a) => { a.pricing.daily_rate_cents = 10001; },
      (a) => { a.pricing.operator_tax_label = 'Changed tax'; },
      (a) => { a.terms.mileage_limit = 50; },
      (a) => { a.terms.cancellation_policy = 'Nonrefundable'; },
      (a) => { a.window.return_at = '2026-11-04T15:00:00.000Z'; },
    ]) {
      const changed = current(); update(changed);
      expect((await validateQuoteForRequest(snapshot(), changed, principal, consent(), now)).outcome).toBe('quote_changed');
    }
  });
  it('fails safely for unknown authority, stale availability and invalid now', async () => {
    expect((await validateQuoteForRequest(snapshot(), null, principal, consent(), now)).outcome).toBe('upstream_unavailable');
    expect((await validateQuoteForRequest(snapshot(), { ...current(), availability: 'UNKNOWN' }, principal, consent(), now)).outcome).toBe('upstream_unavailable');
    expect((await validateQuoteForRequest(snapshot(), current(), principal, consent(), now + 31000)).outcome).toBe('upstream_unavailable');
    expect((await validateQuoteForRequest(snapshot(), current(), principal, consent(), NaN)).outcome).toBe('upstream_unavailable');
  });
});
