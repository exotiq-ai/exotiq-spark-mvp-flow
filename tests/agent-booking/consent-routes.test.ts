import {expect,it} from 'vitest';
import {SignJWT} from 'jose';
import {createConsentExtension} from '../../supabase/functions/_shared/external-booking/consent-routes.ts';
const resource='https://api.example.invalid/external-booking-api',origin='https://rent.example.invalid',now=Date.parse('2030-01-01T00:00:00Z');
const key=new Uint8Array(32).fill(4),principal={issuer:'https://issuer.example.invalid',subject:'renter',clientId:'hosted',audience:resource,tokenId:'token',scopes:['quotes:create','rental_requests:read'] as const};
const config={frontendOrigin:origin,resource,bridgeKey:Buffer.from(key).toString('base64url'),hostedClientIds:['hosted']};
const quote='10000000-0000-4000-8000-000000000001',operator='20000000-0000-4000-8000-000000000001';
const hash=async(s:string)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
async function request(path:string,body:unknown,claims:Record<string,unknown>={}){
 const raw=JSON.stringify(body),jwt=await new SignJWT({provider_issuer:principal.issuer,provider_subject:principal.subject,client_id:principal.clientId,method:'POST',path:'/external-booking-api'+path,body_hash:await hash(raw),token_hash:await hash('synthetic'),csrf_hash:'a'.repeat(64),profile_email:'renter@example.invalid',profile_email_verified:true,profile_name:'Synthetic Renter',...claims}).setProtectedHeader({alg:'HS256',typ:'exotiq-hosted-proof+jwt'}).setIssuer(origin).setAudience(resource).setIssuedAt(now/1000).setExpirationTime(now/1000+30).setJti('synthetic-proof').sign(key);
 return new Request(resource+path,{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json','X-Exotiq-Hosted-Proof':jwt,origin},body:raw});
}
function extension(reply:unknown,rows:Array<{name:string,args:Record<string,unknown>}>){return createConsentExtension({auth:{requirePrincipal:async()=>principal},rpc:{rpc:async(name:string,args:Record<string,unknown>)=>{rows.push({name,args});return {data:reply,error:null};}},hosted:config,consentOrigin:origin,now:()=>now});}
it('requires signed hosted proof before consent SQL and keeps browser result receipt-free',async()=>{
 const rows:Array<{name:string,args:Record<string,unknown>}>=[],body={terms_hash:'b'.repeat(64),action:'rental_requests:create'};
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
