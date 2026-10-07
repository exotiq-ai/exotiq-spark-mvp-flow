import {expect,it} from 'vitest';
import {signInternalHandoff,verifyInternalHandoff} from '../../supabase/functions/_shared/external-booking/internal-handoff.ts';
import {resolveIdentityProvider,validateCheckoutSession,customerReturnBase} from '../../supabase/functions/_shared/external-booking/provider-handoff.ts';
const key='a'.repeat(43),now=Date.now(),ctx={customer_id:'customer',operator_id:'10000000-0000-4000-8000-000000000001',booking_ref:'owned-ref',provider_attempt_key:'00000000-0000-4000-8000-000000000001',mode:'test'},body={booking_ref:'owned-ref',external_handoff:{nonce_hash:'a'.repeat(64),claim_token:'00000000-0000-4000-8000-000000000001'}};
it('real internal HMAC binds endpoint/body/time and rejects unsigned, changed and expired proofs',async()=>{
 const signed=await signInternalHandoff('identity-create-session',body,key,now),request=new Request('https://api.example.test/internal',{headers:{'X-Exotiq-Handoff-Timestamp':signed.timestamp,'X-Exotiq-Handoff-Proof':signed.proof}});
 await expect(verifyInternalHandoff(request,'identity-create-session',body,key,now)).resolves.toBeUndefined();
 await expect(verifyInternalHandoff(request,'rent-checkout',body,key,now)).rejects.toMatchObject({code:'unauthorized'});
 await expect(verifyInternalHandoff(request,'identity-create-session',{...body,booking_ref:'other'},key,now)).rejects.toMatchObject({code:'unauthorized'});
 await expect(verifyInternalHandoff(request,'identity-create-session',body,key,now+30001)).rejects.toMatchObject({code:'unauthorized'});
});
it('retries identity by persisted keyed session; never queries old guest verification or exposes client_secret',async()=>{
 let creates=0,retrieves=0,records=0;
 const db:any={from:()=>{throw new Error('Guest identity query forbidden');},rpc:async(name:string,args:any)=>{expect(name).toBe('external_record_handoff_provider_session');expect(args._provider_session_ref).toBe('vs_synthetic');records++;return {data:true,error:null};}};
 const stripe:any={identity:{verificationSessions:{create:async()=>{creates++;throw new Error('Unexpected new session');},retrieve:async(id:string)=>{retrieves++;expect(id).toBe('vs_synthetic');return {id,livemode:false,status:'requires_input',metadata:{customer_id:ctx.customer_id,booking_ref:ctx.booking_ref},url:'https://verify.stripe.com/start/synthetic',client_secret:'must_not_escape'};}}}};
 const result=await resolveIdentityProvider(db,stripe,body,{...ctx,provider_session_ref:'vs_synthetic'},'test','https://customer.example.test');
 expect(result).toEqual({session_id:'vs_synthetic',url:'https://verify.stripe.com/start/synthetic'});expect({creates,retrieves,records}).toEqual({creates:0,retrieves:1,records:1});
});
it.each([{livemode:true},{status:'processing'},{status:'verified'},{metadata:{customer_id:'other',booking_ref:'owned-ref'}},{metadata:{customer_id:'customer',booking_ref:'other'}}])('denies identity mode/state/owner substitution %j before recording',async patch=>{
 let records=0;const db:any={rpc:async()=>{records++;return {data:true,error:null};}},stripe:any={identity:{verificationSessions:{retrieve:async()=>({id:'vs_synthetic',livemode:false,status:'requires_input',metadata:{customer_id:ctx.customer_id,booking_ref:ctx.booking_ref},url:'https://verify.stripe.com/start/synthetic',...patch})}}};
 await expect(resolveIdentityProvider(db,stripe,body,{...ctx,provider_session_ref:'vs_synthetic'},'test','https://customer.example.test')).rejects.toMatchObject({code:'forbidden'});expect(records).toBe(0);
});
it('persists identity reference before returning a URL; failed durable recording remains retryable',async()=>{
 const db:any={rpc:async()=>({data:null,error:{message:'database transport ambiguity'}})},stripe:any={identity:{verificationSessions:{create:async(parameters:any,options:any)=>{expect(options.idempotencyKey).toBe('external-identity-'+ctx.provider_attempt_key);expect(parameters.return_url).toBe('https://customer.example.test/agent/account/'+ctx.operator_id+'?booking_ref=owned-ref&action=identity');expect(JSON.stringify(parameters)).not.toContain('confirmation_token');return {id:'vs_synthetic',livemode:false,status:'requires_input',metadata:{customer_id:ctx.customer_id,booking_ref:ctx.booking_ref},url:'https://verify.stripe.com/start/synthetic'};}}}};
 await expect(resolveIdentityProvider(db,stripe,body,ctx,'test','https://customer.example.test')).rejects.toMatchObject({code:'upstream_unavailable'});
});
it('requires current open/unpaid checkout exact amount/mode/metadata and safe frozen return URLs',()=>{
 const base=customerReturnBase('https://customer.example.test',ctx.operator_id,ctx.booking_ref,'checkout'),booking={booking_ref:ctx.booking_ref,total_value:100},session={status:'open',payment_status:'unpaid',livemode:false,expires_at:Math.floor(Date.now()/1000)+600,amount_total:10000,currency:'usd',metadata:{booking_ref:ctx.booking_ref,leg:'operator_rental',stripe_mode:'test'},success_url:base+'&payment=success',cancel_url:base+'&payment=cancelled',url:'https://checkout.stripe.com/c/pay/synthetic'};
 expect(validateCheckoutSession(session,booking,'test',base)).toBe(session.url);
 for(const patch of [{status:'complete'},{payment_status:'paid'},{amount_total:9999},{livemode:true},{expires_at:1},{success_url:'https://customer.example.test/booking/owned-ref?t=legacy'}])expect(()=>validateCheckoutSession({...session,...patch},booking,'test',base)).toThrow();
});
