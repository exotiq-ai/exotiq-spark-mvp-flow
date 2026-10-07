// Real database verification is run by the root's ownership-validated local SQL
// lab, then dedicated Supabase staging. Never substitute this with mocked RLS.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
let url: string;
let key: string;
beforeAll(() => {
  if (!process.env.AGENT_STAGING_CONFIG || !process.env.AGENT_STAGING_ANON_KEY) throw new Error('Real dedicated Supabase staging and anon test key required; no production fallback.');
  const config = JSON.parse(readFileSync(process.env.AGENT_STAGING_CONFIG, 'utf8'));
  url = config.supabaseUrl;
  key = process.env.AGENT_STAGING_ANON_KEY;
  if (typeof url !== 'string') throw new Error('Staging URL missing');
});
describe('delegated grant staging release gate', () => {
  it.each(['external_customer_links', 'external_booking_grants', 'external_consent_receipts', 'external_grant_renewals'])('denies direct anonymous table access to %s', async (table) => {
    const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('42501');
  });
  it('denies direct anonymous internal renewal RPC execution', async () => {
    const response = await fetch(`${url}/rest/v1/rpc/external_revoke_booking_grant`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ _grant_id: '11111111-1111-4111-8111-111111111111', _customer_id: '11111111-1111-4111-8111-111111111111', _issuer: 'https://synthetic.invalid', _subject: 'synthetic', _client_id: 'synthetic' }) });
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('42501');
  });
});
