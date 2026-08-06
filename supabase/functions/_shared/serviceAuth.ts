// Shared auth guard for service/cron edge functions.
//
// These functions run with the service role key, so they must never be
// callable by an anonymous caller. Accept either:
//   1. A valid cron token header (server-side pg_cron / scheduler), or
//   2. A valid Supabase user JWT (manual trigger from the app).
//
// Usage:
//   const auth = await requireServiceOrUser(req);
//   if (!auth.ok) return auth.response(corsHeaders);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ServiceAuthResult {
  ok: boolean;
  /** True when authenticated via the shared cron token. */
  isCron: boolean;
  /** Present when authenticated via a user JWT. */
  userId: string | null;
  response: (corsHeaders: Record<string, string>) => Response;
}

const deny = (status: number, error: string): ServiceAuthResult => ({
  ok: false,
  isCron: false,
  userId: null,
  response: (corsHeaders: Record<string, string>) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
});

const allow = (isCron: boolean, userId: string | null): ServiceAuthResult => ({
  ok: true,
  isCron,
  userId,
  response: () => new Response(null, { status: 204 }),
});

export async function requireServiceOrUser(req: Request): Promise<ServiceAuthResult> {
  const cronToken = Deno.env.get("CRON_TRIGGER_TOKEN");
  const headerToken = req.headers.get("x-cron-token");
  if (cronToken && headerToken && headerToken === cronToken) {
    return allow(true, null);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return deny(401, "Unauthorized");

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data, error } = await anonClient.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (error || !data.user) return deny(401, "Unauthorized");

  return allow(false, data.user.id);
}

/** Cron-token-only guard for functions with no legitimate user-triggered path. */
export function requireCronToken(req: Request): ServiceAuthResult {
  const cronToken = Deno.env.get("CRON_TRIGGER_TOKEN");
  if (!cronToken) return deny(503, "Scheduler token not configured");
  const headerToken = req.headers.get("x-cron-token");
  if (!headerToken || headerToken !== cronToken) return deny(401, "Unauthorized");
  return allow(true, null);
}
