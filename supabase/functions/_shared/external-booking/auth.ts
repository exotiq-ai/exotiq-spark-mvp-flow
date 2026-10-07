import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { SCOPES } from './contracts.ts';
import { BookingApiError } from './errors.ts';

export type Scope = typeof SCOPES[number];
export interface Principal { subject: string; customerId: string; issuer: string; audience: string; scopes: readonly Scope[]; clientId: string; tokenId: string; }
export interface ProviderConfiguration {
  issuer: string; resource: string; jwksUri: string; metadataUrl: string;
  allowedHosts: readonly string[]; algorithms: readonly ('ES256' | 'RS256' | 'PS256' | 'EdDSA')[];
  clientIds: readonly string[]; maxTokenLifetimeSeconds: number;
}
export interface AuthDependencies {
  /** Test-only injection uses jose's actual local key resolver, not a claims mock. */
  keyResolver?: JWTVerifyGetKey;
  now?: () => Date;
  resolveCustomer: (issuer: string, subject: string) => Promise<{ customerId: string; verified: boolean; revoked: boolean } | null>;
  /** MUST query current revocation/session policy or introspection on EVERY request.
   * A JWT signature is insufficient for provider revocation. Throw on unavailable store. */
  isTokenActive: (identity: { issuer: string; subject: string; tokenId: string; clientId: string }) => Promise<boolean>;
  /** Persistent limiter; request IP is trustworthy only after ingress proxy validation.
   * Operator-specific limits are additionally enforced after tenant resolution. */
  enforceRateLimit: (principal: Principal, request: Request) => Promise<boolean>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bounded = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x20\x7f]/.test(value);

/** Only administrator-pinned HTTPS URLs are used. No token-controlled iss/jku/x5u
 * or arbitrary client metadata triggers a fetch. Egress must additionally block
 * private DNS resolutions; DNS/rebinding cannot be solved by a URL parser. */
function pinnedUrl(value: string, hosts: readonly string[]): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || (url.port && url.port !== '443')
    || !hosts.includes(url.hostname) || url.hostname === 'localhost' || /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname)
    || url.hostname.includes(':') || /^[\d.]+$/.test(url.hostname)) throw new BookingApiError('upstream_unavailable');
  return url;
}
function validateConfiguration(config: ProviderConfiguration): void {
  for (const value of [config.issuer, config.resource, config.jwksUri, config.metadataUrl]) pinnedUrl(value, config.allowedHosts);
  if (!config.algorithms.length || config.algorithms.some((alg) => !['ES256', 'RS256', 'PS256', 'EdDSA'].includes(alg))
    || !config.clientIds.length || config.clientIds.some((id) => !bounded(id, 512))
    || !Number.isInteger(config.maxTokenLifetimeSeconds) || config.maxTokenLifetimeSeconds < 60 || config.maxTokenLifetimeSeconds > 600) throw new BookingApiError('upstream_unavailable');
}
export function protectedResourceMetadata(config: ProviderConfiguration) {
  validateConfiguration(config);
  return { resource: config.resource, authorization_servers: [config.issuer], scopes_supported: [...SCOPES], bearer_methods_supported: ['header'] };
}
export function authenticationChallenge(config: ProviderConfiguration, scope: Scope): Record<string, string> {
  validateConfiguration(config);
  if (!SCOPES.includes(scope)) throw new BookingApiError('invalid_input');
  return { 'Cache-Control': 'no-store', 'WWW-Authenticate': `Bearer resource_metadata="${config.metadataUrl}", scope="${scope}"` };
}
/** Used by the eventual provider/client integration. Never implement an issuer
 * here. Redirect allowlist comes from reviewed registration, not request input. */
export function validateAuthorizationRequest(input: { redirectUri: string; resource: string; codeChallenge: string; codeChallengeMethod: string }, redirectAllowlist: readonly string[], resource: string): void {
  const url = new URL(input.redirectUri);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !redirectAllowlist.includes(input.redirectUri)
    || redirectAllowlist.some((uri) => uri.includes('*')) || input.resource !== resource
    || input.codeChallengeMethod !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(input.codeChallenge)) throw new BookingApiError('invalid_input');
}

