import type {QuoteStore} from './quotes.ts';
import {OperationControlError,requireOperationEnabled, type FlagStore} from './flags.ts';
import {BookingApiError} from './errors.ts';
import {emitEvent,principalPseudonym,type RedactedEvent} from './observability.ts';
import type {FlagRpc} from './flags.ts';
import type {Principal} from './auth.ts';

/** Authentication and tenant resolution precede this preflight. SQL performs
 * the same admission check under transaction locks, including consent/request
 * admission, so a flag change between this read and INSERT cannot slip through.
 * Existing request replay intentionally reaches its ledger before admission. */
export class ControlledQuoteStore implements QuoteStore {
 constructor(private readonly inner:QuoteStore,private readonly flags:FlagStore){}
 async create(input:Parameters<QuoteStore['create']>[0]):Promise<unknown>{
  try{await requireOperationEnabled(this.flags,input.request.operator_id,'quote:create');}
  catch(error){if(error instanceof OperationControlError)throw new BookingApiError(error.code);throw new BookingApiError('configuration_unavailable');}
  return this.inner.create(input);
 }
}

/** Only recognized route shapes supply event enums; never persist the path,
 * query, request body, response payload, token, receipt or provider URL. */
export function operationForRoute(path:string,method:string):RedactedEvent['action']|null {
 if(method==='GET'&&['/v1/operators','/v1/vehicles'].includes(path))return 'catalog:read';
 if(method==='POST'&&path==='/v1/availability')return 'availability:read';
 if(method==='POST'&&path==='/v1/quotes')return 'quote:create';
 if(method==='POST'&&path==='/v1/rental-requests')return 'request:create';
 if(method==='POST'&&/^\/v1\/quotes\/[^/]+\/consents$/.test(path))return 'consent:new-delegation';
 if(method==='GET'&&/^\/v1\/(?:customers\/)?rental-requests\/[^/]+$/.test(path))return 'request:read';
 if(/^\/v1\/(?:grants\/[^/]+\/renewal-review|grant-renewals\/[^/]+(?:\/consents)?)$/.test(path))return 'grant:reauthorize';
 if(method==='POST'&&/^\/v1\/(?:customers\/)?rental-requests\/[^/]+\/identity-handoff$/.test(path))return 'identity:handoff';
 if(method==='POST'&&/^\/v1\/(?:customers\/)?rental-requests\/[^/]+\/checkout-handoff$/.test(path))return 'checkout:handoff';
 if(method==='POST'&&/^\/v1\/customer-handoffs\/[^/]+\/resolve$/.test(path))return 'nonce:resolve';
 return null;
}
export async function emitRuntimeOutcome(input:{rpc:FlagRpc;secret:Uint8Array;path:string;method:string;response:Response;principal?:Principal;latencyMs:number}):Promise<boolean>{
 try{
  const action=operationForRoute(input.path,input.method);if(!action)return false;
  const status=input.response.status;
  const outcome:RedactedEvent['outcome']=status>=500?'failed':status===409?'conflict':status>=400?'denied':status===202?'deferred':'success';
  const event:RedactedEvent={request_id:input.response.headers.get('X-Request-Id')??'',action,outcome,latency_ms:Math.min(300000,Math.max(0,Math.floor(input.latencyMs)))};
  if(input.principal){event.principal_pseudonym=await principalPseudonym(input.secret,input.principal.issuer,input.principal.subject);if(input.principal.operatorId)event.operator_id=input.principal.operatorId;}
  return await emitEvent(input.rpc,event);
 }catch{return false;}
}
