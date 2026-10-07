import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { guardEnvironment, validateManifest, assertSyntheticExistingRow } from './guard-environment.mjs';

function preflight(config, manifest, options) {
  const environment = guardEnvironment(config, options);
  validateManifest(manifest, config);
  return environment;
}
export async function applyManifest(config, manifest, adapter, options = {}) {
  preflight(config, manifest, options);
  if (typeof adapter.readExact !== 'function') throw new Error('Exact-row preflight is required');
  // Validate every destination before inserting anything; no upsert or overwrite.
  for (const row of manifest.rows) {
    if (await adapter.readExact(row.table, row.id)) throw new Error('Seed ID already exists; refusing overwrite');
  }
  for (const row of manifest.rows) await adapter.insert(row.table, row.data);
  return { inserted: manifest.rows.length, runId: manifest.runId };
}
export async function teardownManifest(config, manifest, adapter, options = {}) {
  preflight(config, manifest, options);
  if (typeof adapter.readExact !== 'function') throw new Error('Exact-row preflight is required');
  const existing = [];
  for (const row of manifest.rows) {
    const current = await adapter.readExact(row.table, row.id);
    if (!current) continue;
    assertSyntheticExistingRow(row, current);
    existing.push(row);
  }
  for (const row of existing.reverse()) await adapter.deleteExact(row.table, row.id);
  return { deleted: existing.length, runId: manifest.runId };
}

export function createRestAdapter(config, credential, { manifest = undefined, fetcher = globalThis.fetch, now = Date.now() } = {}) {
  const target = preflight(config, manifest, { now });
  // Bind legacy service JWTs to the reviewed project; opaque keys need a separately
  // reviewed project-scoped implementation and are intentionally refused here.
  let claims;
  try { claims = JSON.parse(Buffer.from(credential.split('.')[1], 'base64url').toString()); } catch { throw new Error('Project-bound test service JWT required'); }
  if (claims.role !== 'service_role' || (!target.local && claims.ref !== target.projectId) || (target.local && (claims.iss !== 'supabase' || (claims.ref && claims.ref !== target.projectId)))) throw new Error('Service credential is not bound to selected staging');
  if (claims.exp && claims.exp * 1000 <= now) throw new Error('Test service credential is expired');
  const request = async (table, id, method, body) => {
    const exactId = id ?? body?.id;
    const row = manifest.rows.find((entry) => entry.table === table && entry.id === exactId);
    if (!row || (body && JSON.stringify(body) !== JSON.stringify(row.data))) throw new Error('Operation is outside exact seed manifest');
    const marker = ['name', 'full_name', 'slug', 'vehicle_name', 'customer_name', 'note'].find((key) => row.data[key] === row.syntheticLabel);
    const scope = id ? `?id=eq.${encodeURIComponent(id)}${method === 'DELETE' ? `&${marker}=eq.${encodeURIComponent(row.syntheticLabel)}` : ''}` : '';
    const url = `${target.supabaseUrl}/rest/v1/${table}${scope}`;
    const response = await fetcher(url, {
      method, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { apikey: credential, Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`Synthetic staging operation failed (${response.status}); response body redacted`);
    return response.status === 204 ? [] : await response.json();
  };
  return {
    readExact: async (table, id) => (await request(table, id, 'GET'))[0] ?? null,
    insert: (table, data) => request(table, null, 'POST', data),
    deleteExact: (table, id) => request(table, id, 'DELETE'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, configFile, manifestFile] = process.argv.slice(2);
    if (!['apply', 'teardown'].includes(action) || !configFile || !manifestFile) throw new Error('Usage: seed-staging.mjs apply|teardown <reviewed-config.json> <manifest.json>');
    const config = { ...JSON.parse(readFileSync(configFile, 'utf8')), stripeOperatorKey: process.env.AGENT_STRIPE_OPERATOR_TEST_KEY, stripeExotiqKey: process.env.AGENT_STRIPE_EXOTIQ_TEST_KEY };
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    preflight(config, manifest, {});
    const adapter = createRestAdapter(config, process.env.AGENT_SUPABASE_TEST_SERVICE_KEY, { manifest });
    const result = await (action === 'apply' ? applyManifest : teardownManifest)(config, manifest, adapter);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`Synthetic seed operation refused: ${error.message}`);
    process.exitCode = 1;
  }
}
