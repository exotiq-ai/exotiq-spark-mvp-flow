// Resolve the signed-in user behind a request, and check team ownership.
//
// Usage:
//   const session = await requireSessionUser(req, admin);
//   if (!session.ok) return session.response(corsHeaders);
//   if (!(await isTeamOwnerOfRecord(admin, session.userId, teamId))) { ...403... }
//
// `admin` is a service-role client. The user id and email returned here come
// from the verified session token; request bodies are never consulted.

// A service-role client. Typed loosely because callers pin different supabase-js versions.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export type SessionUserResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: (corsHeaders: Record<string, string>) => Response };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const unauthorized: SessionUserResult = {
  ok: false,
  response: (corsHeaders: Record<string, string>) =>
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
};

export async function requireSessionUser(req: Request, admin: AdminClient): Promise<SessionUserResult> {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const jwt = match ? match[1].trim() : "";
  if (!jwt) return unauthorized;

  const { data, error } = await admin.auth.getUser(jwt);
  const user = data?.user;
  if (error || !user?.id || !user.email) return unauthorized;

  return { ok: true, userId: user.id, email: user.email };
}

/** True when the user holds an active owner membership of the team. */
export async function isActiveTeamOwner(admin: AdminClient, userId: string, teamId: string): Promise<boolean> {
  if (!isUuid(userId) || !isUuid(teamId)) return false;
  const { data, error } = await admin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("[callerSession] owner lookup failed:", error.message ?? error);
    return false;
  }
  return Boolean(data);
}

/**
 * True when the user is the team's owner of record: the team row names them
 * as owner, the team is not deleted, and they hold an active owner membership.
 */
export async function isTeamOwnerOfRecord(admin: AdminClient, userId: string, teamId: string): Promise<boolean> {
  if (!(await isActiveTeamOwner(admin, userId, teamId))) return false;
  const { data, error } = await admin
    .from("teams")
    .select("id, owner_id, is_deleted")
    .eq("id", teamId)
    .maybeSingle();
  if (error) {
    console.error("[callerSession] team lookup failed:", error.message ?? error);
    return false;
  }
  return Boolean(data) && data.owner_id === userId && data.is_deleted !== true;
}

/** True when the user is a platform administrator. Any lookup failure counts as true. */
export async function isPlatformAdmin(admin: AdminClient, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return true;
  const { data, error } = await admin.rpc("is_super_admin", { check_user_id: userId });
  if (error) {
    console.error("[callerSession] platform role lookup failed:", error.message ?? error);
    return true;
  }
  return data !== false;
}

/**
 * Keyed digest of a one-time token, bound to the team and the user it was issued to.
 * Only the digest is stored; the token itself is sent to the user and never kept.
 */
export async function oneTimeTokenDigest(token: string, teamId: string, userId: string): Promise<string> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!secret) throw new Error("Server key is not configured");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(["one-time-token", teamId, userId, token].join("\n")));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  return `v1:${hex}`;
}
