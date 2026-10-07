import {createRuntime} from '../../supabase/functions/external-booking-api/index.ts';
import {expect,it} from 'vitest';
import {SignJWT,generateKeyPair,exportJWK,createLocalJWKSet} from 'jose';
import {createConsentExtension} from '../../supabase/functions/_shared/external-booking/consent-routes.ts';
const resource='https://api.example.invalid/external-booking-api',origin='https://rent.example.invalid',now=Date.parse('2030-01-01T00:00:00Z');
const key=new Uint8Array(32).fill(4),principal={issuer:'https://issuer.example.invalid',subject:'renter',clientId:'hosted',audience:resource,tokenId:'token',scopes:['quotes:create','rental_requests:read'] as const};
const config={frontendOrigin:origin,resource,bridgeKey:Buffer.from(key).toString('base64url'),hostedClientIds:['hosted']};
const quote='10000000-0000-4000-8000-000000000001',operator='20000000-0000-4000-8000-000000000001';
const hash=async(s:string)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
async function request(path:string,body:unknown,claims:Record<string,unknown>={},bearer="synthetic"){
 const raw=JSON.stringify(body),jwt=await new SignJWT({provider_issuer:principal.issuer,provider_subject:principal.subject,client_id:principal.clientId,method:'POST',path:'/external-booking-api'+path,body_hash:await hash(raw),token_hash:await hash(bearer),csrf_hash:'a'.repeat(64),profile_email:'renter@example.invalid',profile_email_verified:true,profile_name:'Synthetic Renter',...claims}).setProtectedHeader({alg:'HS256',typ:'exotiq-hosted-proof+jwt'}).setIssuer(origin).setAudience(resource).setIssuedAt(now/1000).setExpirationTime(now/1000+30).setJti('synthetic-proof').sign(key);
 return new Request(resource+path,{method:'POST',headers:{authorization:'Bearer '+bearer,'content-type':'application/json','X-Exotiq-Hosted-Proof':jwt,origin},body:raw});
}
function extension(reply:unknown,rows:Array<{name:string,args:Record<string,unknown>}>){return createConsentExtension({auth:{requirePrincipal:async()=>principal},rpc:{rpc:async(name:string,args:Record<string,unknown>)=>{rows.push({name,args});return {data:reply,error:null};}},hosted:config,consentOrigin:origin,now:()=>now});}
it('requires signed hosted proof before consent SQL and keeps browser result receipt-free',async()=>{
 const rows:Array<{name:string,args:Record<string,unknown>}>=[],body={terms_hash:'b'.repeat(64),action:'rental_requests:create',action_scopes:['rental_requests:read','identity:handoff']};
 const route=extension({api_version:'v1',source_checked_at:new Date(now).toISOString(),quote_id:quote,state:'authorized',expires_at:new Date(now+60000).toISOString()},rows),path='/v1/quotes/'+quote+'/consents';
 await expect(route(new Request(resource+path,{method:'POST',body:JSON.stringify(body)}),path,body)).rejects.toMatchObject({code:'unauthorized'});expect(rows).toHaveLength(0);
 const result=await route(await request(path,body),path,body);expect(result?.status).toBe(201);expect(await result!.json()).not.toHaveProperty('consent_receipt_id');expect(rows[0].args).toMatchObject({_issuer:principal.issuer,_subject:principal.subject,_csrf_hash:'a'.repeat(64)});
});
it.each([{provider_subject:'other'},{csrf_hash:'bad'},{profile_email_verified:false}])('denies invalid signed binding or unverified email onboarding %j',async claims=>{
 const rows:Array<{name:string,args:Record<string,unknown>}>=[],route=extension({},rows),path='/v1/customers/operator-links',body={operator_id:operator,phone:'2025550101',full_name:'Synthetic Renter',consented:true};
 await expect(route(await request(path,body,claims),path,body)).rejects.toMatchObject({code:'unauthorized'});expect(rows).toHaveLength(0);
});
it('never accepts typed email/customer/subject claims in onboarding body',async()=>{
 const rows:Array<{name:string,args:Record<string,unknown>}>=[],route=extension({},rows),path='/v1/customers/operator-links',body={operator_id:operator,phone:'2025550101',full_name:'Synthetic Renter',consented:true,email:'victim@example.invalid',customer_id:quote};
 await expect(route(await request(path,body),path,body)).rejects.toMatchObject({code:'invalid_input'});expect(rows).toHaveLength(0);
});
it('agent rendezvous waits with expiry/retry and returns matched consumed receipt for replay only',async()=>{
 const delegated={...principal,clientId:'agent-a',scopes:['rental_requests:create'] as const},path='/v1/quotes/'+quote+'/consent-result',req=new Request(resource+path,{headers:{authorization:'Bearer synthetic'}});
 let ready=false;const route=createConsentExtension({auth:{requirePrincipal:async()=>delegated},hosted:config,consentOrigin:origin,now:()=>now,rpc:{rpc:async()=>({data:{api_version:'v1',source_checked_at:new Date(now).toISOString(),quote_id:quote,state:ready?'authorized':'waiting',expires_at:new Date(now-1000).toISOString(),...(ready?{consent_receipt_id:operator}:{})},error:null})}});
 const waiting=await route(req,path,undefined);expect(waiting?.status).toBe(202);expect(waiting?.headers.get('Retry-After')).toBe('5');expect(await waiting!.json()).not.toHaveProperty('consent_receipt_id');
 ready=true;const result=await route(req,path,undefined);expect(result?.status).toBe(200);expect(await result!.json()).toHaveProperty('consent_receipt_id',operator);
});
it('denies wrong browser origin and invalid renewal completion bodies before SQL writes',async()=>{
 const rows:Array<{name:string,args:Record<string,unknown>}>=[],route=extension({},rows),path='/v1/quotes/'+quote+'/consents',body={terms_hash:'b'.repeat(64),action:'rental_requests:create',action_scopes:['rental_requests:read','identity:handoff']};
 const signed=await request(path,body),headers=new Headers(signed.headers);headers.set('origin','https://attacker.example.invalid');
 await expect(route(new Request(signed.url,{method:'POST',headers,body:JSON.stringify(body)}),path,body)).rejects.toMatchObject({code:'unauthorized'});
 const renewalPath='/v1/grant-renewals/'+quote+'/complete',invalid={action_scopes:['catalog:read'],explicit_new_delegation:false,consented:true};
 await expect(route(await request(renewalPath,invalid),renewalPath,invalid)).rejects.toMatchObject({code:'invalid_input'});expect(rows).toHaveLength(0);
});
it('actual runtime verifies signed resource JWT, introspection, gateway proof and BFF proof before narrow SQL',async()=>{
 const pair=await generateKeyPair('ES256'),jwk=await exportJWK(pair.publicKey);Object.assign(jwk,{kid:'provider',alg:'ES256'});
 const scope='quotes:create rental_requests:read',tokenId='signed-fixture-token',expires=now/1000+300;
 const token=await new SignJWT({scope,client_id:'hosted'}).setProtectedHeader({alg:'ES256',typ:'at+jwt',kid:'provider'}).setIssuer(principal.issuer).setSubject(principal.subject).setAudience(resource).setIssuedAt(now/1000).setNotBefore(now/1000).setExpirationTime(expires).setJti(tokenId).sign(pair.privateKey);
 const provider={issuer:principal.issuer,resource,jwksUri:principal.issuer+'/jwks',metadataUrl:'https://api.example.invalid/.well-known/oauth-protected-resource',allowedHosts:['issuer.example.invalid','api.example.invalid','rent.example.invalid'],algorithms:['ES256'] as const,clientIds:['hosted','agent-a'],maxTokenLifetimeSeconds:600};
 const gatewayKey=new Uint8Array(32).fill(9),calls:Array<{name:string,args:Record<string,unknown>}>=[];
 const runtime=createRuntime({provider,introspectionUrl:principal.issuer+'/introspection',introspectionAuthorization:'Basic synthetic',supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',serviceKey:'synthetic',cursorKey:key,consentOrigin:origin,browseEnabled:false,hosted:config,gatewayKey},async(input,init)=>{
  const url=new URL(String(input));if(url.pathname==='/introspection')return Response.json({active:true,iss:principal.issuer,sub:principal.subject,client_id:'hosted',jti:tokenId,aud:resource,exp:expires,scope});
  const name=url.pathname.split('/').at(-1)!,args=JSON.parse(String(init?.body));if(name==='check_rate_limit')return Response.json(true);
  calls.push({name,args});return Response.json({api_version:'v1',source_checked_at:new Date(now).toISOString(),operator_id:operator,state:'linked'});
 },{now:()=>now,keyResolver:createLocalJWKSet({keys:[jwk]})});
 const path='/v1/customers/operator-links',body={operator_id:operator,full_name:'Display name',phone:'2025550101',consented:true},raw=JSON.stringify(body),publicRequest=await request(path,body,{},token),headers=new Headers(publicRequest.headers);
 const rawPath='/functions/v1/external-booking-api'+path,at=String(now),gatewayMessage=at+'\nPOST\n'+rawPath+'\n'+await hash(raw);
 const hmac=await crypto.subtle.importKey('raw',gatewayKey,{name:'HMAC',hash:'SHA-256'},false,['sign']);headers.set('X-Exotiq-Gateway-Timestamp',at);headers.set('X-Exotiq-Gateway-Proof',Buffer.from(await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode(gatewayMessage))).toString('hex'));
 const result=await runtime(new Request('https://abcdefghijklmnopqrst.supabase.co'+rawPath,{method:'POST',headers,body:raw}));
 expect(result.status).toBe(201);expect(calls).toHaveLength(1);expect(calls[0]).toMatchObject({name:'external_hosted_link_customer',args:{_email:'renter@example.invalid',_subject:'renter',_client_id:'hosted'}});
 // A valid managed bearer alone still cannot authorize customer mutation.
 const missing=new Headers(publicRequest.headers);missing.delete('X-Exotiq-Hosted-Proof');
 expect((await runtime(new Request(publicRequest.url,{method:'POST',headers:missing,body:raw}))).status).toBe(401);expect(calls).toHaveLength(1);
});
