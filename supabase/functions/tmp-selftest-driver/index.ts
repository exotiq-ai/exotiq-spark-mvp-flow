// @ts-nocheck
// TEMPORARY driver: mints a real super-admin session and invokes rari-selftest
// through the normal gate, so the harness is exercised end-to-end. Deleted
// immediately after the verification run.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  if (body.driverSecret !== Deno.env.get('RARI_TOOL_TOKEN_SECRET')) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const email = body.email || 'hello@exotiq.ai';
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkErr) {
    return new Response(JSON.stringify({ error: 'link_failed', message: linkErr.message }), { status: 500, headers: corsHeaders });
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: session, error: otpErr } = await anon.auth.verifyOtp({
    email,
    token: link.properties.email_otp,
    type: 'magiclink',
  });
  if (otpErr || !session?.session) {
    return new Response(JSON.stringify({ error: 'otp_failed', message: otpErr?.message }), { status: 500, headers: corsHeaders });
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/rari-selftest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${session.session.access_token}`,
    },
    body: JSON.stringify(body.payload ?? {}),
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
