import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { logTransfer } from "../_shared/transferGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DAY_MS = 24 * 60 * 60 * 1000;

// keep in sync with src/components/dashboard/MotorIQEnhanced.tsx (Phase 2: extract to shared/fleetMetrics.ts)
function overlapDays(bookingStart: Date, bookingEnd: Date, windowStart: Date, windowEnd: Date): number {
  const start = Math.max(bookingStart.getTime(), windowStart.getTime());
  const end = Math.min(bookingEnd.getTime(), windowEnd.getTime());
  if (end <= start) return 0;
  return (end - start) / DAY_MS;
}

function overlapWeightedRevenue(
  bookings: any[],
  windowStart: Date,
  windowEnd: Date,
): number {
  let total = 0;
  for (const b of bookings) {
    const s = b.start_date ? new Date(b.start_date) : null;
    const e = b.end_date ? new Date(b.end_date) : null;
    const value = Number(b.total_value || 0);
    if (!s || !e || !isFinite(value) || value <= 0) continue;
    const spanDays = Math.max((e.getTime() - s.getTime()) / DAY_MS, 1);
    const overlap = overlapDays(s, e, windowStart, windowEnd);
    if (overlap <= 0) continue;
    total += value * (overlap / spanDays);
  }
  return Math.round(total);
}

