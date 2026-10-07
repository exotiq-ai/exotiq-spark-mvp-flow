import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createResourceAuthenticator, protectedResourceMetadata, validateAuthorizationRequest, validateAuthorizationResponse } from '../../supabase/functions/_shared/external-booking/auth.ts';

const issuer = 'https://issuer.example.test';
const resource = 'https://api.example.test/v1';
const now = new Date('2026-10-07T18:00:00Z');
const iat = now.getTime() / 1000;
const operatorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const customerId = '11111111-1111-4111-8111-111111111111';
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let rotated: Awaited<ReturnType<typeof generateKeyPair>>;
let keyResolver: ReturnType<typeof createLocalJWKSet>;
const config = { issuer, resource, jwksUri: `${issuer}/jwks`, metadataUrl: 'https://api.example.test/.well-known/oauth-protected-resource/v1', allowedHosts: ['issuer.example.test', 'api.example.test'], algorithms: ['ES256'] as const, clientIds: ['client-profile-a', 'client-profile-b'], maxTokenLifetimeSeconds: 600 };
beforeAll(async () => {
  keys = await generateKeyPair('ES256', { extractable: true });
  rotated = await generateKeyPair('ES256', { extractable: true });
  keyResolver = createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'current', alg: 'ES256' }, { ...await exportJWK(rotated.publicKey), kid: 'rotated', alg: 'ES256' }] });
});
async function token(claims: Record<string, unknown> = {}, key = keys.privateKey, kid = 'current') {
  return new SignJWT({ iss: issuer, aud: resource, sub: 'verified-subject', jti: 'unique-token-identifier', client_id: 'client-profile-a', scope: 'rental_requests:read quotes:create', iat, nbf: iat, exp: iat + 600, ...claims }).setProtectedHeader({ alg: 'ES256', typ: 'at+jwt', kid }).sign(key);
}
function authenticator(overrides: Record<string, unknown> = {}, configuration: typeof config | null = config) {
  return createResourceAuthenticator(configuration, { keyResolver, now: () => now, resolveCustomer: async () => ({ customerId, operatorId, verified: true, revoked: false }), isTokenActive: async () => true, enforceRateLimit: async () => true, ...overrides });
}
function request(value: string) { return new Request(`${resource}/quotes`, { headers: { Authorization: `Bearer ${value}` } }); }
describe('resource authentication using actual signed JWT verification', () => {
  it.each(['client-profile-a', 'client-profile-b'])('accepts signed fixture profile %s only after verified link and fresh revocation checks', async (client_id) => {
    const result = await authenticator().requirePrincipal(request(await token({ client_id })), 'quotes:create', operatorId);
    expect(result).toMatchObject({ subject: 'verified-subject', customerId, issuer, audience: resource, clientId: client_id });
  });
  it('accepts a second key in a rotated pinned JWKS', async () => { expect((await authenticator().requirePrincipal(request(await token({}, rotated.privateKey, 'rotated')), 'quotes:create', operatorId)).customerId).toBe(customerId); });
  it.each([
    { iss: 'https://other.example.test' }, { aud: 'https://mcp.example.test' }, { aud: [resource, 'https://mcp.example.test'] }, { aud: undefined }, { sub: undefined }, { exp: undefined }, { exp: iat - 1 }, { nbf: iat + 60 }, { iat: undefined }, { iat: iat + 60 }, { exp: iat + 601 }, { jti: undefined }, { client_id: undefined }, { client_id: 'unregistered' }, { scope: undefined },
  ])('denies malformed or misbound claim set %j', async (claims) => { await expect(authenticator().requirePrincipal(request(await token(claims)), 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'unauthorized' }); });
  it('denies forged signatures and hides input in errors', async () => { const forged = await generateKeyPair('ES256'); await expect(authenticator().requirePrincipal(request(await token({}, forged.privateKey)), 'quotes:create', operatorId)).rejects.toMatchObject({ message: 'Customer authorization is required.' }); });
  it('denies ID tokens', async () => { const id = await new SignJWT({ iss: issuer, aud: resource, sub: 'verified-subject', iat, exp: iat + 600 }).setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'current' }).sign(keys.privateKey); await expect(authenticator().requirePrincipal(request(id), 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'unauthorized' }); });
  it.each([null, { customerId, operatorId, verified: false, revoked: false }, { customerId, operatorId, verified: true, revoked: true }])('does not derive verified ownership from a typed email %j', async (link) => { await expect(authenticator({ resolveCustomer: async () => link }).requirePrincipal(request(await token({ email: 'customer@example.test', customer_id: customerId })), 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'unauthorized' }); });
  it('checks revocation on every request', async () => { let active = true; const auth = authenticator({ isTokenActive: async () => active }); const req = request(await token()); await auth.requirePrincipal(req, 'quotes:create', operatorId); active = false; await expect(auth.requirePrincipal(req, 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'unauthorized' }); });
  it('fails closed on revocation-store outage', async () => { await expect(authenticator({ isTokenActive: async () => { throw new Error('secret upstream details'); } }).requirePrincipal(request(await token()), 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'upstream_unavailable' }); });
  it('limits authenticated requests before operation execution', async () => { await expect(authenticator({ enforceRateLimit: async () => false }).requirePrincipal(request(await token()), 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'rate_limited' }); });
  it('defaults to denied when provider is absent', async () => { await expect(authenticator({}, null).requirePrincipal(request(await token()), 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'upstream_unavailable' }); });
  it('returns stable subject before tenant resolution, never a global legacy customer ID', async () => { const result = await authenticator().requirePrincipal(request(await token()), 'quotes:create'); expect(result.customerId).toBeUndefined(); expect(result.subject).toBe('verified-subject'); });
  it('resolves same principal to distinct verified Miami and Tampa customer records', async () => {
    const tampaOperator = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const tampaCustomer = '22222222-2222-4222-8222-222222222222';
    const auth = authenticator({ resolveCustomer: async (_issuer: string, _subject: string, tenant: string) => tenant === operatorId ? { customerId, operatorId, verified: true, revoked: false } : tenant === tampaOperator ? { customerId: tampaCustomer, operatorId: tampaOperator, verified: true, revoked: false } : null });
    const req = request(await token());
    const miami = await auth.requirePrincipal(req, 'quotes:create', operatorId);
    const tampa = await auth.requirePrincipal(req, 'quotes:create', tampaOperator);
    expect(miami.subject).toBe(tampa.subject); expect(miami.customerId).toBe(customerId); expect(tampa.customerId).toBe(tampaCustomer);
  });
  it('denies customer mapping returned for another operator', async () => { await expect(authenticator({ resolveCustomer: async () => ({ customerId, operatorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', verified: true, revoked: false }) }).requirePrincipal(request(await token()), 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'unauthorized' }); });
  it('returns forbidden for a valid token with insufficient scope', async () => { await expect(authenticator().requirePrincipal(request(await token({ scope: 'catalog:read' })), 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'forbidden' }); });
  it('rejects oversized bearer credentials before key or storage calls', async () => { await expect(authenticator().requirePrincipal(request('x'.repeat(17000)), 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'unauthorized' }); });
  it('rejects insecure resource requests', async () => { await expect(authenticator().requirePrincipal(new Request('http://api.example.test/v1', { headers: { Authorization: `Bearer ${await token()}` } }), 'quotes:create', operatorId)).rejects.toMatchObject({ code: 'unauthorized' }); });
});
describe('metadata and client boundary validation', () => {
  it('advertises supported scopes while requiring action-specific authorization', () => { expect(protectedResourceMetadata(config)).toMatchObject({ resource, authorization_servers: [issuer], scopes_supported: ['catalog:read', 'quotes:create', 'rental_requests:create', 'rental_requests:read'], bearer_methods_supported: ['header'] }); });
  it.each(['http://issuer.example.test', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://10.0.0.1', 'https://issuer.example.test@evil.example.test', 'https://issuer.example.test/#fragment'])('rejects unsafe configured issuer %s', (bad) => { expect(() => protectedResourceMetadata({ ...config, issuer: bad })).toThrow(); });
  it('requires exact redirect, target resource and PKCE S256', () => { const input = { redirectUri: 'https://client.example.test/callback', resource, codeChallenge: 'a'.repeat(43), codeChallengeMethod: 'S256' }; expect(() => validateAuthorizationRequest(input, ['https://client.example.test/callback'], resource)).not.toThrow(); for (const change of [{ redirectUri: 'https://client.example.test/callback/evil' }, { resource: 'https://mcp.example.test' }, { codeChallengeMethod: 'plain' }, { codeChallenge: 'short' }]) expect(() => validateAuthorizationRequest({ ...input, ...change }, ['https://client.example.test/callback'], resource)).toThrow(); });
  it('compares authorization response issuer exactly before code exchange or error display', () => { expect(() => validateAuthorizationResponse(issuer, issuer, true)).not.toThrow(); expect(() => validateAuthorizationResponse(undefined, issuer, false)).not.toThrow(); for (const incoming of [undefined, `${issuer}/`, 'https://other.example.test']) expect(() => validateAuthorizationResponse(incoming, issuer, true)).toThrow(); expect(() => validateAuthorizationResponse('https://other.example.test', issuer, false)).toThrow(); });
});

it('supplies the required action to current provider revocation/scope checks',async()=>{let seen:any;const auth=authenticator({isTokenActive:async(identity:{requiredScope:string;scopes:readonly string[]})=>{seen=identity;return identity.requiredScope==='catalog:read';}});await expect(auth.requirePrincipal(request(await token()),'quotes:create')).rejects.toMatchObject({code:'unauthorized'});expect(seen.requiredScope).toBe('quotes:create');expect(seen.scopes).toContain('quotes:create');});
