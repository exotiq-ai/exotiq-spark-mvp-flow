import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory rate limiting (simple implementation)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const getClientIP = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for');
  const firstForwarded = forwarded?.split(',')?.[0]?.trim();
  return (
    firstForwarded ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
};

const checkRateLimit = (key: string): boolean => {
  // If we can't reliably identify the client, don't apply a global rate limit
  // (otherwise all demo visitors may share the same bucket and get blocked).
  if (!key || key === 'unknown') return true;

  const now = Date.now();
  const limit = rateLimitMap.get(key);

  // Allow up to 100 demo logins per hour per IP
  const MAX_PER_HOUR = 100;

  if (limit && limit.resetAt > now) {
    if (limit.count >= MAX_PER_HOUR) {
      return false;
    }
    limit.count++;
    return true;
  }

  // Reset or create new limit
  rateLimitMap.set(key, {
    count: 1,
    resetAt: now + 3600000, // 1 hour
  });

  return true;
};

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
