import {jwtVerify} from 'jose';
import type {Principal} from './auth.ts';
import {BookingApiError} from './errors.ts';
export interface HostedProofConfiguration {frontendOrigin:string;resource:string;bridgeKey:string;hostedClientIds:readonly string[];}
export interface HostedCustomerProof {issuer:string;subject:string;clientId:string;csrfHash:string;profile:{email:string|null;emailVerified:boolean;name:string|null};}
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
async function boundedBody(request:Request):Promise<string>{
 const reader=request.clone().body?.getReader();if(!reader)return '';let size=0;const chunks:Uint8Array[]=[];
 try {for(;;){const part=await reader.read();if(part.done)break;if(part.value){size+=part.value.byteLength;if(size>65536){throw new BookingApiError('invalid_input');}chunks.push(part.value);}}
 const merged=new Uint8Array(size);let offset=0;for(const c of chunks){merged.set(c,offset);offset+=c.byteLength;}return new TextDecoder('utf-8',{fatal:true}).decode(merged);
 }catch(error){
  // A cloned stream is a tee: awaiting cancellation of just one branch can
  // wait forever while the original is unread. Cancel both without blocking.
  void reader.cancel().catch(()=>undefined);
  if(request.body&&!request.body.locked)void request.body.cancel().catch(()=>undefined);
  throw error;
 }finally{reader.releaseLock();}
}
/** This is an INTERNAL BFF request attestation, never an OAuth access token.
 * The ingress must first verify the managed-provider API bearer token using
 * auth.ts, including live revocation. No body/headers establish Principal.
 * Idempotent narrow consent/onboarding/renewal RPCs bind replay to exact action.
 */
export async function verifyHostedProof(request:Request,principal:Principal,configuration:HostedProofConfiguration|null,now=new Date()):Promise<HostedCustomerProof>{
 try {
  if(!configuration)throw new BookingApiError('upstream_unavailable');const c=configuration;
  if(!/^https:\/\//.test(c.frontendOrigin)||new URL(c.frontendOrigin).origin!==c.frontendOrigin||!/^https:\/\//.test(c.resource)||!c.hostedClientIds.includes(principal.clientId)||principal.audience!==c.resource||!Number.isFinite(now.getTime())||!/^[A-Za-z0-9_-]{43}$/.test(c.bridgeKey))throw new BookingApiError('unauthorized');
  const encoded=c.bridgeKey.replace(/-/g,'+').replace(/_/g,'/');const key=Uint8Array.from(atob(encoded),x=>x.charCodeAt(0));if(key.length!==32)throw new BookingApiError('upstream_unavailable');
  const proof=request.headers.get('X-Exotiq-Hosted-Proof');if(!proof||proof.length>4096)throw new BookingApiError('unauthorized');
  const {payload:p}=await jwtVerify(proof,key,{issuer:c.frontendOrigin,audience:c.resource,algorithms:['HS256'],typ:'exotiq-hosted-proof+jwt',requiredClaims:['iss','aud','iat','exp','jti','provider_issuer','provider_subject','client_id','method','path','body_hash','token_hash','csrf_hash'],currentDate:now,clockTolerance:0});
  const url=new URL(request.url),auth=request.headers.get('authorization'),base=new URL(c.resource),seconds=Math.floor(now.getTime()/1000);
  if(p.aud!==c.resource||typeof p.jti!=='string'||p.jti.length<8||p.jti.length>256||!Number.isInteger(p.iat)||!Number.isInteger(p.exp)||p.iat!>seconds||p.exp!<=p.iat!||p.exp!-p.iat!>30||p.provider_issuer!==principal.issuer||p.provider_subject!==principal.subject||p.client_id!==principal.clientId||p.method!==request.method||p.path!==url.pathname||url.origin!==base.origin||!url.pathname.startsWith(base.pathname.replace(/\/$/,'')+'/v1/')||url.search||url.hash||!['GET','POST'].includes(request.method)||!auth?.startsWith('Bearer ')||typeof p.csrf_hash!=='string'||! /^[a-f0-9]{64}$/.test(p.csrf_hash)||p.token_hash!==await hash(auth.slice(7))||p.body_hash!==await hash(await boundedBody(request)))throw new BookingApiError('unauthorized');
  if(p.profile_email!==undefined&&p.profile_email!==null&&(typeof p.profile_email!=='string'||p.profile_email.length>320)||p.profile_name!==undefined&&p.profile_name!==null&&(typeof p.profile_name!=='string'||p.profile_name.length>160)||p.profile_email_verified!==undefined&&typeof p.profile_email_verified!=='boolean')throw new BookingApiError('unauthorized');
  return {issuer:principal.issuer,subject:principal.subject,clientId:principal.clientId,csrfHash:p.csrf_hash,profile:{email:typeof p.profile_email==='string'?p.profile_email:null,emailVerified:p.profile_email_verified===true,name:typeof p.profile_name==='string'?p.profile_name:null}};
 }catch(error){if(error instanceof BookingApiError)throw error;throw new BookingApiError('unauthorized');}
}
