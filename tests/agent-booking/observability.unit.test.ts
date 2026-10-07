import {describe,it,expect} from 'vitest';
import {redactedEvent,principalPseudonym,emitEvent} from '../../supabase/functions/_shared/external-booking/observability';
const event={request_id:'synthetic_request_150001',operator_id:'a1500000-0000-4000-8000-000000000001',action:'quote:create',outcome:'success',latency_ms:23};
describe('redacted durable telemetry',()=>{
 it('drops credentials, customer fields, URLs, receipts, nonce and arbitrary errors before persistence',()=>{
  const safe=redactedEvent({...event,authorization:'Bearer secret',email:'private@example.invalid',customer_name:'Private',consent_receipt:'receipt',nonce:'nonce',url:'https://customer.invalid/token',error:'credential'});
  expect(safe).toEqual(event);expect(JSON.stringify(safe)).not.toMatch(/secret|Private|receipt|nonce|token|credential/);
 });
 it('does not accept secrets smuggled into allowlisted strings or metrics',()=>{
  for(const patch of [{request_id:'Bearer credential'},{action:'https://secret.invalid'},{outcome:'private@example.invalid'},{terms_version:'token=private'},{principal_pseudonym:'Bearer private'},{latency_ms:-1}])expect(()=>redactedEvent({...event,...patch})).toThrow();
 });
 it('uses a keyed pseudonym instead of emitting issuer or subject',async()=>{
  const key=new Uint8Array(32).fill(7);const first=await principalPseudonym(key,'https://issuer.example.invalid','customer-private');
  expect(first).toMatch(/^[a-f0-9]{64}$/);expect(first).toBe(await principalPseudonym(key,'https://issuer.example.invalid','customer-private'));
  expect(first).not.toBe(await principalPseudonym(new Uint8Array(32).fill(8),'https://issuer.example.invalid','customer-private'));
 });
 it('enqueues only allowlisted fields and contains telemetry failure after a committed operation',async()=>{
  let payload:unknown;const rpc={rpc:async(name:string,args:Record<string,unknown>)=>{expect(name).toBe('external_enqueue_redacted_event');payload=args._event;return {data:true,error:null};}};
  expect(await emitEvent(rpc,{...event,authorization:'secret'})).toBe(true);expect(payload).toEqual(event);
  expect(await emitEvent({rpc:async()=>{throw new Error('secret sink outage');}},event)).toBe(false);
 });
});
