import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch user's fleet summary for dynamic context
async function getFleetContext(supabase: any, userId: string) {
  try {
    // Get user's team
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .limit(1)
      .single();
    
    const teamId = membership?.team_id;
    if (!teamId) {
      return null;
    }

    // Get vehicle summary by location
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, make, location')
      .eq('team_id', teamId);

    if (!vehicles || vehicles.length === 0) {
      return { 
        summary: "New fleet - no vehicles added yet.",
        vehicleCount: 0,
        locations: [],
        makes: []
      };
    }

    // Aggregate by location
    const locationCounts: Record<string, number> = {};
    const makeSet = new Set<string>();
    
    vehicles.forEach((v: any) => {
      const loc = v.location || 'Unknown';
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      if (v.make) makeSet.add(v.make);
    });

    const locations = Object.entries(locationCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const makes = Array.from(makeSet).sort();
    const totalVehicles = vehicles.length;

    // Build natural language summary
    const locationSummary = locations
      .map(l => `${l.name} (${l.count})`)
      .join(', ');

    const summary = `Fleet: ${totalVehicles} vehicles across ${locations.length} location(s): ${locationSummary}. Makes include: ${makes.slice(0, 5).join(', ')}${makes.length > 5 ? ` and ${makes.length - 5} more` : ''}.`;

    return {
      summary,
      vehicleCount: totalVehicles,
      locations,
      makes,
      teamId
    };
  } catch (error) {
    console.error('Error fetching fleet context:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const { userId, context } = await req.json();
    
    if (!userId) {
      throw new Error('userId is required');
    }

    // Initialize Supabase with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user's fleet context
    const fleetContext = await getFleetContext(supabase, userId);
    
    console.log('Fleet context for user:', userId, fleetContext?.summary || 'No fleet data');

    const agentId = 'agent_0001k9d5pvdwfmvv7aq0mhaexgd6';
    
    // Build context summary for logging
    let contextInfo = '';
    if (context?.currentEntity?.type) {
      contextInfo = ` with ${context.currentEntity.type} context`;
    }
    
    console.log('Generating signed URL for agent:', agentId, 'user:', userId, contextInfo);

    // Get signed URL from ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      throw new Error(`Failed to get signed URL: ${response.status}`);
    }

    const data = await response.json();
    console.log('Successfully generated signed URL');

    return new Response(JSON.stringify({
      ...data,
      // Dynamic fleet context for this user
      fleetContext,
      // Merge with any UI context passed in
      contextSummary: fleetContext?.summary || context?.summary || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in elevenlabs-session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});