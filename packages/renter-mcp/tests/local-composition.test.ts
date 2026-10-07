import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createRemoteJWKSet,customFetch,jwtVerify,generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createServer,request as httpRequest} from 'node:http';
import {SCOPES} from '../../../supabase/functions/_shared/external-booking/contracts.ts';
import {createRuntime,type RuntimeConfig} from '../../../supabase/functions/external-booking-api/index.ts';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {createMcpApplication} from '../src/server.ts';
import {createNodeServer} from '../src/node-http.ts';
import type {AuthConfig} from '../src/auth.ts';

const issuer='https://composition-id.example.test';
const mcpResource='https://composition-mcp.example.test/mcp';
const apiResource='https://composition-api.example.test/functions/v1/external-booking-api';
const customerOrigin='https://composition-customer.example.test';
const basic='Basic '+Buffer.from('composition-adapter:synthetic-only').toString('base64');
const consumerIds=['legacy-miami','modern-miami','legacy-tampa','modern-tampa','hosted-frontend'];

async function localAuthorizationServer(){
  const keys=await generateKeyPair('ES256'),jwk={...await exportJWK(keys.publicKey),alg:'ES256',kid:'local-composition'};
  const revoked=new Set<string>();
  async function token(clientId:string,subject:string,audience:string,scope:string){
    if(!consumerIds.includes(clientId)||![mcpResource,apiResource].includes(audience)||scope.split(' ').some(s=>!SCOPES.includes(s as typeof SCOPES[number])))throw new Error('invalid_synthetic_token');
    const at=Math.floor(Date.now()/1000);
    return new SignJWT({client_id:clientId,scope}).setProtectedHeader({alg:'ES256',typ:'at+jwt',kid:'local-composition'}).setIssuer(issuer).setSubject(subject).setAudience(audience).setIssuedAt(at).setNotBefore(at).setExpirationTime(at+300).setJti(crypto.randomUUID()).sign(keys.privateKey);
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('content-type','application/json');
    const send=(body:unknown,status=200)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    try{
      let size=0;const chunks:Buffer[]=[];
      for await(const part of req){size+=part.length;if(size>16384){send({error:'invalid_request'},413);return;}chunks.push(Buffer.from(part));}
      const fields=new URLSearchParams(Buffer.concat(chunks).toString());
      if(req.method==='GET'&&req.url==='/jwks'){send({keys:[jwk]});return;}
      if(req.method==='GET'&&req.url==='/.well-known/oauth-authorization-server'){
        send({issuer,jwks_uri:issuer+'/jwks',token_endpoint:issuer+'/token',introspection_endpoint:issuer+'/introspect',code_challenge_methods_supported:['S256'],grant_types_supported:['urn:ietf:params:oauth:grant-type:token-exchange'],token_endpoint_auth_methods_supported:['client_secret_basic']});return;
      }
      if(req.method!=='POST'||req.headers.authorization!==basic){send({error:'invalid_client'},401);return;}
      if(req.url==='/introspect'){
        try{const checked=await jwtVerify(fields.get('token')??'',keys.publicKey,{issuer,audience:[mcpResource,apiResource],typ:'at+jwt',algorithms:['ES256']});send(revoked.has(String(checked.payload.jti))?{active:false}:{active:true,...checked.payload});}catch{send({active:false});}return;
      }
      if(req.url==='/token'){
        const checked=await jwtVerify(fields.get('subject_token')??'',keys.publicKey,{issuer,audience:mcpResource,typ:'at+jwt',algorithms:['ES256'],requiredClaims:['client_id','scope','sub','jti']});
        const p=checked.payload,requested=fields.get('scope')??'';
        if(fields.get('grant_type')!=='urn:ietf:params:oauth:grant-type:token-exchange'||fields.get('resource')!==apiResource||p.aud!==mcpResource||revoked.has(String(p.jti))||typeof p.scope!=='string'||requested.split(' ').some(s=>!String(p.scope).split(' ').includes(s))){send({error:'invalid_request'},400);return;}
        send({access_token:await token(String(p.client_id),String(p.sub),apiResource,requested),token_type:'Bearer',issued_token_type:'urn:ietf:params:oauth:token-type:access_token'});return;
      }
      send({error:'invalid_request'},400);
    }catch{send({error:'invalid_request'},400);}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const local='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const localFetch:typeof fetch=async(input,init)=>{
    const target=new URL(input instanceof Request?input.url:String(input));
    if(target.origin!==issuer||target.search||target.hash||!['/jwks','/token','/introspect','/.well-known/oauth-authorization-server'].includes(target.pathname))throw new Error('invalid_local_egress');
    return fetch(local+target.pathname,init);
  };
  return {token,fetch:localFetch,revoke:(jti:string)=>revoked.add(jti),close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}

// These tests prepare the local AS boundary. SQL/API/SDK composition is added
// only when the root's guarded synthetic lab transport is available.
describe('local composition authorization-server fixture',()=>{
  it('serves actual JWKS and exchanges signed MCP tokens while retaining original consumer',async()=>{
    const fixture=await localAuthorizationServer();
    try{
      const token=await fixture.token('legacy-miami','synthetic-miami-customer',mcpResource,'catalog:read quotes:create');
      const response=await fixture.fetch(issuer+'/token',{method:'POST',headers:{authorization:'Basic '+Buffer.from('composition-adapter:synthetic-only').toString('base64'),'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:token-exchange',subject_token:token,resource:apiResource,scope:'catalog:read quotes:create'})});
      expect(response.status).toBe(200);const result=await response.json() as {access_token:string};
      const resolver=createRemoteJWKSet(new URL(issuer+'/jwks'),{[customFetch]:fixture.fetch});
      const checked=await jwtVerify(result.access_token,resolver,{issuer,audience:apiResource,typ:'at+jwt'});
      expect(checked.payload).toMatchObject({sub:'synthetic-miami-customer',client_id:'legacy-miami',scope:'catalog:read quotes:create'});
      expect(result.access_token).not.toBe(token);
      const introspected=await fixture.fetch(issuer+'/introspect',{method:'POST',headers:{authorization:basic},body:new URLSearchParams({token:result.access_token})});
      expect(await introspected.json()).toMatchObject({active:true,client_id:'legacy-miami',aud:apiResource});
      fixture.revoke(String(checked.payload.jti));
      expect(await (await fixture.fetch(issuer+'/introspect',{method:'POST',headers:{authorization:basic},body:new URLSearchParams({token:result.access_token})})).json()).toEqual({active:false});
    }finally{await fixture.close();}
  });
  it('refuses requested scope escalation and wrong exchange resource',async()=>{
    const fixture=await localAuthorizationServer();
    try{const token=await fixture.token('modern-tampa','synthetic-tampa-customer',mcpResource,'catalog:read');
      for(const [resource,scope] of [[apiResource,'quotes:create'],[customerOrigin,'catalog:read']]){
        const response=await fixture.fetch(issuer+'/token',{method:'POST',headers:{authorization:'Basic '+Buffer.from('composition-adapter:synthetic-only').toString('base64')},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:token-exchange',subject_token:token,resource,scope})});
        expect(response.status).toBe(400);expect(await response.json()).toEqual({error:'invalid_request'});
      }
    }finally{await fixture.close();}
  });
});

// Explicit opt-in is mandatory. The guarded transport verifies local Unix
// Docker, ownership, volume/network isolation and service-role SQL authority.
// This is a partial-schema local composition, never a hosted pilot run.
const manifest=process.env.AGENT_LOCAL_LAB_MANIFEST;
describe.skipIf(!manifest)('owned local SQL → production API → production MCP → official SDK',()=>{
  let as:Awaited<ReturnType<typeof localAuthorizationServer>>;
  let listener:ReturnType<typeof createNodeServer>,local:string;
  let runtime:ReturnType<typeof createRuntime>;
  let lab:{rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:unknown}>;setFixtureAdmission(enabled:boolean):Promise<void>;evidence:Record<string,unknown>};
  const bridgeKey=new Uint8Array(32).fill(27);
  const rpcNames:string[]=[];
  const rpcFailures:Array<{name:string;error:unknown}>=[];
  const supabase='https://abcdefghijklmnopqrst.supabase.co';
  const agentScopes='catalog:read quotes:create rental_requests:create rental_requests:read';
  const run=crypto.randomUUID();
  const sha=async(value:string)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
  beforeAll(async()=>{
    const module=await import(/* @vite-ignore */ new URL('../../../scripts/agent-booking/local-sql-rpc.mjs',import.meta.url).href);
    lab=module.createLocalSqlRpc(manifest);
    expect(lab.evidence).toMatchObject({environment:'owned-local-partial-schema',partialSchema:true,providerParity:false});
    as=await localAuthorizationServer();
    const provider={issuer,resource:apiResource,jwksUri:issuer+'/jwks',metadataUrl:new URL('/.well-known/oauth-protected-resource',apiResource).href,allowedHosts:[new URL(issuer).hostname,new URL(apiResource).hostname,new URL(customerOrigin).hostname],algorithms:['ES256'] as const,clientIds:consumerIds,maxTokenLifetimeSeconds:600};
    const config:RuntimeConfig={provider,introspectionUrl:issuer+'/introspect',introspectionAuthorization:basic,supabaseUrl:supabase,serviceKey:'synthetic-local-only',cursorKey:new Uint8Array(32).fill(12),consentOrigin:customerOrigin,browseEnabled:true,hosted:{frontendOrigin:customerOrigin,resource:apiResource,bridgeKey:Buffer.from(bridgeKey).toString('base64url'),hostedClientIds:['hosted-frontend']}};
    const apiFetch:typeof fetch=async(input,init)=>{
      const target=new URL(input instanceof Request?input.url:String(input));
      if(target.origin===issuer)return as.fetch(input,init);
      if(target.origin!==supabase||!/^\/rest\/v1\/rpc\/(?:external_[a-z_]+|agent_inventory_available|check_rate_limit)$/.test(target.pathname)||target.search||init?.method!=='POST'||new Headers(init.headers).get('authorization')!=='Bearer synthetic-local-only')throw new Error('invalid_local_egress');
      const name=target.pathname.split('/').at(-1)!;rpcNames.push(name);
      const reply=await lab.rpc(name,JSON.parse(String(init.body)));
      if(reply.error)rpcFailures.push({name,error:reply.error});
      return Response.json(reply.error??reply.data,{status:reply.error?400:200});
    };
    runtime=createRuntime(config,apiFetch,{keyResolver:createRemoteJWKSet(new URL(issuer+'/jwks'),{[customFetch]:as.fetch})});
    const auth:AuthConfig={issuer,resource:mcpResource,apiResource,jwksUri:issuer+'/jwks',introspectionUri:issuer+'/introspect',tokenUri:issuer+'/token',metadataUri:issuer+'/.well-known/oauth-authorization-server',resourceMetadataUri:new URL('/.well-known/oauth-protected-resource/mcp',mcpResource).href,allowedHosts:[...provider.allowedHosts,new URL(mcpResource).hostname],clientIds:consumerIds.filter(id=>id!=='hosted-frontend'),exchangeClientId:'composition-adapter',exchangeClientSecret:'synthetic-only',maxTokenLifetimeSeconds:600,requestsPerMinute:300};
    const app=createMcpApplication({auth,customerOrigin},async(input,init)=>{
      const url=new URL(input instanceof Request?input.url:String(input));
      if(url.origin===issuer)return as.fetch(input,init);
      if(url.origin===new URL(apiResource).origin)return runtime(new Request(input,init));
      throw new Error('invalid_local_egress');
    });
    listener=createNodeServer(app,mcpResource);await new Promise<void>(resolve=>listener.listen(0,'127.0.0.1',resolve));local='http://127.0.0.1:'+(listener.address() as {port:number}).port;
  },30000);
  afterAll(async()=>{
    if(lab)await lab.setFixtureAdmission(true);
    if(listener){listener.closeAllConnections();await new Promise<void>(resolve=>listener.close(()=>resolve()));}
    if(as)await as.close();
  },30000);
  async function hosted(subject:string,email:string,path:string,method:'GET'|'POST',body?:unknown){
    const raw=body===undefined?'':JSON.stringify(body),at=Math.floor(Date.now()/1000),token=await as.token('hosted-frontend',subject,apiResource,agentScopes);
    const url=new URL(apiResource+path),proof=await new SignJWT({provider_issuer:issuer,provider_subject:subject,client_id:'hosted-frontend',method,path:url.pathname,body_hash:await sha(raw),token_hash:await sha(token),csrf_hash:await sha('synthetic-csrf-'+subject),profile_email:email,profile_email_verified:true,profile_name:'Synthetic local renter'}).setProtectedHeader({alg:'HS256',typ:'exotiq-hosted-proof+jwt'}).setIssuer(customerOrigin).setAudience(apiResource).setIssuedAt(at).setExpirationTime(at+30).setJti(crypto.randomUUID()).sign(bridgeKey);
    return runtime(new Request(url,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json',Origin:customerOrigin,'X-Exotiq-Hosted-Proof':proof},...(body===undefined?{}:{body:raw})}));
  }
  const clientFetch:typeof fetch=async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    if(url.origin!==new URL(mcpResource).origin)throw new Error('invalid_client_transport');
    return new Promise<Response>((resolve,reject)=>{
      const request=httpRequest(local+url.pathname+url.search,{method:init?.method??'GET',headers:{...Object.fromEntries(new Headers(init?.headers)),Host:new URL(mcpResource).host},signal:init?.signal??undefined},response=>{
        const chunks:Buffer[]=[];response.on('data',chunk=>chunks.push(Buffer.from(chunk)));response.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:response.statusCode,headers:Object.fromEntries(Object.entries(response.headers).filter(([,v])=>typeof v==='string')) as Record<string,string>})));
      });request.on('error',reject);if(init?.body)request.write(init.body);request.end();
    });
  };
  const profiles=[['miami','legacy',1,1],['miami','modern',1,2],['tampa','legacy',2,3],['tampa','modern',2,4]] as const;
  it('the actual persisted limiter denies calls after its configured capacity',async()=>{
    const observations=[];
    for(let i=0;i<4;i++){
      const response=await lab.rpc('check_rate_limit',{_bucket:'external:composition:limiter:'+run,_limit:2,_window_seconds:3600});
      expect(response.error).toBeNull();observations.push(response.data);
    }
    expect(observations).toEqual([true,true,false,false]);
  },30000);
  for(const [market,era,operatorIndex,vehicleIndex]of profiles)it(market+' × '+era+' creates through hosted consent, replays and retains disabled-write continuity',async()=>{
    const clientId=era+'-'+market,subject='synthetic-'+clientId+'-'+run,email=clientId+'-'+run+'@example.invalid';
    const operator='a1200000-0000-4000-8000-'+String(operatorIndex).padStart(12,'0'),vehicle='b1200000-0000-4000-8000-'+String(vehicleIndex).padStart(12,'0');
    const window={operator_id:operator,vehicle_id:vehicle,pickup_at:'2035-01-01T10:00:00-05:00',return_at:'2035-01-03T10:00:00-05:00',timezone:'America/New_York'};
    const bearer=await as.token(clientId,subject,mcpResource,agentScopes);
    const client=new Client({name:'local-'+clientId,version:'1.0.0'},{versionNegotiation:{mode:era==='modern'?{pin:'2026-07-28'}:'legacy'}});
    await client.connect(new StreamableHTTPClientTransport(new URL(mcpResource),{fetch:clientFetch,requestInit:{headers:{authorization:'Bearer '+bearer}},onInsufficientScope:'throw'}));
    async function tool(name:string,args:Record<string,unknown>){const response=await client.callTool({name,arguments:args});expect(response.isError).not.toBe(true);return response.structuredContent as Record<string,unknown>;}
    try{
      expect(client.getProtocolEra()).toBe(era);
      const onboard=await hosted(subject,email,'/v1/customers/operator-links','POST',{operator_id:operator,full_name:'Synthetic local renter',phone:'2025550101',consented:true});expect(onboard.status,JSON.stringify(rpcFailures)).toBe(201);
      const discovery=await tool('search_vehicles',{operator_id:operator});expect(discovery.items).toEqual(expect.arrayContaining([expect.objectContaining({vehicle_id:vehicle})]));
      const available=await tool('check_availability',window);expect(available).toMatchObject({availability:'AVAILABLE',buffer_policy_version:'post-return-snapshot-v1/60'});
      const quote=await tool('create_quote',{...window,selected_options:['premium']});expect(quote).toMatchObject({total_cents:83587,holds_inventory:false});
      const key='local:'+clientId+'.'+run,args={quote_id:quote.quote_id,idempotency_key:key};
      expect(await tool('submit_rental_request',args)).toMatchObject({status:'awaiting_customer_consent'});
      const review=await hosted(subject,email,'/v1/quotes/'+quote.quote_id,'GET');expect(review.status).toBe(200);expect((await review.json() as {quote:{terms_hash:string}}).quote.terms_hash).toBe(quote.terms_hash);
      const consent=await hosted(subject,email,'/v1/quotes/'+quote.quote_id+'/consents','POST',{terms_hash:quote.terms_hash,action:'rental_requests:create',action_scopes:['rental_requests:read']});expect(consent.status).toBe(201);expect(await consent.json()).not.toHaveProperty('consent_receipt_id');
      const created=await tool('submit_rental_request',args);expect(created).toMatchObject({status:'pending_documents',next_action:'verify_identity'});expect(created).not.toHaveProperty('consent_receipt_id');
      await lab.setFixtureAdmission(false);
      const denied=await client.callTool({name:'create_quote',arguments:{...window,selected_options:['premium']}});expect(denied.isError).toBe(true);expect(denied.structuredContent).toMatchObject({code:'external_writes_disabled'});
      expect(await tool('submit_rental_request',args)).toEqual(created);
      const status=await tool('get_request_status',{ref:created.ref});expect(status).toMatchObject({status:'pending_documents',next_action:'verify_identity',links:{customer_account:customerOrigin+'/agent/account/'+operator+'?ref='+created.ref}});
      expect((status.links as Record<string,unknown>).identity).toBeUndefined();expect((status.links as Record<string,unknown>).checkout_handoff).toBeUndefined();
      expect(rpcNames).toContain('external_hosted_authorize_quote');expect(rpcNames).toContain('external_submit_rental_request_result');
    }finally{await lab.setFixtureAdmission(true);await client.close();}
  },180000);
});
