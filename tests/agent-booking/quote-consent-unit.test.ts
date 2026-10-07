import { describe, expect, it } from 'vitest';
import { createQuote, quoteFingerprint, normalizeAuthority, SupabaseQuoteStore } from '../../supabase/functions/_shared/external-booking/quotes';

const now = Date.parse('2026-10-07T12:00:00Z');
export const principal = { subject: 'synthetic-subject', customerId: '40000000-0000-4000-8000-000000000001', issuer: 'https://issuer.example.invalid', audience: 'exotiq-external', clientId: 'synthetic-client', scopes: ['quotes:create'] };
export const request = { operator_id: '10000000-0000-4000-8000-000000000001', vehicle_id: '20000000-0000-4000-8000-000000000001', pickup_at: '2026-11-01T10:00:00-05:00', return_at: '2026-11-03T10:00:00-05:00', timezone: 'America/New_York', selected_options: ['premium'] };
export const authority = () => ({ window: request, selected_options: ['premium'], availability: 'AVAILABLE', availability_checked_at: '2026-10-07T12:00:00Z', pricing: { currency: 'USD', rental_days: 2, daily_rate_cents: '10000', rental_subtotal_cents: '20000', deposit_cents: '0', operator_total_cents: '21200', platform_fee_percent: 10, platform_fee_cents: '2000', protection_tier: 'premium', protection_daily_cents: '28900', protection_total_cents: '57800', state_fee_cents: '400', processing_fee_cents: '2187', exotiq_total_cents: '62387', grand_total_cents: '83587', state_code: 'FL', state_fee_label: 'State rental fee', state_fee_daily_cents: '200', operator_tax_rate: 6, operator_tax_label: 'Tax', operator_tax_cents: '1200' }, terms: { operator_tax_inclusive: false, cancellation_policy: 'Cancel until 72 hours before pickup.', pickup_address: 'Synthetic Miami location', pickup_instructions: null, mileage_limit: 100, mileage_overage_rate: '3.50', deposit_disclosure: 'No deposit charged in this quote.', currency: 'USD' } });

describe('immutable persisted quote boundary', () => {
  it('passes only validated principal/window/options to durable RPC; returns original split without repricing', async () => {
    const calls: unknown[] = [];
    const store = { create: async (input: unknown) => { calls.push(input); return { quote_id: crypto.randomUUID(), created_at: new Date(now).toISOString(), expires_at: new Date(now + 900000).toISOString(), authority: authority(), principal, pricing_version: 'a'.repeat(64), terms_version: 'b'.repeat(64), terms_hash: 'b'.repeat(64) }; } };
    const quote = await createQuote(request, principal, store, now);
    expect(quote.authority.pricing.operator_total_cents).toBe(21200);
    expect(quote.authority.pricing.exotiq_total_cents).toBe(62387);
    expect(quote.holds_inventory).toBe(false);
    expect(calls).toHaveLength(1);
    expect(Object.isFrozen(quote.authority.terms)).toBe(true);
    expect(() => { quote.authority.terms.mileage_limit = 999; }).toThrow();
    expect(quote.expires_at).toBe('2026-10-07T12:15:00.000Z');
  });
  it('rejects caller amounts/options and missing scope before persistence', async () => {
    let writes = 0; const store = { create: async () => { writes++; throw new Error(); } };
    await expect(createQuote({ ...request, total_cents: 1 }, principal, store, now)).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(createQuote({ ...request, selected_options: ['invented'] }, principal, store, now)).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(createQuote(request, { ...principal, scopes: [] }, store, now)).rejects.toMatchObject({ code: 'forbidden' });
    expect(writes).toBe(0);
  });
  it('fingerprints every visible price and policy rather than timestamps or key order', async () => {
    const original = normalizeAuthority(authority());
    const hash = await quoteFingerprint(original);
    expect(await quoteFingerprint({ ...original, availability_checked_at: '2026-10-07T12:01:00Z' })).toBe(hash);
    for (const field of ['daily_rate_cents', 'deposit_cents', 'platform_fee_percent', 'operator_tax_label', 'processing_fee_cents']) {
      const changed = structuredClone(original); changed.pricing[field] = typeof changed.pricing[field] === 'number' ? changed.pricing[field] + 1 : 'changed';
      expect(await quoteFingerprint(changed)).not.toBe(hash);
    }
    for (const field of ['cancellation_policy', 'mileage_overage_rate', 'pickup_instructions', 'deposit_disclosure']) {
      const changed = structuredClone(original); changed.terms[field] = 'changed';
      expect(await quoteFingerprint(changed)).not.toBe(hash);
    }
  });
  it('does not round strings/floats or accept unknown/failed authority', () => {
    for (const amount of ['1.1', '9007199254740992', -1, 1.1, null]) {
      const bad = authority(); bad.pricing.daily_rate_cents = amount as string;
      expect(() => normalizeAuthority(bad)).toThrow();
    }
    expect(() => normalizeAuthority({ ...authority(), availability: 'UNKNOWN' })).toThrow();
    const missing = authority(); delete (missing.terms as Record<string, unknown>).cancellation_policy;
    expect(() => normalizeAuthority(missing)).toThrow();
    const wrong = authority(); wrong.pricing.grand_total_cents = '83588';
    expect(() => normalizeAuthority(wrong)).toThrow();
  });
  it('uses real configured Supabase RPC persistence and sanitizes failures', async () => {
    const calls: unknown[] = [];
    const store = new SupabaseQuoteStore({ rpc: async (name, args) => { calls.push({ name, args }); return { data: null, error: { message: 'secret' } }; } });
    await expect(createQuote(request, principal, store, now)).rejects.toMatchObject({ code: 'upstream_unavailable' });
    expect(calls[0].name).toBe('external_create_quote');
    expect(JSON.stringify(calls)).not.toContain('total_cents');
  });
});
