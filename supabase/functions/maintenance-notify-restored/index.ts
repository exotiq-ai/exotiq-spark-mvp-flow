// Minimal stub: notification for restored service.
// Reads notify subscribers for a window and would enqueue emails via the
// transactional email pipeline once configured. Safe to invoke today —
// it stamps notified_at so the queue isn't reprocessed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { window_id } = await req.json();
    if (!window_id || typeof window_id !== 'string') {
      return new Response(JSON.stringify({ error: 'window_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Authenticate caller — must be super admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await supabase.rpc('is_super_admin', { check_user_id: userData.user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subscribers, error } = await supabase
      .from('maintenance_notify_subscribers')
      .select('id, email')
      .eq('window_id', window_id)
      .is('notified_at', null);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    let notified = 0;

    for (const sub of subscribers ?? []) {
      // Try the transactional email pipeline if it's configured.
      // It's safe to fail silently — we still mark notified to avoid loops.
      try {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'maintenance-restored',
            recipientEmail: sub.email,
            idempotencyKey: `maintenance-restored-${window_id}-${sub.id}`,
          },
        });
      } catch (_e) {
        // pipeline may not be configured yet — continue
      }
      await supabase
        .from('maintenance_notify_subscribers')
        .update({ notified_at: now })
        .eq('id', sub.id);
      notified += 1;
    }

    return new Response(JSON.stringify({ ok: true, notified }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
