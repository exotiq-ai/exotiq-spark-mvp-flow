import { describe, it, expect } from 'vitest';
import { catalogResponse, RpcCatalogRepository } from '../../supabase/functions/_shared/external-booking/catalog-routes';
import { createApiHandler } from '../../supabase/functions/external-booking-api/index';
const operator = '10000000-0000-4000-8000-000000000001';
const vehicle = '20000000-0000-4000-8000-000000000001';
const candidate = { operator_id: operator, slug: 'synthetic-miami', name: 'Synthetic Miami', city: 'Miami', timezone: 'America/New_York', storefront_url: 'https://book.example.invalid/synthetic-miami' };
const secret = new Uint8Array(32).fill(7);
const now = Date.parse('2026-10-07T12:00:00Z');
describe('versioned eligible catalog boundary', () => {
  it('calls bounded eligibility RPCs rather than raw tables and projects canonical fields', async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const repository = new RpcCatalogRepository({ rpc: async (name, args) => { calls.push({ name, args }); return { data: [candidate], error: null }; } });
    const response = await catalogResponse('operators', new URL('https://api.example.invalid/v1/operators?operator_slug=synthetic-miami&limit=1'), repository, secret, false, now);
    expect(await response.json()).toMatchObject({ items: [candidate], next_cursor: null });
    expect(calls[0].name).toBe('external_catalog_operators');
    expect(calls[0].args._limit).toBe(2);
    expect(calls[0].args._browse).toBe(false);
  });
  it('does not enumerate all tenants when browse disabled and rejects injection/unknown query fields', async () => {
    let calls = 0;
    const repository = new RpcCatalogRepository({ rpc: async () => { calls++; return { data: [], error: null }; } });
    expect((await (await catalogResponse('operators', new URL('https://api.example.invalid/v1/operators'), repository, secret, false, now)).json()).items).toEqual([]);
    expect(calls).toBe(0);
    for (const query of ['limit=51', 'operator_slug=x%27OR1%3D1', 'is_demo_account=false', 'limit=1&limit=2']) await expect(catalogResponse('operators', new URL(`https://api.example.invalid/v1/operators?${query}`), repository, secret, true, now)).rejects.toMatchObject({ code: 'invalid_input' });
  });
  it('signs filter-bound cursors and refuses reuse under another tenant/filter', async () => {
    const repository = new RpcCatalogRepository({ rpc: async () => ({ data: [candidate, { ...candidate, operator_id: vehicle }], error: null }) });
    const result = await (await catalogResponse('operators', new URL('https://api.example.invalid/v1/operators?limit=1&city=Miami'), repository, secret, true, now)).json();
    expect(result.items).toHaveLength(1); expect(result.next_cursor).toBeTypeOf('string');
    await expect(catalogResponse('operators', new URL(`https://api.example.invalid/v1/operators?limit=1&city=Tampa&cursor=${result.next_cursor}`), repository, secret, true, now)).rejects.toMatchObject({ code: 'invalid_input' });
  });
  it('refuses extra/schema-inconsistent output and upstream failures without disclosing errors', async () => {
    for (const result of [{ data: [{ ...candidate, owner_id: 'secret' }], error: null }, { data: null, error: { message: 'secret' } }]) {
      const repository = new RpcCatalogRepository({ rpc: async () => result });
      await expect(catalogResponse('operators', new URL('https://api.example.invalid/v1/operators'), repository, secret, true, now)).rejects.toMatchObject({ code: 'upstream_unavailable' });
    }
  });
  it('dispatches exact version/method/body bounds and fail-closed distributed limiter', async () => {
    const handler = createApiHandler({ catalog: new RpcCatalogRepository({ rpc: async () => ({ data: [], error: null }) }), cursorKey: secret, browseEnabled: false, boundaryLimit: async () => true, now: () => 1000, auth: null, quoteStore: null, consentOrigin: 'https://book.example.invalid' });
    const cases: [string, RequestInit][] = [['/v2/operators', {}], ['/v1/operators', { method: 'POST' }], ['/v1/availability', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' }]];
    for (const [path, init] of cases) {
      const response = await handler(new Request(`https://api.example.invalid${path}`, init));
      expect(response.status).toBe(400); expect((await response.json()).code).toBe('invalid_input');
    }
    const refused = createApiHandler({ catalog: new RpcCatalogRepository({ rpc: async () => { throw new Error('secret'); } }), cursorKey: secret, browseEnabled: true, boundaryLimit: async () => { throw new Error('secret'); }, now: () => 1000, auth: null, quoteStore: null, consentOrigin: 'https://book.example.invalid' });
    const response = await refused(new Request('https://api.example.invalid/v1/operators'));
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('secret');
  });
});
