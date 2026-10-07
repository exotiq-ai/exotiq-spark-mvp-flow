import {BookingApiError} from './errors.ts';
import {handoffHash,safeProviderUrl,type HostedHandoffProvider,type ProviderClaim} from './handoff-store.ts';
export type InternalEndpoint='rent-checkout'|'identity-create-session';
const keyBytes=(raw:string)=>{if(!/^[A-Za-z0-9_-]{43}$/.test(raw))throw new BookingApiError('configuration_unavailable');return Uint8Array.from(atob(raw.replaceAll('-','+').replaceAll('_','/')+'='),s=>s.charCodeAt(0));};
async function signingKey(raw:string,usage:KeyUsage){return crypto.subtle.importKey('raw',keyBytes(raw),{name:'HMAC',hash:'SHA-256'},false,[usage]);}
export async function signInternalHandoff(endpoint:InternalEndpoint,body:unknown,key:string,now=Date.now()){
 const timestamp=String(now),message=`${timestamp}\n${endpoint}\n${await handoffHash(JSON.stringify(body))}`;
 return {timestamp,proof:[...new Uint8Array(await crypto.subtle.sign('HMAC',await signingKey(key,'sign'),new TextEncoder().encode(message)))].map(n=>n.toString(16).padStart(2,'0')).join('')};
}
/** Separate configured secret, exact endpoint/body and30second lifetime. Caller
 * body booleans, service JWT alone and legacy token possession cannot assert it. */
export async function verifyInternalHandoff(request:Request,endpoint:InternalEndpoint,body:unknown,key:string|undefined,now=Date.now()):Promise<void>{
 if(!key)throw new BookingApiError('configuration_unavailable');
 const at=request.headers.get('X-Exotiq-Handoff-Timestamp')??'',proof=request.headers.get('X-Exotiq-Handoff-Proof')??'';
 if(!/^\d{13}$/.test(at)||Math.abs(now-Number(at))>30000||!/^[a-f0-9]{64}$/.test(proof))throw new BookingApiError('unauthorized');
 const signature=Uint8Array.from(proof.match(/../g)!,x=>parseInt(x,16)),message=`${at}\n${endpoint}\n${await handoffHash(JSON.stringify(body))}`;
 if(!await crypto.subtle.verify('HMAC',await signingKey(key,'verify'),signature,new TextEncoder().encode(message)))throw new BookingApiError('unauthorized');
}
/** Fixed same Supabase deployment only. Legacy credential is sent in this
 * server-to-server body, never a URL/customer DTO/log or browser request. */
export class HttpHostedHandoffProvider implements HostedHandoffProvider{
 constructor(private readonly origin:string,private readonly serviceKey:string,private readonly bridgeKey:string,private readonly fetcher:typeof fetch=fetch,private readonly now=Date.now){
  const url=new URL(origin);if(url.protocol!=='https:'||!/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.port||url.username||url.password||url.search||url.hash||!serviceKey)throw new BookingApiError('configuration_unavailable');keyBytes(bridgeKey);
 }
 async resolve(claim:ProviderClaim){
  const absoluteDeadline=Date.now()+8000;
  const endpoint=claim.action==='identity'?'identity-create-session':'rent-checkout',body={booking_ref:claim.booking_ref,...(claim.action==='identity'?{confirmation_token:claim.confirmation_token}:{token:claim.confirmation_token}),external_handoff:{nonce_hash:claim.nonce_hash,claim_token:claim.claim_token}};
  const signed=await signInternalHandoff(endpoint,body,this.bridgeKey,this.now());
  let response:Response;try{response=await this.fetcher(new URL('/functions/v1/'+endpoint,this.origin),{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{authorization:'Bearer '+this.serviceKey,apikey:this.serviceKey,'content-type':'application/json','X-Exotiq-Handoff-Timestamp':signed.timestamp,'X-Exotiq-Handoff-Proof':signed.proof},body:JSON.stringify(body)});}catch{throw new BookingApiError('upstream_unavailable',{retry_after_seconds:1});}
  if(!response.ok)throw new BookingApiError(response.status===410?'payment_window_expired':response.status===409?'forbidden':'upstream_unavailable');
  const length=response.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>16384))throw new BookingApiError('upstream_unavailable');
  if(!response.body)throw new BookingApiError('upstream_unavailable');const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  let timer:ReturnType<typeof setTimeout>|undefined;const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new BookingApiError('upstream_unavailable')),Math.max(1,absoluteDeadline-Date.now()));});
  try{while(true){const r=await Promise.race([reader.read(),deadline]);if(r.done)break;size+=r.value.length;if(size>16384)throw new BookingApiError('upstream_unavailable');chunks.push(r.value);}}finally{if(timer)clearTimeout(timer);void reader.cancel().catch(()=>undefined);reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let result;try{result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new BookingApiError('upstream_unavailable');}
  const sessionId=result?.session_id;if(typeof sessionId!=='string'||!(claim.action==='identity'?/^vs_[A-Za-z0-9]+$/:/^cs_(?:test_|live_)?[A-Za-z0-9]+$/).test(sessionId))throw new BookingApiError('upstream_unavailable');
  return {url:safeProviderUrl(result.url,claim.action),sessionId};
 }
}
