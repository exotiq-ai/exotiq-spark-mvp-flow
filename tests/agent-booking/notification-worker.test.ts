import {describe,it,expect} from 'vitest';
import {createNotificationWorker,readWorkerConfig} from '../../supabase/functions/_shared/external-booking/notification-worker';
const config={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',serviceKey:'synthetic-service-key-150000',cronToken:'synthetic-cron-token-150000',internalToken:'synthetic-internal-token-150000',renterOrigin:'https://renter.example.invalid',providerProfile:'resend-idempotency-24h-v1'};
const event={id:'e1500000-0000-4000-8000-000000000001',bookingId:'b1500000-0000-4000-8000-000000000001',claimToken:'c1500000-0000-4000-8000-000000000001',deliveryKey:'request-agent-test-150001',createdAt:'2026-10-07T18:00:00Z'};
const context={booking_ref:'agent-test-150001',confirmation_token:'legacy-private',email:'private@example.invalid',customer_name:'Private Renter',operator_name:'Synthetic Operator',vehicle_name:'Synthetic Vehicle',start_date:'2026-11-01T15:00:00Z',end_date:'2026-11-03T15:00:00Z',timezone:'America/New_York',currency:'USD',rental_total:'200',status:'requested'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
describe('actual notification worker runtime composition',()=>{
 it('makes no provider or database contact without its cron credential',async()=>{
  let calls=0;const handler=createNotificationWorker(config,async()=>{calls++;return json(null);});
  expect((await handler(new Request('https://worker.example.invalid',{method:'POST'}))).status).toBe(401);expect(calls).toBe(0);
 });
 it('refuses an absent/unknown provider dedupe profile before any claim',()=>{
  expect(()=>readWorkerConfig({get:()=>undefined})).toThrow();expect(()=>createNotificationWorker({...config,providerProfile:'unknown'})).toThrow();
 });
 it('uses the actual06 frozen context/provider, actual internal email endpoint and receipt acknowledgement',async()=>{
  const names:string[]=[];
  const handler=createNotificationWorker(config,async(input,init)=>{
   const url=new URL(String(input));const body=JSON.parse(String(init?.body));expect(init?.signal).toBeDefined();expect(init?.redirect).toBe('error');
   if(url.pathname.endsWith('/send-renter-email')){names.push('email');expect(body.idempotencyKey).toBe(event.deliveryKey);expect(body.to).toBe(context.email);expect(body.variables.BOOKING_URL).toContain('legacy-private');return json({message_id:'provider-receipt-150001'});}
   const name=url.pathname.split('/').at(-1)!;names.push(name);
   if(name==='external_claim_booking_outbox'){expect(body._limit).toBe(3);return json([event]);}
   if(name==='external_outbox_notification_context')return json(context);
   if(name==='external_ack_booking_outbox'){expect(body._claim_token).toBe(event.claimToken);expect(body._message_id).toBe('provider-receipt-150001');return json(true);}
   if(name==='external_operational_maintenance')return json({notification_lag_ms:0});
   throw new Error('Unexpected actual runtime destination');
  });
  const response=await handler(new Request('https://worker.example.invalid',{method:'POST',headers:{'x-cron-token':config.cronToken}}));
  expect(response.status).toBe(200);expect(names.slice(0,4)).toEqual(['external_claim_booking_outbox','external_outbox_notification_context','email','external_ack_booking_outbox']);
  expect(await response.text()).not.toMatch(/legacy-private|private@example|Private Renter|provider-receipt|synthetic-service/);
 });
 it('ambiguous email failure releases retry with the same durable key, never acknowledges a nonexistent receipt',async()=>{
  const names:string[]=[];
  const handler=createNotificationWorker(config,async(input)=>{const name=new URL(String(input)).pathname.split('/').at(-1)!;names.push(name);if(name==='external_claim_booking_outbox')return json([event]);if(name==='external_outbox_notification_context')return json(context);if(name==='send-renter-email')throw new Error('provider credential leak');if(name==='external_retry_booking_outbox')return json(true);if(name==='external_operational_maintenance')return json({notification_lag_ms:0});throw new Error('Unexpected destination');});
  const response=await handler(new Request('https://worker.example.invalid',{method:'POST',headers:{'x-cron-token':config.cronToken}}));
  expect(response.status).toBe(200);expect(names).toContain('external_retry_booking_outbox');expect(names).not.toContain('external_ack_booking_outbox');expect(await response.text()).not.toContain('credential');
 });
});
