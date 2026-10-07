import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
import {settlementEvidence,applyIdentityEvent,reconcileBooking,sourceAmountCents,snapshotFeeCents} from '../../supabase/functions/_shared/external-booking/lifecycle';
const expected={bookingRef:'agent-test-booking',leg:'operator' as const,mode:'test' as const,amountCents:10000,currency:'usd',operatorAccount:'acct_synthetic'};
const intent=()=>({id:'pi_synthetic',status:'succeeded',amount:10000,amount_received:10000,currency:'usd',livemode:false,metadata:{booking_ref:expected.bookingRef,leg:'operator_rental',stripe_mode:'test'},transfer_data:{destination:'acct_synthetic'}});
/** Execute the actual edge handler source with offline SDK/transport doubles.
 * These are wiring/fault tests, not Stripe signature or database proof. */
function edgeHandler(path:string,db:unknown,stripe:unknown){
 let handler:((request:Request)=>Promise<Response>)|undefined;
 const output=transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText;
 const fakeRequire=(name:string)=>{
  if(name.includes('/http/server'))return {serve:(callback:typeof handler)=>{handler=callback;}};
  if(name.includes('esm.sh/stripe'))return {default:class{constructor(){return stripe;}}};
  if(name.includes('esm.sh/@supabase'))return {createClient:()=>db};
  if(name.includes('external-booking/lifecycle'))return {applyIdentityEvent,reconcileBooking,settlementEvidence};
  if(name.includes('rentEmail'))return {sendRenterEmail:async()=>({message_id:'synthetic'}),resolveRenterReplyTo:()=>''};
  if(name.includes('rentFormat'))return {computePaymentDueAt:()=>new Date().toISOString()};
  throw new Error('Unconfigured source import: '+name);
 };
 const module={exports:{}};
 new Function('require','module','exports','Deno',output)(fakeRequire,module,module.exports,{env:{get:(name:string)=>name.includes('SECRET_KEY')?'sk_test_synthetic':name.includes('WEBHOOK_SECRET')?'synthetic':undefined}});
 if(!handler)throw new Error('Actual edge entry did not mount');return handler;
}
describe('trusted financial and identity lifecycle',()=>{
 it('converts source money exactly without rounding or accepting missing fee snapshots',()=>{
  expect(sourceAmountCents(0.29)).toBe(29);expect(sourceAmountCents('99999999.99')).toBe(9999999999);
  for(const amount of ['1.005',null,-1,'1e3'])expect(()=>sourceAmountCents(amount)).toThrow();
  expect(()=>snapshotFeeCents({platform_fee_cents:null,protection_total_cents:0,state_fee_cents:0,processing_fee_cents:0})).toThrow();
 });
 it('requires settled status, exact amount/currency/leg/mode and operator destination',()=>{
  expect(settlementEvidence(intent(),expected)).toMatchObject({intentId:'pi_synthetic',amountCents:10000});
  for(const patch of [{status:'processing'},{status:'requires_action'},{amount_received:9999},{amount:9999},{currency:'eur'},{livemode:true},{metadata:{booking_ref:'other'}},{transfer_data:{destination:'acct_other'}}]) expect(()=>settlementEvidence({...intent(),...patch},expected)).toThrow();
 });
 it('propagates database failure so identity retry is never acknowledged as completion',async()=>{
  const event={id:'evt_identity',created:1700000000,type:'identity.verification_session.verified'};
  const session={id:'vs_synthetic',status:'verified',documentExpiry:'2036-01-01',verifiedName:'Synthetic Customer'};
  let attempts=0;
  const client={rpc:async()=>{attempts++;return attempts===1?{data:null,error:{message:'promotion failed'}}:{data:{applied:true},error:null};}};
  await expect(applyIdentityEvent(client,event,session)).rejects.toThrow();
  await expect(applyIdentityEvent(client,event,session)).resolves.toEqual({applied:true});expect(attempts).toBe(2);
 });
 it('refuses verified identity without a real document expiry and rejects failed reconciliation',async()=>{
  const client={rpc:async()=>({data:null,error:{message:'secret'}})};
  await expect(applyIdentityEvent(client,{id:'evt_identity',created:1700000000,type:'identity.verification_session.verified'},{id:'vs_synthetic',status:'verified',documentExpiry:null})).rejects.toThrow();
  await expect(reconcileBooking(client,'agent-test-booking','test')).rejects.toThrow();
 });
 it('actual identity handler returns retryable failure before durable completion, then reprocesses delivery',async()=>{
  let calls=0;
  const event={id:'evt_identity',created:1700000000,type:'identity.verification_session.verified',livemode:false,data:{object:{id:'vs_synthetic'}}};
  const stripe={webhooks:{constructEventAsync:async()=>event},identity:{verificationSessions:{retrieve:async()=>({id:'vs_synthetic',status:'verified',livemode:false,last_verification_report:'vr_synthetic',verified_outputs:{first_name:'Synthetic'}})},verificationReports:{retrieve:async()=>({document:{expiration_date:{year:2036,month:1,day:1}}})}}};
  const handler=edgeHandler('supabase/functions/identity-webhook/index.ts',{rpc:async(name:string)=>{expect(name).toBe('external_apply_identity_event');calls++;return calls===1?{data:null,error:{message:'promotion failed'}}:{data:{applied:false,duplicate:true},error:null};}},stripe);
  const request=()=>new Request('https://api.example.invalid/identity-webhook',{method:'POST',headers:{'stripe-signature':'synthetic'},body:'{}'});
  expect((await handler(request())).status).toBe(500);expect((await handler(request())).status).toBe(200);expect(calls).toBe(2);
 });
 it('actual identity handler never persists verified status after failed report retrieval',async()=>{
  let calls=0;
  const handler=edgeHandler('supabase/functions/identity-webhook/index.ts',{rpc:async()=>{calls++;return {data:null,error:null};}},{webhooks:{constructEventAsync:async()=>({id:'evt_identity',created:1700000000,type:'identity.verification_session.verified',livemode:false,data:{object:{id:'vs_synthetic'}}})},identity:{verificationSessions:{retrieve:async()=>({id:'vs_synthetic',status:'verified',livemode:false,last_verification_report:'vr_synthetic'})},verificationReports:{retrieve:async()=>{throw new Error('secret');}}}});
  expect((await handler(new Request('https://api.example.invalid/identity-webhook',{method:'POST',headers:{'stripe-signature':'synthetic'},body:'{}'}))).status).toBe(500);expect(calls).toBe(0);
 });
 it('actual operator approval handler denies a renter without active operator membership',async()=>{
  let writes=0;
  const db={auth:{getUser:async()=>({data:{user:{id:'renter'}},error:null})},from:(table:string)=>{const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:table==='bookings'?{id:'synthetic-booking',team_id:'operator',status:'requested',booking_source:'marketplace'}:null,error:null}),update:()=>{writes++;return chain;}};return chain;},rpc:async()=>({data:false,error:null})};
  const handler=edgeHandler('supabase/functions/rent-approve-booking/index.ts',db,{});
  expect((await handler(new Request('https://api.example.invalid/rent-approve-booking',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify({booking_id:'synthetic-booking'})}))).status).toBe(403);expect(writes).toBe(0);
 });
});