function weeklyUtilization(
  vehicles: any[],
  bookings: any[],
  windowStart: Date,
  windowEnd: Date,
): number {
  if (!vehicles.length) return 0;
  const totalDays = (windowEnd.getTime() - windowStart.getTime()) / DAY_MS;
  if (totalDays <= 0) return 0;
  const blocking = new Set(['confirmed', 'active', 'completed']);
  const perVehicle = vehicles.map(v => {
    const vb = bookings.filter(b => b.vehicle_id === v.id && blocking.has(String(b.status)));
    const days = vb.reduce((sum, b) => {
      const s = b.start_date ? new Date(b.start_date) : null;
      const e = b.end_date ? new Date(b.end_date) : null;
      if (!s || !e) return sum;
      return sum + overlapDays(s, e, windowStart, windowEnd);
    }, 0);
    return Math.min(100, (days / totalDays) * 100);
  });
  return Math.round(perVehicle.reduce((a, b) => a + b, 0) / perVehicle.length);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's team
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single();

    const teamId = teamMember?.team_id;

    // Windows: this week (last 7d) and prior week (7-14d ago)
    const now = new Date();
    const weekEnd = now;
    const weekStart = new Date(now.getTime() - 7 * DAY_MS);
    const prevWeekStart = new Date(now.getTime() - 14 * DAY_MS);
    const prevWeekEnd = weekStart;

    // Fetch bookings that could overlap either window (last 30d, generous buffer)
    const lookback = new Date(now.getTime() - 30 * DAY_MS).toISOString();
    let bookingsQuery = supabase
      .from('bookings')
      .select('*')
      .gte('end_date', lookback);
    if (teamId) {
      bookingsQuery = bookingsQuery.eq('team_id', teamId);
    } else {
      bookingsQuery = bookingsQuery.eq('user_id', userId);
    }
    const { data: recentBookings } = await bookingsQuery;
    const allBookings = recentBookings || [];

    // Bookings created within each window (for "new"/"completed" counts)
    const inWindow = (dateStr: string | null, start: Date, end: Date) => {
      if (!dateStr) return false;
      const t = new Date(dateStr).getTime();
      return t >= start.getTime() && t < end.getTime();
    };
    const bookingsThisWeek = allBookings.filter(b => inWindow(b.created_at, weekStart, weekEnd));

    // Vehicles
    let vehiclesQuery = supabase.from('vehicles').select('*');
    if (teamId) {
      vehiclesQuery = vehiclesQuery.eq('team_id', teamId);
    } else {
      vehiclesQuery = vehiclesQuery.eq('user_id', userId);
    }
    const { data: vehicles } = await vehiclesQuery;
    const allVehicles = vehicles || [];

    // Resolve tenant city from default/primary location (no Miami fallback)
    let resolvedCity: string | null = null;
    if (teamId) {
      const { data: loc } = await supabase
        .from('locations')
        .select('city')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();
      const c = loc?.city ? String(loc.city).trim().toLowerCase() : '';
      resolvedCity = c.length > 0 ? c : null;
    }

    // Overlap-weighted revenue across the rental window (not created_at)
    const currentRevenue = overlapWeightedRevenue(allBookings, weekStart, weekEnd);
    const prevRevenue = overlapWeightedRevenue(allBookings, prevWeekStart, prevWeekEnd);
    const revenueChange = prevRevenue > 0
      ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100)
      : currentRevenue > 0 ? 100 : 0;

    const completedBookings = bookingsThisWeek.filter(b => b.status === 'completed' || b.status === 'active');
    const newBookings = bookingsThisWeek.filter(b => b.status === 'confirmed' || b.status === 'pending');

    // Top vehicle by overlap-weighted revenue this week
    const vehicleRevMap: Record<string, { name: string; revenue: number }> = {};
    for (const b of allBookings) {
      const s = b.start_date ? new Date(b.start_date) : null;
      const e = b.end_date ? new Date(b.end_date) : null;
      const value = Number(b.total_value || 0);
      if (!s || !e || !isFinite(value) || value <= 0) continue;
      const spanDays = Math.max((e.getTime() - s.getTime()) / DAY_MS, 1);
      const overlap = overlapDays(s, e, weekStart, weekEnd);
      if (overlap <= 0) continue;
      const vid = b.vehicle_id || 'unknown';
      const veh = allVehicles.find(v => v.id === vid);
      const name = veh?.name || b.vehicle_name || 'Unknown';
      if (!vehicleRevMap[vid]) vehicleRevMap[vid] = { name, revenue: 0 };
      vehicleRevMap[vid].revenue += value * (overlap / spanDays);
    }
    const topVehicleRaw = Object.values(vehicleRevMap).sort((a, b) => b.revenue - a.revenue)[0]
      || { name: 'N/A', revenue: 0 };
    const topVehicle = { name: topVehicleRaw.name, revenue: Math.round(topVehicleRaw.revenue) };

    // Utilization parity with MotorIQEnhanced: per-vehicle day-share across the week, then averaged
    const currentUtil = weeklyUtilization(allVehicles, allBookings, weekStart, weekEnd);
    const prevUtil = weeklyUtilization(allVehicles, allBookings, prevWeekStart, prevWeekEnd);

    // Next-week events: only fetch if we know the city
    const nextWeekStart = new Date();
    const nextWeekEnd = new Date(Date.now() + 7 * DAY_MS);
    let nextWeekEvents: Array<{ name: string; date: string; impact: string }> = [];
    let demandSurge = 0;

    if (resolvedCity) {
      try {
        const eventResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-event-intelligence`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            city: resolvedCity,
            startDate: nextWeekStart.toISOString().slice(0, 10),
            endDate: nextWeekEnd.toISOString().slice(0, 10),
          }),
        });
        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          nextWeekEvents = (eventData.events || []).slice(0, 5).map((e: any) => ({
            name: e.name,
            date: e.date,
            impact: e.impactScore >= 70 ? 'high' : e.impactScore >= 40 ? 'medium' : 'low',
          }));
          demandSurge = Math.round((eventData.demandMultiplier - 1) * 100);
        }
      } catch (err) {
        console.error('Event fetch failed:', err);
      }
    }

    // vehiclesRecommended = real count of vehicles where suggested_rate > current_rate
    const vehiclesRecommended = allVehicles.filter(v =>
      v.suggested_rate && Number(v.suggested_rate) > Number(v.current_rate)
    ).length;

    // Build payload the LLM is allowed to cite (numbers only from here)
    const aiPayload = {
      revenue_usd: currentRevenue,
      revenue_change_pct: revenueChange,
      completed_bookings: completedBookings.length,
      new_bookings: newBookings.length,
      vehicles_total: allVehicles.length,
      utilization_pct: currentUtil,
      utilization_prev_pct: prevUtil,
      top_vehicle_name: topVehicle.name,
      top_vehicle_revenue_usd: topVehicle.revenue,
      upcoming_events: nextWeekEvents.map(e => e.name),
      demand_surge_pct: demandSurge,
      vehicles_recommended_for_reprice: vehiclesRecommended,
      city: resolvedCity,
    };

    let topAction = `Review your fleet pricing — ${completedBookings.length} bookings active or completed this week with $${currentRevenue.toLocaleString()} in revenue.`;

    if (LOVABLE_API_KEY) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content:
                  'You are FleetCopilot, an AI assistant for luxury car rental fleet management. Give one concise, actionable recommendation (1-2 sentences). Strict rule: do NOT invent dollar amounts or percentages. Only reference numbers that appear verbatim in the JSON payload provided by the user. If you need to cite a figure, copy it exactly from the payload. If a figure is not in the payload, do not include any number for it.',
              },
              {
                role: 'user',
                content: `Fleet data JSON (only cite numbers present here):\n${JSON.stringify(aiPayload)}\n\nGive one actionable recommendation in 1-2 sentences.`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content: string = aiData.choices?.[0]?.message?.content?.trim() || '';
          if (content) {
            // Guardrail: reject $ or % tokens not present in the allowed payload values
            const allowedNumbers = new Set<string>();
            const pushNum = (n: number) => {
              if (!isFinite(n)) return;
              allowedNumbers.add(String(Math.round(n)));
              allowedNumbers.add(String(n));
            };
            [
              aiPayload.revenue_usd,
              aiPayload.revenue_change_pct,
              aiPayload.completed_bookings,
              aiPayload.new_bookings,
              aiPayload.vehicles_total,
              aiPayload.utilization_pct,
              aiPayload.utilization_prev_pct,
              aiPayload.top_vehicle_revenue_usd,
              aiPayload.demand_surge_pct,
              aiPayload.vehicles_recommended_for_reprice,
            ].forEach(pushNum);

            const stripCommas = (s: string) => s.replace(/,/g, '');
            const dollarTokens = Array.from(content.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g)).map(m => stripCommas(m[1]));
            const percentTokens = Array.from(content.matchAll(/(\d+(?:\.\d+)?)\s?%/g)).map(m => m[1]);
            const invented = [...dollarTokens, ...percentTokens].some(tok => !allowedNumbers.has(tok));

            if (!invented) {
              topAction = content;
            } else {
              console.warn('weekly-intelligence-digest: rejected LLM output containing invented figures', { content });
            }
          }
          logTransfer({
            team_id: teamId ?? null,
            user_id: userId ?? null,
            caller: "weekly-intelligence-digest",
            model: "google/gemini-3-flash-preview",
            provider: "Google (Gemini via Lovable AI Gateway)",
            provider_region: "United States / Global",
            response_bytes: content ? content.length : 0,
            status: "ok",
          }).catch(() => {});
        }
      } catch (err) {
        console.error('AI recommendation failed:', err);
      }
    }

    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const summaryJson = {
      weekInReview: {
        revenue: currentRevenue,
        revenueChange,
        bookingsCompleted: completedBookings.length,
        newBookings: newBookings.length,
        topVehicle,
        utilizationChange: { from: prevUtil, to: currentUtil },
      },
      nextWeekOutlook: {
        events: nextWeekEvents,
        demandSurge,
        vehiclesRecommended,
      },
      topAction,
      generatedAt: new Date().toISOString(),
      data_sources: ['bookings', 'vehicles', 'locations'],
      coverage: {
        week_start: weekStartIso,
        week_end: weekEnd.toISOString().slice(0, 10),
        vehicles_counted: allVehicles.length,
        bookings_counted: allBookings.length,
        city_resolved: resolvedCity,
      },
    };

    const { data: storedDigest, error: storeError } = await supabase
      .from('weekly_digests')
      .insert({
        team_id: teamId,
        user_id: userId,
        week_start: weekStartIso,
        summary_json: summaryJson,
        revenue_total: currentRevenue,
        bookings_count: bookingsThisWeek.length,
        top_insight: topAction,
      })
      .select()
      .single();

    if (storeError) {
      console.error('Failed to store digest:', storeError);
    }

    return new Response(JSON.stringify({
      digest: storedDigest || { summary_json: summaryJson, week_start: weekStartIso, created_at: new Date().toISOString() },
      success: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Weekly digest error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
