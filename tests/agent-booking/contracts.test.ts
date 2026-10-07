import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { schemas, validateContract, validateRentalWindow, bindCursor, verifyCursor, generateOpenApi, validateIdempotencyKey } from '../../supabase/functions/_shared/external-booking/contracts';

const operator = '10000000-0000-4000-8000-000000000001';
const vehicle = '20000000-0000-4000-8000-000000000001';
const window = { operator_id: operator, vehicle_id: vehicle, pickup_at: '2026-11-01T01:30:00-04:00', return_at: '2026-11-03T10:00:00-05:00', timezone: 'America/New_York' };
const quote = () => ({ ...window, api_version: 'v1', source_checked_at: '2026-10-07T12:00:00Z', quote_id: '30000000-0000-4000-8000-000000000001', principal_scope: { subject: 'synthetic-customer', operator_id: operator }, expires_at: '2026-10-07T12:15:00Z', pricing_version: 'price-1', terms_version: 'terms-1', terms_hash: 'a'.repeat(64), selected_options: ['premium'], currency: 'USD', terms: { cancellation_policy: 'Synthetic cancellation policy', pickup_address: 'Synthetic pickup location', pickup_instructions: null, mileage_limit: 200, mileage_overage_rate_usd: '0.75', deposit_disclosure: 'Security deposit is separate from rental charges.' }, pricing_details: { rental_days: 2, daily_rate_cents: 10000, protection_tier: 'premium', protection_daily_cents: 28900, state_code: 'FL', state_fee_label: 'Florida rental surcharge', state_fee_daily_cents: 200, operator_tax_label: 'Tax', operator_tax_rate_percent: '6', platform_fee_percent: '10' }, itemization: { rental_subtotal_cents: 20000, operator_tax_cents: 1200, operator_tax_inclusive: false, platform_fee_cents: 2000, protection_total_cents: 57800, state_fee_cents: 400, processing_fee_cents: 2187, deposit_cents: 0 }, operator_total_cents: 21200, exotiq_total_cents: 62387, total_cents: 83587, payment_schedule: [{ payee: 'operator', amount_cents: 21200, due: 'after_operator_approval' }, { payee: 'exotiq', amount_cents: 62387, due: 'after_operator_charge' }], availability_checked_at: '2026-10-07T12:00:00Z', holds_inventory: false, consent_url: 'https://agent-test.example.invalid/consent' });

