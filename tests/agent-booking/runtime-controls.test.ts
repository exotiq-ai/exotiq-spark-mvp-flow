import {describe,it,expect} from 'vitest';
import {ControlledQuoteStore,operationForRoute,emitRuntimeOutcome} from '../../supabase/functions/_shared/external-booking/runtime-controls';
import type {QuoteStore} from '../../supabase/functions/_shared/external-booking/quotes';
const operator='a1500000-0000-4000-8000-000000000001';
describe('production operation controls and safe outcomes',()=>{
 it('checks every quote anew while leaving authoritative transaction admission intact',async()=>{
  let enabled=true,reads=0,writes=0;
  const store=new ControlledQuoteStore({create:async()=>{writes++;return 'snapshot';}},{read:async(id)=>{expect(id).toBe(operator);reads++;return {newWritesEnabled:enabled,operatorEnabled:true};}});
  const input={request:{operator_id:operator}} as Parameters<QuoteStore['create']>[0];
  expect(await store.create(input)).toBe('snapshot');enabled=false;
  await expect(store.create(input)).rejects.toMatchObject({code:'external_writes_disabled'});
  expect(reads).toBe(2);expect(writes).toBe(1);
 });
 it.each([
  ['/v1/customers/rental-requests/SYNTHETIC001','GET','request:read'],
  ['/v1/customers/rental-requests/SYNTHETIC001/identity-handoff','POST','identity:handoff'],
  ['/v1/rental-requests/SYNTHETIC001/checkout-handoff','POST','checkout:handoff'],
  ['/v1/customer-handoffs/private-nonce/resolve','POST','nonce:resolve'],
  ['/unknown/private-customer','POST',null],
 ])('classifies only known operation shapes %s',async(path,method,action)=>{expect(operationForRoute(path,method)).toBe(action);});
 it('correlates outcomes without copying caller or response secrets',async()=>{
  let stored:unknown;
  const response=new Response(JSON.stringify({provider_url:'https://private.invalid/secret',consent_receipt:'secret'}),{status:201,headers:{'X-Request-Id':'synthetic_request_150001'}});
  expect(await emitRuntimeOutcome({rpc:{rpc:async(_name,args)=>{stored=args._event;return {data:true,error:null};}},secret:new Uint8Array(32).fill(7),path:'/v1/rental-requests',method:'POST',response,latencyMs:27,principal:{issuer:'https://private-issuer.invalid',subject:'private-customer',audience:'https://api.invalid',clientId:'private-client',tokenId:'private-token',scopes:['rental_requests:create'],operatorId:operator}})).toBe(true);
  expect(stored).toMatchObject({request_id:'synthetic_request_150001',action:'request:create',outcome:'success',latency_ms:27,operator_id:operator});
  expect(JSON.stringify(stored)).not.toMatch(/private|secret|receipt|provider_url/);
  expect(response.bodyUsed).toBe(false);
 });
 it('contains optional logging failure after success',async()=>{
  const response=new Response(null,{status:201,headers:{'X-Request-Id':'synthetic_request_150001'}});
  expect(await emitRuntimeOutcome({rpc:{rpc:async()=>{throw Error('private sink outage');}},secret:new Uint8Array(32).fill(7),path:'/v1/rental-requests',method:'POST',response,latencyMs:1})).toBe(false);
  expect(response.status).toBe(201);
 });
});
