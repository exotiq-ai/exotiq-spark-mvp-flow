import { catalogResponse, RpcCatalogRepository, jsonResponse, type CatalogRepository } from '../_shared/external-booking/catalog-routes.ts';
import { availabilityResponse, quoteResponse, type ResourceAuth } from '../_shared/external-booking/quote-routes.ts';
import { errorResponse, BookingApiError } from '../_shared/external-booking/errors.ts';
import { authenticationChallenge, createResourceAuthenticator, protectedResourceMetadata, type ProviderConfiguration, type AuthDependencies } from '../_shared/external-booking/auth.ts';
import { SupabaseQuoteStore, hashCanonical, type QuoteStore, type QuoteRpcClient } from '../_shared/external-booking/quotes.ts';
import {createConsentExtension} from '../_shared/external-booking/consent-routes.ts';
import {createRequestExtension,type RequestDependencies} from '../_shared/external-booking/request-routes.ts';
import type {Scope} from '../_shared/external-booking/auth.ts';
import type {HostedProofConfiguration} from '../_shared/external-booking/hosted-proof.ts';
import { createRemoteJWKSet } from 'jose';

export interface ApiDependencies {
  catalog: CatalogRepository; cursorKey: Uint8Array; browseEnabled: boolean;
  boundaryLimit: (request: Request) => Promise<boolean>; now?: () => number;
  auth: ResourceAuth | null; quoteStore: QuoteStore | null; consentOrigin: string;
  provider?: ProviderConfiguration;
  /** Later hosted consent/status/write handlers attach explicitly; absence is 404.
   * Middleware MUST enforce its own scope/CSRF/customer proof, not trust routing. */
  extension?: (request: Request, path: string, body: unknown) => Promise<Response | null>;
}
async function boundedBytes(message: Request | Response, maximum = 32768): Promise<Uint8Array> {
  const contentLength = message.headers.get('content-length');
  if (contentLength && (!/^[0-9]+$/.test(contentLength) || Number(contentLength) > maximum)) throw new BookingApiError('invalid_input');
  if (!message.body) throw new BookingApiError('invalid_input');
  const reader = message.body.getReader(); const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > maximum) throw new BookingApiError('invalid_input'); parts.push(chunk.value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    return bytes;
  } catch { throw new BookingApiError('invalid_input'); } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export async function boundedJson(message: Request | Response, maximum = 32768): Promise<unknown> {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedBytes(message, maximum))); } catch { throw new BookingApiError('invalid_input'); }
}
function routePath(url: URL,resource?:string): string {
  if(resource){const prefix=new URL(resource).pathname.replace(/\/$/, '');if(prefix&&url.pathname.startsWith(prefix+'/v1/'))url=new URL(url.origin+url.pathname.slice(prefix.length)+url.search);}
  if (url.searchParams.has('access_token') || url.pathname.includes('%') || /\/\//.test(url.pathname)) throw new BookingApiError('invalid_input');
  return url.pathname.replace(/^\/functions\/v1\/external-booking-api(?=\/)/, '').replace(/^\/external-booking-api(?=\/)/, '');
}
function operationScope(path:string,method:string):Scope{
 if(path==='/v1/quotes'||/^\/v1\/quotes\/[^/]+(?:\/consents)?$/.test(path)||path==='/v1/customers/operator-links')return 'quotes:create';
 if(path==='/v1/rental-requests'&&method==='POST'||path.endsWith('/consent-result'))return 'rental_requests:create';
 if(path.endsWith('/checkout-handoff'))return 'checkout:handoff';
 if(path.startsWith('/v1/rental-requests/')||path.startsWith('/v1/grants/')||path.startsWith('/v1/grant-renewals'))return 'rental_requests:read';
 return 'catalog:read';
}
/** Pure HTTP factory also used by the actual runtime composition below. */
export function createApiHandler(deps: ApiDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    const requestId = crypto.randomUUID();
    try {
      const url = new URL(request.url), path = routePath(url,deps.provider?.resource), now = deps.now?.() ?? Date.now();
      if (request.url.length > 8192 || !['GET', 'POST'].includes(request.method)) throw new BookingApiError('invalid_input');
      if (!await deps.boundaryLimit(request)) throw new BookingApiError('rate_limited');
      let response: Response;
      if (request.method === 'GET' && deps.provider && url.pathname === new URL(deps.provider.metadataUrl).pathname) response = jsonResponse(protectedResourceMetadata(deps.provider));
      else if (request.method === 'GET' && (path === '/v1/operators' || path === '/v1/vehicles')) {
        if (request.headers.has('authorization')) { if (!deps.auth) throw new BookingApiError('upstream_unavailable'); await deps.auth.requirePrincipal(request, 'catalog:read'); }
        response = await catalogResponse(path.endsWith('operators') ? 'operators' : 'vehicles', url, deps.catalog, deps.cursorKey, deps.browseEnabled, now);
      } else {
        if (!path.startsWith('/v1/')) throw new BookingApiError('invalid_input');
        if (request.method === 'POST' && !/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '')) throw new BookingApiError('invalid_input');
        const body = request.method === 'POST' ? await boundedJson(request.clone()) : undefined;
        if (request.method === 'POST' && path === '/v1/availability') {
          if (request.headers.has('authorization')) { if (!deps.auth) throw new BookingApiError('upstream_unavailable'); await deps.auth.requirePrincipal(request, 'catalog:read'); }
          response = await availabilityResponse(body, deps.catalog, now);
        } else if (request.method === 'POST' && path === '/v1/quotes') response = await quoteResponse(body, request, deps.catalog, deps.auth, deps.quoteStore, deps.consentOrigin, now);
        else {
          const extension = await deps.extension?.(request, path, body);
          if (!extension) throw new BookingApiError(['operators', 'vehicles', 'availability', 'quotes'].some((name) => path === `/v1/${name}`) ? 'invalid_input' : 'not_found');
          response = extension;
        }
      }
      if (!response.headers.has('X-Request-Id')) response.headers.set('X-Request-Id', requestId);
      response.headers.set('Cache-Control', 'no-store');
      if (response.status===401 && deps.provider) for(const [key,value] of Object.entries(authenticationChallenge(deps.provider,operationScope(path,request.method)))) response.headers.set(key,value);
      return response;
    } catch (error) {
      if(request.body&&!request.bodyUsed)void request.body.cancel().catch(()=>undefined);
      const response = errorResponse(error, requestId);
      if (response.status === 401 && deps.provider) {
        let path='/v1/';try{path=routePath(new URL(request.url),deps.provider?.resource);}catch{/* malformed paths must not break safe error handling */}
        const challenge = authenticationChallenge(deps.provider,operationScope(path,request.method));
        for (const [key,value] of Object.entries(challenge)) response.headers.set(key,value);
      }
      return response;
    }
  };
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Environment = { get(name: string): string | undefined };
function pinnedHttps(raw: string, hosts: readonly string[]): URL {
  let url: URL; try { url = new URL(raw); } catch { throw new BookingApiError('upstream_unavailable'); }
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.search || url.hash || (url.port && url.port !== '443') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':') || /(?:^|\.)(?:local|internal|localhost)$/.test(url.hostname)) throw new BookingApiError('upstream_unavailable');
  return url;
}
/** Real Supabase REST RPC transport: fixed host/path, bounded response/deadline,
 * no redirects, and no arbitrary table reads or caller-supplied destination. */
