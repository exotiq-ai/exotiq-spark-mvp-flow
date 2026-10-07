import {deliverOutboxBatch,SupabaseOutboxStore,renterNotificationProvider,type OutboxEvent} from './outbox.ts';
import type {SendRenterEmailArgs} from '../rentEmail.ts';
import {emitEvent,redactedEvent} from './observability.ts';
import {OperationControlError,type FlagRpc} from './flags.ts';
export type WorkerFetch=(input:string|URL|Request,init?:RequestInit)=>Promise<Response>;
export interface WorkerConfig {
 supabaseUrl:string;serviceKey:string;cronToken:string;internalToken:string;renterOrigin:string;providerProfile:string;
 telemetry?:{url:string;token:string;allowedHosts:string[];profile:string};
}
const profile='resend-idempotency-24h-v1';
function validateConfig(config:WorkerConfig):void{
 const url=new URL(config.supabaseUrl),origin=new URL(config.renterOrigin);
 if(url.protocol!=='https:'||!(/^[a-z0-9]{20}\.supabase\.co$/).test(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.password||url.port
  ||origin.protocol!=='https:'||origin.pathname!=='/'||origin.username||origin.password||origin.search||origin.hash||origin.port
  ||config.providerProfile!==profile||[config.serviceKey,config.cronToken,config.internalToken].some(value=>typeof value!=='string'||value.length<16||value.length>16384))throw new OperationControlError('configuration_unavailable');
 if(config.telemetry){const sink=new URL(config.telemetry.url);if(!Array.isArray(config.telemetry.allowedHosts)||!config.telemetry.allowedHosts.length||config.telemetry.allowedHosts.length>10||config.telemetry.allowedHosts.some(host=>typeof host!=='string'||!/^[a-z0-9.-]+$/.test(host))||sink.protocol!=='https:'||sink.username||sink.password||sink.search||sink.hash||sink.port||!config.telemetry.allowedHosts.includes(sink.hostname)||/^[\d.]+$/.test(sink.hostname)||/(?:^|\.)(localhost|local|internal)$/.test(sink.hostname)||sink.hostname.includes(':')||config.telemetry.profile!=='event-id-dedupe-v1'||typeof config.telemetry.token!=='string'||config.telemetry.token.length<16||config.telemetry.token.length>16384)throw new OperationControlError('configuration_unavailable');}
}
export function readWorkerConfig(env:{get(name:string):string|undefined}):WorkerConfig {
 try{
  const config:WorkerConfig={supabaseUrl:env.get('SUPABASE_URL')??'',serviceKey:env.get('SUPABASE_SERVICE_ROLE_KEY')??'',cronToken:env.get('CRON_TRIGGER_TOKEN')??'',internalToken:env.get('INTERNAL_FUNCTION_TOKEN')??'',renterOrigin:env.get('RENTER_APP_ORIGIN')??'',providerProfile:env.get('EXTERNAL_NOTIFICATION_PROVIDER_PROFILE')??''};
  const telemetryUrl=env.get('EXTERNAL_TELEMETRY_URL');
  if(telemetryUrl)config.telemetry={url:telemetryUrl,token:env.get('EXTERNAL_TELEMETRY_TOKEN')??'',allowedHosts:JSON.parse(env.get('EXTERNAL_TELEMETRY_ALLOWED_HOSTS')??'[]'),profile:env.get('EXTERNAL_TELEMETRY_PROFILE')??''};
  validateConfig(config);return config;
 }catch{throw new OperationControlError('configuration_unavailable');}
}
async function boundedJson(response:Response):Promise<unknown>{
 if(!response.body)throw new OperationControlError('configuration_unavailable');
 const reader=response.body.getReader();const parts:Uint8Array[]=[];let length=0;
 try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>65536)throw new OperationControlError('configuration_unavailable');parts.push(part.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{void reader.cancel().catch(()=>undefined);reader.releaseLock();}
}
const rpcs=new Set(['external_claim_booking_outbox','external_ack_booking_outbox','external_retry_booking_outbox','external_outbox_notification_context','external_enqueue_redacted_event','external_operational_maintenance','external_claim_redacted_events','external_finish_redacted_event']);
/** Fixed service RPC transport;3 events bound worst-case work below the06
 * two-minute claim lease. No API bearer/customer authority is accepted here. */
export class WorkerRpc implements FlagRpc {
 constructor(private readonly config:WorkerConfig,private readonly fetcher:WorkerFetch){validateConfig(config);}
 async rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:unknown}>{
  if(!rpcs.has(name))throw new OperationControlError('configuration_unavailable');
  try{
   const body=name==='external_claim_booking_outbox'||name==='external_claim_redacted_events'?{...args,_limit:3}:args;
   const response=await this.fetcher(new URL('/rest/v1/rpc/'+name,this.config.supabaseUrl),{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{apikey:this.config.serviceKey,Authorization:'Bearer '+this.config.serviceKey,'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await boundedJson(response);return response.ok?{data,error:null}:{data:null,error:{code:'worker_authority_unavailable'}};
  }catch{return {data:null,error:{code:'worker_authority_unavailable'}};}
 }
}
function validEvent(event:OutboxEvent):boolean{
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 return !!event&&[event.id,event.bookingId,event.claimToken].every(value=>typeof value==='string'&&uuid.test(value))&&typeof event.deliveryKey==='string'&&/^[A-Za-z0-9._:-]{1,256}$/.test(event.deliveryKey)&&typeof event.createdAt==='string'&&Number.isFinite(Date.parse(event.createdAt));
}
function safeJson(body:unknown,status=200):Response{return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
function credentialEqual(provided:string|null,expected:string):boolean{
 if(!provided||provided.length!==expected.length)return false;let difference=0;for(let index=0;index<expected.length;index++)difference|=provided.charCodeAt(index)^expected.charCodeAt(index);return difference===0;
}
export function createNotificationWorker(config:WorkerConfig,fetcher:WorkerFetch=fetch):(request:Request)=>Promise<Response>{
 validateConfig(config);
 const rpc=new WorkerRpc(config,fetcher),base=new SupabaseOutboxStore(rpc);
 const store={claim:async()=>{const events=await base.claim();if(events.length>3||!events.every(validEvent))throw new OperationControlError('configuration_unavailable');return events;},ack:base.ack.bind(base),fail:base.fail.bind(base)};
 const send=async(args:SendRenterEmailArgs):Promise<{message_id:string}>=>{
  const response=await fetcher(new URL('/functions/v1/send-renter-email',config.supabaseUrl),{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json','x-internal-token':config.internalToken},body:JSON.stringify(args)});
  const data=await boundedJson(response) as Record<string,unknown>;
  if(!response.ok||!data||typeof data.message_id!=='string'||!data.message_id||data.message_id.length>256)throw new OperationControlError('configuration_unavailable');
  return {message_id:data.message_id};
 };
 const provider=renterNotificationProvider(rpc,send,config.renterOrigin);
 return async request=>{
  if(request.method!=='POST')return safeJson({code:'invalid_input'},405);
  if(!credentialEqual(request.headers.get('x-cron-token'),config.cronToken))return safeJson({code:'unauthorized'},401);
  try{
   const result=await deliverOutboxBatch(store,provider);
   const maintenance=await rpc.rpc('external_operational_maintenance',{});
   await emitEvent(rpc,{request_id:crypto.randomUUID(),action:'notification:delivery',outcome:result.deferred?'deferred':'success'});
   // If no reviewed sink is configured, telemetry stays durable in its outbox.
   let telemetryDelivered=0;
   if(config.telemetry){
    const claimed=await rpc.rpc('external_claim_redacted_events',{});
    if(!claimed.error&&Array.isArray(claimed.data)&&claimed.data.length<=3)for(const item of claimed.data){
     if(!item||typeof item.id!=='string'||typeof item.claim_token!=='string')continue;
     let delivered=false;
     try{const event=redactedEvent(item.event);const response=await fetcher(config.telemetry.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.telemetry.token,'Idempotency-Key':item.id},body:JSON.stringify({event_id:item.id,...event})});delivered=response.ok;void response.body?.cancel().catch(()=>undefined);}catch{/* Durable redacted event remains retryable. */}
     const ack=await rpc.rpc('external_finish_redacted_event',{_id:item.id,_claim_token:item.claim_token,_delivered:delivered});if(delivered&&!ack.error&&ack.data===true)telemetryDelivered++;
    }
   }
   return safeJson({...result,telemetry_delivered:telemetryDelivered,maintenance_pending:!!maintenance.error});
  }catch{return safeJson({code:'configuration_unavailable'},503);}
 };
}
