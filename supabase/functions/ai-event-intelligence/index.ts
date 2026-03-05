import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Expanded PEAK_SEASONS calendar — real-world events for luxury rental demand
const PEAK_SEASONS = [
  // Miami
  { name: 'Art Basel Miami', start: '12-01', end: '12-08', city: 'miami', category: 'festivals', attendance: 83000, surge: 1.35, description: 'International art fair attracting collectors and celebrities' },
  { name: 'Miami Boat Show', start: '02-12', end: '02-16', city: 'miami', category: 'expos', attendance: 100000, surge: 1.30, description: 'Largest boat and marine show in the world' },
  { name: 'Ultra Music Festival', start: '03-28', end: '03-30', city: 'miami', category: 'festivals', attendance: 170000, surge: 1.35, description: 'Premier electronic music festival' },
  { name: 'Miami Grand Prix', start: '05-02', end: '05-04', city: 'miami', category: 'sports', attendance: 250000, surge: 1.40, description: 'Formula 1 race at Miami International Autodrome' },
  { name: 'Miami Open Tennis', start: '03-17', end: '03-30', city: 'miami', category: 'sports', attendance: 300000, surge: 1.25, description: 'ATP/WTA combined Masters 1000 event' },
  { name: 'Miami Swim Week', start: '06-01', end: '06-08', city: 'miami', category: 'expos', attendance: 30000, surge: 1.20, description: 'Fashion industry swimwear showcase' },
  { name: 'Spring Break Miami', start: '03-10', end: '03-25', city: 'miami', category: 'community', attendance: 500000, surge: 1.25, description: 'Peak tourism season for South Florida' },

  // Scottsdale / Phoenix
  { name: 'Barrett-Jackson Auction', start: '01-18', end: '01-26', city: 'scottsdale', category: 'expos', attendance: 300000, surge: 1.35, description: 'Largest collector car auction in the world' },
  { name: 'WM Phoenix Open', start: '02-03', end: '02-09', city: 'scottsdale', category: 'sports', attendance: 700000, surge: 1.40, description: 'Highest-attended golf tournament globally' },
  { name: 'Scottsdale Arabian Horse Show', start: '02-13', end: '02-23', city: 'scottsdale', category: 'expos', attendance: 50000, surge: 1.20, description: 'Premier equestrian event with wealthy attendees' },
  { name: 'Spring Training Baseball', start: '02-22', end: '03-25', city: 'scottsdale', category: 'sports', attendance: 200000, surge: 1.20, description: '15 MLB teams train in the Cactus League' },
  { name: 'Scottsdale Arts Festival', start: '03-07', end: '03-09', city: 'scottsdale', category: 'festivals', attendance: 40000, surge: 1.15, description: 'Juried fine art show in downtown Scottsdale' },

  // National holidays (all cities)
  { name: 'Christmas & New Years', start: '12-20', end: '01-03', city: 'all', category: 'community', attendance: 0, surge: 1.45, description: 'Peak holiday travel season' },
  { name: 'Super Bowl Weekend', start: '02-05', end: '02-12', city: 'all', category: 'sports', attendance: 100000, surge: 1.50, description: 'Biggest single sporting event in the US' },
  { name: 'Presidents Day Weekend', start: '02-14', end: '02-17', city: 'all', category: 'community', attendance: 0, surge: 1.15, description: 'Long weekend holiday travel' },
  { name: 'Memorial Day Weekend', start: '05-23', end: '05-26', city: 'all', category: 'community', attendance: 0, surge: 1.25, description: 'Start of summer travel season' },
  { name: 'Independence Day', start: '07-01', end: '07-06', city: 'all', category: 'community', attendance: 0, surge: 1.30, description: 'Peak summer holiday period' },
  { name: 'Labor Day Weekend', start: '08-29', end: '09-01', city: 'all', category: 'community', attendance: 0, surge: 1.20, description: 'End of summer travel weekend' },
  { name: 'Thanksgiving Week', start: '11-24', end: '11-30', city: 'all', category: 'community', attendance: 0, surge: 1.30, description: 'Major holiday travel period' },
  { name: 'Summer Peak', start: '06-15', end: '08-15', city: 'all', category: 'community', attendance: 0, surge: 1.15, description: 'General summer tourism season' },
];

