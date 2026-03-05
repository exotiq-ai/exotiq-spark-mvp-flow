import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    // Fetch last 7 days of bookings
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    let bookingsQuery = supabase
      .from('bookings')
      .select('*')
      .gte('created_at', sevenDaysAgo);
    
    if (teamId) {
      bookingsQuery = bookingsQuery.eq('team_id', teamId);
    } else {
      bookingsQuery = bookingsQuery.eq('user_id', userId);
    }

    const { data: recentBookings } = await bookingsQuery;
    const bookings = recentBookings || [];

    // Fetch vehicles
    let vehiclesQuery = supabase.from('vehicles').select('*');
    if (teamId) {
      vehiclesQuery = vehiclesQuery.eq('team_id', teamId);
    } else {
      vehiclesQuery = vehiclesQuery.eq('user_id', userId);
    }
    const { data: vehicles } = await vehiclesQuery;
    const allVehicles = vehicles || [];

    // Previous week bookings for comparison
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    let prevQuery = supabase
      .from('bookings')
      .select('*')
      .gte('created_at', fourteenDaysAgo)
      .lt('created_at', sevenDaysAgo);
    
    if (teamId) {
      prevQuery = prevQuery.eq('team_id', teamId);
    } else {
      prevQuery = prevQuery.eq('user_id', userId);
    }
    const { data: prevBookings } = await prevQuery;
    const previousBookings = prevBookings || [];

    // Calculate metrics
    const currentRevenue = bookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
    const prevRevenue = previousBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
    const revenueChange = prevRevenue > 0 
      ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100) 
      : currentRevenue > 0 ? 100 : 0;

    const completedBookings = bookings.filter(b => b.status === 'completed' || b.status === 'active');
    const newBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending');

    // Top vehicle by revenue
    const vehicleRevMap: Record<string, { name: string; revenue: number }> = {};
    bookings.forEach(b => {
      const vid = b.vehicle_id || 'unknown';
      const veh = allVehicles.find(v => v.id === vid);
      const name = veh?.name || b.vehicle_name || 'Unknown';
      if (!vehicleRevMap[vid]) vehicleRevMap[vid] = { name, revenue: 0 };
      vehicleRevMap[vid].revenue += Number(b.total_value || 0);
    });
    const topVehicle = Object.values(vehicleRevMap).sort((a, b) => b.revenue - a.revenue)[0] 
      || { name: 'N/A', revenue: 0 };

    // Utilization (simplified: % of vehicles with active/confirmed bookings)
    const activeVehicleIds = new Set(
      bookings.filter(b => b.status === 'active' || b.status === 'confirmed').map(b => b.vehicle_id)
    );
    const currentUtil = allVehicles.length > 0 
      ? Math.round((activeVehicleIds.size / allVehicles.length) * 100) 
      : 0;
    const prevActiveIds = new Set(
      previousBookings.filter(b => b.status === 'active' || b.status === 'confirmed').map(b => b.vehicle_id)
    );
    const prevUtil = allVehicles.length > 0 
      ? Math.round((prevActiveIds.size / allVehicles.length) * 100) 
      : 0;

    // Next week events
    const nextWeekStart = new Date();
    const nextWeekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    let nextWeekEvents: Array<{ name: string; date: string; impact: string }> = [];
    let demandSurge = 0;

    // Call event intelligence for next week
    try {
      const eventResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-event-intelligence`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city: 'miami',
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

    // Generate top action with AI
    let topAction = `Review your fleet pricing — ${completedBookings.length} bookings completed this week with $${Math.round(currentRevenue).toLocaleString()} in revenue.`;

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
              { role: 'system', content: 'You are FleetCopilot, an AI assistant for luxury car rental fleet management. Give one concise, actionable recommendation (1-2 sentences) based on the fleet data.' },
              { role: 'user', content: `Fleet data this week: Revenue $${Math.round(currentRevenue)}, ${completedBookings.length} completed bookings, ${newBookings.length} new bookings, ${allVehicles.length} vehicles, utilization ${currentUtil}%. Revenue change vs last week: ${revenueChange}%. Upcoming events: ${nextWeekEvents.map(e => e.name).join(', ') || 'none'}. Top vehicle: ${topVehicle.name} ($${Math.round(topVehicle.revenue)}). Give one actionable recommendation.` },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) topAction = content.trim();
        }
      } catch (err) {
        console.error('AI recommendation failed:', err);
      }
    }

    // Build digest
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
        vehiclesRecommended: demandSurge > 15 ? Math.min(allVehicles.length, 3) : 0,
      },
      topAction,
      generatedAt: new Date().toISOString(),
    };

    // Store in DB
    const { data: storedDigest, error: storeError } = await supabase
      .from('weekly_digests')
      .insert({
        team_id: teamId,
        user_id: userId,
        week_start: weekStart,
        summary_json: summaryJson,
        revenue_total: currentRevenue,
        bookings_count: bookings.length,
        top_insight: topAction,
      })
      .select()
      .single();

    if (storeError) {
      console.error('Failed to store digest:', storeError);
    }

    return new Response(JSON.stringify({ 
      digest: storedDigest || { summary_json: summaryJson, week_start: weekStart, created_at: new Date().toISOString() },
      success: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Weekly digest error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
