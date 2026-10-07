import { bindCursor, verifyCursor, validateContract } from './contracts.ts';
import { BookingApiError } from './errors.ts';
import type { QuoteRpcClient } from './quotes.ts';
export type CatalogKind = 'operators' | 'vehicles';
export type CatalogQuery = Record<string, unknown> & { limit: number; after?: string; browse: boolean };
export interface EligibleTarget { operator_id: string; vehicle_id: string; operator_slug: string; vehicle_slug: string; timezone: string; external_api_enabled: true }
export interface AvailabilityObservation { available:boolean; source_checked_at:string; buffer_policy_version:string }
export interface CatalogRepository {
  list(kind: CatalogKind, query: CatalogQuery): Promise<Record<string, unknown>[]>;
  target(operatorId: string, vehicleId: string): Promise<EligibleTarget | null>;
  availability(target: EligibleTarget, pickupAt: string, returnAt: string): Promise<AvailabilityObservation | null>;
}
export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export function parseCatalogQuery(kind: CatalogKind, url: URL): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (url.search.length > 4096) throw new BookingApiError('invalid_input');
  for (const [key, value] of url.searchParams) {
    if (Object.hasOwn(result, key)) throw new BookingApiError('invalid_input');
    result[key] = key === 'limit' && /^[1-9][0-9]*$/.test(value) ? Number(value) : value;
  }
  if (!validateContract(kind === 'operators' ? 'OperatorsQuery' : 'VehiclesQuery', result).ok) throw new BookingApiError('invalid_input');
  return { ...result, limit: result.limit ?? 20 };
}
export async function catalogResponse(kind: CatalogKind, url: URL, repository: CatalogRepository, cursorKey: Uint8Array, browseEnabled: boolean, now: number): Promise<Response> {
  const filters = parseCatalogQuery(kind, url), cursor = filters.cursor;
  delete filters.cursor;
  const context = { operation: kind, filters, now };
  let after: string | undefined;
  if (cursor !== undefined) {
    try { after = (await verifyCursor(String(cursor), context, cursorKey)).after; } catch { throw new BookingApiError('invalid_input'); }
  }
  if (!browseEnabled && !(kind === 'operators' ? filters.operator_slug : filters.operator_id)) return jsonResponse({ api_version: 'v1', source_checked_at: new Date(now).toISOString(), items: [], next_cursor: null });
  const limit = Number(filters.limit);
  let rows;
  try { rows = await repository.list(kind, { ...filters, after, limit: limit + 1, browse: browseEnabled }); } catch (error) { if (error instanceof BookingApiError) throw error; throw new BookingApiError('upstream_unavailable'); }
  if (!Array.isArray(rows) || rows.length > limit + 1) throw new BookingApiError('upstream_unavailable');
  const itemContract = kind === 'operators' ? 'Operator' : 'Vehicle';
  const id = kind === 'operators' ? 'operator_id' : 'vehicle_id';
  if (rows.some((row, index) => !validateContract(itemContract, row).ok || (index > 0 && String(row[id]) <= String(rows[index - 1][id])) || (after !== undefined && String(row[id]) <= after))) throw new BookingApiError('upstream_unavailable');
  const items = rows.slice(0, limit);
  const next_cursor = rows.length > limit ? await bindCursor({ after: String(items[items.length - 1][id]), expires_at: now + 900000 }, context, cursorKey) : null;
  const result = { api_version: 'v1', source_checked_at: new Date(now).toISOString(), items, next_cursor };
  if (!validateContract(kind === 'operators' ? 'OperatorsPage' : 'VehiclesPage', result).ok) throw new BookingApiError('upstream_unavailable');
  return jsonResponse(result);
}
/** Only bounded RPCs may supply public rows. Their SQL composes the existing
 * public visibility/tenant RPCs with external opt-in; no table API is exposed.
 */
export class RpcCatalogRepository implements CatalogRepository {
  constructor(private readonly rpc: QuoteRpcClient) {}
  async list(kind: CatalogKind, q: CatalogQuery): Promise<Record<string, unknown>[]> {
    const { data, error } = await this.rpc.rpc(kind === 'operators' ? 'external_catalog_operators' : 'external_catalog_vehicles', {
      _after: q.after ?? null, _limit: q.limit, _browse: q.browse, _city: q.city ?? null,
      ...(kind === 'operators' ? { _operator_slug: q.operator_slug ?? null } : { _operator_id: q.operator_id ?? null, _pickup_at: q.pickup_at ?? null, _return_at: q.return_at ?? null, _timezone: q.timezone ?? null }),
    });
    if (error || !Array.isArray(data)) throw new BookingApiError('upstream_unavailable');
    return data as Record<string, unknown>[];
  }
  async target(operatorId: string, vehicleId: string): Promise<EligibleTarget | null> {
    const { data, error } = await this.rpc.rpc('external_api_target', { _operator_id: operatorId, _vehicle_id: vehicleId });
    if (error || !Array.isArray(data) || data.length > 1) throw new BookingApiError('upstream_unavailable');
    if (!data.length) return null;
    const row = data[0] as EligibleTarget;
    if (row.operator_id !== operatorId || row.vehicle_id !== vehicleId || row.external_api_enabled !== true || typeof row.timezone !== 'string' || typeof row.operator_slug !== 'string' || typeof row.vehicle_slug !== 'string') throw new BookingApiError('upstream_unavailable');
    return row;
  }
  async availability(target: EligibleTarget, pickupAt: string, returnAt: string): Promise<AvailabilityObservation | null> {
    const { data, error } = await this.rpc.rpc('external_api_observe_availability', { _operator_id:target.operator_id,_vehicle_id:target.vehicle_id,_pickup_at:pickupAt,_return_at:returnAt,_timezone:target.timezone });
    if (error || !Array.isArray(data) || data.length>1) throw new BookingApiError('upstream_unavailable');
    if (!data.length) return null;
    const row=data[0] as AvailabilityObservation;
    if (!row || Object.keys(row).some(key=>!['available','source_checked_at','buffer_policy_version'].includes(key)) || typeof row.available!=='boolean' || typeof row.source_checked_at!=='string' || !Number.isFinite(Date.parse(row.source_checked_at)) || typeof row.buffer_policy_version!=='string' || !/^post-return-snapshot-v1\/(?:0|[1-9][0-9]{0,4})$/.test(row.buffer_policy_version) || Number(row.buffer_policy_version.split('/')[1])>10080) throw new BookingApiError('upstream_unavailable');
    return row;
  }
}