function getRelevantPeakSeasons(city: string, startDate: string, endDate: string) {
  const start = startDate.slice(5); // MM-DD
  const end = endDate.slice(5);

  return PEAK_SEASONS.filter(season => {
    const cityMatch = season.city === 'all' || season.city === city.toLowerCase();
    if (!cityMatch) return false;

    // Check date overlap (simplified — works for most cases within a year)
    const seasonOverlapsRange =
      (season.start >= start && season.start <= end) ||
      (season.end >= start && season.end <= end) ||
      (season.start <= start && season.end >= end);

    return seasonOverlapsRange;
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, startDate, endDate, categories } = await req.json();
    const targetCity = city || 'miami';
    const start = startDate || new Date().toISOString().slice(0, 10);
    const end = endDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check cache first
    const { data: cached } = await supabase
      .from('demand_intelligence_cache')
      .select('response, expires_at')
      .eq('city', targetCity)
      .eq('start_date', start)
      .eq('end_date', end)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      console.log('Returning cached event intelligence for', targetCity);
      return new Response(JSON.stringify(cached.response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get PEAK_SEASONS events for the date range
    const peakSeasonEvents = getRelevantPeakSeasons(targetCity, start, end);

    // Call Gemini for additional event intelligence
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let geminiEvents: any[] = [];

    if (LOVABLE_API_KEY) {
      try {
        const cityLabel = targetCity.charAt(0).toUpperCase() + targetCity.slice(1);
        const prompt = `You are an event intelligence analyst for the luxury car rental industry. List real, confirmed events happening in or near ${cityLabel} between ${start} and ${end}.

Focus on events that drive demand for luxury/exotic car rentals:
- Sports events (F1, golf tournaments, tennis, NFL, NBA, MLB)
- Music festivals and major concerts
- Art fairs and cultural events
- Business conferences and trade shows
- Fashion events
- Boat shows and automotive events
- Major holiday weekends

For each event provide the real event name, actual dates, estimated attendance, category, and a demand impact score (0-100) based on how much it would drive luxury car rental demand.

Only include REAL events that actually happen in this city and time period. Do NOT invent events.`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
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
                          category: { type: 'string', enum: ['sports', 'concerts', 'festivals', 'conferences', 'expos', 'performing-arts', 'community'] },
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
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            geminiEvents = parsed.events || [];
            console.log(`Gemini returned ${geminiEvents.length} events for ${cityLabel}`);
          }
        } else {
          const errText = await response.text();
          console.error('Gemini API error:', response.status, errText);
        }
      } catch (geminiErr) {
        console.error('Gemini call failed, using PEAK_SEASONS only:', geminiErr);
      }
    }

    // Merge PEAK_SEASONS with Gemini events, deduplicating by name similarity
    const allEvents: any[] = [];
    const addedNames = new Set<string>();

    // Add PEAK_SEASONS events first (ground truth)
    for (const season of peakSeasonEvents) {
      const event = {
        id: `peak-${season.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: season.name,
        date: `${start.slice(0, 4)}-${season.start}`,
        endDate: `${start.slice(0, 4)}-${season.end}`,
        category: season.category,
        attendance: season.attendance,
        impactScore: Math.round(season.surge * 60),
        description: season.description,
        source: 'calendar',
        confidence: 'high',
      };
      allEvents.push(event);
      addedNames.add(season.name.toLowerCase());
    }

    // Add Gemini events that aren't duplicates
    for (const gEvent of geminiEvents) {
      const nameLower = gEvent.name.toLowerCase();
      const isDuplicate = [...addedNames].some(existing =>
        nameLower.includes(existing) || existing.includes(nameLower) ||
        (nameLower.split(' ').filter((w: string) => w.length > 3).some((w: string) => existing.includes(w)))
      );

      if (!isDuplicate) {
        allEvents.push({
          ...gEvent,
          id: `ai-${gEvent.name.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}`,
          source: 'ai',
          confidence: 'medium',
        });
        addedNames.add(nameLower);
      }
    }

    // Filter by categories if provided
    const filteredEvents = categories?.length
      ? allEvents.filter(e => categories.includes(e.category))
      : allEvents;

    // Sort by impact score descending
    filteredEvents.sort((a, b) => b.impactScore - a.impactScore);

    // Calculate demand multiplier
    const maxImpact = filteredEvents.length > 0
      ? Math.max(...filteredEvents.map(e => e.impactScore))
      : 0;
    const avgImpact = filteredEvents.length > 0
      ? filteredEvents.reduce((sum, e) => sum + e.impactScore, 0) / filteredEvents.length
      : 0;

    // Use PEAK_SEASONS surge if available, otherwise derive from impact scores
    const peakSurge = peakSeasonEvents.length > 0
      ? Math.max(...peakSeasonEvents.map(s => s.surge))
      : 1.0;
    const demandMultiplier = Math.max(peakSurge, 1 + (avgImpact / 200));

    // Find peak date
    const peakEvent = filteredEvents[0];
    const peakDate = peakEvent?.date || null;

    const result = {
      events: filteredEvents,
      demandMultiplier: Math.round(demandMultiplier * 100) / 100,
      summary: {
        peakDate,
        totalEvents: filteredEvents.length,
        avgImpact: Math.round(avgImpact),
        totalAttendance: filteredEvents.reduce((sum, e) => sum + (e.attendance || 0), 0),
        sources: {
          calendar: allEvents.filter(e => e.source === 'calendar').length,
          ai: allEvents.filter(e => e.source === 'ai').length,
        },
      },
    };

    // Cache the result (upsert)
    await supabase
      .from('demand_intelligence_cache')
      .upsert({
        city: targetCity,
        start_date: start,
        end_date: end,
        response: result,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'city,start_date,end_date' });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Event intelligence error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
