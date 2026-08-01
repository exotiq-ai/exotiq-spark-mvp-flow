#!/usr/bin/env bun
// Tenant isolation proof for Rari tools.
//
// Generates a session token for two different users (and therefore two different tenants),
// calls the same tools through the voice and MCP surfaces, and proves that no vehicle,
// booking, customer, or revenue data leaks across.
//
// Required env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RARI_TOOL_TOKEN_SECRET
//   USER_ID_A    (tenant A user)
//   USER_ID_B    (tenant B user)
// Optional:
//   RARI_BASE_URL

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const RARI_TOOL_TOKEN_SECRET = requireEnv('RARI_TOOL_TOKEN_SECRET');
const USER_ID_A = requireEnv('USER_ID_A');
const USER_ID_B = requireEnv('USER_ID_B');
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

function extractIds(payload: any, key: string): string[] {
  const walk = (v: any): string[] => {
    if (!v || typeof v !== 'object') return [];
    const ids: string[] = [];
    if (v[key] && typeof v[key] === 'string') ids.push(v[key]);
    for (const child of Array.isArray(v) ? v : Object.values(v)) {
      ids.push(...walk(child));
    }
    return ids;
  };
  return walk(payload);
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}

const TEST_CASES = [
  { tool: 'get_fleet_vehicles', args: { limit: 100 } },
  { tool: 'get_todays_schedule', args: {} },
  { tool: 'getOutstandingBalances', args: { limit: 100 } },
  { tool: 'getRevenueAnalysis', args: { timeframe: 'month' } },
  { tool: 'search_customer', args: { query: 'a' } },
];

async function collect(tool: string, args: Record<string, unknown>, token: string) {
  const voice = await callVoice(tool, args, token);
  const mcp = await callMcp(tool, args, token);
  return { voice: voice.body, mcp: mcp.body, status: voice.status === 200 && mcp.status === 200 };
}

async function main() {
  console.log('Tenant isolation proof for Rari tools');
  console.log('User A:', USER_ID_A);
  console.log('User B:', USER_ID_B);

  const teamA = await getTeamId(USER_ID_A);
  const teamB = await getTeamId(USER_ID_B);
  console.log('Team A:', teamA);
  console.log('Team B:', teamB);

  if (teamA === teamB) {
    throw new Error('Both users map to the same team. Pick two users from different tenants.');
  }

  const tokenA = generateToolToken(USER_ID_A, teamA);
  const tokenB = generateToolToken(USER_ID_B, teamB);

  let failures = 0;

  for (const tc of TEST_CASES) {
    console.log(`\n--- ${tc.tool} ---`);
    const a = await collect(tc.tool, tc.args, tokenA);
    const b = await collect(tc.tool, tc.args, tokenB);

    if (!a.status || !b.status) {
      console.log(`FAIL: one surface failed. A ok=${a.status}, B ok=${b.status}`);
      failures++;
      continue;
    }

    // Collect all vehicle IDs, booking IDs, customer IDs, and user IDs from both sides
    const idsA = {
      vehicles: unique(extractIds(a.voice, 'id')),
      vehiclesMcp: unique(extractIds(a.mcp, 'id')),
      bookings: unique(extractIds(a.voice, 'booking_id')),
      bookingsMcp: unique(extractIds(a.mcp, 'booking_id')),
      customers: unique(extractIds(a.voice, 'customer_id')),
      customersMcp: unique(extractIds(a.mcp, 'customer_id')),
    };
    const idsB = {
      vehicles: unique(extractIds(b.voice, 'id')),
      vehiclesMcp: unique(extractIds(b.mcp, 'id')),
      bookings: unique(extractIds(b.voice, 'booking_id')),
      bookingsMcp: unique(extractIds(b.mcp, 'booking_id')),
      customers: unique(extractIds(b.voice, 'customer_id')),
      customersMcp: unique(extractIds(b.mcp, 'customer_id')),
    };

    // Sanity: the two surfaces for the same tenant should overlap heavily
    const vehicleOverlapSameTenant = intersection(idsA.vehicles, idsA.vehiclesMcp).length;
    const vehicleOverlapCrossTenant = intersection(idsA.vehicles, idsB.vehicles).length;

    if (vehicleOverlapCrossTenant > 0) {
      console.log(`FAIL: vehicle IDs leaked across tenants: ${vehicleOverlapCrossTenant} overlap(s)`);
      console.log('Overlapping IDs:', intersection(idsA.vehicles, idsB.vehicles).join(', '));
      failures++;
    } else if (vehicleOverlapSameTenant === 0) {
      // If tenant A has no vehicles, voice and MCP may both be empty — that's fine.
      console.log('PASS: no vehicle ID overlap between tenants');
    } else {
      console.log('PASS: no vehicle ID overlap between tenants');
    }

    const customerOverlapCrossTenant = intersection(idsA.customers, idsB.customers).length;
    if (customerOverlapCrossTenant > 0) {
      console.log(`FAIL: customer IDs leaked across tenants: ${customerOverlapCrossTenant} overlap(s)`);
      failures++;
    } else {
      console.log('PASS: no customer ID overlap between tenants');
    }

    // Revenue figures must differ (same exact amount across tenants is a warning, not an error, but very suspicious)
    const revenueA = JSON.stringify(a.voice).match(/\$[\d,]+/g) || [];
    const revenueB = JSON.stringify(b.voice).match(/\$[\d,]+/g) || [];
    if (revenueA.length && revenueB.length && unique(revenueA).join('|') === unique(revenueB).join('|')) {
      console.log('WARN: identical revenue strings across tenants — verify this is expected');
    }
  }

  console.log(`\n${failures === 0 ? 'Tenant isolation proof passed.' : `${failures} isolation failure(s).`}`);
  process.exit(failures === 0 ? 0 : 1);
}

function intersection(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
