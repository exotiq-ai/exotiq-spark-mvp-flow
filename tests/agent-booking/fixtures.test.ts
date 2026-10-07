import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createOAuthFixtures, checkFixtureToken } from './fixtures/oauth';
import { createUpstreamFixture, syntheticContext } from './fixtures/upstream';
import { createSignedDeliveries, verifyTestWebhookSignature, replayDeliveries } from './helpers/webhook-replay';
import { auditSource } from '../../scripts/agent-booking/audit-source.mjs';

describe('offline OAuth fixture failures', () => {
  const now = 1791374400;
  const fixtures = createOAuthFixtures(now);
  it('creates real signed issuer/JWKS fixtures and matching synthetic ownership', () => {
    expect(checkFixtureToken(fixtures.tokens.valid, fixtures, now)).toMatchObject({ sub: syntheticContext.subject, aud: fixtures.audience });
    expect(fixtures.jwks.keys[0].d).toBeUndefined();
  });
  it.each(['expired', 'revoked', 'wrongAudience', 'wrongIssuer', 'wrongSignature', 'unknownKey', 'unsigned', 'futureIssued'])('rejects %s without network or silent acceptance', (fault) => {
    expect(() => checkFixtureToken(fixtures.tokens[fault], fixtures, now)).toThrow();
  });
  it('does not let a claimed email grant customer or tenant ownership', () => {
    const claims = checkFixtureToken(fixtures.tokens.valid, fixtures, now);
    expect(claims.customer_id).toBe(syntheticContext.customerId);
    expect(claims.email).toBeUndefined();
    expect(fixtures.tokens.wrongCustomer).not.toEqual(fixtures.tokens.valid);
  });
});

describe('upstream fault fixtures', () => {
  it.each(['timeout', 'unavailable'])('fails %s rather than returning empty availability', async (fault) => {
    const upstream = createUpstreamFixture(fault);
    await expect(upstream.fetch()).rejects.toThrow();
    expect(upstream.calls()).toBe(1);
  });
  it('schema disagreements are observable and UNKNOWN remains explicit', async () => {
    expect(await (await createUpstreamFixture('schema-disagreement').fetch()).json()).toEqual({ availability: [] });
    expect(await (await createUpstreamFixture('unknown').fetch()).json()).toMatchObject({ status: 'UNKNOWN', reason: 'upstream_unavailable' });
    expect(await (await createUpstreamFixture('success').fetch()).json()).toMatchObject({ status: 'AVAILABLE' });
  });
});

describe('signed duplicate, late and out-of-order webhook inputs', () => {
  it('preserves event IDs, exact bytes, timestamp and both payment leg contexts', async () => {
    const fixture = createSignedDeliveries(1791374400);
    expect(fixture.deliveries.map((entry) => entry.event.id)).toEqual(['evt_agent_test_exotiq', 'evt_agent_test_operator', 'evt_agent_test_operator', 'evt_agent_test_late_failure']);
    expect(fixture.deliveries.map((entry) => entry.event.account)).toContain('acct_agent_test_operator');
    expect(fixture.deliveries.map((entry) => entry.event.account)).toContain('acct_agent_test_exotiq');
    const seen = new Set();
    const handler = vi.fn(async (delivery) => {
      expect(verifyTestWebhookSignature(delivery.rawBody, delivery.signature, fixture.secret, 1791374400)).toBe(true);
      const duplicate = seen.has(delivery.event.id); seen.add(delivery.event.id);
      return { duplicate };
    });
    const result = await replayDeliveries(fixture.deliveries, handler);
    expect(result[2]).toEqual({ duplicate: true });
    expect(handler).toHaveBeenCalledTimes(4);
    expect(fixture.deliveries[1].rawBody).toBe(fixture.deliveries[2].rawBody);
    expect(fixture.deliveries[1].signature).toBe(fixture.deliveries[2].signature);
  });
  it('tampered body, wrong secret, old signing timestamp and replay failures fail', async () => {
    const fixture = createSignedDeliveries(1791374400);
    const delivery = fixture.deliveries[0];
    expect(verifyTestWebhookSignature(delivery.rawBody + ' ', delivery.signature, fixture.secret, 1791374400)).toBe(false);
    expect(verifyTestWebhookSignature(delivery.rawBody, delivery.signature, 'wrong-test-secret', 1791374400)).toBe(false);
    expect(verifyTestWebhookSignature(delivery.rawBody, delivery.signature, fixture.secret, 1791374800)).toBe(false);
    await expect(replayDeliveries(fixture.deliveries, async () => { throw new Error('handler failure'); })).rejects.toThrow('handler failure');
  });
});

it('privilege fixture matches every source writer and overload but claims no effective grant proof', () => {
  const fixture = JSON.parse(readFileSync('tests/agent-booking/fixtures/schema-grants.json', 'utf8'));
  const report = auditSource(process.cwd());
  expect(fixture.sourceFingerprint).toBe(report.sourceFingerprint);
  expect(fixture.writers).toEqual(report.writers);
  expect(fixture.functions).toEqual(report.finalFunctions);
  expect(fixture.grantStatements).toEqual(report.permissions);
  expect(fixture.states).toEqual(report.states);
  expect(fixture.proof).toBe('source-only; applied effective privileges not verified');
});
