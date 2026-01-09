import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    // Get user ID and context from request body
    const { userId, context } = await req.json();
    
    if (!userId) {
      throw new Error('userId is required');
    }

    const agentId = 'agent_0001k9d5pvdwfmvv7aq0mhaexgd6';
    
    // Build context summary for logging
    let contextInfo = '';
    if (context?.currentEntity?.type) {
      contextInfo = ` with ${context.currentEntity.type} context`;
    }
    
    console.log('Generating signed URL for agent:', agentId, 'user:', userId, contextInfo);

    // Get signed URL from ElevenLabs (GET request only)
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

    // Return signed URL along with any context that should be passed to the agent
    return new Response(JSON.stringify({
      ...data,
      // Include context summary that can be used for agent initialization
      contextSummary: context?.summary || null,
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
