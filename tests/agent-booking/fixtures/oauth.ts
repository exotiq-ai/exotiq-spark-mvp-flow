import { generateKeyPairSync, sign, verify, createPublicKey, type JsonWebKey } from 'node:crypto';
import { syntheticContext } from './upstream';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
export function createOAuthFixtures(now: number) {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const issuer = 'https://agent-test-issuer.example.invalid';
  const audience = 'https://agent-test-api.example.invalid';
  const kid = 'agent-test-signing-key';
  const claims = {
    iss: issuer, aud: audience, sub: syntheticContext.subject, customer_id: syntheticContext.customerId,
    tenant_id: syntheticContext.tenantId, scope: 'booking:read booking:request',
    iat: now, exp: now + 600, jti: 'agent-test-token-valid',
  };
  const signToken = (overrides: Record<string, unknown> = {}, headerOverrides: Record<string, unknown> = {}, key = pair.privateKey) => {
    const header = encode({ alg: 'RS256', typ: 'JWT', kid, ...headerOverrides });
    const payload = encode({ ...claims, ...overrides });
    const input = `${header}.${payload}`;
    return `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
  };
  return {
    issuer, audience,
    jwks: { keys: [{ ...pair.publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }] },
    revokedIds: new Set(['agent-test-token-revoked']),
    tokens: {
      valid: signToken(), expired: signToken({ exp: now - 1 }),
      revoked: signToken({ jti: 'agent-test-token-revoked' }),
      wrongAudience: signToken({ aud: 'https://agent-test-other-api.example.invalid' }),
      wrongIssuer: signToken({ iss: 'https://agent-test-attacker.example.invalid' }),
      wrongCustomer: signToken({ customer_id: syntheticContext.otherCustomerId }),
      wrongTenant: signToken({ tenant_id: syntheticContext.otherTenantId }),
      wrongSignature: signToken({}, {}, attacker.privateKey),
      unknownKey: signToken({}, { kid: 'agent-test-unknown-key' }),
      unsigned: `${encode({ alg: 'none', typ: 'JWT' })}.${encode(claims)}.`,
      futureIssued: signToken({ iat: now + 60 }),
    },
    signToken,
  };
}

/** Fixture sanity check, not an API authenticator or provider compatibility proof. */
export function checkFixtureToken(token: string, fixture: ReturnType<typeof createOAuthFixtures>, now: number) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  if (header.alg !== 'RS256') throw new Error('Unsupported token algorithm');
  const key = fixture.jwks.keys.find((entry) => entry.kid === header.kid);
  if (!key || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: key as JsonWebKey, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw new Error('Invalid signature or signing key');
  if (claims.iss !== fixture.issuer || claims.aud !== fixture.audience) throw new Error('Issuer/audience mismatch');
  if (claims.exp <= now || claims.iat > now || fixture.revokedIds.has(claims.jti)) throw new Error('Expired, future or revoked token');
  return claims;
}
