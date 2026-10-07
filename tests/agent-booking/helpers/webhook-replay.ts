import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { syntheticContext } from '../fixtures/upstream';

export interface TestWebhookEvent {
  id: string; type: string; account: string; created: number; livemode: false;
  data: { object: { id: string; metadata: { booking_id: string; leg: string } } };
}
export interface TestDelivery { event: TestWebhookEvent; rawBody: string; signature: string }
const signatureFor = (raw: string, timestamp: number, secret: string) => createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');

export function createSignedDeliveries(now: number) {
  const secret = `whsec_agent_test_${randomBytes(24).toString('hex')}`;
  const event = (id: string, leg: string, type: string, created: number): TestWebhookEvent => ({
    id, type, account: `acct_agent_test_${leg}`, created, livemode: false,
    data: { object: { id: `pi_agent_test_${leg}`, metadata: { booking_id: syntheticContext.bookingId, leg } } },
  });
  const signEvent = (entry: TestWebhookEvent): TestDelivery => {
    const rawBody = JSON.stringify(entry);
    return { event: entry, rawBody, signature: `t=${now},v1=${signatureFor(rawBody, now, secret)}` };
  };
  const operator = signEvent(event('evt_agent_test_operator', 'operator', 'payment_intent.succeeded', now - 20));
  const platform = signEvent(event('evt_agent_test_exotiq', 'exotiq', 'payment_intent.succeeded', now - 10));
  const lateFailure = signEvent(event('evt_agent_test_late_failure', 'operator', 'payment_intent.payment_failed', now - 30));
  return { secret, deliveries: [platform, operator, { ...operator }, lateFailure] };
}

/** Stripe-style raw-body HMAC fixture verification; production must use its provider SDK. */
export function verifyTestWebhookSignature(raw: string, header: string, secret: string, now: number, toleranceSeconds = 300) {
  const fields = header.split(',');
  const timestamp = Number(fields.find((value) => value.startsWith('t='))?.slice(2));
  const signature = fields.find((value) => value.startsWith('v1='))?.slice(3);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > toleranceSeconds || !signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(signatureFor(raw, timestamp, secret), 'hex'));
}

/** Delivers every event verbatim. Deduplication/monotonicity belong to the real handler. */
export async function replayDeliveries<T>(deliveries: TestDelivery[], handler: (delivery: TestDelivery) => Promise<T>) {
  const results: T[] = [];
  for (const delivery of deliveries) results.push(await handler(delivery));
  return results;
}
