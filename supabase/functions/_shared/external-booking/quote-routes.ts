import { validateContract } from './contracts.ts';
import { BookingApiError } from './errors.ts';
import { jsonResponse, type CatalogRepository } from './catalog-routes.ts';
import { createQuote, type QuoteInput, type QuoteStore, type QuotePrincipal } from './quotes.ts';
import type { createResourceAuthenticator } from './auth.ts';
export type ResourceAuth = ReturnType<typeof createResourceAuthenticator>;
export async function availabilityResponse(input: unknown, repository: CatalogRepository, now: number): Promise<Response> {
  if (!validateContract('AvailabilityRequest', input, { now }).ok) throw new BookingApiError('invalid_input');
  const window = input as QuoteInput;
  const target = await repository.target(window.operator_id, window.vehicle_id);
  if (!target) throw new BookingApiError('not_found');
  if (!validateContract('AvailabilityRequest', input, { now, tenantTimezone: target.timezone }).ok) throw new BookingApiError('invalid_input');
  let available: boolean | null = null;
  try { available = await repository.availability(target, window.pickup_at, window.return_at); } catch { /* deliberate UNKNOWN observation, no fabricated empty intervals */ }
  const result = { api_version: 'v1', source_checked_at: new Date(now).toISOString(), ...window,
    ...(typeof available === 'boolean' ? { availability: available ? 'AVAILABLE' : 'UNAVAILABLE' } : { availability: 'UNKNOWN', reason_code: 'upstream_unavailable', retry_after_seconds: 30 }) };
  if (!validateContract('AvailabilityResult', result).ok) throw new BookingApiError('upstream_unavailable');
  return jsonResponse(result);
}
export async function quoteResponse(input: unknown, request: Request, repository: CatalogRepository, auth: ResourceAuth | null, store: QuoteStore | null, consentOrigin: string, now: number): Promise<Response> {
  if (!validateContract('QuoteRequest', input, { now }).ok) throw new BookingApiError('invalid_input');
  if (!auth || !store) throw new BookingApiError('upstream_unavailable');
  const window = input as QuoteInput;
  const target = await repository.target(window.operator_id, window.vehicle_id);
  if (!target) throw new BookingApiError('not_found');
  if (!validateContract('QuoteRequest', input, { now, tenantTimezone: target.timezone }).ok) throw new BookingApiError('invalid_input');
  const principal = await auth.requirePrincipal(request, 'quotes:create', target.operator_id);
  const quote = await createQuote(window, principal as QuotePrincipal, store, now);
  const p = quote.authority.pricing, terms = quote.authority.terms;
  const consent = new URL(`/external/consent/${quote.quote_id}`, consentOrigin);
  const result = { api_version: 'v1', source_checked_at: quote.created_at, ...window, quote_id: quote.quote_id,
    principal_scope: { subject: principal.subject, operator_id: window.operator_id }, expires_at: quote.expires_at,
    pricing_version: quote.pricing_version, terms_version: quote.terms_version, terms_hash: quote.terms_hash,
    terms: { cancellation_policy: terms.cancellation_policy, pickup_address: terms.pickup_address, pickup_instructions: terms.pickup_instructions,
      mileage_limit: terms.mileage_limit, mileage_overage_rate_usd: terms.mileage_overage_rate, deposit_disclosure: terms.deposit_disclosure },
    pricing_details: { rental_days: p.rental_days, daily_rate_cents: p.daily_rate_cents, protection_tier: p.protection_tier,
      protection_daily_cents: p.protection_daily_cents, state_code: p.state_code, state_fee_label: p.state_fee_label,
      state_fee_daily_cents: p.state_fee_daily_cents, operator_tax_label: p.operator_tax_label,
      operator_tax_rate_percent: terms.operator_tax_rate_percent ?? String(p.operator_tax_rate), platform_fee_percent: terms.platform_fee_percent ?? String(p.platform_fee_percent) },
    currency: p.currency, itemization: { rental_subtotal_cents: p.rental_subtotal_cents, operator_tax_cents: p.operator_tax_cents,
      operator_tax_inclusive: terms.operator_tax_inclusive, platform_fee_cents: p.platform_fee_cents,
      protection_total_cents: p.protection_total_cents, state_fee_cents: p.state_fee_cents,
      processing_fee_cents: p.processing_fee_cents, deposit_cents: p.deposit_cents },
    operator_total_cents: p.operator_total_cents, exotiq_total_cents: p.exotiq_total_cents, total_cents: p.grand_total_cents,
    payment_schedule: [{ payee: 'operator', amount_cents: p.operator_total_cents, due: 'after_operator_approval' },
      { payee: 'exotiq', amount_cents: p.exotiq_total_cents, due: 'after_operator_charge' }],
    availability_checked_at: quote.authority.availability_checked_at, holds_inventory: false, consent_url: consent.href };
  if (!validateContract('QuoteResult', result, { now }).ok) throw new BookingApiError('upstream_unavailable');
  return jsonResponse(result, 201);
}
