import { timestampInstant, validateContract } from './contracts.ts';
import { BookingApiError } from './errors.ts';

export interface QuotePrincipal { subject: string; customerId: string; issuer: string; audience: string; clientId: string; scopes: readonly string[] }
export interface QuoteInput { operator_id: string; vehicle_id: string; pickup_at: string; return_at: string; timezone: string; selected_options: string[] }
export interface QuoteAuthority { window: QuoteInput; selected_options: string[]; availability: 'AVAILABLE'; availability_checked_at: string; pricing: Record<string, string | number>; terms: Record<string, unknown> }
export interface QuoteSnapshot {
  quote_id: string; created_at: string; expires_at: string; authority: QuoteAuthority;
  principal: QuotePrincipal; pricing_version: string; terms_version: string; terms_hash: string;
  consumed_booking_id: string | null; holds_inventory: false;
}
export interface QuoteStore { create(input: { request: QuoteInput; principal: QuotePrincipal; ttlSeconds: number }): Promise<unknown> }
export interface QuoteRpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }
const cents = ['daily_rate_cents', 'rental_subtotal_cents', 'deposit_cents', 'operator_total_cents', 'platform_fee_cents', 'protection_daily_cents', 'protection_total_cents', 'state_fee_cents', 'processing_fee_cents', 'exotiq_total_cents', 'grand_total_cents', 'state_fee_daily_cents', 'operator_tax_cents'] as const;
const strings = ['currency', 'protection_tier', 'state_code', 'state_fee_label', 'operator_tax_label'] as const;
const policies = ['operator_tax_inclusive', 'cancellation_policy', 'pickup_address', 'pickup_instructions', 'mileage_limit', 'mileage_overage_rate', 'deposit_disclosure', 'currency'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function fail(): never { throw new BookingApiError('upstream_unavailable'); }
function safeCents(value: unknown): number {
  if (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) && BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  return fail();
}
function localTimestamp(value: unknown, timezone: string): string {
  if (typeof value !== 'string' || timestampInstant(value) === null) return fail();
  const instant = timestampInstant(value)!;
  let fields: Record<string, string>;
  try { fields = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map(({ type, value }) => [type, value])); } catch { return fail(); }
  const wall = Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day), Number(fields.hour), Number(fields.minute), Number(fields.second));
  const offset = Math.round((wall - Math.floor(instant / 1000) * 1000) / 60000);
  const suffix = `${offset < 0 ? '-' : '+'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:${fields.second}.${String(((instant % 1000) + 1000) % 1000).padStart(3, '0')}${suffix}`;
}
/** Internal quote/receipt equality uses UTC instants; API dates retain tenant wall
 * clock offsets. Normalize only after strict timestamp and rental-window checks.
 */
export function canonicalQuoteWindow(value: unknown): QuoteInput {
  if (!object(value) || typeof value.timezone !== 'string') return fail();
  const local = { ...value, pickup_at: localTimestamp(value.pickup_at, value.timezone), return_at: localTimestamp(value.return_at, value.timezone) };
  if (!validateContract('QuoteRequest', local).ok) return fail();
  return { ...local, pickup_at: new Date(timestampInstant(local.pickup_at)!).toISOString(), return_at: new Date(timestampInstant(local.return_at)!).toISOString() } as QuoteInput;
}
export function publicQuoteWindow(window:QuoteInput):QuoteInput {return {...window,pickup_at:localTimestamp(window.pickup_at,window.timezone),return_at:localTimestamp(window.return_at,window.timezone)};}
/** Exact integer normalization and consistency checks only. All arithmetic amounts
 * originate in public_vehicle_quote; this boundary never estimates/reprices them.
 */
