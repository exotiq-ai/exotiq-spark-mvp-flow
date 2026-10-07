/** Controls classify operations; they never replace principal, tenant, grant,
 * booking-state or customer authorization checks in each consumer. */
export const OPERATIONS = ['catalog:read','availability:read','quote:create','request:create','consent:new-delegation','request:read','request:replay','grant:reauthorize','identity:handoff','checkout:handoff','nonce:resolve','payment:reconcile'] as const;
export type ExternalOperation = typeof OPERATIONS[number];
const continuity=new Set<ExternalOperation>(['request:read','request:replay','grant:reauthorize','identity:handoff','checkout:handoff','nonce:resolve','payment:reconcile']);
export interface OperationFlags {newWritesEnabled:boolean;operatorEnabled:boolean}
export interface FlagStore {read(operatorId:string):Promise<OperationFlags|null>}
/** Converted to the canonical safe API error by the later sequential entry
 * consumer. No upstream exception text is retained in this denial. */
export class OperationControlError extends Error {
 readonly status=503;
 readonly retryable:boolean;
 constructor(readonly code:'configuration_unavailable'|'external_writes_disabled'){
  super(code==='configuration_unavailable'?'Operation configuration is temporarily unavailable.':'New external activity is disabled.');
  this.name='OperationControlError';this.retryable=code==='configuration_unavailable';
 }
}
export async function requireOperationEnabled(store:FlagStore,operatorId:string,operation:ExternalOperation):Promise<{continuity:boolean}>{
 if(!OPERATIONS.includes(operation)||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(operatorId))throw new OperationControlError('configuration_unavailable');
 if(continuity.has(operation))return {continuity:true};
 let flags:OperationFlags|null;
 try{flags=await store.read(operatorId);}catch{throw new OperationControlError('configuration_unavailable');}
 if(!flags||typeof flags.newWritesEnabled!=='boolean'||typeof flags.operatorEnabled!=='boolean')throw new OperationControlError('configuration_unavailable');
 const read=operation==='catalog:read'||operation==='availability:read';
 if(!flags.operatorEnabled||(!read&&!flags.newWritesEnabled))throw new OperationControlError('external_writes_disabled');
 return {continuity:false};
}
export interface FlagRpc {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>}
export class SupabaseFlagStore implements FlagStore {
 constructor(private readonly client:FlagRpc,private readonly timeoutMs=2000){if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>4000)throw new OperationControlError('configuration_unavailable');}
 async read(operatorId:string):Promise<OperationFlags>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const {data,error}=await Promise.race([Promise.resolve(this.client.rpc('external_read_operation_flags',{_operator_id:operatorId})),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new OperationControlError('configuration_unavailable')),this.timeoutMs);})]);
   if(error||!data||typeof data!=='object'||Array.isArray(data))throw new OperationControlError('configuration_unavailable');
   const value=data as Record<string,unknown>;
   if(typeof value.new_writes_enabled!=='boolean'||typeof value.operator_enabled!=='boolean')throw new OperationControlError('configuration_unavailable');
   return {newWritesEnabled:value.new_writes_enabled,operatorEnabled:value.operator_enabled};
  }catch{throw new OperationControlError('configuration_unavailable');}finally{if(timer)clearTimeout(timer);}
 }
}
