import {describe,it,expect} from 'vitest';
import {requireOperationEnabled,SupabaseFlagStore} from '../../supabase/functions/_shared/external-booking/flags';
const operator='a1500000-0000-4000-8000-000000000001';
describe('authoritative operation controls',()=>{
 it('denies new external quotes, requests and delegation by default',async()=>{
  for(const operation of ['quote:create','request:create','consent:new-delegation'] as const){
   await expect(requireOperationEnabled({read:async()=>({newWritesEnabled:false,operatorEnabled:false})},operator,operation)).rejects.toMatchObject({code:'external_writes_disabled'});
  }
 });
 it('requires both explicit global and operator opt-in for new activity',async()=>{
  for(const flags of [{newWritesEnabled:true,operatorEnabled:false},{newWritesEnabled:false,operatorEnabled:true}])await expect(requireOperationEnabled({read:async()=>flags},operator,'request:create')).rejects.toMatchObject({code:'external_writes_disabled'});
  await expect(requireOperationEnabled({read:async()=>({newWritesEnabled:true,operatorEnabled:true})},operator,'quote:create')).resolves.toEqual({continuity:false});
 });
 it('fails closed for missing, unreachable and malformed authority',async()=>{
  for(const read of [async()=>null,async()=>{throw new Error('secret backend failure');},async()=>({newWritesEnabled:'true',operatorEnabled:true})])await expect(requireOperationEnabled({read} as any,operator,'quote:create')).rejects.toMatchObject({code:'configuration_unavailable'});
 });
 it('existing read/replay/recovery/handoffs/reconciliation do not depend on new-write settings',async()=>{
  let reads=0;const store={read:async()=>{reads++;throw new Error('outage');}};
  for(const operation of ['request:read','request:replay','grant:reauthorize','identity:handoff','checkout:handoff','nonce:resolve','payment:reconcile'] as const)await expect(requireOperationEnabled(store,operator,operation)).resolves.toEqual({continuity:true});
  expect(reads).toBe(0);
 });
 it('catalog still needs operator opt-in while global new writes are disabled',async()=>{
  await expect(requireOperationEnabled({read:async()=>({newWritesEnabled:false,operatorEnabled:true})},operator,'catalog:read')).resolves.toEqual({continuity:false});
  await expect(requireOperationEnabled({read:async()=>({newWritesEnabled:true,operatorEnabled:false})},operator,'availability:read')).rejects.toMatchObject({code:'external_writes_disabled'});
 });
 it('reads fresh authority on every consequential operation, never an enabled cache',async()=>{
  let reads=0;const store={read:async()=>({newWritesEnabled:++reads===1,operatorEnabled:true})};
  await requireOperationEnabled(store,operator,'quote:create');
  await expect(requireOperationEnabled(store,operator,'quote:create')).rejects.toMatchObject({code:'external_writes_disabled'});expect(reads).toBe(2);
 });
 it('uses one bounded narrow RPC, accepts only the exact authoritative boolean shape',async()=>{
  const store=new SupabaseFlagStore({rpc:async(name,args)=>{expect(name).toBe('external_read_operation_flags');expect(args).toEqual({_operator_id:operator});return {data:{new_writes_enabled:false,operator_enabled:true},error:null};}});
  await expect(store.read(operator)).resolves.toEqual({newWritesEnabled:false,operatorEnabled:true});
  await expect(new SupabaseFlagStore({rpc:async()=>({data:{new_writes_enabled:'true',operator_enabled:true},error:null})}).read(operator)).rejects.toThrow();
 });
 it('bounds stalled authority and rejects unknown operation or non-UUID operator',async()=>{
  await expect(new SupabaseFlagStore({rpc:()=>new Promise(()=>{})},10).read(operator)).rejects.toMatchObject({code:'configuration_unavailable'});
  const store={read:async()=>({newWritesEnabled:true,operatorEnabled:true})};
  await expect(requireOperationEnabled(store,operator,'made-up' as any)).rejects.toThrow();
  await expect(requireOperationEnabled(store,'nonexistent','request:read')).rejects.toThrow();
 });
});
