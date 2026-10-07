import { beforeAll, describe, it, expect } from 'vitest';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { availabilityResponse } from '../../supabase/functions/_shared/external-booking/quote-routes';
import { createRuntime, readRuntimeConfig, normalizeIngress } from '../../supabase/functions/external-booking-api/index';
import { validateContract } from '../../supabase/functions/_shared/external-booking/contracts';
import type { CatalogRepository } from '../../supabase/functions/_shared/external-booking/catalog-routes';
const now = Date.parse('2026-10-07T12:00:00Z'), seconds = now/1000;
const operator = '10000000-0000-4000-8000-000000000001', vehicle = '20000000-0000-4000-8000-000000000001', customer = '40000000-0000-4000-8000-000000000001';
const window = { operator_id: operator, vehicle_id: vehicle, pickup_at:'2035-01-01T10:00:00-05:00', return_at:'2035-01-03T10:00:00-05:00', timezone:'America/New_York' };
const input = {...window,selected_options:['premium']};
const target = {...window,operator_slug:'synthetic-miami',vehicle_slug:'synthetic-car',external_api_enabled:true as const};
const provider = { issuer:'https://issuer.example.invalid',resource:'https://api.example.invalid/v1',jwksUri:'https://issuer.example.invalid/jwks',metadataUrl:'https://api.example.invalid/.well-known/oauth-protected-resource/v1',allowedHosts:['issuer.example.invalid','api.example.invalid','book.example.invalid'],algorithms:['ES256'] as const,clientIds:['synthetic-client'],maxTokenLifetimeSeconds:600 };
const config = {provider,introspectionUrl:'https://issuer.example.invalid/introspect',introspectionAuthorization:'Basic c3ludGhldGljOnRlc3Q=',supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',serviceKey:'synthetic-service-only',cursorKey:new Uint8Array(32).fill(7),consentOrigin:'https://book.example.invalid',browseEnabled:false};
let keys:Awaited<ReturnType<typeof generateKeyPair>>, resolver:ReturnType<typeof createLocalJWKSet>;
beforeAll(async()=>{keys=await generateKeyPair('ES256',{extractable:true});resolver=createLocalJWKSet({keys:[{...await exportJWK(keys.publicKey),alg:'ES256',kid:'test'}]});});
async function token(extra:Record<string,unknown>={}) {return new SignJWT({iss:provider.issuer,aud:provider.resource,sub:'synthetic-subject',jti:'synthetic-jti',client_id:'synthetic-client',scope:'quotes:create',iat:seconds,nbf:seconds,exp:seconds+600,...extra}).setProtectedHeader({alg:'ES256',typ:'at+jwt',kid:'test'}).sign(keys.privateKey);}
function quoteRow() {return {quote_id:'30000000-0000-4000-8000-000000000001',subject:'synthetic-subject',customer_id:customer,issuer:provider.issuer,audience:provider.resource,client_id:'synthetic-client',created_at:new Date(now).toISOString(),expires_at:new Date(now+900000).toISOString(),pricing_version:'a'.repeat(64),terms_version:'b'.repeat(64),terms_hash:'b'.repeat(64),authority:{window:input,selected_options:['premium'],availability:'AVAILABLE',availability_checked_at:new Date(now).toISOString(),pricing:{currency:'USD',rental_days:2,daily_rate_cents:10000,rental_subtotal_cents:20000,deposit_cents:0,operator_total_cents:21200,platform_fee_percent:10,platform_fee_cents:2000,protection_tier:'premium',protection_daily_cents:28900,protection_total_cents:57800,state_fee_cents:400,processing_fee_cents:2187,exotiq_total_cents:62387,grand_total_cents:83587,state_code:'FL',state_fee_label:'State fee',state_fee_daily_cents:200,operator_tax_rate:6,operator_tax_cents:1200,operator_tax_label:'Tax'},terms:{operator_tax_inclusive:false,cancellation_policy:'72-hour cancellation',pickup_address:'Synthetic Miami',pickup_instructions:null,mileage_limit:100,mileage_overage_rate:'3.50',deposit_disclosure:'Separate deposit',currency:'USD',operator_tax_rate_percent:'6',platform_fee_percent:'10'}}};}
function runtime(options:{active?:boolean;failIntrospection?:boolean;limit?:boolean;quoteError?:boolean;missingCustomer?:boolean;availability?:unknown;scope?:string;flags?:unknown;failFlags?:boolean}={}) {
  const calls:{destination:string;name:string;authorization:string|null}[]=[];
  const fetcher=async(raw:string|URL|Request,init?:RequestInit)=>{
    const url=new URL(String(raw));const name=url.pathname.split('/').at(-1)!;calls.push({destination:url.hostname,name,authorization:new Headers(init?.headers).get('authorization')});
    if(url.hostname==='issuer.example.invalid') {if(options.failIntrospection)throw new Error('secret provider');return new Response(JSON.stringify({active:options.active??true,iss:provider.issuer,aud:provider.resource,sub:'synthetic-subject',jti:'synthetic-jti',client_id:'synthetic-client',scope:options.scope??'quotes:create',exp:seconds+600}));}
    if(options.failFlags&&name==='external_read_operation_flags')throw new Error('secret flag provider');
    const value:Record<string,unknown>={external_read_operation_flags:options.flags===undefined?{new_writes_enabled:true,operator_enabled:true}:options.flags,check_rate_limit:options.limit??true,external_api_target:[target],external_resolve_customer_link:options.missingCustomer?[]:[{customer_id:customer,operator_id:operator,verified:true,revoked:false}],external_create_quote:[quoteRow()],agent_inventory_available:options.availability??true};
    if(options.quoteError&&name==='external_create_quote')return new Response(JSON.stringify({message:'upstream_unavailable'}),{status:500});
    return new Response(JSON.stringify(value[name]??[]));
  };
  return {handler:createRuntime(config,fetcher,{keyResolver:resolver,now:()=>now}),calls};
}
describe('safe availability and actual runtime quote composition',()=>{
  it('returns UNKNOWN for upstream observation outage, never AVAILABLE or empty dates',async()=>{
    const repository:CatalogRepository={list:async()=>[],target:async()=>target,availability:async()=>{throw new Error('secret');}};
    const result=await(await availabilityResponse(window,repository,now)).json();
    expect(result.availability).toBe('UNKNOWN');expect(result.buffer_policy_version).toBeNull();expect(result.retry_after_seconds).toBe(30);expect(validateContract('AvailabilityResult',result).ok).toBe(true);
  });
  it('returns database observation time and policy together, while schema disagreement is UNKNOWN',async()=>{
    const checked='2026-10-07T11:59:59.000Z';
    for(const observation of [{available:true,source_checked_at:checked,buffer_policy_version:'post-return-snapshot-v1/90'},{available:false,source_checked_at:checked,buffer_policy_version:'post-return-snapshot-v1/90'},{available:'true',source_checked_at:checked,buffer_policy_version:'post-return-snapshot-v1/90'}]){
      const repository=new (await import('../../supabase/functions/_shared/external-booking/catalog-routes')).RpcCatalogRepository({rpc:async(name)=>{expect(name).toBe('external_api_observe_availability');return {data:[observation],error:null};}});
      repository.target=async()=>target;
      const result=await(await availabilityResponse(window,repository,now)).json();
      expect(result.availability).toBe(typeof observation.available==='boolean'?(observation.available?'AVAILABLE':'UNAVAILABLE'):'UNKNOWN');
      expect(result.buffer_policy_version).toBe(typeof observation.available==='boolean'?'post-return-snapshot-v1/90':null);
      if(typeof observation.available==='boolean')expect(result.source_checked_at).toBe(checked);
    }
  });
  it('normalizes actual PostgreSQL microsecond timestamps to the public millisecond contract',async()=>{
    const repository=new (await import('../../supabase/functions/_shared/external-booking/catalog-routes')).RpcCatalogRepository({rpc:async()=>({data:[{available:true,source_checked_at:'2026-10-07T11:59:59.123456+00:00',buffer_policy_version:'post-return-snapshot-v1/60'}],error:null})});
    repository.target=async()=>target;
    const response=await(await availabilityResponse(window,repository,now)).json();
    expect(response.availability).toBe('AVAILABLE');expect(response.source_checked_at).toBe('2026-10-07T11:59:59.123Z');expect(validateContract('AvailabilityResult',response).ok).toBe(true);
  });
  it('uses real signed JWT verification, introspection, persistent limiter, ownership and quote RPC',async()=>{
    const {handler,calls}=runtime();const bearer=await token();
    const response=await handler(new Request('https://api.example.invalid/v1/quotes',{method:'POST',headers:{authorization:`Bearer ${bearer}`,'content-type':'application/json'},body:JSON.stringify(input)}));
    expect(response.status).toBe(201);const result=await response.json();
    expect(validateContract('QuoteResult',result).ok).toBe(true);expect(result.holds_inventory).toBe(false);expect(result.total_cents).toBe(83587);
    expect(result.consent_url).toBe(`${config.consentOrigin}/agent/consent/30000000-0000-4000-8000-000000000001`);
    expect(calls.some(call=>call.name==='external_create_quote')).toBe(true);expect(calls.some(call=>call.name==='external_resolve_customer_link')).toBe(true);
    expect(calls.filter(call=>call.name==='check_rate_limit')).toHaveLength(2);
    expect(calls.find(call=>call.destination==='issuer.example.invalid')?.authorization).toBe(config.introspectionAuthorization);
    expect(calls.filter(call=>call.destination==='abcdefghijklmnopqrst.supabase.co').every(call=>call.authorization===`Bearer ${config.serviceKey}`)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(config.serviceKey);
  });
  it.each([{active:false,status:401},{failIntrospection:true,status:503},{missingCustomer:true,status:401},{limit:false,status:429},{scope:'catalog:read',status:401}])('denies revocation/provider failure/missing onboarding/rate limit before quote persistence %j',async(options)=>{
    const {handler,calls}=runtime(options);const response=await handler(new Request('https://api.example.invalid/v1/quotes',{method:'POST',headers:{authorization:`Bearer ${await token()}`,'content-type':'application/json'},body:JSON.stringify(input)}));
    const error=await response.json();
    expect(response.status).toBe(options.status);expect(calls.some(call=>call.name==='external_create_quote')).toBe(false);expect(JSON.stringify(error)).not.toContain('secret');
    expect(response.headers.get('X-Request-Id')).toBe(error.request_id);
    if(options.missingCustomer)expect(response.headers.get('Link')).toBe(`<${config.consentOrigin}/agent/account/${operator}>; rel="customer-account"`);
  });
  it.each([
    {flags:{new_writes_enabled:false,operator_enabled:true},code:'external_writes_disabled'},
    {flags:{new_writes_enabled:true,operator_enabled:false},code:'external_writes_disabled'},
    {flags:null,code:'configuration_unavailable'},
    {flags:{new_writes_enabled:'true',operator_enabled:true},code:'configuration_unavailable'},
    {failFlags:true,code:'configuration_unavailable'},
  ])('checks fresh authoritative flags before quote persistence %j',async(options)=>{
    const {handler,calls}=runtime(options);
    const response=await handler(new Request('https://api.example.invalid/v1/quotes',{method:'POST',headers:{authorization:`Bearer ${await token()}`,'content-type':'application/json'},body:JSON.stringify(input)}));
    expect(response.status).toBe(503);expect((await response.json()).error.code).toBe(options.code);
    expect(calls.some(call=>call.name==='external_create_quote')).toBe(false);
    expect(calls.filter(call=>call.name==='external_read_operation_flags')).toHaveLength(1);
  });
  it('checks token revocation on every request rather than cache active state',async()=>{
    const {handler,calls}=runtime();const bearer=await token();
    for(let n=0;n<2;n++)await handler(new Request('https://api.example.invalid/v1/quotes',{method:'POST',headers:{authorization:`Bearer ${bearer}`,'content-type':'application/json'},body:JSON.stringify(input)}));
    expect(calls.filter(call=>call.destination==='issuer.example.invalid')).toHaveLength(2);
  });
  it('rejects unknown pricing options, malformed/oversized JSON and wrong audiences without quote calls',async()=>{
    const {handler,calls}=runtime();
    for(const [body,bearer] of [[JSON.stringify({...input,selected_options:['invented']}),await token()],['x'.repeat(32769),await token()],[JSON.stringify(input),await token({aud:'https://wrong.example.invalid'})]]){
      const response=await handler(new Request('https://api.example.invalid/v1/quotes',{method:'POST',headers:{authorization:`Bearer ${bearer}`,'content-type':'application/json'},body}));expect([400,401]).toContain(response.status);
    }
    expect(calls.some(call=>call.name==='external_create_quote')).toBe(false);
  });
  it('fails closed without provider configuration and refuses unproven ingress origin/header rewriting',async()=>{
    expect(()=>readRuntimeConfig({get:()=>undefined})).toThrow();
    await expect(normalizeIngress(new Request('https://attacker.example.invalid/v1/quotes',{headers:{'X-Forwarded-Host':'api.example.invalid'}}),config,now)).rejects.toMatchObject({code:'unauthorized'});
    await expect(normalizeIngress(new Request(`${config.supabaseUrl}/functions/v1/external-booking-api/v1/quotes`),config,now)).rejects.toMatchObject({code:'unauthorized'});
  });
  it('accepts gateway metadata forwarding only with a method and path bound proof',async()=>{
    const gatewayKey=new Uint8Array(32).fill(9), rawPath='/functions/v1/external-booking-api/.well-known/oauth-protected-resource/v1';
    const key=await crypto.subtle.importKey('raw',gatewayKey,{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const empty=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array()))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const proof=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${now}\nGET\n${rawPath}\n${empty}`)))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const headers={'X-Exotiq-Gateway-Timestamp':String(now),'X-Exotiq-Gateway-Proof':proof};
    const request=new Request(config.supabaseUrl+rawPath,{headers});
    expect((await normalizeIngress(request,{...config,gatewayKey},now)).url).toBe(provider.metadataUrl);
    await expect(normalizeIngress(new Request(config.supabaseUrl+rawPath+'/changed',{headers}),{...config,gatewayKey},now)).rejects.toMatchObject({code:'unauthorized'});
  });
});
