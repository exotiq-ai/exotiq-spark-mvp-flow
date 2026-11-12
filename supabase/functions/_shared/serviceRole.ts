// Is this bearer the project's service-role key?
//
// A raw string compare against SUPABASE_SERVICE_ROLE_KEY is not reliable: the value the platform injects into
// a function can be a different JWT from the one the dashboard/CLI issues for the same project (seen on the
// rehearsal project, 2026-11-01: a valid service key was refused with 401). So: read the role claim, and prove
// it by making one privileged call with the key itself. A user JWT or the anon key fails that call.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function roleClaim(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "="));
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

export async function isServiceRoleBearer(jwt: string): Promise<boolean> {
  if (!jwt) return false;
  if (jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true;
  if (roleClaim(jwt) !== "service_role") return false;
  const probe = createClient(Deno.env.get("SUPABASE_URL")!, jwt, { auth: { persistSession: false } });
  const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 });
  return !error;
}
