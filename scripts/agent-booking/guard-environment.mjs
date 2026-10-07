export const PRODUCTION_PROJECT_IDS = ['jlgwbbqydjeokypoenoc'];
const label = 'agent-booking-staging';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tables = new Set(['teams', 'vehicles', 'customers', 'bookings', 'vehicle_blocked_dates']);
function requireCondition(condition, message) { if (!condition) throw new Error(message); }

export function guardEnvironment(config, { now = Date.now() } = {}) {
  requireCondition(config?.environment === label, 'Missing dedicated staging environment label');
  requireCondition(/^agent-test-[a-z0-9-]+$/.test(config.projectId) || /^[a-z]{20}$/.test(config.projectId), 'Invalid staging project identifier');
  requireCondition(!PRODUCTION_PROJECT_IDS.includes(config.projectId), 'Original backend project is prohibited');
  requireCondition(config.allowedProjectIds?.includes(config.projectId), 'Project is not explicitly allowlisted');
  let url;
  try { url = new URL(config.supabaseUrl); } catch { throw new Error('Invalid staging URL'); }
  requireCondition(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'Staging URL must be a bare origin');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  requireCondition(local ? url.protocol === 'http:' && Boolean(url.port) : url.protocol === 'https:' && url.hostname === `${config.projectId}.supabase.co`, 'URL must be isolated loopback or the selected staging project');
  requireCondition(!PRODUCTION_PROJECT_IDS.some((id) => url.hostname.includes(id)), 'Production endpoint prohibited');
  requireCondition(config.allowedUrls?.includes(config.supabaseUrl), 'URL is not explicitly allowlisted');
  const evidence = config.evidence;
  requireCondition(evidence?.environment === label && evidence.projectId === config.projectId && evidence.supabaseUrl === config.supabaseUrl, 'Reviewed evidence must match this exact staging project and URL');
  requireCondition(typeof evidence.reviewedBy === 'string' && evidence.reviewedBy.length >= 3, 'Missing evidence reviewer');
  const reviewedAt = Date.parse(evidence.reviewedAt), expiresAt = Date.parse(evidence.expiresAt);
  requireCondition(Number.isFinite(reviewedAt) && reviewedAt <= now && Number.isFinite(expiresAt) && expiresAt > now && expiresAt - reviewedAt <= 7 * 86400000, 'Evidence missing, expired or future-dated');
  requireCondition(/^[a-f0-9]{64}$/.test(evidence.baselineSha256), 'Missing reviewed clean baseline checksum');
  requireCondition(evidence.schemaAndGrantsVerified === true && evidence.schedulerIsolated === true, 'Staging schema/grants and scheduler proof required');
  const providers = evidence.providers;
  requireCondition(providers?.stripeOperator === 'test' && providers.stripeExotiq === 'test' && providers.identity === 'sandbox' && providers.email === 'sink', 'Both payment legs, identity sandbox and email sink must be evidenced');
  let issuer;
  try { issuer = new URL(providers.oauthIssuer); } catch { throw new Error('Missing test OAuth issuer'); }
  requireCondition(issuer.protocol === 'https:' && !issuer.username && !issuer.password && /agent-test/.test(issuer.hostname), 'Dedicated test OAuth issuer required');
  requireCondition(/^sk_test_[A-Za-z0-9_-]+$/.test(config.stripeOperatorKey) && /^sk_test_[A-Za-z0-9_-]+$/.test(config.stripeExotiqKey), 'Only test keys are allowed for both charge legs');
  return Object.freeze({ projectId: config.projectId, supabaseUrl: url.origin, environment: label, local });
}

export function validateManifest(manifest, config) {
  requireCondition(manifest?.version === 1 && /^agent-test-[a-zA-Z0-9-]+$/.test(manifest.runId), 'Invalid synthetic seed manifest');
  requireCondition(manifest.projectId === config.projectId, 'Seed manifest belongs to another project');
  requireCondition(Array.isArray(manifest.rows) && manifest.rows.length > 0 && manifest.rows.length <= 500, 'Manifest rows must be bounded and nonempty');
  const seen = new Set();
  for (const row of manifest.rows) {
    requireCondition(tables.has(row.table) && uuid.test(row.id) && row.data?.id === row.id, 'Only supported tables and exact UUID rows are allowed');
    requireCondition(/^agent-test-[a-zA-Z0-9-]+$/.test(row.syntheticLabel), 'All mutations must be synthetic');
    const marker = ['name', 'full_name', 'slug', 'vehicle_name', 'customer_name', 'note'].find((key) => row.data[key] === row.syntheticLabel);
    requireCondition(Boolean(marker), 'Synthetic marker must exist in inserted row data');
    requireCondition(!seen.has(`${row.table}:${row.id}`), 'Duplicate manifest row');
    seen.add(`${row.table}:${row.id}`);
    for (const [key, value] of Object.entries(row.data)) {
      if (/email/i.test(key) && value != null) requireCondition(typeof value === 'string' && /^agent-test-[^@]+@[^@]+\.invalid$/.test(value), 'Only synthetic non-deliverable email is permitted');
      if (/token|secret|password|api.?key|document.?url|card.?number/i.test(key)) throw new Error('Sensitive material is forbidden in seed manifests');
      if (/phone/i.test(key) && value != null) requireCondition(/^\+?1?20255501\d{2}$/.test(String(value).replace(/[ ()-]/g, '')), 'Only fictional 202-555-01xx telephone numbers are allowed');
    }
  }
  for (const row of manifest.rows) {
    for (const [column, table] of [['team_id', 'teams'], ['vehicle_id', 'vehicles'], ['customer_id', 'customers']]) {
      if (row.data[column]) requireCondition(seen.has(`${table}:${row.data[column]}`), 'Foreign keys must remain within this synthetic manifest');
    }
    for (const column of ['user_id', 'owner_id', 'created_by']) {
      if (row.data[column]) requireCondition(config.evidence?.syntheticAuthUserIds?.includes(row.data[column]), 'Auth owners must have reviewed synthetic account provenance');
    }
  }
  return manifest;
}

export function assertSyntheticExistingRow(row, current) {
  requireCondition(current?.id === row.id, 'Existing row differs from seed manifest');
  const markers = ['name', 'full_name', 'slug', 'vehicle_name', 'customer_name', 'note'].filter((key) => row.data[key] === row.syntheticLabel);
  requireCondition(markers.length > 0 && markers.every((key) => current[key] === row.syntheticLabel), 'Existing row no longer has original synthetic markers');
}
