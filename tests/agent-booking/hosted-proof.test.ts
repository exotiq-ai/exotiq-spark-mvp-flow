import {describe,it,expect} from 'vitest';
import {SignJWT} from 'jose';
import {verifyHostedProof} from '../../supabase/functions/_shared/external-booking/hosted-proof.ts';
const now=new Date('2030-01-01T00:00:00Z'),resource='https://api.example.invalid/external-booking-api',front='https://rent.example.invalid';
const key=new Uint8Array(32).fill(4),cfg={frontendOrigin:front,resource,bridgeKey:Buffer.from(key).toString('base64url'),hostedClientIds:['hosted-customer']};
const principal={issuer:'https://identity.example.invalid',subject:'renter',clientId:'hosted-customer',audience:resource,scopes:['quotes:create'] as const,tokenId:'token'};
const path='/external-booking-api/v1/quotes/10000000-0000-4000-8000-000000000008/consents',body='{"terms_hash":"exact"}',token='synthetic-only-access-token';
async function hash(x:string){return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x))).toString('hex');}
async function request(changes:Record<string,unknown>={},keyOverride=key){
 const second=now.getTime()/1000;const jwt=await new SignJWT({provider_issuer:principal.issuer,provider_subject:principal.subject,client_id:principal.clientId,method:'POST',path,body_hash:await hash(body),token_hash:await hash(token),csrf_hash:'a'.repeat(64),profile_email:'renter@example.invalid',profile_email_verified:true,profile_name:'Synthetic Renter',...changes}).setProtectedHeader({alg:'HS256',typ:'exotiq-hosted-proof+jwt'}).setIssuer(front).setAudience(resource).setIssuedAt(second).setExpirationTime(second+30).setJti('synthetic-proof').sign(keyOverride);
 return new Request(resource+'/v1/quotes/10000000-0000-4000-8000-000000000008/consents',{method:'POST',body,headers:{authorization:'Bearer '+token,'X-Exotiq-Hosted-Proof':jwt}});
}
describe('trusted hosted proof request binding',()=>{
 it('verifies actual signature plus original resource principal and exact request',async()=>{const p=await verifyHostedProof(await request(),principal,cfg,now);expect(p.csrfHash).toBe('a'.repeat(64));expect(p.profile.emailVerified).toBe(true);expect(JSON.stringify(p)).not.toContain(token);});
 it.each([{method:'GET'},{path:'/admin'},{body_hash:'b'.repeat(64)},{token_hash:'c'.repeat(64)},{provider_subject:'other'},{provider_issuer:'https://other.example.invalid'},{client_id:'agent-client'},{csrf_hash:'bad'}])('denies signed request/binding mismatch %j',async(change)=>{await expect(verifyHostedProof(await request(change),principal,cfg,now)).rejects.toThrow();});
 it('denies other signature, missing bridge configuration and unapproved customer client',async()=>{
  await expect(verifyHostedProof(await request({},new Uint8Array(32).fill(5)),principal,cfg,now)).rejects.toThrow();await expect(verifyHostedProof(await request(),principal,null,now)).rejects.toThrow();await expect(verifyHostedProof(await request(),{...principal,clientId:'agent-client'},cfg,now)).rejects.toThrow();
 });
 it('denies expired proofs and bearer replay to a different request',async()=>{await expect(verifyHostedProof(await request(),principal,cfg,new Date(now.getTime()+31000))).rejects.toThrow();const r=await request();await expect(verifyHostedProof(new Request(r.url,{method:'POST',headers:r.headers,body:'{"terms_hash":"changed"}'}),principal,cfg,now)).rejects.toThrow();});
});
