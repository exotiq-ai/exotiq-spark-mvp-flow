import {describe,it,expect} from 'vitest';
import {settlementEvidence,applyIdentityEvent,reconcileBooking} from '../../supabase/functions/_shared/external-booking/lifecycle';
const expected={bookingRef:'agent-test-booking',leg:'operator' as const,mode:'test' as const,amountCents:10000,currency:'usd',operatorAccount:'acct_synthetic'};
const intent=()=>({id:'pi_synthetic',status:'succeeded',amount:10000,amount_received:10000,currency:'usd',livemode:false,metadata:{booking_ref:expected.bookingRef,leg:'operator_rental',stripe_mode:'test'},transfer_data:{destination:'acct_synthetic'}});
describe('trusted financial and identity lifecycle',()=>{
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
});
