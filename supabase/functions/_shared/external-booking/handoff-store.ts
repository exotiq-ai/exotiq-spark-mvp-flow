import {BookingApiError} from './errors.ts';
import type {QuoteRpcClient} from './quotes.ts';
import type {Principal} from './auth.ts';
import {actorArgs} from './consent-routes.ts';
import {validProviderHttpsUrl} from './contracts.ts';
export type HandoffAction='identity'|'checkout';
export const opaqueNonce=/^[A-Za-z0-9_-]{43}$/;
export async function handoffHash(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function generateHandoffNonce(){const bytes=crypto.getRandomValues(new Uint8Array(32)),value=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');return {value,hash:await handoffHash(value)};}
/** URLs never persist in SQL or logs; Identity URL is one-use. Provider session
 * references permit a fresh authorized retrieval when the provider allows it. */
export function safeProviderUrl(raw:unknown,action:HandoffAction):string{
 if(typeof raw!=='string'||raw.length>4096)throw new BookingApiError('upstream_unavailable');
 let url:URL;try{url=new URL(raw);}catch{throw new BookingApiError('upstream_unavailable');}
 const host=action==='checkout'?'checkout.stripe.com':'verify.stripe.com';
 if(url.hostname!==host||!validProviderHttpsUrl(raw))throw new BookingApiError('upstream_unavailable');
 return raw;
}
export interface ProviderClaim {nonce_hash:string;claim_token:string;action:HandoffAction;booking_ref:string;confirmation_token:string;provider_session_ref:string|null;provider_attempt_key:string;mode:'test'|'live';expires_at:string}
export interface HostedHandoffProvider {resolve(claim:ProviderClaim):Promise<{url:string;sessionId:string}>}
export class SupabaseHandoffStore{
 constructor(private readonly client:QuoteRpcClient){}
 async call(name:string,args:Record<string,unknown>):Promise<Record<string,unknown>>{
  const {data,error}=await this.client.rpc(name,args);if(error){const row=error&&typeof error==='object'?error as Record<string,unknown>:{};
   if(['not_found','invalid_input','grant_expired','grant_revoked','payment_window_expired','forbidden'].includes(String(row.message)))throw new BookingApiError(row.message as 'not_found');
   if(row.code==='55P03'||row.code==='40001')throw new BookingApiError('request_in_flight',{retry_after_seconds:1});
   throw new BookingApiError('upstream_unavailable',{retry_after_seconds:1});
  }
  if(!data||typeof data!=='object'||Array.isArray(data))throw new BookingApiError('upstream_unavailable');return data as Record<string,unknown>;
 }
 create(principal:Principal,ref:string,action:HandoffAction,hash:string,mode:'test'|'live'){return this.call('external_create_customer_handoff',{...actorArgs(principal),_ref:ref,_action:action,_nonce_hash:hash,_mode:mode});}
 review(principal:Principal,hash:string){return this.call('external_review_customer_handoff',{...actorArgs(principal),_nonce_hash:hash});}
 claim(principal:Principal,hash:string){return this.call('external_claim_customer_handoff',{...actorArgs(principal),_nonce_hash:hash});}
 complete(principal:Principal,hash:string,claimToken:string,sessionId:string){return this.call('external_complete_customer_handoff',{...actorArgs(principal),_nonce_hash:hash,_claim_token:claimToken,_provider_session_ref:sessionId});}
}
