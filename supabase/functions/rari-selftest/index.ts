// @ts-nocheck
// rari-selftest — permanent, super-admin-gated E2E harness for Rari's tool layer.
//
// POST { action, suites?, teams?, tools? }  with a super-admin user JWT.
//   action: "run" (default) | "seed" | "unseed"
//   suites: subset of
//     execution | questions | edge | golden | isolation | surface | auth | drift | session
//   teams:  optional team_id list; defaults to the configured matrix
//
// The harness mints its own scoped tool tokens server-side — no tenant
// credentials ever live in a script or CI env.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { executeFunction, normalizeToolArgs, TOOL_PARAM_ALIASES } from '../_shared/fleet-tools/executor.ts';
import { FLEET_TOOLS } from '../_shared/fleet-tools/registry.ts';
import { mintTestToolToken, mintExpiredToolToken } from './token.ts';
import { assertResult, assertCurrency, collectRecordIds } from './assertions.ts';
import { TOOL_CASES, QUESTION_CASES, EDGE_CASES } from './cases.ts';
import { seedTestTenant, unseedTestTenant, SEED_TAG } from './seed.ts';
import { runGoldenChecks } from './golden.ts';
import { runSurfaceParity, runAuthRefusals, runSessionSmoke } from './surfaces.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const TOOL_SECRET = Deno.env.get('RARI_TOOL_TOKEN_SECRET');

const ALL_SUITES = ['execution', 'questions', 'edge', 'golden', 'isolation', 'surface', 'auth', 'drift', 'session'] as const;

/** The deterministic, seedable tenant. Everything else gets shape + isolation only. */
// Dedicated harness workspace ("Rari Self-Test"). It is deliberately NOT a real
// tenant and NOT the demo account — seeded fixtures must never land anywhere else.
const TEST_TEAM_ID = Deno.env.get('RARI_SELFTEST_TEAM_ID') || 'd378546a-29cb-4ed6-81ce-ef768fa3f36f';

interface TenantProfile {
  teamId: string;
  name: string;
  role: 'test' | 'data-rich' | 'currency' | 'sparse';
  currencySymbol: string;
  strict: boolean;
  ownerUserId: string | null;
  sample: Record<string, string | null>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function substitute(value: unknown, sample: Record<string, string | null>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(sample[key] ?? ''));
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, sample));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, sample)]));
  }
  return value;
}

