import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
/** Actual PostgreSQL runner; ownership/partial-schema guard runs on every SQL
 * operation. Never accepts a connection URL or production credentials. */
export function runRequestLab(script: 'setup.mjs' | 'concurrency.mjs' | 'lab.mjs', sqlFile?: 'request-check.sql' | 'replay-expiry.sql' | 'replay-expiry-check.sql' | 'compatibility-check.sql') {
  const args = [resolve('request-lab', script), ...(sqlFile ? ['sql', resolve('request-lab', sqlFile)] : [])];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 25000 });
  if (result.status !== 0 || result.error) throw new Error(`Actual partial SQL check failed: ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