export function createResourceAuthenticator(config: ProviderConfiguration | null, dependencies: AuthDependencies) {
  let resolver: JWTVerifyGetKey | undefined;
  if (config) {
    validateConfiguration(config);
    // jose pins endpoint, bounds network time and implements JWKS rotation/cache.
    resolver = dependencies.keyResolver ?? createRemoteJWKSet(new URL(config.jwksUri), { timeoutDuration: 3000, cooldownDuration: 1000, cacheMaxAge: 300000 });
  }
  return {
    async requirePrincipal(request: Request, requiredScope: Scope): Promise<Principal> {
      if (!config || !resolver) throw new BookingApiError('upstream_unavailable');
      const url = new URL(request.url);
      if (url.protocol !== 'https:' || url.origin !== new URL(config.resource).origin || url.searchParams.has('access_token')) throw new BookingApiError('unauthorized');
      const authorization = request.headers.get('authorization');
      if (!authorization || authorization.length > 16384 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) throw new BookingApiError('unauthorized');
      const now = dependencies.now?.() ?? new Date();
      let claims;
      try {
        const result = await jwtVerify(authorization.slice(7), resolver, { issuer: config.issuer, audience: config.resource, algorithms: [...config.algorithms], typ: 'at+jwt', requiredClaims: ['iss', 'aud', 'sub', 'iat', 'nbf', 'exp', 'jti', 'client_id', 'scope'], currentDate: now, clockTolerance: 0 });
        claims = result.payload;
        const nowSeconds = Math.floor(now.getTime() / 1000);
        if (claims.aud !== config.resource || !bounded(claims.sub, 256) || !bounded(claims.jti, 256)
          || !bounded(claims.client_id, 512) || !config.clientIds.includes(claims.client_id)
          || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || !Number.isInteger(claims.nbf)
          || claims.iat! > nowSeconds || claims.nbf! < claims.iat! || claims.exp! <= claims.iat!
          || claims.exp! - claims.iat! > config.maxTokenLifetimeSeconds
          || typeof claims.scope !== 'string' || claims.scope.length > 1024) throw new Error('invalid claims');
      } catch { throw new BookingApiError('unauthorized'); }
      const scopes = claims.scope!.split(' ') as Scope[];
      if (!SCOPES.includes(requiredScope) || scopes.some((scope) => !SCOPES.includes(scope)) || !scopes.includes(requiredScope)) throw new BookingApiError('unauthorized');
      const identity = { issuer: config.issuer, subject: claims.sub!, tokenId: claims.jti!, clientId: claims.client_id as string };
      try {
        // Every request resolves the verified persisted binding; typed email/customer
        // IDs in claims or request bodies are deliberately ignored.
        const link = await dependencies.resolveCustomer(identity.issuer, identity.subject);
        if (!link || !link.verified || link.revoked || !uuid.test(link.customerId) || !await dependencies.isTokenActive(identity)) throw new BookingApiError('unauthorized');
        const principal: Principal = { ...identity, audience: config.resource, customerId: link.customerId, scopes };
        if (!await dependencies.enforceRateLimit(principal, request)) throw new BookingApiError('rate_limited');
        return principal;
      } catch (error) {
        if (error instanceof BookingApiError) throw error;
        throw new BookingApiError('upstream_unavailable');
      }
    },
  };
}
/** Unconfigured callers fail closed. Composition at the API/MCP ingress injects
 * separately reviewed provider/store dependencies; there is no global fallback. */
export async function requirePrincipal(request: Request, requiredScope: Scope, options?: { config: ProviderConfiguration; dependencies: AuthDependencies }): Promise<Principal> {
  if (!options) throw new BookingApiError('upstream_unavailable');
  return createResourceAuthenticator(options.config, options.dependencies).requirePrincipal(request, requiredScope);
}
