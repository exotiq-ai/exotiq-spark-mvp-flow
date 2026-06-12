// Rari Agent Admin - inspect & update ElevenLabs Conversational AI config
// Auth: requires ELEVENLABS_ADMIN_API_KEY (Workspace Admin scope)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const EL = 'https://api.elevenlabs.io';

async function el(path: string, init: RequestInit = {}) {
  const key = Deno.env.get('ELEVENLABS_ADMIN_API_KEY');
  if (!key) throw new Error('ELEVENLABS_ADMIN_API_KEY missing');
  const res = await fetch(`${EL}${path}`, {
    ...init,
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const op = url.searchParams.get('op') || 'list_agents';
    const agentId = url.searchParams.get('agent_id') || '';

    let result: unknown;
    if (op === 'list_agents') {
      result = await el('/v1/convai/agents?page_size=100');
    } else if (op === 'get_agent') {
      result = await el(`/v1/convai/agents/${agentId}`);
    } else if (op === 'list_tools') {
      result = await el('/v1/convai/tools');
    } else if (op === 'get_tool') {
      const toolId = url.searchParams.get('tool_id') || '';
      result = await el(`/v1/convai/tools/${toolId}`);
    } else if (op === 'list_conversations') {
      result = await el(`/v1/convai/conversations?agent_id=${agentId}&page_size=10`);
    } else if (op === 'raw') {
      const path = url.searchParams.get('path') || '';
      const method = (url.searchParams.get('method') || 'GET').toUpperCase();
      const body = method !== 'GET' ? await req.text() : undefined;
      result = await el(path, { method, body });
    } else {
      result = { error: `unknown op: ${op}`, ops: ['list_agents','get_agent','list_tools','get_tool','list_conversations','raw'] };
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
