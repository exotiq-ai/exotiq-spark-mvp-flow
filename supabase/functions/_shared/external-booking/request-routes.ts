import {validateContract} from './contracts.ts';
import {BookingApiError} from './errors.ts';
import {jsonResponse} from './catalog-routes.ts';
import {actorArgs,type ConsentDependencies} from './consent-routes.ts';
import {mapRentalState,type StateEvidence} from './state.ts';
import {hashCanonical} from './quotes.ts';
export interface RequestDependencies extends Pick<ConsentDependencies,'auth'|'rpc'|'now'> {
 publicOrigin:string; customerOrigin?:string; sleep?:(ms:number)=>Promise<void>;
 /**14 installs this only with its actual nonce store and hosted resolver. */
 handoff?:(request:Request,ref:string,body:unknown)=>Promise<Response>;
}
const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function fail(error:unknown,atomic:boolean):never{
 const row=isObject(error)?error:{};
 if(['invalid_input','not_found','dates_unavailable','quote_changed','quote_expired','consent_mismatch','consent_expired','idempotency_conflict','forbidden','grant_expired','grant_revoked'].includes(String(row.message)))throw new BookingApiError(row.message as 'not_found');
 if(atomic&&['40001','55P03'].includes(String(row.code)))throw new BookingApiError('request_in_flight',{retry_after_seconds:1});
 throw new BookingApiError('upstream_unavailable',{retry_after_seconds:1});
}
async function rpc(deps:RequestDependencies,name:string,args:Record<string,unknown>,atomic=false):Promise<unknown>{
 for(let attempt=0;attempt<(atomic?5:1);attempt++){
  let result;try{result=await deps.rpc.rpc(name,args);}catch{throw new BookingApiError('upstream_unavailable',{retry_after_seconds:1});}
  if(!result.error)return result.data;
  if(atomic&&isObject(result.error)&&['40001','55P03'].includes(String(result.error.code))&&attempt<4){await(deps.sleep?.(25*2**attempt)??new Promise(resolve=>setTimeout(resolve,25*2**attempt)));continue;}
  fail(result.error,atomic);
 }
 throw new BookingApiError('upstream_unavailable');
}
export function createRequestExtension(deps:RequestDependencies){
 const origin=new URL(deps.publicOrigin);if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||(origin.port&&origin.port!=='443')||!/^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(origin.pathname))throw new BookingApiError('upstream_unavailable');
 const publicBase=origin.href.replace(/\/$/,'');
 return async(request:Request,path:string,body:unknown):Promise<Response|null>=>{
  if(path==='/v1/rental-requests'){
   if(request.method!=='POST')throw new BookingApiError('invalid_input');
   const key=request.headers.get('Idempotency-Key')??'';
   if(!validateContract('RentalRequestInput',body).ok||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw new BookingApiError('invalid_input');
   const principal=await deps.auth.requirePrincipal(request,'rental_requests:create'),input=body as {quote_id:string;consent_receipt_id:string};
   const result=await rpc(deps,'external_submit_rental_request_result',{...actorArgs(principal),_quote_id:input.quote_id,_receipt_id:input.consent_receipt_id,_idempotency_key:key,_public_origin:publicBase},true);
   if(!isObject(result)||typeof result.created!=='boolean'||Object.keys(result).some(key=>!['created','response'].includes(key))||!validateContract('RentalRequestResult',result.response).ok)throw new BookingApiError('upstream_unavailable');
   return jsonResponse(result.response,result.created?201:200);
  }
  const match=/^\/v1\/rental-requests\/([A-Za-z0-9_-]{1,80})(?:\/(checkout-handoff|grant-renewals))?$/.exec(path);
  if(!match)return null;
  const ref=match[1],action=match[2];
  if(action==='checkout-handoff')return deps.handoff&&request.method==='POST'?deps.handoff(request,ref,body):null;
  if(action==='grant-renewals'){
   if(request.method!=='POST'||!isObject(body)||Object.keys(body).length||!deps.customerOrigin)throw new BookingApiError('invalid_input');
   const principal=await deps.auth.requirePrincipal(request,'rental_requests:read');
   const secret=crypto.randomUUID()+crypto.randomUUID(),csrfHash=await hashCanonical(secret);
   const result=await rpc(deps,'external_begin_request_grant_recovery',{...actorArgs(principal),_ref:ref,_csrf_hash:csrfHash,_customer_origin:deps.customerOrigin});
   if(!validateContract('GrantRenewalResult',result).ok)throw new BookingApiError('upstream_unavailable');
   return jsonResponse(result,201);
  }
  if(request.method!=='GET')throw new BookingApiError('invalid_input');
  const principal=await deps.auth.requirePrincipal(request,'rental_requests:read');
  let raw:unknown;
  try{raw=await rpc(deps,'external_read_rental_request',{...actorArgs(principal),_ref:ref});}
  catch(error){if(error instanceof BookingApiError&&['grant_expired','grant_revoked'].includes(error.code)){
   // Only the SQL-owned-ledger check can produce these recoverable errors.
   // Transport never reveals a ref/renewal URL for a different principal.
   const {errorResponse}=await import('./errors.ts');const response=errorResponse(error);response.headers.set('Link',`<${publicBase}/v1/rental-requests/${ref}/grant-renewals>; rel="grant-renewal"`);return response;
  }throw error;}
  if(!isObject(raw)||raw.ref!==ref)throw new BookingApiError('upstream_unavailable');
  const state=mapRentalState(raw as unknown as StateEvidence,deps.now?.()??Date.now());
  const links={status:`${publicBase}/v1/rental-requests/${ref}`,...(state.can_checkout&&deps.handoff?{checkout_handoff:`${publicBase}/v1/rental-requests/${ref}/checkout-handoff`}:{})};
  const poll_after_seconds=['confirmed','active','completed','refunded','declined','cancelled','payment_expired'].includes(state.status)?60:5;
  const result={api_version:'v1',source_checked_at:raw.source_checked_at,ref,status:state.status,next_action:state.next_action,hold_expires_at:state.hold_expires_at,payment_due_at:state.payment_due_at,inventory_blocked:state.inventory_blocked,poll_after_seconds,links};
  if(!validateContract('RentalStatusResult',result).ok)throw new BookingApiError('upstream_unavailable');
  // Observation time changes every read. ETag represents substantive authority,
  // not that clock, so unchanged reads can304 AFTER current authorization.
  const {source_checked_at:_,...representation}=result,tag=`"${await hashCanonical(representation)}"`;
  const response=request.headers.get('If-None-Match')?.split(',').map(tag=>tag.trim().replace(/^W\//,'')).includes(tag)?new Response(null,{status:304}):jsonResponse(result);
  response.headers.set('ETag',tag);response.headers.set('Retry-After',String(poll_after_seconds));response.headers.set('Cache-Control','no-store');return response;
 };
}
