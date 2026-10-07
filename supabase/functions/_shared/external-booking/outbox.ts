import { BookingApiError } from './errors.ts';
import type { RequestRpcClient } from './requests.ts';
import type { SendRenterEmailArgs } from '../rentEmail.ts';
import { buildPayUrl, formatCurrency, formatDateRange, formatPickupTime, shortVehicleName } from '../rentFormat.ts';
export interface OutboxEvent { id: string; bookingId: string; deliveryKey: string; claimToken: string; createdAt: string }
export interface OutboxStore { claim(): Promise<OutboxEvent[]>; ack(event: OutboxEvent, messageId: string): Promise<boolean>; fail(event: OutboxEvent): Promise<void> }
export interface NotificationProvider { send(event: OutboxEvent, idempotencyKey: string): Promise<{ messageId: string }> }
/** SQL commit is atomic; SMTP is not. Provider must support stable idempotency
 * keys. Unknown outcomes retry only within its reviewed dedupe window, then need
 * reconciliation/manual review. Never log recipients, links or provider errors. */
export async function deliverOutboxBatch(store: OutboxStore, provider: NotificationProvider) {
  const events = await store.claim();
  let delivered=0,deferred=0;
  for (const event of events) {
    try {
      const result=await provider.send(event,event.deliveryKey);
      if (!result.messageId || !await store.ack(event,result.messageId)) { deferred++; continue; }
      delivered++;
    } catch { await store.fail(event); deferred++; }
  }
  return {delivered,deferred};
}
export class SupabaseOutboxStore implements OutboxStore {
  constructor(private readonly client: RequestRpcClient) {}
  private async rpc(name: string,args:Record<string,unknown>):Promise<unknown>{const {data,error}=await this.client.rpc(name,args);if(error)throw new BookingApiError('upstream_unavailable');return data;}
  async claim():Promise<OutboxEvent[]>{const data=await this.rpc('external_claim_booking_outbox',{_limit:10});if(!Array.isArray(data))throw new BookingApiError('upstream_unavailable');return data as OutboxEvent[];}
  async ack(event:OutboxEvent,messageId:string):Promise<boolean>{return await this.rpc('external_ack_booking_outbox',{_id:event.id,_claim_token:event.claimToken,_message_id:messageId})===true;}
  async fail(event:OutboxEvent):Promise<void>{await this.rpc('external_retry_booking_outbox',{_id:event.id,_claim_token:event.claimToken});}
}
/** Uses the existing internal sendRenterEmail and template through injection.
 * This provider is for the internal outbox worker, never API/MCP response data. */
export function renterNotificationProvider(client:RequestRpcClient, sendRenterEmail:(args:SendRenterEmailArgs)=>Promise<{message_id?:string|null}>, renterOrigin:string):NotificationProvider {
  const origin=new URL(renterOrigin);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new BookingApiError('upstream_unavailable');
  return {async send(event,key){
    const {data,error}=await client.rpc('external_outbox_notification_context',{_id:event.id,_claim_token:event.claimToken});
    if(error||!data||typeof data!=='object'||Array.isArray(data))throw new BookingApiError('upstream_unavailable');
    const context=data as Record<string,string>;
    const required=['booking_ref','confirmation_token','email','customer_name','operator_name','vehicle_name','start_date','end_date','timezone','currency','rental_total','status'];
    if(required.some(field=>typeof context[field]!=='string'||!context[field]))throw new BookingApiError('upstream_unavailable');
    const supportEmail=context.support_email||'support@exotiq.ai';
    const supportLine=context.support_phone?`Questions? Reply to this email, write ${supportEmail}, or call ${context.support_phone}.`:`Questions? Reply to this email or write ${supportEmail}.`;
    const result=await sendRenterEmail({templateName:'bookingRequest',to:context.email,subject:`Request received — ${context.operator_name} is reviewing your dates · ${context.booking_ref}`,
      variables:{OPERATOR_NAME:context.operator_name,BOOKING_REF:context.booking_ref,VEHICLE_NAME:context.vehicle_name,VEHICLE_SHORT:shortVehicleName(context.vehicle_name),DATE_RANGE:formatDateRange(context.start_date,context.end_date),PICKUP_TIME:formatPickupTime(context.start_date,context.timezone),LOCATION:context.pickup_location||'Arranged with operator',RENTAL_TOTAL:formatCurrency(Number(context.rental_total),context.currency),NEXT_STEP_NOTE:context.status==='pending_documents'?`${context.operator_name} reviews your request, usually within a few hours. A quick ID verification is part of the process — we'll walk you through it, nothing to do right now.`:`${context.operator_name} reviews your request, usually within a few hours. You'll hear either way.`,SUPPORT_LINE:supportLine,BOOKING_URL:buildPayUrl(context.booking_ref,context.confirmation_token,renterOrigin)},idempotencyKey:key,replyTo:supportEmail,fromName:context.operator_name,tags:[{name:'booking_ref',value:context.booking_ref},{name:'email_type',value:'booking_request'}]});
    if(!result.message_id)throw new BookingApiError('upstream_unavailable');
    return {messageId:result.message_id};
  }};
}
