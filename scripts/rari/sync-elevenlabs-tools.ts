/**
 * Sync the canonical FleetCopilot tool registry to an ElevenLabs agent.
 *
 * The registry (`supabase/functions/_shared/fleet-tools/registry.ts`) is the one
 * source of truth. This script makes the ElevenLabs workspace mirror it exactly:
 * creates missing webhook tools, updates changed ones, deletes registry-orphans
 * that this script owns, and pins the agent's `tool_ids` to the result.
 *
 * Auth model is unchanged: every tool carries
 *   Authorization: Bearer {{secret__rari_tool_token}}
 * which is the per-conversation, per-tenant HS256 token minted by
 * `elevenlabs-session`. Native MCP cannot carry that (its headers are static and
 * workspace-scoped), which is why voice stays on webhook tools.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... ELEVENLABS_AGENT_ID=... RARI_TOOLS_URL=https://<ref>.supabase.co/functions/v1/elevenlabs-tools \
 *     bun run rari:sync-tools            # dry run, prints the plan
 *   ... bun run rari:sync-tools -- --apply
 */
import {
  FLEET_TOOLS,
  toJsonSchema,
  type FleetToolDefinition,
} from '../../supabase/functions/_shared/fleet-tools/registry.ts';

const API = 'https://api.elevenlabs.io/v1';
const APPLY = process.argv.includes('--apply');

const API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const TOOLS_URL = process.env.RARI_TOOLS_URL;

/** Marker so we only ever delete tools this script created. */
const OWNED_MARKER = '[rari-registry]';

if (!API_KEY || !AGENT_ID || !TOOLS_URL) {
  console.error(
    'Missing env. Required: ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, RARI_TOOLS_URL',
  );
  process.exit(1);
}

async function el<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'xi-api-key': API_KEY!,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[${res.status}] ${init.method ?? 'GET'} ${path}: ${text}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Registry entry -> ElevenLabs webhook tool config. */
function toWebhookToolConfig(tool: FleetToolDefinition) {
  const schema = toJsonSchema(tool) as {
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
  const required = new Set(schema.required ?? []);

  const properties: Record<string, unknown> = {};
  for (const [name, prop] of Object.entries(schema.properties)) {
    properties[name] = {
      type: prop.type,
      description: prop.enum
        ? `${prop.description} (one of: ${prop.enum.join(', ')})`
        : prop.description,
      required: required.has(name),
    };
  }

  return {
    type: 'webhook' as const,
    name: tool.name,
    description:
      `${tool.description}${tool.readOnly ? '' : ' Mutates data — confirm with the operator first.'}` +
      ` ${OWNED_MARKER}`,
    response_timeout_secs: 20,
    api_schema: {
      // Path-suffix dispatch: the adapter reads the tool name off the URL, so the
      // body stays a flat parameter object the model can fill directly.
      url: `${TOOLS_URL!.replace(/\/$/, '')}/${tool.name}`,
      method: 'POST' as const,
      request_headers: {
        // Per-conversation tenant identity. Never a static workspace token.
        Authorization: 'Bearer {{secret__rari_tool_token}}',
      },
      request_body_schema: {
        type: 'object' as const,
        description: `Parameters for ${tool.name}.`,
        properties,
        required: schema.required ?? [],
      },
    },
  };
}

interface RemoteTool {
  id: string;
  tool_config: { name: string; description?: string };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

async function main() {
  console.log(
    `${APPLY ? 'APPLYING' : 'DRY RUN'} — ${FLEET_TOOLS.length} registry tools -> agent ${AGENT_ID}\n`,
  );

  const listed = await el<{ tools: RemoteTool[] }>('/convai/tools');
  const remote = new Map(listed.tools.map((t) => [t.tool_config.name, t]));

  const created: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];
  const deleted: string[] = [];
  const toolIds: string[] = [];

  for (const tool of FLEET_TOOLS) {
    const config = toWebhookToolConfig(tool);
    const existing = remote.get(tool.name);

    if (!existing) {
      created.push(tool.name);
      if (APPLY) {
        const res = await el<{ id: string }>('/convai/tools', {
          method: 'POST',
          body: JSON.stringify({ tool_config: config }),
        });
        toolIds.push(res.id);
      }
      continue;
    }

    toolIds.push(existing.id);
    const full = await el<{ tool_config: unknown }>(`/convai/tools/${existing.id}`);
    if (stableJson(full.tool_config) === stableJson(config)) {
      unchanged.push(tool.name);
      continue;
    }
    updated.push(tool.name);
    if (APPLY) {
      await el(`/convai/tools/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tool_config: config }),
      });
    }
  }

  // Remove tools this script owns that are no longer in the registry.
  const registryNames = new Set(FLEET_TOOLS.map((t) => t.name));
  for (const [name, tool] of remote) {
    if (registryNames.has(name)) continue;
    if (!tool.tool_config.description?.includes(OWNED_MARKER)) continue;
    deleted.push(name);
    if (APPLY) await el(`/convai/tools/${tool.id}`, { method: 'DELETE' });
  }

  if (APPLY) {
    await el(`/convai/agents/${AGENT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({
        conversation_config: { agent: { prompt: { tool_ids: toolIds } } },
      }),
    });
  }

  const report = (label: string, names: string[]) =>
    console.log(`${label} (${names.length})${names.length ? `: ${names.join(', ')}` : ''}`);

  report('created', created);
  report('updated', updated);
  report('unchanged', unchanged);
  report('deleted', deleted);

  const writeTools = FLEET_TOOLS.filter((t) => !t.readOnly).map((t) => t.name);
  console.log(
    `\nSet "requires approval" in the agent UI for the ${writeTools.length} mutating tools: ${writeTools.join(', ')}`,
  );
  if (!APPLY) console.log('\nRe-run with --apply to write these changes.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
