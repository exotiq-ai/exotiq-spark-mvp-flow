import { expect, it } from 'vitest';
import { deliverOutboxBatch, renterNotificationProvider } from '../../supabase/functions/_shared/external-booking/outbox.ts';
const event={id:'event-a',bookingId:'booking-a',deliveryKey:'request-booking-a',claimToken:'claim-a',createdAt:'2026-10-07T18:00:00Z'};
it('sends only durable claimed post-commit events with stable provider dedupe key', async () => { const order:string[]=[]; const result=await deliverOutboxBatch({ claim:async()=>[event],ack:async()=>{order.push('ack');return true;},fail:async()=>{order.push('fail');} },{ send:async(e,key)=>{order.push('send');expect(key).toBe(e.deliveryKey);return {messageId:'sink-a'};} });expect(order).toEqual(['send','ack']);expect(result).toEqual({delivered:1,deferred:0}); });
it('leaves failed delivery durable for retry and does not claim transaction SMTP atomicity', async () => {let failed=0;const result=await deliverOutboxBatch({claim:async()=>[event],ack:async()=>true,fail:async()=>{failed++;}},{send:async()=>{throw Error('provider outage');}});expect(failed).toBe(1);expect(result).toEqual({delivered:0,deferred:1});});
it('does not mark delivered when claim was lost; same provider key protects supported retry window', async () => {const result=await deliverOutboxBatch({claim:async()=>[event],ack:async()=>false,fail:async()=>{}},{send:async()=>({messageId:'sink-a'})});expect(result).toEqual({delivered:0,deferred:1});});
it('uses existing notification template and internal frozen context through a test sink', async () => {
 const context={booking_ref:'agent-test-ref',confirmation_token:'internal-legacy-token',email:'agent-test@example.invalid',customer_name:'agent-test Renter',operator_name:'agent-test Miami',vehicle_name:'agent-test Car',start_date:'2026-11-01T15:00:00Z',end_date:'2026-11-03T16:00:00Z',timezone:'America/New_York',currency:'USD',rental_total:'200',status:'pending_documents'};
 const provider=renterNotificationProvider({rpc:async(name,args)=>{expect(name).toBe('external_outbox_notification_context');expect(args).toEqual({_id:event.id,_claim_token:event.claimToken});return {data:context,error:null};}},async args=>{expect(args.templateName).toBe('bookingRequest');expect(args.idempotencyKey).toBe(event.deliveryKey);expect(args.to).toBe(context.email);expect(args.variables.BOOKING_URL).toContain('internal-legacy-token');return {message_id:'sink-existing-template'};},'https://renter.example.invalid');
 await expect(provider.send(event,event.deliveryKey)).resolves.toEqual({messageId:'sink-existing-template'});
});
it('does not contact notification provider without a valid current claim context', async()=>{
 let sends=0;const provider=renterNotificationProvider({rpc:async()=>({data:null,error:null})},async()=>{sends++;return {message_id:'unexpected'};},'https://renter.example.invalid');
 await expect(provider.send(event,event.deliveryKey)).rejects.toMatchObject({code:'upstream_unavailable'});expect(sends).toBe(0);
});
