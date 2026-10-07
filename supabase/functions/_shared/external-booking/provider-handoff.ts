import {BookingApiError} from './errors.ts';
import {safeProviderUrl} from './handoff-store.ts';
import {sourceAmountCents} from './lifecycle.ts';
import type {QuoteRpcClient} from './quotes.ts';
type Db=QuoteRpcClient & {from:(table:string)=>any};
type StripeClient=any;
export function customerReturnBase(origin:string|undefined,operator:string,ref:string,action:'identity'|'checkout'){
 if(!origin)throw new BookingApiError('configuration_unavailable');const u=new URL(origin);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.port&&u.port!=='443'||!/^[a-f0-9-]{36}$/.test(operator)||!/^[A-Za-z0-9_-]{1,80}$/.test(ref))throw new BookingApiError('configuration_unavailable');
 return u.origin+'/agent/account/'+operator+'?booking_ref='+encodeURIComponent(ref)+'&action='+action;
}
async function rpc(db:Db,name:string,args:Record<string,unknown>){const result=await db.rpc(name,args);if(result.error){const code=String((result.error as {message?:unknown}).message);throw new BookingApiError(['not_found','forbidden','payment_window_expired','grant_expired','grant_revoked'].includes(code)?code as any:'upstream_unavailable');}if(result.data===true)return {recorded:true};if(!result.data||typeof result.data!=='object')throw new BookingApiError('upstream_unavailable');return result.data as Record<string,any>;}
export async function providerContext(db:Db,body:any,action:'identity'|'checkout'){
 const h=body.external_handoff;if(!h||!/^[a-f0-9]{64}$/.test(h.nonce_hash)||!/^[a-f0-9-]{36}$/.test(h.claim_token))throw new BookingApiError('unauthorized');
 const c=await rpc(db,'external_provider_handoff_context',{_nonce_hash:h.nonce_hash,_claim_token:h.claim_token,_action:action});
 if(c.booking_ref!==body.booking_ref||!['test','live'].includes(c.mode))throw new BookingApiError('not_found');return c;
}
export async function resolveIdentityProvider(db:Db,stripe:StripeClient,body:any,context:Record<string,any>,mode:'test'|'live',origin:string|undefined){
 if(mode!==context.mode)throw new BookingApiError('configuration_unavailable');
 let session;
 if(context.provider_session_ref){
  session=await stripe.identity.verificationSessions.retrieve(context.provider_session_ref);
 }else{
  session=await stripe.identity.verificationSessions.create({type:'document',options:{document:{require_matching_selfie:true}},metadata:{customer_id:context.customer_id,booking_ref:context.booking_ref},return_url:customerReturnBase(origin,context.operator_id,context.booking_ref,'identity')},{idempotencyKey:'external-identity-'+context.provider_attempt_key});
 }
 if(!session||session.livemode!==(mode==='live')||session.status!=='requires_input'||session.metadata?.customer_id!==context.customer_id||session.metadata?.booking_ref!==context.booking_ref)throw new BookingApiError('forbidden');
 const url=safeProviderUrl(session.url,'identity');
 await rpc(db,'external_record_handoff_provider_session',{_nonce_hash:body.external_handoff.nonce_hash,_claim_token:body.external_handoff.claim_token,_action:'identity',_provider_session_ref:session.id,_mode:mode});
 return {session_id:session.id,url};
}
/** One persisted reservation governs both source callers. Different return flows
 * cannot independently create sessions. Ambiguous or expired sessions require
 * reconciliation; payment-intent presence never authorizes another rental leg. */
export async function reserveCheckout(db:Db,body:any,mode:'test'|'live',origin:string,context:Record<string,any>|null,paymentDueAt:string){
 return rpc(db,'external_reserve_rental_checkout',{_ref:body.booking_ref,_token:body.token,_mode:mode,_kind:context?'external':'legacy',_origin:origin,_nonce_hash:context?body.external_handoff.nonce_hash:null,_claim_token:context?body.external_handoff.claim_token:null,_attempt_key:'rent-checkout-'+body.booking_ref+'-'+paymentDueAt});
}
export async function recordCheckoutCustomer(db:Db,bookingId:string,attempt:string,customerId:string){await rpc(db,'external_record_checkout_customer',{_booking_id:bookingId,_attempt_key:attempt,_customer_ref:customerId});}
export async function recordCheckoutSession(db:Db,bookingId:string,attempt:string,sessionId:string){await rpc(db,'external_record_checkout_session',{_booking_id:bookingId,_attempt_key:attempt,_session_ref:sessionId});}
export function validateCheckoutSession(session:any,booking:any,mode:'test'|'live',returnBase:string,currency='usd',external=true){
 if(!session||session.status!=='open'||session.payment_status!=='unpaid'||session.livemode!==(mode==='live')||!Number.isInteger(session.expires_at)||session.expires_at*1000<=Date.now()||session.amount_total!==sourceAmountCents(booking.total_value)||session.currency!==currency||session.metadata?.booking_ref!==booking.booking_ref||session.metadata?.leg!=='operator_rental'||session.metadata?.stripe_mode!==mode||session.success_url!==(external?returnBase:returnBase+'&payment=success')||session.cancel_url!==(external?returnBase:returnBase+'&payment=cancelled'))throw new BookingApiError('forbidden');
 if(external)return safeProviderUrl(session.url,'checkout');
 // The existing public source flow retains Stripe's opaque hosted fragment.
 // External browser/agent projection remains governed by the stricter contract.
 let url:URL;try{url=new URL(session.url);}catch{throw new BookingApiError('forbidden');}
 if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.username||url.password||url.port&&url.port!=='443')throw new BookingApiError('forbidden');return url.href;
}
export async function finishExternalCheckout(db:Db,body:any,sessionId:string,mode:'test'|'live'){
 await rpc(db,'external_record_handoff_provider_session',{_nonce_hash:body.external_handoff.nonce_hash,_claim_token:body.external_handoff.claim_token,_action:'checkout',_provider_session_ref:sessionId,_mode:mode});
}