describe('canonical contracts', () => {
  it('accepts exact quote sums and rejects inconsistent totals and payment schedule', () => {
    expect(validateContract('QuoteResult', quote()).ok).toBe(true);
    expect(validateContract('QuoteResult', { ...quote(), total_cents: 83588 }).ok).toBe(false);
    expect(validateContract('QuoteResult', { ...quote(), operator_total_cents: 20000 }).ok).toBe(false);
    const wrong = quote(); wrong.payment_schedule[0].amount_cents++;
    expect(validateContract('QuoteResult', wrong).ok).toBe(false);
  });
  it('requires readable pricing and customer terms, and refuses private extra fields', () => {
    expect(validateContract('QuoteResult', quote()).ok).toBe(true);
    const absent = quote() as Record<string, unknown>; delete absent.terms;
    expect(validateContract('QuoteResult', absent).ok).toBe(false);
    expect(validateContract('QuoteResult', { ...quote(), terms: { ...quote().terms, document_url: 'private' } }).ok).toBe(false);
    expect(validateContract('QuoteResult', { ...quote(), pricing_details: { ...quote().pricing_details, rental_days: 3 } }).ok).toBe(false);
    expect(validateContract('QuoteResult', { ...quote(), terms: { ...quote().terms, mileage_overage_rate_usd: '-1' } }).ok).toBe(false);
  });
  it('handles tax included in rental without double counting it or charging deposit as rental', () => {
    const included = quote(); included.itemization.operator_tax_inclusive = true;
    included.operator_total_cents = 20000; included.total_cents = 82387; included.payment_schedule[0].amount_cents = 20000;
    included.itemization.deposit_cents = 100000;
    expect(validateContract('QuoteResult', included).ok).toBe(true);
  });
  it.each(['total_cents', 'status', 'customer_id', 'confirmation_token'])('rejects client substitution %s', (key) => {
    expect(validateContract('RentalRequestInput', { quote_id: quote().quote_id, consent_receipt_id: operator, [key]: 'untrusted' }).ok).toBe(false);
    expect(validateContract('QuoteRequest', { ...window, selected_options: ['premium'], [key]: 1 }).ok).toBe(false);
  });
  it('rejects unsafe amounts, ids, options, schemas and unbounded discovery', () => {
    const bad = quote(); bad.itemization.rental_subtotal_cents = Number.MAX_SAFE_INTEGER + 1;
    expect(validateContract('QuoteResult', bad).ok).toBe(false);
    expect(validateContract('AvailabilityRequest', { ...window, vehicle_id: 'no' }).ok).toBe(false);
    expect(validateContract('QuoteRequest', { ...window, selected_options: ['invented'] }).ok).toBe(false);
    expect(validateContract('OperatorsQuery', { limit: 51 }).ok).toBe(false);
    expect(validateContract('OperatorsQuery', { city: 'a'.repeat(81) }).ok).toBe(false);
    expect(validateContract('QuoteResult', { ...quote(), expires_at: '2026-02-30T10:00:00Z' }).ok).toBe(false);
    expect(validateContract('QuoteResult', { ...quote(), currency: 'XYZ' }).ok).toBe(false);
  });
  it('checks offset and calendar validity including both DST fold instants and spring gap', () => {
    expect(validateRentalWindow(window, { now: Date.parse('2026-10-07T12:00:00Z'), tenantTimezone: 'America/New_York' }).ok).toBe(true);
    expect(validateRentalWindow({ ...window, pickup_at: '2026-11-01T01:30:00-05:00' }).ok).toBe(true);
    for (const pickup_at of ['2026-03-08T02:30:00-05:00', '2026-11-01T01:30:00Z', '2026-02-30T10:00:00-05:00', '2026-11-01T01:30:00-00:00']) {
      expect(validateRentalWindow({ ...window, pickup_at }).ok).toBe(false);
    }
    expect(validateRentalWindow(window, { tenantTimezone: 'America/Chicago' }).ok).toBe(false);
    expect(validateRentalWindow({ ...window, timezone: 'UTC' }).ok).toBe(false);
    expect(validateRentalWindow({ ...window, return_at: window.pickup_at }).ok).toBe(false);
    expect(validateRentalWindow({ ...window, return_at: '2026-11-01T14:30:00-05:00' }).ok).toBe(false);
    expect(validateRentalWindow({ ...window, return_at: '2027-11-03T10:00:00-04:00' }).ok).toBe(false);
    expect(validateRentalWindow(window, { now: Date.parse('2026-12-01T00:00:00Z') }).ok).toBe(false);
  });
  it('requires safe idempotency keys', () => {
    expect(validateIdempotencyKey('synthetic-retry-001')).toBe(true);
    for (const key of ['', 'short', 'a'.repeat(129), 'x'.repeat(16) + '\r\nInjected: bad']) expect(validateIdempotencyKey(key)).toBe(false);
  });
  it('authenticates opaque cursors and binds operation, normalized filters, expiry and size', async () => {
    const key = new Uint8Array(32).fill(7);
    const context = { operation: 'vehicles', filters: { operator_id: operator, city: 'Miami' }, now: 1000 };
    const token = await bindCursor({ after: vehicle, expires_at: 5000 }, context, key);
    expect(await verifyCursor(token, { ...context, filters: { city: 'Miami', operator_id: operator } }, key)).toEqual({ after: vehicle, expires_at: 5000 });
    for (const input of [token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), 'x'.repeat(2049), '{}']) await expect(verifyCursor(input, context, key)).rejects.toThrow('Invalid cursor');
    await expect(verifyCursor(token, { ...context, filters: { city: 'Tampa' } }, key)).rejects.toThrow('Invalid cursor');
    await expect(verifyCursor(token, { ...context, operation: 'operators' }, key)).rejects.toThrow('Invalid cursor');
    await expect(verifyCursor(token, { ...context, now: 5000 }, key)).rejects.toThrow('Invalid cursor');
  });
  it('exposes tri-state availability without inventing success or leaking exceptions', () => {
    const result = { api_version: 'v1', source_checked_at: '2026-10-07T12:00:00Z', ...window, availability: 'UNKNOWN', buffer_policy_version:null, reason_code: 'upstream_unavailable', retry_after_seconds: 30 };
    expect(validateContract('AvailabilityResult', result).ok).toBe(true);
    expect(validateContract('AvailabilityResult', { ...result, availability: 'AVAILABLE' }).ok).toBe(false);
    expect(validateContract('AvailabilityResult', { ...result, error: 'secret-db-connection' }).ok).toBe(false);
    const known={api_version:'v1',source_checked_at:result.source_checked_at,...window,availability:'AVAILABLE',buffer_policy_version:'post-return-snapshot-v1/60'};
    expect(validateContract('AvailabilityResult',known).ok).toBe(true);
    expect(validateContract('AvailabilityResult',{...known,buffer_policy_version:null}).ok).toBe(false);
    expect(validateContract('AvailabilityResult',{...result,buffer_policy_version:known.buffer_policy_version}).ok).toBe(false);
  });
  it('generates exact OpenAPI with schema references, scopes, responses, idempotency and conditional status', () => {
    const api = generateOpenApi();
    expect(api.openapi).toBe('3.1.2');
    expect(Object.keys(api.paths)).toHaveLength(21);
    expect(api.components.schemas).toEqual(schemas);
    expect(JSON.parse(readFileSync('docs/external-booking/openapi.yaml', 'utf8'))).toEqual(api);
    for (const path of Object.values(api.paths)) for (const operation of Object.values(path)) {
      expect(operation.security.length).toBeGreaterThan(0);
      expect(operation.responses['503']).toBeDefined();
    }
    const submit = api.paths['/v1/rental-requests'].post;
    expect(submit.parameters.some((p) => p.name === 'Idempotency-Key' && p.required)).toBe(true);
    expect(submit.responses['200']).toBeDefined(); expect(submit.responses['201']).toBeDefined();
    expect(api.paths['/v1/rental-requests/{ref}'].get.responses['304'].content).toBeUndefined();
    expect(api.components.securitySchemes.customerOAuth.flows.authorizationCode.scopes).not.toHaveProperty('approval');
  });
});
