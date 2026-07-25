// Persistent, cross-isolate rate limiter for anonymous rent endpoints.
// Replaces the per-isolate `Map` limiter that never enforced across
// serverless restarts. Backed by public.check_rate_limit() + the
// public.rate_limit_counters table.
//
// Fails OPEN on RPC error (logged) so a DB blip cannot break checkout,
// but succeeds under normal operation to enforce the caller's cap.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

let cachedAdmin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (!cachedAdmin) {
    cachedAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
  }
  return cachedAdmin;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Returns true when the request is within the limit, false when it should be
 * rejected with 429. `bucket` should be `"<fn-name>:<ip>"`.
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await admin().rpc("check_rate_limit", {
      _bucket: bucket,
      _limit: limit,
      _window_seconds: windowSeconds,
    });
    if (error) {
      console.warn("[rateLimit] rpc error, failing open", { bucket, error: error.message });
      return true;
    }
    return data === true;
  } catch (err) {
    console.warn("[rateLimit] threw, failing open", {
      bucket,
      err: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}

/**
 * Optional Cloudflare Turnstile verification for anonymous booking creation.
 * Active only when CLOUDFLARE_TURNSTILE_SECRET is set. Returns true when
 * verification passes (or when the secret is unset so it is a no-op until the
 * renter web app ships the widget).
 */
export async function verifyTurnstile(
  token: string | undefined,
  remoteIp: string,
): Promise<{ ok: boolean; reason?: string }> {
  const secret = Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET");
  if (!secret) return { ok: true }; // not enforced yet
  if (!token) return { ok: false, reason: "missing_turnstile_token" };

  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: remoteIp });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const json = await res.json().catch(() => ({}));
    if (json?.success) return { ok: true };
    return { ok: false, reason: "turnstile_failed" };
  } catch (err) {
    console.warn("[turnstile] verify threw", {
      err: err instanceof Error ? err.message : String(err),
    });
    // Fail open on network blip; upstream logs will surface it.
    return { ok: true };
  }
}
