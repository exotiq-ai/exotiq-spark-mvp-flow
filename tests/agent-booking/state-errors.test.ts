import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BACKEND_STATUSES, ERROR_CODES, SCOPES, validateContract } from '../../supabase/functions/_shared/external-booking/contracts';
import { mapRentalState, mapAvailability, requireBookingRead, computePaymentDueAt } from '../../supabase/functions/_shared/external-booking/state';
import { safeApiError, errorResponse, BookingApiError } from '../../supabase/functions/_shared/external-booking/errors';

const now = Date.parse('2026-10-07T12:00:00Z');
const base = () => ({ status: 'requested', authoritative: true, created_at: '2026-10-06T12:00:00Z', pickup_at: '2026-10-10T12:00:00Z', payment_due_at: null, identity_verified: true, operator_payment: { present: false, settled: false }, exotiq_payment: { present: false, settled: false } });
const paid = () => ({ ...base(), operator_payment: { present: true, settled: true }, exotiq_payment: { present: true, settled: true } });
const requestId = 'synthetic-request-0001';

describe('authoritative booking states', () => {
  it.each(['requested', 'pending'])('%s remains awaiting operator and inventory blocking', (status) => {
    expect(mapRentalState({ ...base(), status }, now)).toMatchObject({ status, next_action: 'await_operator', inventory_blocked: true, can_checkout: false });
  });
  it('maps unverified and fully paid unverified to identity; paid/partial rows cannot simply expire', () => {
    const unpaid = mapRentalState({ ...base(), status: 'pending_documents', identity_verified: false }, now);
    expect(unpaid).toMatchObject({ next_action: 'verify_identity', hold_expires_at: '2026-10-07T12:00:00.000Z', inventory_blocked: true, can_expire: true });
    for (const payment of [paid(), { ...base(), operator_payment: { present: true, settled: false } }]) {
      expect(mapRentalState({ ...payment, status: 'pending_documents', identity_verified: false }, now)).toMatchObject({ next_action: 'verify_identity', hold_expires_at: null, can_expire: false, inventory_blocked: true });
    }
  });
  it('preserves exact 72h hold and blocks until committed terminal transition', () => {
    const state = mapRentalState(base(), Date.parse('2026-10-12T00:00:00Z'));
    expect(state).toMatchObject({ hold_expires_at: '2026-10-09T12:00:00.000Z', inventory_blocked: true, can_expire: true, status: 'requested' });
    expect(mapRentalState({ ...base(), status: 'cancelled' }, now)).toMatchObject({ inventory_blocked: false, next_action: 'cancelled' });
  });
  it('enforces identity, expiry, authoritative leg settlement and prevents second operator checkout', () => {
    const payment = { ...base(), status: 'pending_payment', payment_due_at: '2026-10-08T12:00:00Z' };
    expect(mapRentalState(payment, now)).toMatchObject({ next_action: 'hosted_checkout', can_checkout: true });
    expect(mapRentalState({ ...payment, identity_verified: false }, now).next_action).toBe('verify_identity');
    expect(mapRentalState({ ...payment, identity_verified: null }, now).next_action).toBe('await_reconciliation');
    expect(mapRentalState({ ...payment, operator_payment: { present: true, settled: true } }, now)).toMatchObject({ next_action: 'await_payment_settlement', can_checkout: false });
    expect(mapRentalState({ ...payment, payment_due_at: '2026-10-07T12:00:00Z' }, now)).toMatchObject({ next_action: 'await_reconciliation', can_checkout: false, inventory_blocked: true });
    expect(mapRentalState({ ...paid(), status: 'pending_payment', payment_due_at: payment.payment_due_at }, now).next_action).toBe('await_reconciliation');
  });
  it('rejects stored confirmation without authoritative identity and both settled legs', () => {
    expect(mapRentalState({ ...paid(), status: 'confirmed' }, now).next_action).toBe('confirmed');
    for (const invalid of [base(), { ...paid(), identity_verified: false }, { ...paid(), operator_payment: { present: true, settled: false } }, { ...paid(), exotiq_payment: { present: true, settled: null } }]) expect(() => mapRentalState({ ...invalid, status: 'confirmed' }, now)).toThrow(BookingApiError);
    expect(() => mapRentalState({ ...base(), status: 'active' }, now)).toThrow(BookingApiError);
    expect(mapRentalState({ ...paid(), status: 'active' }, now).next_action).toBe('rental_active');
  });
  it.each(['declined', 'cancelled', 'completed', 'refunded'])('maps actual terminal %s without hold or checkout', (status) => {
    expect(mapRentalState({ ...base(), status }, now)).toMatchObject({ status, next_action: status, hold_expires_at: null, inventory_blocked: false, can_checkout: false });
  });
  it('uses exact source booking CHECK states, payment_expired terminal and cancelled hold expiry', () => {
    const source = readFileSync('supabase/migrations/20260724015013_c1c8f150-af28-400e-8b5d-aae1e1515305.sql', 'utf8');
    const check = /CHECK \(status = ANY \(ARRAY\[([\s\S]*?)\]\)\)/.exec(source)![1];
    expect([...check.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort()).toEqual([...BACKEND_STATUSES].sort());
    expect(mapRentalState({ ...base(), status: 'payment_expired' }, now)).toMatchObject({ status: 'payment_expired', next_action: 'expired', inventory_blocked: false });
    expect(() => mapRentalState({ ...base(), status: 'expired' }, now)).toThrow(BookingApiError);
    const expiry = readFileSync('supabase/migrations/20260728152708_256354b7-9f0f-4e1d-a9a0-33e45ca82d04.sql', 'utf8');
    expect(expiry).toContain("SET status = 'cancelled'");
    expect(expiry).toContain("'unverified_hold_expired'");
  });
  it('fails safely on unknown status, unverified source and invalid dates', () => {
    for (const override of [{ status: 'approved' }, { authoritative: false }, { created_at: 'bad' }, { created_at: '2026-02-30T12:00:00Z' }, { created_at: '2026-10-09T12:00:00Z' }, { status: 'pending_payment', payment_due_at: null }]) expect(() => mapRentalState({ ...base(), ...override }, now)).toThrow(BookingApiError);
    expect(new Set(BACKEND_STATUSES).size).toBe(11);
  });
  it('preserves the exact approval payment deadline policy in UTC', () => {
    expect(computePaymentDueAt('2026-10-15T12:00:00-04:00', '2026-10-07T12:00:00Z')).toBe('2026-10-09T12:00:00.000Z');
    expect(computePaymentDueAt('2026-10-08T12:00:00-04:00', '2026-10-07T12:00:00Z')).toBe('2026-10-08T14:00:00.000Z');
    expect(() => computePaymentDueAt('bad', 'bad')).toThrow(BookingApiError);
  });
  it('keeps UNKNOWN distinct from available, including failure/null', () => {
    expect(mapAvailability(true, true)).toEqual({ availability: 'AVAILABLE' });
    expect(mapAvailability(false, true)).toEqual({ availability: 'UNAVAILABLE' });
    for (const available of [true, false, null]) expect(mapAvailability(available, false).availability).toBe('UNKNOWN');
    expect(mapAvailability(null, true)).toEqual({ availability: 'UNKNOWN', reason_code: 'upstream_unavailable', retry_after_seconds: 30 });
  });
  it('makes wrong-customer, operator, grant, scope and missing lookups indistinguishable', () => {
    const access = { bookingExists: true, customerMatches: true, operatorMatches: true, grantActive: true, scopeGranted: true };
    expect(() => requireBookingRead(access)).not.toThrow();
    const failures = Object.keys(access).map((key) => {
      try { requireBookingRead({ ...access, [key]: false }); } catch (error) { return safeApiError(error, requestId); }
    });
    for (const failure of failures) expect(failure).toEqual(safeApiError(new BookingApiError('not_found'), requestId));
  });
});
describe('safe structured errors and scopes', () => {
  const statuses = { invalid_input: 400, unauthorized: 401, forbidden: 403, not_found: 404, dates_unavailable: 409, quote_changed: 409, idempotency_conflict: 409, request_in_flight: 409, consent_mismatch: 409, quote_expired: 410, consent_expired: 410, payment_window_expired: 410, grant_expired:409,grant_revoked:409,configuration_unavailable:503,external_writes_disabled:503,rate_limited: 429, upstream_unavailable: 503 };
  it.each(ERROR_CODES)('maps %s with no exception, token or customer disclosure', async (code) => {
    const error = new BookingApiError(code);
    expect(safeApiError(error, requestId).status).toBe(statuses[code]);
    expect(validateContract('ApiError', safeApiError(error, requestId).body).ok).toBe(true);
    const response = errorResponse(error, requestId);
    expect(response.status).toBe(statuses[code]);
    if (code === 'unauthorized') expect(response.headers.get('WWW-Authenticate')).toContain('Bearer');
    if (code === 'rate_limited') expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('redacts unexpected errors, values, injected ids and arbitrary detail keys', () => {
    const unexpected = safeApiError(new Error('postgres://secret?token=raw customer_email@example.com'), 'raw\r\nsecret');
    expect(unexpected.body.code).toBe('upstream_unavailable');
    expect(JSON.stringify(unexpected)).not.toMatch(/postgres|raw|customer_email|secret/);
    const error = new BookingApiError('invalid_input', { field: 'quote_id', token: 'raw', message: 'raw' } as never);
    expect(safeApiError(error, requestId).body.details).toEqual({ field: 'quote_id' });
    expect(safeApiError(new BookingApiError('rate_limited', { retry_after_seconds: 90000 }), requestId).body.details?.retry_after_seconds).toBe(30);
  });
  it('documents only customer capabilities with no agent approval or payment authority', () => {
    expect(SCOPES).toEqual(['catalog:read', 'quotes:create', 'rental_requests:create', 'rental_requests:read', 'checkout:handoff', 'identity:handoff']);
    expect(SCOPES.join(' ')).not.toMatch(/approval|approve|charge/);
  });
});

it('reports in-flight contention with bounded same-key retry guidance',()=>{
 for(const delay of [0,1,5,6,3600,NaN]){
  const result=safeApiError(new BookingApiError('request_in_flight' as any,{retry_after_seconds:delay}),requestId);
  expect(result.status).toBe(409);expect(result.body.code).toBe('request_in_flight');expect(result.body.retryable).toBe(true);expect(Number(result.headers['Retry-After'])).toBeGreaterThanOrEqual(1);expect(Number(result.headers['Retry-After'])).toBeLessThanOrEqual(5);
 }
});
