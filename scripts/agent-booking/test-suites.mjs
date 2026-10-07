const root = 'tests/agent-booking/';
export const contractNames = ['capabilities', 'contracts', 'visibility', 'docs', 'security', 'release-gates'];
export const stagingNames = ['grants', 'quote-consent', 'concurrency', 'inventory-parity', 'idempotency', 'request-compatibility', 'request-routes', 'payment-states', 'handoff-resolver', 'handoff-continuity', 'rollback'];
const files = (names) => names.map((name) => `${root}${name}.test.ts`);
export function suiteFiles(suite) {
  const generated = ['**/node_modules/**', '**/.git/**'];
  if (suite === 'unit') return { include: [`${root}*.test.ts`], exclude: [...generated, ...files(contractNames), ...files(stagingNames)] };
  if (suite === 'contract') return { include: files(contractNames), exclude: generated };
  if (suite === 'staging') return { include: files(stagingNames), exclude: generated };
  if (suite === 'pilot') return { include: [`${root}pilot.spec.ts`], exclude: generated };
  throw new Error('Unknown agent test suite');
}
