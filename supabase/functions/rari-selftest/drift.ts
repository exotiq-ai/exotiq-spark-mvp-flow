// @ts-nocheck
// Live-workspace parity: the production ElevenLabs agent must expose exactly the
// tools the registry declares, with the same schemas. Mirrors the comparison in
// scripts/rari/sync-elevenlabs-tools.ts so a green harness means a zero-drift
// `rari:sync-tools --dry-run`.
import { FLEET_TOOLS, toJsonSchema } from '../_shared/fleet-tools/registry.ts';

const API = 'https://api.elevenlabs.io/v1';
const OWNED_MARKER = '[rari-registry]';

function desiredConfig(tool: any, toolsUrl: string) {
  const schema = toJsonSchema(tool) as any;
  const properties: Record<string, unknown> = {};
  for (const [name, prop] of Object.entries<any>(schema.properties)) {
    properties[name] = {
      type: prop.type,
      description: prop.enum
        ? `${prop.description} (one of: ${prop.enum.join(', ')})`
        : prop.description,
    };
  }
  return {
    type: 'webhook',
    name: tool.name,
    description:
      `${tool.description}${tool.readOnly ? '' : ' Mutates data — confirm with the operator first.'} ${OWNED_MARKER}`,
    response_timeout_secs: 20,
    api_schema: {
      url: `${toolsUrl.replace(/\/$/, '')}/${tool.name}`,
      method: 'POST',
      request_headers: { Authorization: { variable_name: 'secret__rari_tool_token' } },
      request_body_schema: {
        type: 'object',
        description: `Parameters for ${tool.name}.`,
        properties,
        required: schema.required ?? [],
      },
    },
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

function projectOnto(desired: unknown, actual: unknown): unknown {
  if (!desired || typeof desired !== 'object' || Array.isArray(desired)) return actual;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return actual;
  const out: Record<string, unknown> = {};
  for (const [key, want] of Object.entries(desired as Record<string, unknown>)) {
    out[key] = projectOnto(want, (actual as Record<string, unknown>)[key]);
  }
  return out;
}

export async function checkWorkspaceDrift() {
  const apiKey = Deno.env.get('ELEVENLABS_ADMIN_API_KEY') || Deno.env.get('ELEVENLABS_API_KEY');
  const agentId = Deno.env.get('ELEVENLABS_AGENT_ID');
  const toolsUrl = Deno.env.get('RARI_TOOLS_URL')
    || `${Deno.env.get('SUPABASE_URL')}/functions/v1/elevenlabs-tools`;

  if (!apiKey) {
    return { skipped: true, reason: 'ELEVENLABS_ADMIN_API_KEY not configured', failures: [] };
  }

  const res = await fetch(`${API}/convai/tools`, { headers: { 'xi-api-key': apiKey } });
  const text = await res.text();
  if (!res.ok) {
    return {
      skipped: false,
      failures: [{ assertion: 'elevenlabs-list', detail: `[${res.status}] ${text.slice(0, 300)}` }],
    };
  }
  const listed = JSON.parse(text) as { tools: any[] };

  const remote = new Map<string, any>();
  for (const t of listed.tools || []) {
    const name = t.tool_config?.name;
    if (!name) continue;
    const owned = t.tool_config?.description?.includes(OWNED_MARKER) ?? false;
    const current = remote.get(name);
    if (!current || (owned && !(current.tool_config?.description?.includes(OWNED_MARKER) ?? false))) {
      remote.set(name, t);
    }
  }

  const failures: { assertion: string; detail: string }[] = [];
  for (const tool of FLEET_TOOLS) {
    const want = desiredConfig(tool, toolsUrl);
    const actual = remote.get(tool.name);
    if (!actual) {
      failures.push({ assertion: 'drift-missing', detail: `${tool.name} is not published to the live agent` });
      continue;
    }
    if (stableJson(want) !== stableJson(projectOnto(want, actual.tool_config))) {
      failures.push({ assertion: 'drift-changed', detail: `${tool.name} schema differs from the registry` });
    }
  }

  const registryNames = new Set(FLEET_TOOLS.map((t) => t.name));
  for (const [name, t] of remote) {
    const owned = t.tool_config?.description?.includes(OWNED_MARKER) ?? false;
    if (owned && !registryNames.has(name)) {
      failures.push({ assertion: 'drift-orphan', detail: `${name} is published but no longer in the registry` });
    }
  }

  return { skipped: false, agentId, toolCount: FLEET_TOOLS.length, failures };
}
