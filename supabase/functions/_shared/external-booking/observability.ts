import type {FlagRpc} from './flags.ts';
export const EVENT_ACTIONS=['catalog:read','availability:read','quote:create','request:create','request:read','request:replay','grant:reauthorize','consent:new-delegation','identity:handoff','checkout:handoff','nonce:resolve','payment:reconcile','payment:settlement','payment:confirmation','notification:delivery','scheduler:tick','flags:change'] as const;
export const EVENT_OUTCOMES=['success','denied','unknown','replay','conflict','deferred','failed'] as const;
export interface RedactedEvent {
 request_id:string;action:typeof EVENT_ACTIONS[number];outcome:typeof EVENT_OUTCOMES[number];
 operator_id?:string;quote_id?:string;booking_id?:string;principal_pseudonym?:string;
 terms_version?:string;pricing_version?:string;latency_ms?:number;scheduler_lag_ms?:number;itemization_equal?:boolean;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=/^[a-f0-9]{64}$/;
/** Copy only enum/shape-bounded authoritative fields. Never copy a message,
 * caller headers, URLs, receipts, provider payload or customer profile. */
export function redactedEvent(raw:unknown):RedactedEvent {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid operational event');
 const source=raw as Record<string,unknown>;
 if(typeof source.request_id!=='string'||!(/^[A-Za-z0-9_-]{16,80}$/).test(source.request_id)||!EVENT_ACTIONS.includes(source.action as any)||!EVENT_OUTCOMES.includes(source.outcome as any))throw new Error('Invalid operational event');
 const output:Record<string,unknown>={request_id:source.request_id,action:source.action,outcome:source.outcome};
 for(const key of ['operator_id','quote_id','booking_id'])if(source[key]!==undefined){if(typeof source[key]!=='string'||!uuid.test(source[key]))throw new Error('Invalid operational event');output[key]=source[key];}
 for(const key of ['principal_pseudonym','terms_version','pricing_version'])if(source[key]!==undefined){if(typeof source[key]!=='string'||!hash.test(source[key]))throw new Error('Invalid operational event');output[key]=source[key];}
 for(const key of ['latency_ms','scheduler_lag_ms'])if(source[key]!==undefined){if(!Number.isSafeInteger(source[key])||Number(source[key])<0||Number(source[key])>(key==='latency_ms'?300000:31536000000))throw new Error('Invalid operational event');output[key]=source[key];}
 if(source.itemization_equal!==undefined){if(typeof source.itemization_equal!=='boolean')throw new Error('Invalid operational event');output.itemization_equal=source.itemization_equal;}
 return output as unknown as RedactedEvent;
}
export async function principalPseudonym(secret:Uint8Array,issuer:string,subject:string):Promise<string>{
 if(secret.byteLength<32||secret.byteLength>64||typeof issuer!=='string'||issuer.length>2048||typeof subject!=='string'||!subject||subject.length>256)throw new Error('Invalid pseudonym configuration');
 const key=await crypto.subtle.importKey('raw',secret as BufferSource,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify([issuer,subject])));
 return Array.from(new Uint8Array(signature),value=>value.toString(16).padStart(2,'0')).join('');
}
/** Optional telemetry cannot undo an already committed booking. Required
 * request/financial evidence stays in its authoritative transaction ledgers. */
export async function emitEvent(client:FlagRpc,event:unknown):Promise<boolean>{
 try{const safe=redactedEvent(event);const {data,error}=await client.rpc('external_enqueue_redacted_event',{_event:safe});return !error&&data===true;}catch{return false;}
}
