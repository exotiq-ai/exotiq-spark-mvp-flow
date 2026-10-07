import { validateContract } from './contracts.ts';
import { BookingApiError } from './errors.ts';
import type { Principal } from './auth.ts';
export interface RequestStore { create(input: { quoteId: string; receiptId: string; idempotencyKey: string; principal: Principal & { customerId: string; operatorId: string } }): Promise<unknown> }
export interface RequestRpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export async function submitRentalRequest(input: unknown, idempotencyKey: string, principal: Principal, store: RequestStore) {
  if (!principal?.customerId || !principal.operatorId || !uuid.test(principal.customerId) || !uuid.test(principal.operatorId) || !principal.scopes?.includes('rental_requests:create')) throw new BookingApiError('unauthorized');
  if (!validateContract('RentalRequestInput', input).ok || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) throw new BookingApiError('invalid_input');
  const body = input as { quote_id: string; consent_receipt_id: string };
  let result;
  try { result = await store.create({ quoteId: body.quote_id, receiptId: body.consent_receipt_id, idempotencyKey, principal: principal as Principal & { customerId: string; operatorId: string } }); }
  catch (error) { if (error instanceof BookingApiError) throw error; throw new BookingApiError('upstream_unavailable'); }
  if (!validateContract('RentalRequestResult', result).ok) throw new BookingApiError('upstream_unavailable');
  return result;
}
/** The RPC is the WHOLE transaction. Never retry isolated insert/consume/email.
 * Lost HTTP response is ambiguous: caller retries the SAME durable key. */
export class SupabaseRequestStore implements RequestStore {
  constructor(private readonly client: RequestRpcClient, private readonly publicOrigin: string, private readonly retry: { sleep?: (ms: number) => Promise<void>; random?: () => number } = {}) {
    const url = new URL(publicOrigin);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new BookingApiError('upstream_unavailable');
  }
  async create(input: Parameters<RequestStore['create']>[0]): Promise<unknown> {
    const args = { _quote_id: input.quoteId, _receipt_id: input.receiptId, _idempotency_key: input.idempotencyKey, _issuer: input.principal.issuer, _subject: input.principal.subject, _client_id: input.principal.clientId, _customer_id: input.principal.customerId, _operator_id: input.principal.operatorId, _audience: input.principal.audience, _public_origin: this.publicOrigin };
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await this.client.rpc('external_submit_rental_request', args);
      if (!error) return Array.isArray(data) && data.length === 1 ? data[0] : data;
      if (object(error) && ['40001','55P03'].includes(String(error.code)) && attempt < 4) {
        const delay = 25 * 2 ** attempt + Math.floor((this.retry.random?.() ?? Math.random()) * 25);
        await (this.retry.sleep?.(delay) ?? new Promise((resolve) => setTimeout(resolve, delay)));
        continue;
      }
      if (object(error) && ['invalid_input', 'not_found', 'dates_unavailable', 'quote_changed', 'quote_expired', 'consent_mismatch', 'consent_expired', 'idempotency_conflict', 'forbidden'].includes(String(error.message))) throw new BookingApiError(error.message as 'invalid_input');
      if (object(error) && ['40001','55P03'].includes(String(error.code))) throw new BookingApiError('request_in_flight', {retry_after_seconds: 1});
      throw new BookingApiError('upstream_unavailable');
    }
    throw new BookingApiError('upstream_unavailable');
  }
}
