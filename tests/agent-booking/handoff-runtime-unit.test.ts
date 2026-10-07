import {expect,it} from 'vitest';
import {SignJWT,generateKeyPair,exportJWK,createLocalJWKSet,decodeJwt} from 'jose';
import {createRuntime} from '../../supabase/functions/external-booking-api/index.ts';
import {verifyInternalHandoff} from '../../supabase/functions/_shared/external-booking/internal-handoff.ts';
const resource='https://api.example.invalid/external-booking-api',issuer='https://issuer.example.invalid',origin='https://customer.example.invalid',now=Date.now(),bridgeKey=new Uint8Array(32).fill(4),internalKey='a'.repeat(43);
const hash=async(s:string)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
it('actual runtime composes real nonce RPC/provider bridge behind JWT, gateway, BFF and explicit Continue',async()=>{
 const pair=await generateKeyPair('ES256'),jwk=await exportJWK(pair.publicKey);Object.assign(jwk,{kid:'provider',alg:'ES256'});
 const token=async(client:string,scope:string)=>new SignJWT({scope,client_id:client}).setProtectedHeader({alg:'ES256',typ:'at+jwt',kid:'provider'}).setIssuer(issuer).setSubject('renter').setAudience(resource).setIssuedAt(Math.floor(now/1000)).setNotBefore(Math.floor(now/1000)).setExpirationTime(Math.floor(now/1000)+300).setJti('token-'+client).sign(pair.privateKey);
 const agent=await token('agent-a','rental_requests:read identity:handoff'),customer=await token('hosted','rental_requests:read identity:handoff checkout:handoff'),nonce='a'.repeat(43),expires=new Date(now+60000).toISOString(),calls:string[]=[],events:Record<string,unknown>[]=[],gatewayKey=new Uint8Array(32).fill(9);let providerCalls=0;
 const provider={issuer,resource,jwksUri:issuer+'/jwks',metadataUrl:'https://api.example.invalid/.well-known/oauth-protected-resource',allowedHosts:['issuer.example.invalid','api.example.invalid','customer.example.invalid'],algorithms:['ES256'] as const,clientIds:['hosted','agent-a'],maxTokenLifetimeSeconds:600};
 const runtime=createRuntime({provider,introspectionUrl:issuer+'/introspection',introspectionAuthorization:'Basic synthetic',supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',serviceKey:'synthetic',cursorKey:bridgeKey,consentOrigin:origin,browseEnabled:false,gatewayKey,hosted:{frontendOrigin:origin,resource,bridgeKey:Buffer.from(bridgeKey).toString('base64url'),hostedClientIds:['hosted']},handoff:{key:internalKey,mode:'test'}},async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname==='/introspection'){const claims=decodeJwt(new URLSearchParams(String(init?.body)).get('token')!);return Response.json({active:true,iss:claims.iss,sub:claims.sub,jti:claims.jti,client_id:claims.client_id,aud:claims.aud,exp:claims.exp,scope:claims.scope});}
  const name=url.pathname.split('/').at(-1)!,args=JSON.parse(String(init?.body));if(name==='check_rate_limit')return Response.json(true);
  calls.push(name);
  if(name==='external_enqueue_redacted_event'){events.push(args._event);return Response.json(true);}
  if(name==='external_create_customer_handoff')return Response.json({status:'pending_documents',source_checked_at:new Date(now).toISOString(),expires_at:expires});
  if(name==='external_review_customer_handoff')return Response.json({api_version:'v1',source_checked_at:new Date(now).toISOString(),ref:'owned-ref',operator_name:'Synthetic Operator',vehicle_name:'Synthetic Car',action:'identity',status:'pending_documents',expires_at:expires});
  if(name==='external_claim_customer_handoff')return Response.json({nonce_hash:await hash(nonce),claim_token:'00000000-0000-4000-8000-000000000001',action:'identity',booking_ref:'owned-ref',confirmation_token:'server-only-legacy',provider_session_ref:null,provider_attempt_key:'00000000-0000-4000-8000-000000000002',mode:'test',expires_at:expires});
  if(name==='identity-create-session'){
   providerCalls++;expect(url.origin).toBe('https://abcdefghijklmnopqrst.supabase.co');expect(args.confirmation_token).toBe('server-only-legacy');
   await verifyInternalHandoff(new Request(url,{method:'POST',headers:init?.headers,body:String(init?.body)}),'identity-create-session',args,internalKey,now);
   return Response.json({session_id:'vs_synthetic',url:'https://verify.stripe.com/start/synthetic'});
  }
  if(name==='external_complete_customer_handoff'){expect(args._provider_session_ref).toBe('vs_synthetic');return Response.json({source_checked_at:new Date(now).toISOString(),expires_at:expires});}
  throw new Error('Unexpected actual runtime RPC '+name);
 },{now:()=>now,keyResolver:createLocalJWKSet({keys:[jwk]})});
 const createPath='/v1/rental-requests/owned-ref/identity-handoff';
 const created=await runtime(new Request(resource+createPath,{method:'POST',headers:{authorization:'Bearer '+agent,'content-type':'application/json'},body:'{}'}));expect(created.status).toBe(201);const createdBody=await created.json();expect(createdBody.customer_url).toMatch(/^https:\/\/customer\.example\.invalid\/agent\/handoff\/[A-Za-z0-9_-]{43}$/);expect(providerCalls).toBe(0);
 async function browser(path:string,body?:unknown,gateway=false){
  const method=body?'POST':'GET',raw=body?JSON.stringify(body):'',proof=await new SignJWT({provider_issuer:issuer,provider_subject:'renter',client_id:'hosted',method,path:'/external-booking-api'+path,body_hash:await hash(raw),token_hash:await hash(customer),csrf_hash:'b'.repeat(64),profile_email:'renter@example.invalid',profile_email_verified:true,profile_name:'Synthetic Renter'}).setProtectedHeader({alg:'HS256',typ:'exotiq-hosted-proof+jwt'}).setIssuer(origin).setAudience(resource).setIssuedAt(Math.floor(now/1000)).setExpirationTime(Math.floor(now/1000)+30).setJti('browser-proof').sign(bridgeKey);
  const headers=new Headers({authorization:'Bearer '+customer,'X-Exotiq-Hosted-Proof':proof,origin,...(body?{'content-type':'application/json'}:{})});let url=resource+path;
  if(gateway){const rawPath='/functions/v1/external-booking-api'+path,at=String(now),key=await crypto.subtle.importKey('raw',gatewayKey,{name:'HMAC',hash:'SHA-256'},false,['sign']);headers.set('X-Exotiq-Gateway-Timestamp',at);headers.set('X-Exotiq-Gateway-Proof',Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(at+'\n'+method+'\n'+rawPath+'\n'+await hash(raw)))).toString('hex'));url='https://abcdefghijklmnopqrst.supabase.co'+rawPath;}
  return new Request(url,{method,headers,...(body?{body:raw}:{})});
 }
 const review='/v1/customer-handoffs/'+nonce+'/review',resolve='/v1/customer-handoffs/'+nonce+'/resolve';
 expect((await runtime(await browser(review,undefined,true))).status).toBe(200);expect(providerCalls).toBe(0);
 expect((await runtime(new Request(resource+resolve,{method:'POST',headers:{authorization:'Bearer '+customer,'content-type':'application/json'},body:'{"action":"continue"}'}))).status).toBe(401);expect(providerCalls).toBe(0);
 const resolved=await runtime(await browser(resolve,{action:'continue'},true));expect(resolved.status).toBe(200);const publicBody=await resolved.json();expect(publicBody.provider_url).toBe('https://verify.stripe.com/start/synthetic');expect(JSON.stringify(publicBody)).not.toMatch(/server-only-legacy|claim_token|session_id|client_secret|nonce_hash/);expect(providerCalls).toBe(1);
 expect(calls).toEqual(['external_create_customer_handoff','external_enqueue_redacted_event','external_review_customer_handoff','external_enqueue_redacted_event','external_claim_customer_handoff','identity-create-session','external_complete_customer_handoff','external_enqueue_redacted_event']);
 expect(events.map(event=>[event.action,event.outcome])).toEqual([['identity:handoff','success'],['nonce:resolve','denied'],['nonce:resolve','success']]);
 expect(events.every(event=>typeof event.request_id==='string'&&/^[a-f0-9-]{36}$/.test(event.request_id))).toBe(true);
 expect(JSON.stringify(events)).not.toMatch(/server-only-legacy|renter|nonce_hash|receipt|stripe|Bearer|claim_token|provider_url/);
});