export class HttpSupabaseRpcClient implements QuoteRpcClient {
  constructor(private readonly origin: string, private readonly serviceKey: string, private readonly fetcher: Fetcher = fetch) {
    const url = new URL(origin);
    if (!/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) || url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password || url.port || !serviceKey || serviceKey.length > 16384) throw new BookingApiError('upstream_unavailable');
  }
  async rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> {
    if (!/^(?:external_[a-z_]+|agent_inventory_available|check_rate_limit)$/.test(name)) throw new BookingApiError('upstream_unavailable');
    try {
      const response = await this.fetcher(new URL(`/rest/v1/rpc/${name}`, this.origin), { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(args) });
      const payload = await boundedJson(response, 131072);
      return response.ok ? { data: payload, error: null } : { data: null, error: payload };
    } catch { throw new BookingApiError('upstream_unavailable'); }
  }
}
export interface RuntimeConfig {
  provider: ProviderConfiguration; introspectionUrl: string; introspectionAuthorization: string;
  supabaseUrl: string; serviceKey: string; cursorKey: Uint8Array; consentOrigin: string;
  browseEnabled: boolean; gatewayKey?: Uint8Array; hosted?:HostedProofConfiguration|null;
}
async function byteHash(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map((v)=>v.toString(16).padStart(2,'0')).join('');
}
/** Direct public-origin requests retain their URL. Supabase ingress forwarding
 * requires an administrator-pinned shared HMAC key and a short-lived proof over
 * the exact method/path/query/body. No forwarded-host/IP/header is trusted.
 * Gateway signs UTF8 `${timestamp}\n${method}\n${rawPathAndQuery}\n${bodySHA256}`.
 */
