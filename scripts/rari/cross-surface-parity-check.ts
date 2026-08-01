#!/usr/bin/env bun
// Cross-surface parity check for Rari tools.
//
// Picks a fixed tenant session token, calls the same representative tools through
// the voice webhook (elevenlabs-tools) and the MCP server (rari-mcp-server), and
// compares the executed payloads. Also does a chat smoke test.
//
// Required env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RARI_TOOL_TOKEN_SECRET
//   USER_ID        (a user with an active team_members row)
// Optional:
//   RARI_BASE_URL  (default: the Lovable Cloud function URL)

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const RARI_TOOL_TOKEN_SECRET = requireEnv('RARI_TOOL_TOKEN_SECRET');
const USER_ID = requireEnv('USER_ID');
const SUPABASE_AUTH_TOKEN = process.env.SUPABASE_AUTH_TOKEN; // optional; chat uses the user's auth token, not the tool token
const BASE_URL =
  process.env.RARI_BASE_URL ||
  'https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function toBase64Url(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function generateToolToken(userId: string, teamId: string | null): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = toBase64Url(JSON.stringify({ userId, teamId, iat: now, exp: now + 3600 }));
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', RARI_TOOL_TOKEN_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

async function getTeamId(userId: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();
  if (error || !data) {
    throw new Error(`No active team for user ${userId}: ${error?.message || 'not found'}`);
  }
  return data.team_id;
}

async function callVoice(tool: string, args: Record<string, unknown>, token: string) {
  const res = await fetch(`${BASE_URL}/elevenlabs-tools/${tool}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

async function callMcp(tool: string, args: Record<string, unknown>, token: string) {
  const res = await fetch(`${BASE_URL}/rari-mcp-server`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: tool, arguments: args },
      id: 1,
    }),
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

async function callChat(message: string, authToken: string) {
  const res = await fetch(`${BASE_URL}/fleet-copilot-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

function extractMcpResult(body: any): any {
  if (body?.result?.content?.[0]?.text) {
    const text = body.result.content[0].text;
    // The MCP adapter returns text that starts with a summary and then JSON.
    // Try to parse the JSON block after the first blank line.
    const jsonStart = text.indexOf('{');
    if (jsonStart >= 0) {
      try { return JSON.parse(text.slice(jsonStart)); } catch { /* fall through */ }
    }
    return text;
  }
  return body;
}

function compareResults(voice: any, mcp: any): string | null {
  const voiceJson = typeof voice === 'string' ? JSON.parse(voice) : voice;
  const mcpJson = typeof mcp === 'string' ? JSON.parse(mcp) : mcp;

  // Compare error state first
  if (voiceJson?.error || mcpJson?.error) {
    return `One surface returned an error: voice=${JSON.stringify(voiceJson?.error)} mcp=${JSON.stringify(mcpJson?.error)}`;
  }

  // The voice adapter adds a `_meta` envelope with request/team/user IDs.
  // Strip it so we compare only business data, which is identical across surfaces.
  const a = normalize(stripMeta(voiceJson));
  const b = normalize(stripMeta(mcpJson));

  if (JSON.stringify(a) !== JSON.stringify(b)) {
    return `Payloads differ.\nVoice: ${JSON.stringify(a, null, 2)}\nMCP:   ${JSON.stringify(b, null, 2)}`;
  }

  return null;
}

function stripMeta(v: any): any {
  if (!v || typeof v !== 'object') return v;
  const { _meta, ...rest } = v;
  return rest;
}

function normalize(v: any): any {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(normalize);
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(v).sort()) {
    sorted[key] = normalize(v[key]);
  }
  return sorted;
}

const TEST_CASES: { tool: string; args: Record<string, unknown>; chatPrompt?: string }[] = [
  { tool: 'get_fleet_vehicles', args: { limit: 5 }, chatPrompt: 'List up to 5 vehicles in my fleet' },
  { tool: 'getFleetMetrics', args: { timeframe: 'month' }, chatPrompt: 'How is my fleet doing this month?' },
  { tool: 'get_todays_schedule', args: {}, chatPrompt: "What's on the schedule today?" },
  { tool: 'getRariInsights', args: { limit: 3 }, chatPrompt: 'What insights do you have for me?' },
  { tool: 'getOutstandingBalances', args: { limit: 3 }, chatPrompt: 'Who owes me money?' },
];

async function main() {
  console.log('Cross-surface parity check for Rari tools');
  console.log('User ID:', USER_ID);

  const teamId = await getTeamId(USER_ID);
  console.log('Resolved team ID:', teamId);

  const token = generateToolToken(USER_ID, teamId);
  console.log('Generated tool token (60 min expiry)\n');

  let failures = 0;

  for (const tc of TEST_CASES) {
    console.log(`--- ${tc.tool} ---`);
    const voice = await callVoice(tc.tool, tc.args, token);
    const mcp = await callMcp(tc.tool, tc.args, token);

    if (voice.status !== 200 || mcp.status !== 200) {
      console.log(`FAIL: voice status ${voice.status}, mcp status ${mcp.status}`);
      console.log('Voice:', JSON.stringify(voice.body, null, 2).slice(0, 500));
      console.log('MCP:', JSON.stringify(mcp.body, null, 2).slice(0, 500));
      failures++;
      continue;
    }

    const mcpResult = extractMcpResult(mcp.body);
    const diff = compareResults(voice.body, mcpResult);

    if (diff) {
      console.log('FAIL:', diff);
      failures++;
    } else {
      console.log('PASS: voice and MCP payloads match');
    }

    if (tc.chatPrompt) {
      if (!SUPABASE_AUTH_TOKEN) {
        console.log('SKIP: chat smoke test (SUPABASE_AUTH_TOKEN not provided)');
      } else {
        const chat = await callChat(tc.chatPrompt, SUPABASE_AUTH_TOKEN);
        if (chat.status !== 200) {
          console.log(`FAIL: chat smoke test status ${chat.status}`);
          console.log(chat.body.slice(0, 500));
          failures++;
        } else {
          console.log('PASS: chat smoke test returned a successful response');
        }
      }
    }
  }

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
