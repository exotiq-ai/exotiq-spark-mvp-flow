import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory rate limiting (simple implementation)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  
  if (limit && limit.resetAt > now) {
    if (limit.count >= 10) { // Max 10 requests per hour
      return false;
    }
    limit.count++;
    return true;
  }
  
  // Reset or create new limit
  rateLimitMap.set(ip, {
    count: 1,
    resetAt: now + 3600000 // 1 hour
  });
  
  return true;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    
    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      console.log(`🚫 Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Too many demo login attempts. Please try again later.' }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get demo credentials from environment
    const DEMO_EMAIL = 'hello@exotiq.ai';
    const DEMO_PASSWORD = Deno.env.get('DEMO_PASSWORD') || 'demo123456';
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Sign in with demo credentials
    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (error) {
      console.error('🚨 Demo login error:', error);
      return new Response(
        JSON.stringify({ error: 'Demo mode temporarily unavailable' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log successful demo login
    console.log(`✅ Demo login successful from IP: ${clientIP}`);

    // Return session data
    return new Response(
      JSON.stringify({
        session: data.session,
        user: data.user,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('🚨 Demo login error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to authenticate demo user' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
