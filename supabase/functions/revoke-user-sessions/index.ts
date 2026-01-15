import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client with the user's JWT to verify they're authenticated
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the calling user is authenticated
    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callingUser) {
      throw new Error('Unauthorized: Invalid token');
    }

    // Parse the request body
    const { target_user_id } = await req.json();
    if (!target_user_id) {
      throw new Error('target_user_id is required');
    }

    // Use service role client to check if calling user is an admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if calling user has admin role using the has_role function
    const { data: hasAdminRole, error: roleError } = await adminClient.rpc('has_role', {
      _user_id: callingUser.id,
      _role: 'admin'
    });

    if (roleError) {
      console.error('Error checking admin role:', roleError);
      throw new Error('Failed to verify admin permissions');
    }

    if (!hasAdminRole) {
      throw new Error('Unauthorized: Admin role required');
    }

    // Prevent self-deactivation session revocation
    if (target_user_id === callingUser.id) {
      throw new Error('Cannot revoke your own sessions');
    }

    // Use admin API to sign out the target user globally
    const { error: signOutError } = await adminClient.auth.admin.signOut(
      target_user_id,
      { scope: 'global' }
    );

    if (signOutError) {
      console.error('Error revoking sessions:', signOutError);
      throw new Error('Failed to revoke user sessions');
    }

    console.log(`Successfully revoked all sessions for user: ${target_user_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All user sessions have been revoked' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in revoke-user-sessions:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message?.includes('Unauthorized') ? 403 : 400 
      }
    );
  }
});
