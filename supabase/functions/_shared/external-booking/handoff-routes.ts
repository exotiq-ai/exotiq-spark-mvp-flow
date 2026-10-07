import {BookingApiError,errorResponse} from './errors.ts';import {validateContract} from './contracts.ts';import {jsonResponse} from './catalog-routes.ts';
import {actorArgs,customerProof,type ConsentDependencies} from './consent-routes.ts';
import {mapRentalState,type StateEvidence} from './state.ts';
import {generateHandoffNonce,handoffHash,opaqueNonce,safeProviderUrl,SupabaseHandoffStore,type HandoffAction,type HostedHandoffProvider,type ProviderClaim} from './handoff-store.ts';
export interface HandoffDependencies extends Pick<ConsentDependencies,'auth'|'rpc'|'hosted'|'now'>{customerOrigin:string;mode:'test'|'live';provider:HostedHandoffProvider|null}
export function createHandoffExtension(deps:HandoffDependencies){
 const store=new SupabaseHandoffStore(deps.rpc),customer=new URL(deps.customerOrigin);if(customer.protocol!=='https:'||customer.pathname!=='/'||customer.username||customer.password||customer.search||customer.hash)throw new BookingApiError('upstream_unavailable');
 return async(request:Request,path:string,body:unknown):Promise<Response|null>=>{
  const create=/^\/v1\/rental-requests\/([A-Za-z0-9_-]{1,80})\/(identity|checkout)-handoff$/.exec(path);
  if(create){
   if(request.method!=='POST'||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)throw new BookingApiError('invalid_input');
   if(!deps.provider)throw new BookingApiError('configuration_unavailable');
   const action=create[2] as HandoffAction,principal=await deps.auth.requirePrincipal(request,action==='identity'?'identity:handoff':'checkout:handoff'),nonce=await generateHandoffNonce();
   const raw=await store.create(principal,create[1],action,nonce.hash,deps.mode),result={api_version:'v1',source_checked_at:raw.source_checked_at,customer_url:customer.origin+'/agent/handoff/'+nonce.value,expires_at:raw.expires_at,state:raw.status,next_action:action==='identity'?'verify_identity':'hosted_checkout'};
   if(!validateContract(action==='identity'?'IdentityHandoffResult':'CheckoutHandoffResult',result).ok)throw new BookingApiError('upstream_unavailable');return jsonResponse(result,201);
  }
  const status=/^\/v1\/customers\/rental-requests\/([A-Za-z0-9_-]{1,80})$/.exec(path);
  if(status){if(request.method!=='GET')throw new BookingApiError('invalid_input');const principal=await deps.auth.requirePrincipal(request,'rental_requests:read');await customerProof(request,principal,{...deps,consentOrigin:deps.customerOrigin});const raw=await store.call('external_customer_rental_status',{...actorArgs(principal),_ref:status[1]}),state=mapRentalState(raw as unknown as StateEvidence,deps.now?.()??Date.now()),result={api_version:'v1',source_checked_at:raw.source_checked_at,ref:raw.ref,operator_id:raw.operator_id,operator_name:raw.operator_name,vehicle_name:raw.vehicle_name,status:state.status,next_action:state.next_action,hold_expires_at:state.hold_expires_at,payment_due_at:state.payment_due_at};if(!validateContract('CustomerRentalStatusResult',result).ok)throw new BookingApiError('upstream_unavailable');return jsonResponse(result);}
  const owned=/^\/v1\/customers\/rental-requests\/([A-Za-z0-9_-]{1,80})\/(identity|checkout)-handoff$/.exec(path);
  if(owned){
   if(request.method!=='POST'||!validateContract('CustomerHandoffResolveInput',body).ok)throw new BookingApiError('invalid_input');
   const action=owned[2] as HandoffAction,principal=await deps.auth.requirePrincipal(request,action==='identity'?'identity:handoff':'checkout:handoff');
   await customerProof(request,principal,{...deps,consentOrigin:deps.customerOrigin});if(!deps.provider)throw new BookingApiError('configuration_unavailable');
   const nonce=await generateHandoffNonce(),raw=await store.call('external_create_customer_owned_handoff',{...actorArgs(principal),_ref:owned[1],_action:action,_nonce_hash:nonce.hash,_mode:deps.mode}),result={api_version:'v1',source_checked_at:raw.source_checked_at,customer_url:customer.origin+'/agent/handoff/'+nonce.value,expires_at:raw.expires_at,state:raw.status,next_action:action==='identity'?'verify_identity':'hosted_checkout'};
   if(!validateContract(action==='identity'?'IdentityHandoffResult':'CheckoutHandoffResult',result).ok)throw new BookingApiError('upstream_unavailable');return jsonResponse(result,201);
  }
  const match=/^\/v1\/customer-handoffs\/([^/]+)\/(review|resolve|grant-renewals)$/.exec(path);if(!match)return null;
  if(!opaqueNonce.test(match[1])||(match[2]==='review'?request.method!=='GET':request.method!=='POST'))throw new BookingApiError('invalid_input');
  if(match[2]!=='review'&&!validateContract('CustomerHandoffResolveInput',body).ok)throw new BookingApiError('invalid_input');
  const principal=await deps.auth.requirePrincipal(request,'rental_requests:read'),proof=await customerProof(request,principal,{...deps,consentOrigin:deps.customerOrigin});
  const hash=await handoffHash(match[1]);
  if(match[2]==='grant-renewals'){
   const result=await store.call('external_begin_customer_handoff_recovery',{...actorArgs(principal),_nonce_hash:hash,_csrf_hash:proof.csrfHash,_customer_origin:customer.origin});
   if(!validateContract('GrantRenewalResult',result).ok)throw new BookingApiError('upstream_unavailable');return jsonResponse(result,201);
  }
  if(match[2]==='review'){const result=await store.review(principal,hash);if(!validateContract('CustomerHandoffReviewResult',result).ok)throw new BookingApiError('upstream_unavailable');return jsonResponse(result);}
  if(!deps.provider)throw new BookingApiError('configuration_unavailable');
  // Determine the persisted action before acquiring a mutable lease. The
  // current provider must authorize that action, not just a status read.
  const reviewed=await store.review(principal,hash);
  if(!validateContract('CustomerHandoffReviewResult',reviewed).ok)throw new BookingApiError('upstream_unavailable');
  await deps.auth.requirePrincipal(request,reviewed.action==='identity'?'identity:handoff':'checkout:handoff');
  const raw=await store.claim(principal,hash);
  if(raw.nonce_hash!==hash||!['identity','checkout'].includes(String(raw.action))||!['test','live'].includes(String(raw.mode))||typeof raw.claim_token!=='string'||typeof raw.confirmation_token!=='string'||typeof raw.booking_ref!=='string'||typeof raw.provider_attempt_key!=='string')throw new BookingApiError('upstream_unavailable');
  const claim=raw as unknown as ProviderClaim,provider=await deps.provider.resolve(claim),url=safeProviderUrl(provider.url,claim.action);
  const completed=await store.complete(principal,hash,claim.claim_token,provider.sessionId),result={api_version:'v1',source_checked_at:completed.source_checked_at,action:claim.action,provider_url:url,expires_at:completed.expires_at};
  if(!validateContract('CustomerHandoffResolveResult',result).ok)throw new BookingApiError('upstream_unavailable');return jsonResponse(result);
 };
}
