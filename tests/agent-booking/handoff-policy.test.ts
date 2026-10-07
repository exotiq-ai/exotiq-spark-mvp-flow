// Offline nonce/provider policy. Actual SQL and source compatibility have
// separate guarded local suites; no provider registration proof is implied.
import {expect,it} from 'vitest';
import {safeProviderUrl,generateHandoffNonce} from '../../supabase/functions/_shared/external-booking/handoff-store.ts';
import {createHandoffExtension} from '../../supabase/functions/_shared/external-booking/handoff-routes.ts';
it('creates256bit opaque rendezvous values and stores only their SHA256 hash',async()=>{const nonce=await generateHandoffNonce();expect(nonce.value).toMatch(/^[A-Za-z0-9_-]{43}$/);expect(nonce.hash).toMatch(/^[a-f0-9]{64}$/);expect(nonce.hash).not.toContain(nonce.value);expect((await generateHandoffNonce()).value).not.toBe(nonce.value);});
it.each(['https://checkout.stripe.com.evil.test/c/pay/test','http://checkout.stripe.com/c/pay/test','https://name:password@checkout.stripe.com/c/pay/test','https://checkout.stripe.com:444/c/pay/test','https://checkout.stripe.com/c/pay/test#fragment','https://checkout.stripe.com/c/pay/test?token=legacy','https://verify.stripe.com/test'])('denies substituted/credential provider URL%s',url=>{expect(()=>safeProviderUrl(url,'checkout')).toThrow();});
it('allows exact hosted provider URLs only for their own action',()=>{expect(safeProviderUrl('https://checkout.stripe.com/c/pay/test','checkout')).toBe('https://checkout.stripe.com/c/pay/test');expect(safeProviderUrl('https://verify.stripe.com/start/test','identity')).toBe('https://verify.stripe.com/start/test');});
it('requires explicit customer Continue and BFF proof, never starts provider on review or missingproof',async()=>{
 let providers=0,stores=0;const run=createHandoffExtension({auth:{requirePrincipal:async()=>({issuer:'https://issuer.example.test',subject:'customer',clientId:'hosted',audience:'https://api.example.test',tokenId:'fixture',scopes:['rental_requests:read']})},rpc:{rpc:async()=>{stores++;return {data:null,error:null};}},hosted:{frontendOrigin:'https://customer.example.test',resource:'https://api.example.test',bridgeKey:'a'.repeat(43),hostedClientIds:['hosted']},customerOrigin:'https://customer.example.test',mode:'test',provider:{resolve:async()=>{providers++;return {url:'https://verify.stripe.com/start/test',sessionId:'vs_test'};}}});
 const path='/v1/customer-handoffs/'+'a'.repeat(43)+'/resolve';
 await expect(run(new Request('https://api.example.test'+path,{method:'POST'}),path,{action:'continue'})).rejects.toMatchObject({code:'unauthorized'});expect(providers).toBe(0);expect(stores).toBe(0);
 await expect(run(new Request('https://api.example.test'+path,{method:'POST'}),path,{action:'automatic'})).rejects.toMatchObject({code:'invalid_input'});
});
