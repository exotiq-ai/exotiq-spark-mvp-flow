import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { logTransfer } from "../_shared/transferGuard.ts";
import { requireServiceOrUser } from "../_shared/serviceAuth.ts";
import { aiModel, aiProviderLabel } from "../_shared/aiProvider.ts";
import { DEMAND_CITIES, type DemandCity } from "../_shared/demandCities.ts";
import {
  applyVerification,
  calendarCheckKey,
  calendarEvents,
  checkableCalendarEvents,
  calendarNamesWithAliases,
  markScheduleConflicts,
  mergeSnapshotEvents,
  searchCityEvents,
  type EngineEvent,
} from "../_shared/eventEngine.ts";
import { verifyEvents } from "../_shared/eventVerify.ts";

/**
 * Nightly precompute of web-search events for each market (event demand engine v2).
 * Scheduler only (x-cron-token): each run costs real money, so signed-in users cannot trigger it.
 *
 * Body (all optional): { cities?: string[], days?: number }   default: every market, 90 days.
 * Register several jobs with a few cities each so one run stays well inside the function time limit.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token',
};

const DAY_MS = 86_400_000;
const CONCURRENCY = 3;
const SEARCH_TIMEOUT_MS = 140_000;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireServiceOrUser(req);
  if (!auth.ok) return auth.response(corsHeaders);
  if (!auth.isCron) return json({ error: 'Forbidden: scheduler only' }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }

  const wanted = Array.isArray(body.cities) ? new Set(body.cities.map((c) => String(c))) : null;
  const cities: DemandCity[] = DEMAND_CITIES.filter((c) => !wanted || wanted.has(c.value));
  if (!cities.length) return json({ error: 'No matching cities' }, 400);

  const days = Math.min(120, Math.max(14, Math.round(Number(body.days) || 90)));
  const start = iso(Date.now());
  const end = iso(Date.now() + days * DAY_MS);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const run = async () => {
  const results = await mapPool(cities, CONCURRENCY, async (city) => {
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    try {
      const calendar = calendarEvents(city.value, start, end);
      // A wide window needs more room to look: venue calendars and conference listings.
      const outcome = await searchCityEvents(city, start, end, {
        signal: controller.signal,
        maxCalls: Number(Deno.env.get('AI_PRECOMPUTE_MAX_CALLS') || 6),
        existingNames: calendarNamesWithAliases(calendar),
      });
      const durationMs = Date.now() - t0;
      const allFailed = outcome.totalSearches > 0 && outcome.failedSearches === outcome.totalSearches;
      const partial = outcome.failedSearches > 0;

      logTransfer({
        team_id: null,
        user_id: null,
        caller: 'precompute-event-intelligence',
        model: aiModel('text'),
        provider: aiProviderLabel() + ' + web search',
        provider_region: 'United States / Global',
        status: allFailed ? 'error' : 'ok',
      }).catch(() => {});

      const { data: existing } = await supabase
        .from('demand_event_snapshots').select('ai_event_count, events').eq('city', city.value).maybeSingle();

      // Never replace a good snapshot with a failed or half-failed run.
      if (allFailed || (partial && existing)) {
        await supabase.from('demand_event_snapshots').upsert({
          city: city.value,
          ...(existing ? {} : { window_start: start, window_end: end, events: [], ai_event_count: 0 }),
          failed_searches: outcome.failedSearches,
          duration_ms: durationMs,
          last_attempt_at: new Date().toISOString(),
          last_error: allFailed ? 'all searches failed' : 'partial failure; previous snapshot kept',
        }, { onConflict: 'city' });
        return { city: city.value, status: allFailed ? 'failed' : 'kept-previous', failedSearches: outcome.failedSearches, durationMs };
      }

      // Fact check: fetch each cited page and look for the event near its date; then flag impossible schedules.
      const checks = await verifyEvents(outcome.events);
      const checked = markScheduleConflicts(applyVerification(outcome.events, checks), city.value);
      const evidence = {
        verified: checked.filter((e) => e.evidence === 'verified').length,
        listed: checked.filter((e) => e.evidence === 'listed').length,
        unconfirmed: checked.filter((e) => e.evidence === 'unconfirmed').length,
      };

      // Curated events: open each official site and check its dates fall inside our window for this occurrence.
      const checkable = checkableCalendarEvents(calendar);
      const calChecks = await verifyEvents(checkable.map((e) => ({ name: e.name, date: e.date, endDate: e.endDate, sourceUrls: e.sourceUrls, anyDayOfWindow: true })));
      const calendarChecks: Record<string, { status: string; checkedAt: string }> = {};
      checkable.forEach((e, i) => { calendarChecks[calendarCheckKey(e)] = { status: calChecks[i].status, checkedAt: new Date().toISOString() }; });

      // Keep events seen in the past week that tonight's (noisy) search missed.
      const merged = mergeSnapshotEvents((existing?.events as EngineEvent[] | undefined) ?? [], checked, new Date(), city.promptName);
      const noEvents = merged.length === 0;
      const { error } = await supabase.from('demand_event_snapshots').upsert({
        city: city.value,
        window_start: start,
        window_end: end,
        generated_at: new Date().toISOString(),
        events: merged,
        calendar_checks: calendarChecks,
        ai_event_count: merged.length,
        failed_searches: outcome.failedSearches,
        duration_ms: durationMs,
        last_attempt_at: new Date().toISOString(),
        // A big market with no events at all is far more likely a search problem than a quiet quarter.
        last_error: noEvents ? 'search returned no events (check the market)' : null,
      }, { onConflict: 'city' });
      if (error) throw new Error(error.message);

      return {
        city: city.value,
        status: noEvents ? 'empty' : 'ok',
        aiEvents: merged.length,
        freshFromSearch: outcome.events.length,
        anchored: merged.filter((e) => e.pricingEligible).length,
        freshEvidence: evidence,
        calendarEvents: calendar.length,
        rawFromModel: outcome.rawCount,
        durationMs,
      };
    } catch (e) {
      console.error(`[${city.value}] precompute failed:`, e instanceof Error ? e.message : e);
      return { city: city.value, status: 'error', error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - t0 };
    } finally {
      clearTimeout(timer);
    }
  });

  console.log('precompute', JSON.stringify(results));
  return { window: { start, end }, results };
  };

  // The scheduler's HTTP call gives up after 30 s, a run takes a minute or more: accept the job and
  // finish in the background. `sync: true` waits for the result (manual testing).
  if (body.sync === true) return json(await run());
  const work = run().catch((e) => console.error('precompute run failed:', e instanceof Error ? e.message : e));
  (globalThis as any).EdgeRuntime?.waitUntil?.(work);
  return json({ accepted: true, cities: cities.map((c) => c.value), window: { start, end } }, 202);
});
