// @ts-nocheck
// Rari MCP server — THIN ADAPTER over ../_shared/fleet-tools/.
//
// Transport: MCP Streamable HTTP (JSON-RPC over POST, SSE for GET).
// Capabilities: exactly the shared FleetCopilot registry — no local tool list,
// no local handlers, no mock data.
//
// AUTH IS FAIL CLOSED. The only accepted credential is the signed per-session
// tool token minted by `elevenlabs-session` (same token the voice webhook
// uses). The previous implementation fell back to DEMO_USER_ID / "first user
// in profiles", which served one tenant's data to another. Do not reintroduce
// any fallback identity here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { verifyToolToken, getUserTeamId, looksLikeJwt } from '../_shared/fleet-tools/auth.ts';
import { executeFunction } from '../_shared/fleet-tools/executor.ts';
import { toMcpTools, isKnownFleetTool } from '../_shared/fleet-tools/registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mcp-session-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

interface Identity {
  userId: string;
  teamId: string;
  supabase: ReturnType<typeof createClient>;
}

/**
 * Resolves the caller strictly from the signed session token.
 * Returns a string reason on refusal — never a default tenant.
 */
async function resolveIdentity(req: Request): Promise<Identity | { reason: string }> {
  const secret = Deno.env.get('RARI_TOOL_TOKEN_SECRET');
  if (!secret) return { reason: 'tool_token_secret_missing' };

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { reason: 'missing_bearer_token' };

  const token = authHeader.slice(7).trim();
  if (!looksLikeJwt(token)) return { reason: 'token_not_session_token' };

  const payload = await verifyToolToken(token, secret);
  if (!payload?.userId) return { reason: 'token_verification_failed' };

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', payload.userId)
    .maybeSingle();
  if (!profile) return { reason: 'unknown_user' };

  const membershipTeamId = await getUserTeamId(supabase, payload.userId);
  let teamId = payload.teamId ?? null;

  if (teamId && teamId !== membershipTeamId) {
    const { data: claimed } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', payload.userId)
      .eq('team_id', teamId)
      .eq('is_active', true)
      .maybeSingle();
    if (!claimed) return { reason: 'team_claim_rejected' };
  }

  teamId = teamId || membershipTeamId;
  if (!teamId) return { reason: 'no_team_membership' };

  return { userId: payload.userId, teamId, supabase };
}

async function handleRpc(message: any, req: Request): Promise<unknown | null> {
  const { method, id, params } = message || {};

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'exotiq-command-center', version: '2.0.0' },
        instructions:
          'FleetCopilot tools for the signed-in operator. Every tool is scoped to that user\'s team; ' +
          'never ask the model to supply a team or user id.',
      });

    case 'tools/list':
      return rpcResult(id, { tools: toMcpTools() });

    case 'resources/list':
      return rpcResult(id, { resources: [] });

    case 'prompts/list':
      return rpcResult(id, { prompts: [] });

    case 'ping':
      return rpcResult(id, {});

    case 'notifications/initialized':
      return null;

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};

      if (!toolName) return rpcError(id, -32602, 'Missing tool name');
      if (!isKnownFleetTool(toolName)) return rpcError(id, -32601, `Unknown tool: ${toolName}`);

      const identity = await resolveIdentity(req);
      if ('reason' in identity) {
        return rpcResult(id, {
          content: [
            {
              type: 'text',
              text:
                `Authentication required (${identity.reason}). I can't tell which account is asking, ` +
                'so I won\'t guess. Start a new session from inside the app.',
            },
          ],
          isError: true,
        });
      }

      const result = await executeFunction(
        toolName,
        toolArgs,
        identity.supabase,
        identity.userId,
        identity.teamId,
      );

      const text = result?.error
        ? `Error: ${result.error}\n${result.summary || ''}`.trim()
        : `${result?.summary ? `${result.summary}\n\n` : ''}${JSON.stringify(result, null, 2)}`;

      return rpcResult(id, {
        content: [{ type: 'text', text }],
        isError: !!result?.error,
      });
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (url.pathname.endsWith('/health')) {
    return new Response(
      JSON.stringify({
        ok: true,
        transport: 'streamable-http',
        authMode: 'tool_token_only',
        hasToolSecret: !!Deno.env.get('RARI_TOOL_TOKEN_SECRET'),
        tools: toMcpTools().length,
        timestamp: new Date().toISOString(),
      }),
      { headers: jsonHeaders },
    );
  }

  // SSE stream (clients that open a GET channel). We push nothing server-side;
  // the channel exists so spec-compliant clients stay happy.
  if (req.method === 'GET') {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(': connected\n\n'));
      },
    });
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify(rpcError(null, -32600, 'Method not allowed')), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  let message: any;
  try {
    message = await req.json();
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, 'Parse error')), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  try {
    // Batch support
    if (Array.isArray(message)) {
      const responses = [];
      for (const item of message) {
        const res = await handleRpc(item, req);
        if (res) responses.push(res);
      }
      return responses.length
        ? new Response(JSON.stringify(responses), { headers: jsonHeaders })
        : new Response(null, { status: 204, headers: corsHeaders });
    }

    const response = await handleRpc(message, req);
    if (!response) return new Response(null, { status: 204, headers: corsHeaders });
    return new Response(JSON.stringify(response), { headers: jsonHeaders });
  } catch (error) {
    console.error('[rari-mcp-server] error:', error);
    return new Response(
      JSON.stringify(rpcError(message?.id ?? null, -32603, error instanceof Error ? error.message : 'Internal error')),
      { status: 500, headers: jsonHeaders },
    );
  }
});