export async function normalizeIngress(request: Request, config: RuntimeConfig, now: number): Promise<Request> {
  const incoming = new URL(request.url), resource = new URL(config.provider.resource);
  if (incoming.protocol !== 'https:') throw new BookingApiError('unauthorized');
  if (incoming.origin === resource.origin) return request;
  if (incoming.origin !== new URL(config.supabaseUrl).origin || !config.gatewayKey) throw new BookingApiError('unauthorized');
  const at = request.headers.get('X-Exotiq-Gateway-Timestamp') ?? '', proof = request.headers.get('X-Exotiq-Gateway-Proof') ?? '';
  if (!/^[0-9]{13}$/.test(at) || Math.abs(now-Number(at))>30000 || !/^[a-f0-9]{64}$/.test(proof)) throw new BookingApiError('unauthorized');
  const bytes = request.body ? await boundedBytes(request.clone()) : new Uint8Array();
  const message = new TextEncoder().encode(`${at}\n${request.method}\n${incoming.pathname}${incoming.search}\n${await byteHash(bytes)}`);
  const key = await crypto.subtle.importKey('raw',config.gatewayKey,{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const signature = Uint8Array.from(proof.match(/../g)!, pair=>parseInt(pair,16));
  if (!await crypto.subtle.verify('HMAC',key,signature,message)) throw new BookingApiError('unauthorized');
  const path = routePath(incoming);
  if (!path.startsWith('/v1/') && path !== new URL(config.provider.metadataUrl).pathname) throw new BookingApiError('invalid_input');
  const prefix=resource.pathname.replace(/\/$/,'');
  const publicPath=path===new URL(config.provider.metadataUrl).pathname?path:prefix+path;
  return new Request(new URL(publicPath+incoming.search,resource.origin),{method:request.method,headers:request.headers, ...(request.body?{body:bytes}:{})});
}
export function readRuntimeConfig(env: Environment): RuntimeConfig {
  try {
    const provider = JSON.parse(env.get('EXTERNAL_API_PROVIDER_CONFIG') ?? '') as ProviderConfiguration;
    protectedResourceMetadata(provider);
    const introspectionUrl = pinnedHttps(env.get('EXTERNAL_API_INTROSPECTION_URL') ?? '', provider.allowedHosts).href;
    if (new URL(introspectionUrl).origin !== new URL(provider.issuer).origin) throw new Error();
    const introspectionAuthorization = env.get('EXTERNAL_API_INTROSPECTION_AUTHORIZATION') ?? '';
    if (!/^(?:Basic|Bearer) [A-Za-z0-9+/=_\-.]+$/.test(introspectionAuthorization) || introspectionAuthorization.length > 16384) throw new Error();
    const consent = pinnedHttps(env.get('EXTERNAL_API_CUSTOMER_ORIGIN') ?? '', provider.allowedHosts);
    if (consent.pathname !== '/') throw new Error();
    const cursor = env.get('EXTERNAL_API_CURSOR_KEY_HEX') ?? '', gateway = env.get('EXTERNAL_API_GATEWAY_KEY_HEX');
    if (!/^[a-f0-9]{64}$/.test(cursor) || (gateway !== undefined && !/^[a-f0-9]{64}$/.test(gateway))) throw new Error();
    const bytes = (raw: string) => Uint8Array.from(raw.match(/../g)!, (pair) => parseInt(pair, 16));
    const bridgeKey=env.get('EXTERNAL_API_HOSTED_BRIDGE_KEY'),hostedClients=env.get('EXTERNAL_API_HOSTED_CLIENT_IDS');
    let hosted:HostedProofConfiguration|null=null;
    if(bridgeKey||hostedClients){const clientIds=JSON.parse(hostedClients??'[]') as unknown;if(!/^[A-Za-z0-9_-]{43}$/.test(bridgeKey??'')||!Array.isArray(clientIds)||!clientIds.length||clientIds.some(id=>typeof id!=='string'||!provider.clientIds.includes(id)))throw new Error();hosted={frontendOrigin:consent.origin,resource:provider.resource,bridgeKey:bridgeKey!,hostedClientIds:clientIds};}
    return { hosted, provider, introspectionUrl, introspectionAuthorization, supabaseUrl: env.get('SUPABASE_URL') ?? '', serviceKey: env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', cursorKey: bytes(cursor), consentOrigin: consent.origin, browseEnabled: env.get('EXTERNAL_API_CATALOG_BROWSE_ENABLED') === 'true', ...(gateway ? { gatewayKey: bytes(gateway) } : {}) };
  } catch { throw new BookingApiError('upstream_unavailable'); }
}
/** RFC7662 each-request introspection, not a signature-only revocation assertion.
 * https://datatracker.ietf.org/doc/html/rfc7662#section-2
 * Provider response must bind the JWT identity/resource and fresh expiry. Pinned
 * egress DNS/private-network restrictions still require deployment evidence.
 */
export async function introspectToken(config: RuntimeConfig, token: string, identity: Parameters<AuthDependencies['isTokenActive']>[0], fetcher: Fetcher, now: number): Promise<boolean> {
  try {
    const response = await fetcher(config.introspectionUrl, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3000), headers: { Authorization: config.introspectionAuthorization, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ token, token_type_hint: 'access_token' }) });
    if (!response.ok) throw new Error();
    const row = await boundedJson(response, 32768) as Record<string, unknown>;
    if (row.active === false) return false;
    if (row.active !== true || row.sub !== identity.subject || row.jti !== identity.tokenId || row.client_id !== identity.clientId || row.iss !== identity.issuer || row.aud !== config.provider.resource || !Number.isInteger(row.exp) || Number(row.exp) <= Math.floor(now / 1000)) throw new Error();
    if (typeof row.scope !== 'string' || row.scope.length > 1024) throw new Error();
    if (!row.scope.split(' ').includes(identity.requiredScope)) return false;
    return true;
  } catch { throw new BookingApiError('upstream_unavailable'); }
}
/** Actual production dependencies are composed here, not just injected scaffolds.
 * Request-local auth closes over its token; no token/claims live in global state. */
