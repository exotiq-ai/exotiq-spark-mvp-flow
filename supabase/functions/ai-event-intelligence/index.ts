import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { logTransfer } from "../_shared/transferGuard.ts";
import { aiModel, aiProviderLabel } from "../_shared/aiProvider.ts";
import { EVENT_CATEGORIES, resolveCity, type EventCategory } from "../_shared/demandCities.ts";
import {
  RESULT_VERSION,
  applyCalendarChecks,
  buildResult,
  calendarEvents,
  calendarNamesWithAliases,
  searchCityEvents,
  sliceEvents,
  type EngineEvent,
  type EngineResult,
} from "../_shared/eventEngine.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_RANGE_DAYS = 120;
const DAY_MS = 86_400_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — events shift intraday
const FAILURE_CACHE_TTL_MS = 5 * 60 * 1000; // if a search failed, retry soon instead of caching a thin result for 6h
const SNAPSHOT_MAX_AGE_MS = 36 * 60 * 60 * 1000; // nightly precompute; tolerate one missed night

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** Validate + clamp the requested window. Never trust client input. */
function normalizeRange(startInput: unknown, endInput: unknown, maxDays = MAX_RANGE_DAYS) {
  const today = new Date();
  const defaultStart = toIso(today);
  const defaultEnd = toIso(new Date(today.getTime() + 14 * DAY_MS));

  const isValid = (v: unknown): v is string =>
    typeof v === 'string' && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v));

  let start = isValid(startInput) ? startInput : defaultStart;
  let end = isValid(endInput) ? endInput : defaultEnd;

  if (end < start) [start, end] = [end, start];

  // Clamp the window so a hostile/buggy client can't request years of data
  const spanDays = Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS);
  if (spanDays > maxDays) {
    end = toIso(new Date(Date.parse(start) + maxDays * DAY_MS));
  }

  return { start, end };
}

function normalizeCategories(input: unknown): EventCategory[] {
  if (!Array.isArray(input)) return [];
  const valid = input.filter(
    (c): c is EventCategory => typeof c === 'string' && (EVENT_CATEGORIES as readonly string[]).includes(c),
  );
  return [...new Set(valid)];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const authSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const city = resolveCity(body.city);

    // Curated calendar only, for any window (up to ~2.5 years): no AI, no cache. The app uses it to look up past
    // occurrences of recurring events and measure what the tenant's own bookings did around them.
    if (body.calendarOnly === true) {
      const range = normalizeRange(body.startDate, body.endDate, 900);
      const events = calendarEvents(city.value, range.start, range.end);
      return json({ ...buildResult(events, range.start, range.end), city: city.value, cityLabel: city.label, cached: false, origin: 'calendar' });
    }

    const { start, end } = normalizeRange(body.startDate, body.endDate);
    const categories = normalizeCategories(body.categories);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Category filtering happens AFTER the data is assembled, so the cache and the
    // snapshot always hold the full unfiltered event set.
    const respond = (events: EngineEvent[], extra: Record<string, unknown>) => {
      const filtered = categories.length ? events.filter((e) => categories.includes(e.category)) : events;
      return json({ ...buildResult(filtered, start, end), city: city.value, cityLabel: city.label, ...extra });
    };

    // ---- 1. Nightly snapshot (instant; no web search while the user waits) ----
    const calendar = calendarEvents(city.value, start, end);
    const { data: snap, error: snapError } = await supabase
      .from('demand_event_snapshots')
      .select('events, generated_at, window_start, window_end, ai_event_count, calendar_checks')
      .eq('city', city.value)
      .maybeSingle();
    if (snapError) console.error('Snapshot read failed (continuing):', snapError.message);

    if (
      snap &&
      Array.isArray(snap.events) &&
      snap.window_start <= start && snap.window_end >= end &&
      Date.now() - Date.parse(snap.generated_at) < SNAPSHOT_MAX_AGE_MS
    ) {
      const aiEvents = sliceEvents(snap.events as EngineEvent[], start, end);
      return respond([...applyCalendarChecks(calendar, snap.calendar_checks as never), ...aiEvents], { cached: true, origin: 'snapshot', snapshotAt: snap.generated_at });
    }

    // ---- 2. Short-lived cache of a previous live search ----
    const { data: cached, error: cacheError } = await supabase
      .from('demand_intelligence_cache')
      .select('response, expires_at')
      .eq('city', city.value)
      .eq('start_date', start)
      .eq('end_date', end)
      .maybeSingle();
    if (cacheError) console.error('Cache read failed (continuing):', cacheError.message);

    const cachedResult = cached?.response as EngineResult | undefined;
    if (
      cachedResult?.version === RESULT_VERSION && Array.isArray(cachedResult.events) &&
      cached?.expires_at && new Date(cached.expires_at) > new Date()
    ) {
      return respond(cachedResult.events, { cached: true, origin: 'cache' });
    }

    // ---- 3. Live search (fallback when no fresh snapshot covers this window) ----
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 100_000);
    let outcome;
    try {
      outcome = await searchCityEvents(city, start, end, {
        signal: controller.signal,
        existingNames: calendarNamesWithAliases(calendar),
      });
    } finally {
      clearTimeout(timeout);
    }

    const searchFailed = outcome.failedSearches > 0;
    if (outcome.totalSearches > 0) {
      logTransfer({
        team_id: ((claimsData.claims as any).team_id as string) ?? null,
        user_id: ((claimsData.claims as any).sub as string) ?? null,
        caller: "ai-event-intelligence",
        model: aiModel("text"),
        provider: aiProviderLabel() + ' + web search',
        provider_region: "United States / Global",
        status: outcome.failedSearches === outcome.totalSearches ? "error" : "ok",
      }).catch(() => {});
    }
    console.log(`[${city.value}] live calendar=${calendar.length} ai_kept=${outcome.events.length}/${outcome.rawCount} failed=${outcome.failedSearches}/${outcome.totalSearches}`);

    const all = [...calendar, ...outcome.events];

    // Cache the UNFILTERED result; never cache a failed run for long.
    const { error: upsertError } = await supabase
      .from('demand_intelligence_cache')
      .upsert({
        city: city.value,
        start_date: start,
        end_date: end,
        response: buildResult(all, start, end),
        expires_at: new Date(Date.now() + (searchFailed ? FAILURE_CACHE_TTL_MS : CACHE_TTL_MS)).toISOString(),
      }, { onConflict: 'city,start_date,end_date' });
    if (upsertError) console.error('Cache write failed (non-fatal):', upsertError.message);

    return respond(all, { cached: false, origin: 'live', aiEnrichmentFailed: searchFailed });
  } catch (error) {
    console.error('Event intelligence error:', error);
    return json({ error: (error as Error)?.message || 'Unknown error' }, 500);
  }
});
