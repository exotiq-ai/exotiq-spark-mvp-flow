// @ts-nocheck
// TEMPORARY verification harness for the fleet-tools executor. Deleted after use.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { executeFunction } from '../_shared/fleet-tools/executor.ts';

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  if (body.token !== 'ephemeral-9f3a2c1d8b47e6social5') {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const result = await executeFunction(body.tool, body.args || {}, supabase, body.userId, body.teamId);
  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
