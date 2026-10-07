import { describe, expect, it, vi } from 'vitest';
import { guardEnvironment, validateManifest } from '../../scripts/agent-booking/guard-environment.mjs';
import { applyManifest, teardownManifest } from '../../scripts/agent-booking/seed-staging.mjs';
import { suiteFiles } from '../../scripts/agent-booking/test-suites.mjs';

const now = Date.parse('2026-10-07T12:00:00Z');
const fixture = () => ({
  environment: 'agent-booking-staging', projectId: 'agent-test-local',
  supabaseUrl: 'http://127.0.0.1:65431', allowedUrls: ['http://127.0.0.1:65431'],
  allowedProjectIds: ['agent-test-local'],
  evidence: {
    environment: 'agent-booking-staging', projectId: 'agent-test-local', supabaseUrl: 'http://127.0.0.1:65431',
    reviewedBy: 'fixture-only-never-staging-proof', reviewedAt: '2026-10-07T11:00:00Z',
    expiresAt: '2026-10-08T11:00:00Z', baselineSha256: 'a'.repeat(64),
    schemaAndGrantsVerified: true, schedulerIsolated: true,
    providers: { oauthIssuer: 'https://agent-test-issuer.example.invalid', stripeOperator: 'test', stripeExotiq: 'test', identity: 'sandbox', email: 'sink' },
  },
  stripeOperatorKey: 'sk_test_synthetic', stripeExotiqKey: 'sk_test_synthetic',
});
const manifest = () => ({ version: 1, runId: 'agent-test-run-1', projectId: 'agent-test-local', rows: [
  { table: 'customers', id: '00000000-0000-4000-8000-000000000001', syntheticLabel: 'agent-test-customer', data: { id: '00000000-0000-4000-8000-000000000001', full_name: 'agent-test-customer', email: 'agent-test-customer@example.invalid' } },
] });

describe('staging guard', () => {
  it('accepts explicit isolated fixture configuration without network', () => {
    const network = vi.fn();
    expect(guardEnvironment(fixture(), { now, network })).toMatchObject({ projectId: 'agent-test-local' });
    expect(network).not.toHaveBeenCalled();
  });
  it.each([
    ['missing labels', { environment: undefined }],
    ['unallowlisted project', { allowedProjectIds: [] }],
    ['known original project', { projectId: 'jlgwbbqydjeokypoenoc' }],
    ['unallowlisted URL', { allowedUrls: [] }],
    ['production hostname', { supabaseUrl: 'https://book.exotiq.rent' }],
    ['URL credentials', { supabaseUrl: 'http://x:y@127.0.0.1:65431' }],
    ['missing reviewed evidence', { evidence: undefined }],
    ['live operator key', { stripeOperatorKey: 'sk_live_never-accepted' }],
    ['live platform key', { stripeExotiqKey: 'sk_live_never-accepted' }],
  ])('rejects %s before any network', (_, override) => {
    const network = vi.fn();
    expect(() => guardEnvironment({ ...fixture(), ...override }, { now, network })).toThrow();
    expect(network).not.toHaveBeenCalled();
  });
  it.each([
    { expiresAt: '2026-10-06T11:00:00Z' },
    { schemaAndGrantsVerified: false }, { schedulerIsolated: false },
    { projectId: 'agent-test-other' },
    { providers: { ...fixture().evidence.providers, identity: 'production' } },
    { providers: { ...fixture().evidence.providers, stripeExotiq: 'live' } },
  ])('rejects expired, incomplete or mismatched evidence', (override) => {
    expect(() => guardEnvironment({ ...fixture(), evidence: { ...fixture().evidence, ...override } }, { now })).toThrow();
  });
});

describe('manifest-scoped seed and teardown', () => {
  it('checks all rows before the first operation and rejects mixed nonsynthetic rows', async () => {
    const adapter = { insert: vi.fn(), deleteExact: vi.fn(), readExact: vi.fn(async () => null) };
    const input = manifest(); input.rows.push({ ...input.rows[0], syntheticLabel: 'real-person' });
    await expect(applyManifest(fixture(), input, adapter, { now })).rejects.toThrow();
    expect(adapter.insert).not.toHaveBeenCalled();
  });
  it('only deletes exact manifest IDs, in reverse dependency order', async () => {
    const adapter = { insert: vi.fn(), deleteExact: vi.fn(), readExact: vi.fn(async () => null) };
    await applyManifest(fixture(), manifest(), adapter, { now });
    expect(adapter.insert).toHaveBeenCalledWith('customers', manifest().rows[0].data);
    adapter.readExact.mockResolvedValue(manifest().rows[0].data);
    await teardownManifest(fixture(), manifest(), adapter, { now });
    expect(adapter.deleteExact).toHaveBeenCalledExactlyOnceWith('customers', manifest().rows[0].id);
  });
  it('rejects another project manifest, unknown tables, duplicate IDs and unsafe email', () => {
    const input = manifest();
    expect(() => validateManifest({ ...input, projectId: 'agent-test-other' }, fixture())).toThrow();
    expect(() => validateManifest({ ...input, rows: [{ ...input.rows[0], table: 'auth.users' }] }, fixture())).toThrow();
    expect(() => validateManifest({ ...input, rows: [...input.rows, ...input.rows] }, fixture())).toThrow();
    expect(() => validateManifest({ ...input, rows: [{ ...input.rows[0], data: { ...input.rows[0].data, email: 'person@gmail.com' } }] }, fixture())).toThrow();
  });
  it('refuses teardown when existing data is not the original manifest row', async () => {
    const adapter = { insert: vi.fn(), deleteExact: vi.fn(), readExact: vi.fn(async () => ({ id: manifest().rows[0].id, full_name: 'real customer' })) };
    await expect(teardownManifest(fixture(), manifest(), adapter, { now })).rejects.toThrow();
    expect(adapter.deleteExact).not.toHaveBeenCalled();
  });
});

it('keeps unit/contract/staging/pilot discovery explicit and disjoint', () => {
  expect(suiteFiles('unit').exclude).toContain('tests/agent-booking/concurrency.test.ts');
  expect(suiteFiles('contract').include).toContain('tests/agent-booking/capabilities.test.ts');
  expect(suiteFiles('staging').include).toContain('tests/agent-booking/concurrency.test.ts');
  expect(suiteFiles('pilot').include).toEqual(['tests/agent-booking/pilot.spec.ts']);
  expect(() => suiteFiles('unknown')).toThrow();
});