/** Pull real anchors (vehicle / customer / booking ref / location) from a tenant. */
async function profileTenant(supabase: any, teamId: string): Promise<TenantProfile> {
  const [teamRes, vehicleRes, bookingRes, memberRes] = await Promise.all([
    supabase.from('teams').select('id, name, currency, is_demo_account, owner_id').eq('id', teamId).maybeSingle(),
    supabase.from('vehicles').select('make, model, year, location').eq('team_id', teamId).order('created_at', { ascending: false }).limit(5),
    supabase.from('bookings').select('booking_ref, customer_name').eq('team_id', teamId).not('booking_ref', 'is', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('team_members').select('user_id').eq('team_id', teamId).eq('is_active', true).limit(1),
  ]);

  const team = teamRes.data;
  const vehicle = (vehicleRes.data || [])[0];
  const booking = (bookingRes.data || []).find((b: any) => b.customer_name) || (bookingRes.data || [])[0];

  const currency = String(team?.currency || 'USD').toUpperCase();
  const currencySymbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';

  const start = new Date(); start.setUTCDate(start.getUTCDate() + 7); start.setUTCHours(10, 0, 0, 0);
  const end = new Date(); end.setUTCDate(end.getUTCDate() + 9); end.setUTCHours(10, 0, 0, 0);

  const vehiclePhrase = vehicle ? `${vehicle.make} ${vehicle.model}`.trim() : null;
  const vehicleWord = vehicle
    ? String(vehicle.model || vehicle.make).split(/\s+/).filter(Boolean).slice(-1)[0]
    : null;

  return {
    teamId,
    name: team?.name || teamId,
    role: teamId === TEST_TEAM_ID ? 'test' : 'data-rich',
    currencySymbol,
    strict: teamId === TEST_TEAM_ID,
    // The dedicated harness team has no active team_members row (a user may only
    // hold one active membership), so fall back to the team owner.
    ownerUserId: memberRes.data?.[0]?.user_id ?? team?.owner_id ?? null,
    sample: {
      vehicle: vehiclePhrase,
      vehicleWord,
      customer: booking?.customer_name ? String(booking.customer_name).split(/\s+/)[0] : null,
      bookingRef: booking?.booking_ref ?? null,
      location: vehicle?.location ?? null,
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}

function missingNeeds(needs: string[] | undefined, sample: Record<string, string | null>): string[] {
  return (needs || []).filter((n) => !sample[n]);
}

// ---- drill-down helpers ---------------------------------------------------
const MAX_DETAIL_CHARS = 6000;

function pretty(value: unknown): string {
  let s: string;
  try {
    s = JSON.stringify(value ?? null, null, 2) ?? 'null';
  } catch {
    s = String(value);
  }
  return s.length > MAX_DETAIL_CHARS ? `${s.slice(0, MAX_DETAIL_CHARS)}\n… truncated` : s;
}

/** How the registry schema for a tool maps onto the handler args actually used. */
function registryMapping(tool: string, args: Record<string, unknown>) {
  const def = FLEET_TOOLS.find((t) => t.name === tool) || null;
  const aliases = TOOL_PARAM_ALIASES[tool] || {};
  const declared = (def?.params || []).map((p: any) => p.name);
  return {
    tool,
    foundInRegistry: !!def,
    category: def?.category ?? null,
    readOnly: def?.readOnly ?? null,
    aliasMap: aliases,
    params: (def?.params || []).map((p: any) => ({
      registryName: p.name,
      handlerName: aliases[p.name] ?? p.name,
      type: p.type,
      required: !!p.required,
      supplied: args?.[p.name] !== undefined,
      value: args?.[p.name] ?? null,
    })),
    undeclaredArgs: Object.keys(args || {}).filter((k) => !declared.includes(k)),
    missingRequired: (def?.params || [])
      .filter((p: any) => p.required && (args?.[p.name] === undefined || args?.[p.name] === ''))
      .map((p: any) => p.name),
    normalizedArgs: normalizeToolArgs(tool, args || {}),
  };
}

serve_handler();

function serve_handler() {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const started = Date.now();
    try {
      if (!SERVICE_KEY || !SUPABASE_URL) return json({ error: 'server_misconfigured' }, 500);
      if (!TOOL_SECRET) return json({ error: 'RARI_TOOL_TOKEN_SECRET is not configured' }, 500);

      // ---- super-admin gate -------------------------------------------------
      const authHeader = req.headers.get('Authorization') || '';
      const jwt = authHeader.replace(/^Bearer\s+/i, '');
      if (!jwt) return json({ error: 'unauthorized', message: 'Missing bearer token' }, 401);

      const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
      const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
      if (userErr || !userData?.user) return json({ error: 'unauthorized', message: 'Invalid session' }, 401);

      const caller = userData.user;
      const { data: superAdmin } = await admin
        .from('super_admins')
        .select('id, is_active')
        .or(`user_id.eq.${caller.id},email.eq.${caller.email}`)
        .eq('is_active', true)
        .maybeSingle();

      if (!superAdmin) {
        console.warn(`[rari-selftest] refused non-super-admin ${caller.id}`);
        return json({ error: 'forbidden', message: 'Super admin access required' }, 403);
      }

      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const action = String(body.action || 'run');
      const suites: string[] = Array.isArray(body.suites) && body.suites.length ? body.suites : [...ALL_SUITES];
      const toolFilter: string[] | null = Array.isArray(body.tools) && body.tools.length ? body.tools : null;

      // ---- seed / unseed ----------------------------------------------------
      if (action === 'seed') {
        const seeded = await seedTestTenant(admin, body.teamId || TEST_TEAM_ID);
        return json({ action, teamId: body.teamId || TEST_TEAM_ID, seeded });
      }
      if (action === 'unseed') {
        const removed = await unseedTestTenant(admin, body.teamId || TEST_TEAM_ID);
        return json({ action, teamId: body.teamId || TEST_TEAM_ID, removed });
      }

      // ---- tenant matrix ----------------------------------------------------
      let teamIds: string[] = Array.isArray(body.teams) && body.teams.length ? body.teams : [];
      if (!teamIds.length) {
        const { data: teams } = await admin
          .from('teams')
          .select('id, name')
          .order('created_at', { ascending: true })
          .limit(200);
        // Default matrix: the deterministic test tenant plus a small, stable
        // spread of real tenants for shape + isolation assertions.
        const preferred = (teams || []).filter((t: any) => t.id === TEST_TEAM_ID);
        const others = (teams || []).filter((t: any) => t.id !== TEST_TEAM_ID).slice(0, Number(body.tenantSampleSize ?? 3));
        teamIds = [...preferred, ...others].map((t: any) => t.id);
      }

      const profiles: TenantProfile[] = [];
      for (const id of teamIds) profiles.push(await profileTenant(admin, id));

      // Seed the deterministic tenant so timeframe assertions are meaningful.
      const testProfile = profiles.find((p) => p.teamId === TEST_TEAM_ID);
      if (testProfile && suites.includes('execution') && body.seed !== false) {
        try {
          const seeded = await seedTestTenant(admin, TEST_TEAM_ID);
          testProfile.sample = {
            ...testProfile.sample,
            vehicle: seeded.sampleVehicle,
            vehicleWord: seeded.sampleVehicleWord,
            customer: seeded.sampleCustomer,
            bookingRef: seeded.sampleBookingRef,
            location: seeded.location,
          };
        } catch (e) {
          console.error('[rari-selftest] seeding failed', e);
        }
      }

      const results: any[] = [];
      const failures: any[] = [];
      const idsByTenant = new Map<string, Set<string>>();
      const createdBookingIds: string[] = [];

      const push = (entry: any) => {
        results.push(entry);
        for (const f of entry.failures || []) {
          failures.push({ ...f, suite: entry.suite, tenant: entry.tenant, case: entry.case });
        }
      };

      // =====================================================================
      // Suites that run per tenant
      // =====================================================================
      for (const p of profiles) {
        const userId = p.ownerUserId;
        if (!userId) {
          push({ suite: 'setup', tenant: p.name, case: 'owner-lookup', failures: [{ assertion: 'setup', detail: 'no active team member to run as' }] });
          continue;
        }
        const seen = new Set<string>();
        idsByTenant.set(p.teamId, seen);

        // ---- execution: every registry tool -------------------------------
        if (suites.includes('execution')) {
          for (const c of TOOL_CASES) {
            if (toolFilter && !toolFilter.includes(c.tool)) continue;
            const skipped = missingNeeds(c.needs, p.sample);
            if (skipped.length) {
              push({ suite: 'execution', tenant: p.name, case: `${c.tool}`, status: 'skipped', reason: `tenant has no ${skipped.join(', ')}`, failures: [] });
              continue;
            }
            if (c.mutating && p.teamId !== TEST_TEAM_ID) {
              push({ suite: 'execution', tenant: p.name, case: c.tool, status: 'skipped', reason: 'mutating case runs only on the test tenant', failures: [] });
              continue;
            }

            const args = substitute(c.args, p.sample) as Record<string, unknown>;
            let result: any;
            try {
              result = await executeFunction(c.tool, args, admin, userId, p.teamId);
            } catch (e) {
              push({ suite: 'execution', tenant: p.name, case: c.tool, tool: c.tool, args, rawResult: { threw: String(e?.message || e) }, failures: [{ assertion: 'threw', detail: String(e?.message || e) }] });
              continue;
            }

            const caseFailures = [
              ...assertResult(result, { teamId: p.teamId, args, expectError: c.expectError, strict: p.strict }),
              ...assertCurrency(result, p.currencySymbol),
            ];
            collectRecordIds(result, seen);

            if (c.tool === 'create_booking_hold' && result?.bookingId) createdBookingIds.push(result.bookingId);

            push({
              suite: 'execution',
              tenant: p.name,
              case: c.tool,
              tool: c.tool,
              args,
              rawResult: result,
              summary: String(result?.summary || '').slice(0, 160),
              failures: caseFailures,
            });
          }

          // Registry coverage: no tool may be silently untested.
          const covered = new Set(TOOL_CASES.map((c) => c.tool));
          const uncovered = FLEET_TOOLS.map((t) => t.name).filter((n) => !covered.has(n));
          if (uncovered.length && !toolFilter) {
            push({ suite: 'execution', tenant: p.name, case: 'registry-coverage', failures: [{ assertion: 'coverage', detail: `no case for: ${uncovered.join(', ')}` }] });
          }
        }

        // ---- questions: natural-language routing ---------------------------
        if (suites.includes('questions')) {
          for (const q of QUESTION_CASES) {
            const skipped = missingNeeds(q.needs, p.sample);
            if (skipped.length) {
              push({ suite: 'questions', tenant: p.name, case: q.label, status: 'skipped', reason: `tenant has no ${skipped.join(', ')}`, failures: [] });
              continue;
            }
            const question = substitute(q.question, p.sample) as string;
            let result: any;
            try {
              result = await executeFunction('ask_fleet', { question }, admin, userId, p.teamId);
            } catch (e) {
              push({ suite: 'questions', tenant: p.name, case: q.label, tool: 'ask_fleet', args: { question }, question, rawResult: { threw: String(e?.message || e) }, failures: [{ assertion: 'threw', detail: String(e?.message || e) }] });
              continue;
            }
            const summary = String(result?.summary || '').toLowerCase();
            const wanted = q.expectAnyOf.map((w) => String(substitute(w, p.sample)).toLowerCase()).filter(Boolean);
            const routed = wanted.some((w) => summary.includes(w));
            const caseFailures = [
              ...assertResult(result, { teamId: p.teamId, args: { question }, strict: false }),
              ...(routed ? [] : [{ assertion: 'routing', detail: `expected one of [${wanted.join(', ')}] in: ${summary.slice(0, 200)}` }]),
            ];
            push({ suite: 'questions', tenant: p.name, case: q.label, tool: 'ask_fleet', args: { question }, question, rawResult: result, summary: summary.slice(0, 160), failures: caseFailures });
          }
        }

        // ---- edge: graceful misses ------------------------------------------
        if (suites.includes('edge')) {
          for (const c of EDGE_CASES) {
            let result: any;
            try {
              result = await executeFunction(c.tool, substitute(c.args, p.sample) as any, admin, userId, p.teamId);
            } catch (e) {
              push({ suite: 'edge', tenant: p.name, case: c.label || c.tool, tool: c.tool, args: c.args, rawResult: { threw: String(e?.message || e) }, failures: [{ assertion: 'threw', detail: String(e?.message || e) }] });
              continue;
            }
            push({
              suite: 'edge',
              tenant: p.name,
              case: c.label || c.tool,
              tool: c.tool,
              args: c.args,
              rawResult: result,
              summary: String(result?.summary || '').slice(0, 160),
              failures: assertResult(result, { teamId: p.teamId, args: c.args, expectError: c.expectError, strict: false }),
            });
          }
        }

        // ---- golden numbers (data-rich tenants) ------------------------------
        if (suites.includes('golden')) {
          try {
            const { checks, failures: gf } = await runGoldenChecks(admin, userId, p.teamId);
            push({ suite: 'golden', tenant: p.name, case: 'sql-cross-check', rawResult: { checks }, checks, failures: gf });
          } catch (e) {
            push({ suite: 'golden', tenant: p.name, case: 'sql-cross-check', failures: [{ assertion: 'threw', detail: String(e?.message || e) }] });
          }
        }

        // ---- cross-tenant WRITE refusal ---------------------------------------
        if (suites.includes('isolation')) {
          const other = profiles.find((x) => x.teamId !== p.teamId);
          if (other) {
            const { data: foreignVehicle } = await admin
              .from('vehicles').select('id, make, model').eq('team_id', other.teamId).limit(1).maybeSingle();
            if (foreignVehicle) {
              const start = new Date(); start.setUTCDate(start.getUTCDate() + 30);
              const end = new Date(); end.setUTCDate(end.getUTCDate() + 32);
              let result: any;
              try {
                result = await executeFunction('create_booking_hold', {
                  vehicle_id: foreignVehicle.id,
                  vehicle: foreignVehicle.id,
                  customer_name: 'Rari Selftest CrossTenant',
                  start_date: start.toISOString(),
                  end_date: end.toISOString(),
                }, admin, userId, p.teamId);
              } catch {
                result = { error: 'refused' };
              }
              const refused = !!result?.error || !result?.bookingId;
              if (!refused) createdBookingIds.push(result.bookingId);
              push({
                suite: 'isolation',
                tenant: p.name,
                case: `write against ${other.name}'s vehicle`,
                tool: 'create_booking_hold',
                rawResult: result,
                summary: String(result?.summary || result?.error || '').slice(0, 160),
                failures: refused ? [] : [{ assertion: 'cross-tenant-write', detail: `booking ${result.bookingId} was created against another team's vehicle` }],
              });
            }
          }
        }

        // ---- surface parity + auth refusals ------------------------------------
        if (suites.includes('surface') || suites.includes('auth')) {
          const token = await mintTestToolToken(userId, p.teamId, TOOL_SECRET);
          if (suites.includes('surface')) {
            const parityCases = [
              { tool: 'get_fleet_vehicles', args: { limit: 3 } },
              { tool: 'getFleetMetrics', args: { timeframe: 'month' } },
              { tool: 'get_todays_schedule', args: {} },
              ...(p.sample.vehicle ? [{ tool: 'getVehicleDetails', args: { vehicle: p.sample.vehicle } }] : []),
            ];
            const { results: sr, failures: sf } = await runSurfaceParity(token, parityCases);
            push({ suite: 'surface', tenant: p.name, case: 'voice-webhook vs mcp', detail: sr, failures: sf });
          }
          if (suites.includes('auth')) {
            const expired = await mintExpiredToolToken(userId, p.teamId, TOOL_SECRET);
            push({ suite: 'auth', tenant: p.name, case: 'fail-closed refusals', failures: await runAuthRefusals(expired) });
          }
        }
      }

      // ---- cross-tenant READ leakage ----------------------------------------
      if (suites.includes('isolation') && idsByTenant.size > 1) {
        const entries = [...idsByTenant.entries()];
        for (let i = 0; i < entries.length; i++) {
          for (let j = i + 1; j < entries.length; j++) {
            const [aId, aIds] = entries[i];
            const [bId, bIds] = entries[j];
            const overlap = [...aIds].filter((x) => bIds.has(x));
            const nameA = profiles.find((p) => p.teamId === aId)?.name;
            const nameB = profiles.find((p) => p.teamId === bId)?.name;
            push({
              suite: 'isolation',
              tenant: `${nameA} vs ${nameB}`,
              case: 'read leakage',
              failures: overlap.length
                ? [{ assertion: 'cross-tenant-read', detail: `${overlap.length} shared record ids, e.g. ${overlap.slice(0, 3).join(', ')}` }]
                : [],
            });
          }
        }
      }

      // ---- live workspace drift ---------------------------------------------
      if (suites.includes('drift')) {
        try {
          const drift = await checkDrift();
          push({ suite: 'drift', tenant: 'workspace', case: 'elevenlabs registry parity', detail: drift, failures: drift.failures });
        } catch (e) {
          push({ suite: 'drift', tenant: 'workspace', case: 'elevenlabs registry parity', failures: [{ assertion: 'threw', detail: String(e?.message || e) }] });
        }
      }

      // ---- live session handshake --------------------------------------------
      if (suites.includes('session')) {
        try {
          const { detail, failures: sf } = await runSessionSmoke(jwt);
          push({ suite: 'session', tenant: 'caller', case: 'elevenlabs-session handshake', detail, failures: sf });
        } catch (e) {
          push({ suite: 'session', tenant: 'caller', case: 'elevenlabs-session handshake', failures: [{ assertion: 'threw', detail: String(e?.message || e) }] });
        }
      }

      // ---- cleanup -------------------------------------------------------------
      if (createdBookingIds.length) {
        await admin.from('bookings').delete().in('id', createdBookingIds);
      }
      if (body.keepSeed !== true) {
        await unseedTestTenant(admin, TEST_TEAM_ID).catch(() => null);
      }

      const total = results.length;
      const failed = results.filter((r) => (r.failures || []).length > 0).length;
      const skipped = results.filter((r) => r.status === 'skipped').length;

      const matrix: Record<string, Record<string, string>> = {};
      for (const r of results) {
        const row = (matrix[r.case] ||= {});
        row[r.tenant] = r.status === 'skipped' ? 'skip' : (r.failures || []).length ? 'FAIL' : 'pass';
      }

      const tenants = profiles.map((p) => ({ teamId: p.teamId, name: p.name, currency: p.currencySymbol, strict: p.strict, sample: p.sample }));
      const totals = { cases: total, passed: total - failed - skipped, failed, skipped };
      const isGreen = failed === 0;
      const ranAt = new Date().toISOString();

      // ---- regression against the last green run ------------------------------
      const { data: lastGreen } = await admin
        .from('rari_selftest_runs')
        .select('id, ran_at, matrix')
        .eq('is_green', true)
        .order('ran_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const regressions: any[] = [];
      const fixed: any[] = [];
      const newCases: any[] = [];
      if (lastGreen?.matrix) {
        const prev = lastGreen.matrix as Record<string, Record<string, string>>;
        for (const [caseName, row] of Object.entries(matrix)) {
          for (const [tenant, status] of Object.entries(row)) {
            const before = prev?.[caseName]?.[tenant];
            if (before === undefined) { newCases.push({ case: caseName, tenant, status }); continue; }
            if (before === 'pass' && status === 'FAIL') regressions.push({ case: caseName, tenant });
            if (before === 'FAIL' && status === 'pass') fixed.push({ case: caseName, tenant });
          }
        }
      }

      // ---- persist the run artifact -------------------------------------------
      let runId: string | null = null;
      try {
        const { data: inserted, error: insErr } = await admin
          .from('rari_selftest_runs')
          .insert({
            ran_at: ranAt,
            ran_by: caller.id,
            ran_by_email: caller.email ?? null,
            suites,
            tenants,
            totals,
            matrix,
            failures,
            elapsed_ms: Date.now() - started,
            is_green: isGreen,
          })
          .select('id')
          .maybeSingle();
        if (insErr) console.error('[rari-selftest] artifact insert failed', insErr);
        runId = inserted?.id ?? null;
      } catch (e) {
        console.error('[rari-selftest] artifact insert threw', e);
      }

      return json({
        ok: isGreen,
        runId,
        ranAt,
        elapsedMs: Date.now() - started,
        suites,
        tenants,
        totals,
        failures,
        matrix,
        comparedTo: lastGreen ? { runId: lastGreen.id, ranAt: lastGreen.ran_at } : null,
        regressions,
        fixed,
        newCases,
        results: body.verbose === false ? undefined : results,
      }, 200);
    } catch (error) {
      console.error('[rari-selftest] fatal', error);
      return json({ error: 'selftest_failed', message: String(error?.message || error) }, 500);
    }
  });
}

async function checkDrift() {
  const mod = await import('./drift.ts');
  return mod.checkWorkspaceDrift();
}