export function createRuntime(config: RuntimeConfig, fetcher: Fetcher = fetch, additions?: { keyResolver?: AuthDependencies['keyResolver']; now?: () => number; extension?: ApiDependencies['extension']; handoff?:RequestDependencies['handoff'] }): (request: Request) => Promise<Response> {
  protectedResourceMetadata(config.provider);
  const keyResolver = additions?.keyResolver ?? createRemoteJWKSet(new URL(config.provider.jwksUri), { timeoutDuration: 3000, cooldownDuration: 1000, cacheMaxAge: 300000 });
  const rpc = new HttpSupabaseRpcClient(config.supabaseUrl, config.serviceKey, fetcher);
  const catalog = new RpcCatalogRepository(rpc);
  const now = additions?.now ?? Date.now;
  const limit = async (bucket: string, count: number) => {
    const { data, error } = await rpc.rpc('check_rate_limit', { _bucket: bucket, _limit: count, _window_seconds: 60 });
    if (error || typeof data !== 'boolean') throw new BookingApiError('upstream_unavailable'); return data;
  };
  return async (request) => {
    try { request = await normalizeIngress(request,config,now()); } catch(error) { return errorResponse(error); }
    const dependencies: AuthDependencies = {
      keyResolver, now: () => new Date(now()),
      resolveCustomer: async (issuer, subject, operatorId) => {
        const { data, error } = await rpc.rpc('external_resolve_customer_link', { _issuer: issuer, _subject: subject, _operator_id: operatorId });
        if (error || !Array.isArray(data) || data.length > 1) throw new BookingApiError('upstream_unavailable');
        if (!data.length) return null;
        const row = data[0] as Record<string, unknown>;
        return { customerId: String(row.customer_id), operatorId: String(row.operator_id), verified: row.verified === true, revoked: row.revoked === true };
      },
      isTokenActive: (identity) => introspectToken(config, request.headers.get('authorization')?.slice(7) ?? '', identity, fetcher, now()),
      enforceRateLimit: async (principal) => limit(`external:principal:${await hashCanonical({ issuer: principal.issuer, subject: principal.subject, clientId: principal.clientId, operatorId: principal.operatorId ?? null })}`, principal.operatorId ? 20 : 120),
    };
    const auth = createResourceAuthenticator(config.provider, dependencies);
    const consent=createConsentExtension({auth,rpc,hosted:config.hosted??null,consentOrigin:config.consentOrigin,now});
    const requests=createRequestExtension({auth,rpc,publicOrigin:config.provider.resource,customerOrigin:config.consentOrigin,now,handoff:additions?.handoff});
    const extension:ApiDependencies['extension']=async(req,path,body)=>await consent(req,path,body)??await requests(req,path,body)??await additions?.extension?.(req,path,body)??null;
    return createApiHandler({ catalog, cursorKey: config.cursorKey, browseEnabled: config.browseEnabled,
      boundaryLimit: async () => limit('external:boundary:global', 600), now, auth,
      quoteStore: new SupabaseQuoteStore(rpc), consentOrigin: config.consentOrigin, provider: config.provider, extension })(request);
  };
}

declare const Deno: { env: Environment; serve(handler: (request: Request) => Promise<Response>): void };
if ((import.meta as ImportMeta & { main?: boolean }).main && typeof Deno !== 'undefined') {
  let handler: (request: Request) => Promise<Response>;
  try { handler = createRuntime(readRuntimeConfig(Deno.env)); }
  catch { handler = async () => errorResponse(new BookingApiError('upstream_unavailable')); }
  Deno.serve(handler);
}
