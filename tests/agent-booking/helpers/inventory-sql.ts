import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

/** Real PostgreSQL test client. No URL/credential fallback, HTTP or source mounts.
 * This proves selected SQL on a partial synthetic schema, not deployed parity.
 */
export function inventorySql() {
  const manifest = process.env.AGENT_INVENTORY_LAB_MANIFEST;
  if (!manifest) throw new Error('Dedicated owned inventory SQL lab manifest required');
  if (process.env.DOCKER_HOST && !process.env.DOCKER_HOST.startsWith('unix://')) throw new Error('Remote Docker denied');
  const run = (args: string[]) => {
    const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 10000 });
    if (r.status !== 0) throw new Error('Owned local Docker probe failed');
    return r.stdout.trim();
  };
  if (!run(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).startsWith('unix://')) throw new Error('Local Unix Docker required');
  const m = JSON.parse(readFileSync(manifest, 'utf8'));
  if (!/^exotiq-agent-test-[a-f0-9]{12}-db$/.test(m.container) || m.partialSchema !== true || m.providerParity !== false) throw new Error('Invalid partial lab');
  const c = JSON.parse(run(['inspect', m.container]))[0];
  const n = JSON.parse(run(['network', 'inspect', m.network]))[0];
  const v = JSON.parse(run(['volume', 'inspect', m.volume]))[0];
  if (c.Id !== m.containerId || c.Image !== m.imageId || c.Config.Labels['exotiq.agent-test.owner'] !== m.owner || c.HostConfig.Privileged ||
      Object.keys(c.NetworkSettings.Networks).length !== 1 || !c.NetworkSettings.Networks[m.network] || !n.Internal || n.Labels['exotiq.agent-test.owner'] !== m.owner ||
      Object.values(c.NetworkSettings.Ports).some((ports: any) => ports?.length) || m.port !== null ||
      c.Mounts.length !== 1 || c.Mounts[0].Type !== 'volume' || c.Mounts[0].Name !== m.volume || v.Labels['exotiq.agent-test.owner'] !== m.owner) throw new Error('Lab ownership/isolation mismatch');
  const args = ['exec', '-i', m.container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'agent_test', '-At'];
  const identity = spawnSync('docker', args, { input: "SELECT name || ':' || schema_parity FROM public.lab_identity;", encoding: 'utf8', timeout: 10000 });
  if (identity.status !== 0 || identity.stdout.trim() !== 'exotiq-agent-test-partial:false') throw new Error('Synthetic database marker missing');
  return async (sql: string) => new Promise<{ ok: boolean; output: string; error: string }>((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Local SQL timeout')); }, 15000);
    child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { error += chunk; });
    child.on('error', reject);
    child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0, output: output.trim(), error }); });
    child.stdin.end("\\set VERBOSITY verbose\nSET statement_timeout='10s'; SET lock_timeout='3s';\n" + sql);
  });
}
export const testTeam = '10000000-0000-4000-8000-000000000005';
export const vehicle = (suffix: number) => `20000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
export const bookingInsert = (v: string, start: string, end: string, source = 'direct', status = 'requested') =>
  `INSERT INTO public.bookings(vehicle_id,team_id,customer_name,customer_email,pickup_location,daily_rate,total_value,start_date,end_date,status,booking_source) VALUES('${v}','${testTeam}','agent-test-inventory','inventory@example.invalid','synthetic',100,100,'${start}','${end}','${status}','${source}');`;