export function normalizeAuthority(value: unknown): QuoteAuthority {
  if (!object(value) || value.availability !== 'AVAILABLE' || !object(value.pricing) || !object(value.terms) || !object(value.window) || !Array.isArray(value.selected_options) || stableJson(value.selected_options) !== stableJson(value.window.selected_options) || !Number.isFinite(Date.parse(String(value.availability_checked_at)))) return fail();
  const window = canonicalQuoteWindow(value.window);
  const pricing = structuredClone(value.pricing) as Record<string, string | number>;
  for (const field of cents) pricing[field] = safeCents(pricing[field]);
  for (const field of strings) if (typeof pricing[field] !== 'string' || !(pricing[field] as string).length || (pricing[field] as string).length > 500) return fail();
  if (pricing.currency !== 'USD' || !['premium', 'standard', 'decline'].includes(String(pricing.protection_tier)) || pricing.protection_tier !== value.selected_options[0]) return fail();
  for (const field of ['rental_days', 'platform_fee_percent', 'operator_tax_rate']) if (typeof pricing[field] !== 'number' || !Number.isFinite(pricing[field]) || (pricing[field] as number) < 0) return fail();
  if (!Number.isSafeInteger(pricing.rental_days) || (pricing.rental_days as number) < 1) return fail();
  const terms = structuredClone(value.terms);
  if (policies.some((key) => !Object.hasOwn(terms, key)) || typeof terms.operator_tax_inclusive !== 'boolean' || typeof terms.cancellation_policy !== 'string' || !terms.cancellation_policy.length || terms.currency !== pricing.currency || typeof terms.deposit_disclosure !== 'string' || !terms.deposit_disclosure.length) return fail();
  for (const field of ['pickup_address', 'pickup_instructions']) if (terms[field] !== null && typeof terms[field] !== 'string') return fail();
  if (terms.mileage_limit !== null && (!Number.isSafeInteger(terms.mileage_limit) || Number(terms.mileage_limit) < 0)) return fail();
  if (terms.mileage_overage_rate !== null && !(typeof terms.mileage_overage_rate === 'string' && /^(0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(terms.mileage_overage_rate))) return fail();
  const operator = BigInt(pricing.rental_subtotal_cents) + (terms.operator_tax_inclusive ? 0n : BigInt(pricing.operator_tax_cents));
  const exotiq = ['platform_fee_cents', 'protection_total_cents', 'state_fee_cents', 'processing_fee_cents'].reduce((sum, key) => sum + BigInt(pricing[key]), 0n);
  if (operator !== BigInt(pricing.operator_total_cents) || exotiq !== BigInt(pricing.exotiq_total_cents) || operator + exotiq !== BigInt(pricing.grand_total_cents)) return fail();
  return { ...structuredClone(value), window, pricing, terms } as unknown as QuoteAuthority;
}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return JSON.stringify(value);
  return fail();
}
export async function hashCanonical(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
/** TS fingerprint compares normalized complete values. Persisted SQL revisions are
 * separately generated from JSONB text and MUST NOT be recomputed with this codec.
 */
export function quoteFingerprint(authority: QuoteAuthority): Promise<string> {
  return hashCanonical({ window: authority.window, selected_options: authority.selected_options, pricing: authority.pricing, terms: authority.terms });
}
function deepFreeze<T>(value: T): T {
  if (object(value) || Array.isArray(value)) { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
  return value;
}
export function assertQuotePrincipal(principal: QuotePrincipal): void {
  if (!principal || !uuid.test(principal.customerId) || [principal.subject, principal.issuer, principal.audience, principal.clientId].some((value) => typeof value !== 'string' || value.length < 1 || value.length > 500)) throw new BookingApiError('unauthorized');
}
export async function createQuote(request: unknown, principal: QuotePrincipal, store: QuoteStore, now: number, ttlSeconds = 900): Promise<QuoteSnapshot> {
  assertQuotePrincipal(principal);
  if (!Array.isArray(principal.scopes) || !principal.scopes.includes('quotes:create')) throw new BookingApiError('forbidden');
  if (!Number.isFinite(now) || !validateContract('QuoteRequest', request, { now }).ok || !Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 900) throw new BookingApiError('invalid_input');
  try {
    const row = await store.create({ request: structuredClone(request) as QuoteInput, principal: structuredClone(principal), ttlSeconds });
    if (!object(row) || !uuid.test(String(row.quote_id)) || !object(row.principal)) return fail();
    const authority = normalizeAuthority(row.authority);
    const checked = Date.parse(authority.availability_checked_at), created = Date.parse(String(row.created_at)), expires = Date.parse(String(row.expires_at));
    if (!Number.isFinite(created) || !Number.isFinite(expires) || checked > created || created - checked > 30000 || created > now + 30000 || now - created > 30000 || expires <= now || expires - created > ttlSeconds * 1000 || stableJson(authority.window) !== stableJson(canonicalQuoteWindow(request)) || ['subject', 'customerId', 'issuer', 'audience', 'clientId'].some((key) => (row.principal as Record<string, unknown>)[key] !== principal[key as keyof QuotePrincipal])) return fail();
    for (const key of ['pricing_version', 'terms_version', 'terms_hash']) if (typeof row[key] !== 'string' || !/^[a-f0-9]{64}$/.test(row[key] as string)) return fail();
    return deepFreeze({ quote_id: String(row.quote_id), created_at: String(row.created_at), expires_at: String(row.expires_at), authority, principal: structuredClone(principal), pricing_version: String(row.pricing_version), terms_version: String(row.terms_version), terms_hash: String(row.terms_hash), consumed_booking_id: null, holds_inventory: false });
  } catch (error) { if (error instanceof BookingApiError) throw error; return fail(); }
}
/** Caller injects its already configured, server-only Supabase service client. No
 * environment/credential discovery and no in-memory production ledger exists.
 */
export class SupabaseQuoteStore implements QuoteStore {
  constructor(private readonly client: QuoteRpcClient) {}
  async create({ request, principal, ttlSeconds }: { request: QuoteInput; principal: QuotePrincipal; ttlSeconds: number }): Promise<unknown> {
    const { data, error } = await this.client.rpc('external_create_quote', { _subject: principal.subject, _customer_id: principal.customerId, _issuer: principal.issuer, _audience: principal.audience, _client_id: principal.clientId, _operator_id: request.operator_id, _vehicle_id: request.vehicle_id, _pickup_at: request.pickup_at, _return_at: request.return_at, _timezone: request.timezone, _selected_options: request.selected_options, _ttl_seconds: ttlSeconds });
    if (error) {
      if (object(error) && ['invalid_input', 'dates_unavailable', 'not_found', 'configuration_unavailable', 'external_writes_disabled'].includes(String(error.message))) throw new BookingApiError(error.message as 'invalid_input' | 'dates_unavailable' | 'not_found' | 'configuration_unavailable' | 'external_writes_disabled');
      return fail();
    }
    const row = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
    if (!object(row)) return fail();
    return { ...row, principal: { subject: row.subject, customerId: row.customer_id, issuer: row.issuer, audience: row.audience, clientId: row.client_id } };
  }
}
