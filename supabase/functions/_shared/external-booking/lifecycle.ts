import {BookingApiError} from './errors.ts';
export interface LifecycleRpc {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>}
export interface SettlementExpectation {bookingRef:string;leg:'operator'|'exotiq';mode:'test'|'live';amountCents:number;currency:string;operatorAccount?:string}
/** Exact conversion of source numeric USD values, never binary multiplication or rounding. */
export function sourceAmountCents(value:unknown):number{
 if(typeof value!=='number'&&typeof value!=='string')throw new BookingApiError('upstream_unavailable');
 const match=/^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/.exec(String(value));
 if(!match)throw new BookingApiError('upstream_unavailable');
 const cents=BigInt(match[1])*100n+BigInt((match[2]??'').padEnd(2,'0'));
 if(cents>BigInt(Number.MAX_SAFE_INTEGER))throw new BookingApiError('upstream_unavailable');return Number(cents);
}
export function snapshotFeeCents(row:Record<string,unknown>):number{
 let sum=0;for(const key of ['platform_fee_cents','protection_total_cents','state_fee_cents','processing_fee_cents']){const value=row[key];if(value===null||value===undefined||!Number.isSafeInteger(Number(value))||Number(value)<0)throw new BookingApiError('upstream_unavailable');sum+=Number(value);}
 if(!Number.isSafeInteger(sum))throw new BookingApiError('upstream_unavailable');return sum;
}
/** Called only after Stripe signature verification or trusted SDK retrieval.
 * Intent reference/redirect/amount alone is never settlement evidence. */
export function settlementEvidence(raw:unknown,expected:SettlementExpectation){
 const pi=raw as Record<string,any>;
 if(!pi || typeof pi.id!=='string' || !/^pi_[A-Za-z0-9_]+$/.test(pi.id) || pi.status!=='succeeded' || !Number.isSafeInteger(expected.amountCents) || expected.amountCents<0 || pi.amount!==expected.amountCents || pi.amount_received!==expected.amountCents || pi.currency!==expected.currency.toLowerCase() || pi.livemode!==(expected.mode==='live') || pi.metadata?.booking_ref!==expected.bookingRef || pi.metadata?.leg!==(expected.leg==='operator'?'operator_rental':'exotiq_fee_protection') || pi.metadata?.stripe_mode!==expected.mode || (expected.leg==='operator' && (!expected.operatorAccount || pi.transfer_data?.destination!==expected.operatorAccount))) throw new BookingApiError('upstream_unavailable');
 return {intentId:pi.id as string,amountCents:expected.amountCents,currency:pi.currency as string};
}
async function rpc(client:LifecycleRpc,name:string,args:Record<string,unknown>){const {data,error}=await client.rpc(name,args);if(error)throw new BookingApiError('upstream_unavailable');return data;}
export async function recordSettlement(client:LifecycleRpc,eventId:string,raw:unknown,expected:SettlementExpectation){const proof=settlementEvidence(raw,expected);return rpc(client,'external_record_settlement',{_event_id:eventId,_booking_ref:expected.bookingRef,_leg:expected.leg,_intent_id:proof.intentId,_amount_cents:proof.amountCents,_currency:proof.currency,_mode:expected.mode,_operator_account:expected.operatorAccount??null});}
export async function reconcileBooking(client:LifecycleRpc,bookingRef:string,mode:'test'|'live'){return rpc(client,'external_reconcile_booking',{_booking_ref:bookingRef,_mode:mode});}
export async function applyIdentityEvent(client:LifecycleRpc,event:{id:string;created:number;type:string},session:{id:string;status:string;documentExpiry:string|null;verifiedName?:string|null}){
 if(!/^evt_[A-Za-z0-9_]+$/.test(event.id)||!Number.isSafeInteger(event.created)||event.created<0||!/^vs_[A-Za-z0-9_]+$/.test(session.id)||!['processing','verified','requires_input','canceled','redacted'].includes(session.status))throw new BookingApiError('upstream_unavailable');
 if(session.status==='verified'&&(!session.documentExpiry||!/^\d{4}-\d{2}-\d{2}$/.test(session.documentExpiry)||!Number.isFinite(Date.parse(session.documentExpiry+'T00:00:00Z'))||new Date(session.documentExpiry+'T00:00:00Z').toISOString().slice(0,10)!==session.documentExpiry))throw new BookingApiError('upstream_unavailable');
 return rpc(client,'external_apply_identity_event',{_event_id:event.id,_created:event.created,_session_id:session.id,_status:session.status,_document_expiry:session.documentExpiry,_verified_name:session.verifiedName??null});
}
