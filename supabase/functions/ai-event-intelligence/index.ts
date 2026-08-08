import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { logTransfer } from "../_shared/transferGuard.ts";
import {
  EVENT_CATEGORIES,
  getRelevantPeakSeasons,
  resolveCity,
  type EventCategory,
} from "../_shared/demandCities.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_RANGE_DAYS = 120;
const DAY_MS = 86_400_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — events shift intraday

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** Validate + clamp the requested window. Never trust client input. */
function normalizeRange(startInput: unknown, endInput: unknown) {
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
  if (spanDays > MAX_RANGE_DAYS) {
    end = toIso(new Date(Date.parse(start) + MAX_RANGE_DAYS * DAY_MS));
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

const clampScore = (n: unknown, fallback = 50) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, Math.round(v)));
};

const clampAttendance = (n: unknown) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(2_000_000, Math.round(v));
};

interface NormalizedEvent {
  id: string;
  name: string;
  date: string;
  endDate: string;
  category: EventCategory;
  attendance: number;
  impactScore: number;
  description: string;
  source: 'calendar' | 'ai';
  confidence: 'high' | 'medium';
}

/** Reject anything the model returns that is malformed or out of window. */
function sanitizeAiEvent(raw: unknown, start: string, end: string): NormalizedEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  const name = typeof e.name === 'string' ? e.name.trim().slice(0, 120) : '';
  if (!name) return null;

  const date = typeof e.date === 'string' && ISO_DATE.test(e.date) ? e.date : null;
  if (!date) return null;

  const endDate =
    typeof e.endDate === 'string' && ISO_DATE.test(e.endDate) && e.endDate >= date ? e.endDate : date;

  // Drop hallucinated events that fall completely outside the requested window
  if (endDate < start || date > end) return null;

  const category = (EVENT_CATEGORIES as readonly string[]).includes(String(e.category))
    ? (e.category as EventCategory)
    : 'community';

  return {
    id: `ai-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${date}`,
    name,
    date,
    endDate,
    category,
    attendance: clampAttendance(e.attendance),
    impactScore: clampScore(e.impactScore),
    description: typeof e.description === 'string' ? e.description.slice(0, 240) : '',
    source: 'ai',
    confidence: 'medium',
  };
}

/** Token-overlap dedupe — safer than the old substring check that ate valid events. */
function isDuplicate(candidate: string, existing: Set<string>): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
  const candTokens = new Set(norm(candidate));
  if (candTokens.size === 0) return false;

  for (const other of existing) {
    const otherTokens = norm(other);
    if (otherTokens.length === 0) continue;
    const shared = otherTokens.filter((t) => candTokens.has(t)).length;
    const ratio = shared / Math.min(candTokens.size, otherTokens.length);
    if (ratio >= 0.6) return true;
  }
  return false;
}

