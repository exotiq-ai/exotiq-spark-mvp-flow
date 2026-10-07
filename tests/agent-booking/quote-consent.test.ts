import { describe, it } from 'vitest';

// The offline boundary is quote-consent-unit.test.ts. Real migration/ACL/race
// assertions are executed in the separately guarded synthetic PostgreSQL lab.
// Full Auth/PostgREST/provider parity cannot be inferred from that partial lab.
describe('hosted quote persistence/consent deployment parity', () => {
  it.skip('requires dedicated Supabase staging Auth/PostgREST and synthetic customer ownership evidence before rollout', () => {});
});
