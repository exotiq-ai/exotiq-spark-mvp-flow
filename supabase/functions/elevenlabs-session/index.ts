import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a signed tool token for secure tool calls
// Convert Uint8Array to base64url string
function toBase64Url(bytes: Uint8Array): string {
  const base64 = base64Encode(bytes);
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Convert string to base64url
function stringToBase64Url(str: string): string {
  const encoder = new TextEncoder();
  return toBase64Url(encoder.encode(str));
}

async function generateToolToken(userId: string, teamId: string | null, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId,
    teamId,
    iat: now,
    exp: now + 900, // 15 minutes expiry
  };

  const encoder = new TextEncoder();
  const headerB64 = stringToBase64Url(JSON.stringify(header));
  const payloadB64 = stringToBase64Url(JSON.stringify(payload));
  
  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureB64 = toBase64Url(new Uint8Array(signature));
  
  console.log('[JWT] Generated token for user:', userId, 'team:', teamId);
  
  return `${data}.${signatureB64}`;
}

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
        makes: [],
        teamId
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
    const RARI_TOOL_TOKEN_SECRET = Deno.env.get('RARI_TOOL_TOKEN_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    if (!RARI_TOOL_TOKEN_SECRET) {
      console.warn('RARI_TOOL_TOKEN_SECRET not configured - tool calls will not be authenticated');
    }

    const { userId, context } = await req.json();
    
    if (!userId) {
      throw new Error('userId is required');
    }

    // Initialize Supabase with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user's fleet context (also returns teamId)
    const fleetContext = await getFleetContext(supabase, userId);
    const teamId = fleetContext?.teamId || null;
    
    console.log('Fleet context for user:', userId, 'team:', teamId, fleetContext?.summary || 'No fleet data');

    // Generate tool token for secure tool calls
    let toolToken: string | null = null;
    if (RARI_TOOL_TOKEN_SECRET) {
      try {
        toolToken = await generateToolToken(userId, teamId, RARI_TOOL_TOKEN_SECRET);
        console.log('Generated tool token for user:', userId);
      } catch (tokenError) {
        console.error('Failed to generate tool token:', tokenError);
      }
    }

    const agentId = 'agent_0001k9d5pvdwfmvv7aq0mhaexgd6';
    
    // Build context summary for logging
    let contextInfo = '';
    if (context?.currentEntity?.type) {
      contextInfo = ` with ${context.currentEntity.type} context`;
    }
    
    console.log('Generating signed URL for agent:', agentId, 'user:', userId, contextInfo);

    // Get signed URL from ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('ElevenLabs API error:', response.status, errorText);
      throw new Error(`Failed to get signed URL (${response.status}): ${errorText || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Successfully generated signed URL');

    return new Response(JSON.stringify({
      ...data,
      // Tool token for secure tool calls
      toolToken,
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});