import { beforeAll, expect, it } from 'vitest';
import { runRequestLab } from './helpers/request-lab.ts';
// Custom request-lab config verifies actual LOCAL partial PostgreSQL only.
// Full staging runner independently refuses absent provider/staging evidence.
beforeAll(() => { runRequestLab('setup.mjs'); });
it('real PostgreSQL rejects consumed consent/changed prices and rolls back all side effects', () => { expect(runRequestLab('lab.mjs','request-check.sql')).toContain('ROLLBACK'); });
it('20 same-key clients commit one booking and 20 different keys consume one receipt once', () => { const result=JSON.parse(runRequestLab('concurrency.mjs')); expect(result).toMatchObject({ sameKeyConnections:20,sameKeyBookingCount:1,differentKeyConnections:20,differentKeyBookingCount:1,consentDenied:19 }); });
it('replays a committed response after actual quote expiry, while conflicts and revocation still deny', () => { runRequestLab('lab.mjs','replay-expiry.sql'); expect(runRequestLab('lab.mjs','replay-expiry-check.sql')).toContain('DO'); });
