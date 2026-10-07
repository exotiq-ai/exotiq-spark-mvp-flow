import { validateContract } from './contracts.ts';
import { BookingApiError, errorResponse } from './errors.ts';
import { jsonResponse, type CatalogRepository, type AvailabilityObservation } from './catalog-routes.ts';
import { createQuote, type QuoteInput, type QuoteStore, type QuotePrincipal, type QuoteSnapshot, publicQuoteWindow } from './quotes.ts';
import type { createResourceAuthenticator } from './auth.ts';
export type ResourceAuth = ReturnType<typeof createResourceAuthenticator>;
export async function availabilityResponse(input: unknown, repository: CatalogRepository, now: number): Promise<Response> {
  if (!validateContract('AvailabilityRequest', input, { now }).ok) throw new BookingApiError('invalid_input');
  const window = input as QuoteInput;
  const target = await repository.target(window.operator_id, window.vehicle_id);
  if (!target) throw new BookingApiError('not_found');
  if (!validateContract('AvailabilityRequest', input, { now, tenantTimezone: target.timezone }).ok) throw new BookingApiError('invalid_input');
  let observation:AvailabilityObservation|null=null;
  try { observation = await repository.availability(target, window.pickup_at, window.return_at); } catch { /* deliberate UNKNOWN observation, no fabricated empty intervals */ }
  const unknown={api_version:'v1',source_checked_at:new Date(now).toISOString(),...window,availability:'UNKNOWN',buffer_policy_version:null,reason_code:'upstream_unavailable',retry_after_seconds:30};
  const result=observation?{api_version:'v1',...window,source_checked_at:observation.source_checked_at,availability:observation.available?'AVAILABLE':'UNAVAILABLE',buffer_policy_version:observation.buffer_policy_version}:unknown;
  return jsonResponse(validateContract('AvailabilityResult',result).ok?result:unknown);
}
export async function quoteResponse(input: unknown, request: Request, repository: CatalogRepository, auth: ResourceAuth | null, store: QuoteStore | null, consentOrigin: string, now: number, responseClock:()=>number=()=>now): Promise<Response> {
  if (!validateContract('QuoteRequest', input, { now }).ok) throw new BookingApiError('invalid_input');
  if (!auth || !store) throw new BookingApiError('upstream_unavailable');
  const window = input as QuoteInput;
  const target = await repository.target(window.operator_id, window.vehicle_id);
  if (!target) throw new BookingApiError('not_found');
  if (!validateContract('QuoteRequest', input, { now, tenantTimezone: target.timezone }).ok) throw new BookingApiError('invalid_input');
  let principal;
  try { principal = await auth.requirePrincipal(request, 'quotes:create', target.operator_id); }
  catch(error) {
    if (error instanceof BookingApiError && error.code==='unauthorized') {
      const response=errorResponse(error);
      response.headers.set('Link',`<${new URL(`/agent/account/${target.operator_id}`,consentOrigin).href}>; rel="customer-account"`);
      return response;
    }
    throw error;
  }
  const quote = await createQuote(window, principal as QuotePrincipal, store, now);
  // Persistence legitimately happens after request admission. Validate the
  // original SQL observation against the response clock, retaining its timestamp.
  return jsonResponse(quoteResultFromSnapshot(quote,consentOrigin,responseClock()),201);
}
export function quoteResultFromSnapshot(quote:QuoteSnapshot,consentOrigin:string,now:number) {
  const window=publicQuoteWindow(quote.authority.window);
  const p = quote.authority.pricing, terms = quote.authority.terms;
  const consent = new URL(`/agent/consent/${quote.quote_id}`, consentOrigin);
  const result = { api_version: 'v1', source_checked_at: new Date(quote.created_at).toISOString(), ...window, quote_id: quote.quote_id,
    principal_scope: { subject: quote.principal.subject, operator_id: window.operator_id }, expires_at: new Date(quote.expires_at).toISOString(),
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
    availability_checked_at: new Date(quote.authority.availability_checked_at).toISOString(), holds_inventory: false, consent_url: consent.href };
  if (!validateContract('QuoteResult', result, { now }).ok) throw new BookingApiError('upstream_unavailable');
  return result;
}