function buildResult(events: NormalizedEvent[], peakSurge: number) {
  const sorted = [...events].sort((a, b) => b.impactScore - a.impactScore || a.date.localeCompare(b.date));
  const avgImpact = sorted.length
    ? sorted.reduce((sum, e) => sum + e.impactScore, 0) / sorted.length
    : 0;

  const demandMultiplier = Math.min(2, Math.max(peakSurge, 1 + avgImpact / 200));

  return {
    events: sorted,
    demandMultiplier: Math.round(demandMultiplier * 100) / 100,
    summary: {
      peakDate: sorted[0]?.date ?? null,
      totalEvents: sorted.length,
      avgImpact: Math.round(avgImpact),
      totalAttendance: sorted.reduce((sum, e) => sum + (e.attendance || 0), 0),
      sources: {
        calendar: sorted.filter((e) => e.source === 'calendar').length,
        ai: sorted.filter((e) => e.source === 'ai').length,
      },
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const authSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const city = resolveCity(body.city);
    const { start, end } = normalizeRange(body.startDate, body.endDate);
    const categories = normalizeCategories(body.categories);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Category filtering happens AFTER the cache read, so the cache always
    // stores the full unfiltered event set for a (city, window) pair.
    const applyFilter = (result: ReturnType<typeof buildResult>) => {
      if (!categories.length) return { ...result, city: city.value, cityLabel: city.label };
      const filtered = result.events.filter((e) => categories.includes(e.category));
      const peakSurge = result.demandMultiplier;
      return { ...buildResult(filtered, filtered.length ? 1 : 1), demandMultiplier: filtered.length ? Math.min(peakSurge, result.demandMultiplier) : 1, city: city.value, cityLabel: city.label };
    };

    // ---- Cache ----
    const { data: cached, error: cacheError } = await supabase
      .from('demand_intelligence_cache')
      .select('response, expires_at')
      .eq('city', city.value)
      .eq('start_date', start)
      .eq('end_date', end)
      .maybeSingle();

    if (cacheError) console.error('Cache read failed (continuing):', cacheError.message);

    if (cached?.response && cached.expires_at && new Date(cached.expires_at) > new Date()) {
      const payload = applyFilter(cached.response as ReturnType<typeof buildResult>);
      return new Response(JSON.stringify({ ...payload, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Ground-truth seasonal calendar ----
    const peakSeasonEvents = getRelevantPeakSeasons(city.value, start, end);

    const allEvents: NormalizedEvent[] = peakSeasonEvents.map((season) => ({
      id: `peak-${season.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${season.startDate}`,
      name: season.name,
      date: season.startDate,
      endDate: season.endDate,
      category: season.category,
      attendance: season.attendance,
      impactScore: clampScore(Math.round(season.surge * 60)),
      description: season.description,
      source: 'calendar',
      confidence: 'high',
    }));

    const addedNames = new Set(allEvents.map((e) => e.name));

    // ---- AI enrichment (best effort — never fatal) ----
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const prompt = `You are an event intelligence analyst for the luxury car rental industry. List real, confirmed events happening in or near ${city.promptName} (within roughly ${city.radiusKm} km of the city center) between ${start} and ${end}.

Focus on events that drive demand for luxury/exotic car rentals:
- Sports events (F1, IndyCar, NASCAR, golf, tennis, NFL, NBA, MLB)
- Music festivals and major concerts
- Art fairs and cultural events
- Business conferences and trade shows
- Fashion events
- Boat shows and automotive events
- Major holiday weekends

Every date must fall inside ${start} to ${end}. Only include REAL events that actually happen in this market and time period. Do NOT invent events. If you are unsure an event is real, omit it.`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: 'You are an event data provider. Return structured event data only.' },
              { role: 'user', content: prompt },
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'return_events',
                description: 'Return structured event data for the requested city and date range',
                parameters: {
                  type: 'object',
                  properties: {
                    events: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string', description: 'Official event name' },
                          date: { type: 'string', description: 'Start date YYYY-MM-DD' },
                          endDate: { type: 'string', description: 'End date YYYY-MM-DD' },
                          category: { type: 'string', enum: [...EVENT_CATEGORIES] },
                          attendance: { type: 'number', description: 'Estimated total attendance' },
                          impactScore: { type: 'number', description: 'Demand impact score 0-100 for luxury car rentals' },
                          description: { type: 'string', description: 'One-line description' },
                        },
                        required: ['name', 'date', 'category', 'attendance', 'impactScore'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['events'],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: 'function', function: { name: 'return_events' } },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
          let rawEvents: unknown[] = [];
          if (toolCall?.function?.arguments) {
            try {
              rawEvents = JSON.parse(toolCall.function.arguments)?.events ?? [];
            } catch (parseErr) {
              console.error('Failed to parse AI tool arguments:', parseErr);
            }
          }

          for (const raw of rawEvents.slice(0, 60)) {
            const evt = sanitizeAiEvent(raw, start, end);
            if (!evt) continue;
            if (isDuplicate(evt.name, addedNames)) continue;
            allEvents.push(evt);
            addedNames.add(evt.name);
          }
          console.log(`[${city.value}] calendar=${peakSeasonEvents.length} ai_kept=${allEvents.length - peakSeasonEvents.length}/${rawEvents.length}`);

          logTransfer({
            team_id: ((claimsData.claims as any).team_id as string) ?? null,
            user_id: ((claimsData.claims as any).sub as string) ?? null,
            caller: "ai-event-intelligence",
            model: "google/gemini-3-flash-preview",
            provider: "Google (Gemini via Lovable AI Gateway)",
            provider_region: "United States / Global",
            response_bytes: JSON.stringify(data).length,
            status: "ok",
          }).catch(() => {});
        } else {
          console.error('AI gateway error:', response.status, await response.text());
          logTransfer({
            team_id: ((claimsData.claims as any).team_id as string) ?? null,
            user_id: ((claimsData.claims as any).sub as string) ?? null,
            caller: "ai-event-intelligence",
            model: "google/gemini-3-flash-preview",
            provider: "Google (Gemini via Lovable AI Gateway)",
            provider_region: "United States / Global",
            status: "error",
          }).catch(() => {});
        }
      } catch (aiErr) {
        console.error('AI enrichment failed, serving calendar events only:', aiErr);
      } finally {
        clearTimeout(timeout);
      }
    }

    const peakSurge = peakSeasonEvents.length
      ? Math.max(...peakSeasonEvents.map((s) => s.surge))
      : 1.0;

    const fullResult = buildResult(allEvents, peakSurge);

    // Cache the UNFILTERED result so category toggles never poison the cache.
    const { error: upsertError } = await supabase
      .from('demand_intelligence_cache')
      .upsert({
        city: city.value,
        start_date: start,
        end_date: end,
        response: fullResult,
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      }, { onConflict: 'city,start_date,end_date' });

    if (upsertError) console.error('Cache write failed (non-fatal):', upsertError.message);

    return new Response(JSON.stringify({ ...applyFilter(fullResult), cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Event intelligence error:', error);
    return new Response(JSON.stringify({ error: (error as Error)?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
