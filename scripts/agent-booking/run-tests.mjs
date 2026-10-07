import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { suiteFiles } from './test-suites.mjs';

const [suite, ...args] = process.argv.slice(2);
try {
  suiteFiles(suite);
  if (suite === 'staging' || suite === 'pilot') {
    const { guardEnvironment } = await import('./guard-environment.mjs');
    if (!process.env.AGENT_STAGING_CONFIG) throw new Error('Dedicated staging evidence is required; no production fallback');
    const config = JSON.parse(readFileSync(process.env.AGENT_STAGING_CONFIG, 'utf8'));
    guardEnvironment({ ...config, stripeOperatorKey: process.env.AGENT_STRIPE_OPERATOR_TEST_KEY, stripeExotiqKey: process.env.AGENT_STRIPE_EXOTIQ_TEST_KEY });
  }
  const root = fileURLToPath(new URL('../../', import.meta.url));
  // The fixed config cannot be overridden to load project dotenv or widen discovery.
  if (args.some((arg) => !(
    arg === '--run' || (suite === 'pilot' && arg === '--project=synthetic')
    || /^tests\/agent-booking\/[A-Za-z0-9-]+\.(test|spec)\.ts$/.test(arg)
  ))) {
    throw new Error('Test runner override is not allowed');
  }
  const result = spawnSync(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), '--config', resolve(root, 'vitest.agent.config.ts'), '--run', ...args.filter((arg) => arg !== '--run')], {
    cwd: root, stdio: 'inherit', env: { ...process.env, AGENT_TEST_SUITE: suite },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(`Agent tests refused: ${error.message}`);
  process.exitCode = 1;
}
