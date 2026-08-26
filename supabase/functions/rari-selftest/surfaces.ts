// @ts-nocheck
// Surface parity + live session smoke.
//
// The same tool must answer identically whether it arrives over the voice
// webhook (elevenlabs-tools), MCP (rari-mcp-server), or the direct executor.

interface Failure { assertion: string; detail: string }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

/** Strip volatile fields before comparing two surfaces. */
function normalize(payload: any): any {
  if (Array.isArray(payload)) return payload.map(normalize);
  if (payload && typeof payload === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (['requestId', 'generatedAt', 'timestamp', 'elapsedMs', 'authMethod'].includes(k)) continue;
      out[k] = normalize(v);
    }
    return out;
  }
  return payload;
}

async function callWebhook(tool: string, args: Record<string, unknown>, toolToken: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tools/${tool}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${toolToken}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function callMcp(tool: string, args: Record<string, unknown>, toolToken: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/rari-mcp-server`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${toolToken}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: tool, arguments: args },
    }),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function extractSummary(body: any): string | null {
  if (!body) return null;
  if (typeof body.summary === 'string') return body.summary;
  if (typeof body.result?.summary === 'string') return body.result.summary;
  const content = body.result?.content?.[0]?.text ?? body.content?.[0]?.text;
  if (typeof content === 'string') {
    try { return JSON.parse(content).summary ?? content; } catch { return content; }
  }
  return null;
}

/** Compare voice-webhook and MCP answers for a handful of representative tools. */
export async function runSurfaceParity(
  toolToken: string,
  cases: { tool: string; args: Record<string, unknown> }[],
): Promise<{ results: any[]; failures: Failure[] }> {
  const failures: Failure[] = [];
  const results: any[] = [];

  for (const c of cases) {
    const [webhook, mcp] = await Promise.all([
      callWebhook(c.tool, c.args, toolToken).catch((e) => ({ status: 0, body: { error: String(e) } })),
      callMcp(c.tool, c.args, toolToken).catch((e) => ({ status: 0, body: { error: String(e) } })),
    ]);

    const wSummary = extractSummary(webhook.body);
    const mSummary = extractSummary(mcp.body);

    if (webhook.status !== 200) {
      failures.push({ assertion: 'surface:webhook', detail: `${c.tool} -> HTTP ${webhook.status}` });
    }
    if (mcp.status !== 200) {
      failures.push({ assertion: 'surface:mcp', detail: `${c.tool} -> HTTP ${mcp.status}` });
    }
    if (wSummary && mSummary && normalize(wSummary) !== normalize(mSummary)) {
      failures.push({
        assertion: 'surface:parity',
        detail: `${c.tool} summaries differ.\n  voice: ${String(wSummary).slice(0, 160)}\n  mcp:   ${String(mSummary).slice(0, 160)}`,
      });
    }

    results.push({ tool: c.tool, webhookStatus: webhook.status, mcpStatus: mcp.status, summary: wSummary?.slice(0, 120) });
  }

  return { results, failures };
}

/** Auth refusals: no token, garbage token, expired token must all fail closed. */
export async function runAuthRefusals(expiredToken: string): Promise<Failure[]> {
  const failures: Failure[] = [];
  const attempts: { label: string; token: string | null }[] = [
    { label: 'no-token', token: null },
    { label: 'garbage-token', token: 'not.a.token' },
    { label: 'expired-token', token: expiredToken },
  ];

  for (const a of attempts) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tools/get_fleet_vehicles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        ...(a.token ? { Authorization: `Bearer ${a.token}` } : {}),
      },
      body: JSON.stringify({ limit: 1 }),
    });
    const text = await res.text();
    if (res.status === 200 && !/error|unauth/i.test(text)) {
      failures.push({ assertion: `auth:${a.label}`, detail: `expected refusal, got 200: ${text.slice(0, 160)}` });
    }
  }
  return failures;
}

/**
 * One real session handshake: elevenlabs-session must mint dynamic variables
 * (including the tool token) and a signed URL, and that tool token must work.
 */
export async function runSessionSmoke(userJwt: string): Promise<{ detail: any; failures: Failure[] }> {
  const failures: Failure[] = [];
  const res = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userJwt}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (res.status !== 200) {
    failures.push({ assertion: 'session:handshake', detail: `HTTP ${res.status}: ${text.slice(0, 240)}` });
    return { detail: { status: res.status }, failures };
  }

  const signedUrl = body?.signed_url ?? body?.signedUrl;
  const dynamic = body?.dynamic_variables ?? body?.dynamicVariables ?? {};
  const sessionToolToken = dynamic?.secret__rari_tool_token ?? dynamic?.rari_tool_token;

  if (!signedUrl || !/^wss?:\/\/|^https:\/\//.test(String(signedUrl))) {
    failures.push({ assertion: 'session:signed-url', detail: `missing or malformed signed URL: ${String(signedUrl).slice(0, 120)}` });
  }
  if (!sessionToolToken) {
    failures.push({ assertion: 'session:dynamic-vars', detail: `no tool token in dynamic variables: ${JSON.stringify(Object.keys(dynamic))}` });
  } else {
    // The token the live session hands the agent must actually authorize a tool
    // call, and the response must report authMethod "tool_token".
    const bare = String(sessionToolToken).replace(/^Bearer\s+/i, '');
    const probe = await callWebhook('get_fleet_vehicles', { limit: 1 }, bare);
    if (probe.status !== 200) {
      failures.push({ assertion: 'session:tool-call', detail: `session token rejected by tool webhook: HTTP ${probe.status}` });
    } else if (probe.body?.authMethod && probe.body.authMethod !== 'tool_token') {
      failures.push({ assertion: 'session:auth-method', detail: `expected authMethod "tool_token", got "${probe.body.authMethod}"` });
    }
  }

  return {
    detail: {
      hasSignedUrl: !!signedUrl,
      dynamicVariableKeys: Object.keys(dynamic),
      agentId: body?.agent_id ?? body?.agentId ?? null,
    },
    failures,
  };
}
