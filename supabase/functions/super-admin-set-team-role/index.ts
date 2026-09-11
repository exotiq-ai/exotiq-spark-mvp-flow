import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES = ["owner", "admin", "manager", "operator", "viewer"] as const;
type Role = (typeof ROLES)[number];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    let actorId: string | null = null;
    let actorEmail: string | null = null;

    if (bearer !== serviceKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return json({ error: "Unauthorized" }, 401);

      const { data: superAdmin, error: saError } = await admin
        .from("super_admins")
        .select("user_id, email, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (saError) {
        console.error("super_admins lookup failed", saError);
        return json({ error: "Permission check failed" }, 500);
      }
      if (!superAdmin || superAdmin.is_active === false) {
        return json({ error: "Only super admins can call this function" }, 403);
      }
      actorId = user.id;
      actorEmail = superAdmin.email ?? user.email ?? null;
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "list";
    const teamId: string | undefined = body?.team_id;

    if (!teamId || typeof teamId !== "string") {
      return json({ error: "team_id is required" }, 400);
    }

    // ---------- list members + pending invites ----------
    if (action === "list") {
      const [{ data: members, error: mErr }, { data: invites, error: iErr }] = await Promise.all([
        admin
          .from("team_members")
          .select("user_id, role, is_active, joined_at")
          .eq("team_id", teamId),
        admin
          .from("user_invitations")
          .select("id, email, role, status, expires_at, created_at")
          .eq("team_id", teamId)
          .eq("status", "pending"),
      ]);
      if (mErr) throw mErr;
      if (iErr) throw iErr;

      const ids = (members ?? []).map((m) => m.user_id);
      let profiles: Record<string, { full_name: string | null; email: string | null }> = {};
      if (ids.length) {
        const { data: profileRows, error: pErr } = await admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        if (pErr) throw pErr;
        profiles = Object.fromEntries(
          (profileRows ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]),
        );
      }

      return json({
        members: (members ?? []).map((m) => ({
          user_id: m.user_id,
          role: m.role,
          is_active: m.is_active !== false,
          joined_at: m.joined_at,
          full_name: profiles[m.user_id]?.full_name ?? null,
          email: profiles[m.user_id]?.email ?? null,
        })),
        invitations: invites ?? [],
      });
    }

    // ---------- change a member's role ----------
    if (action === "set_role") {
      const userId: string | undefined = body?.user_id;
      const newRole: Role | undefined = body?.role;
      if (!userId || typeof userId !== "string") return json({ error: "user_id is required" }, 400);
      if (!newRole || !ROLES.includes(newRole)) return json({ error: "Invalid role" }, 400);

      const { data: current, error: curErr } = await admin
        .from("team_members")
        .select("id, role, is_active")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .maybeSingle();
      if (curErr) throw curErr;
      if (!current) return json({ error: "That person is not a member of this workspace" }, 404);
      if (current.role === newRole) return json({ success: true, unchanged: true });

      // Never leave a workspace without an active owner.
      if (current.role === "owner" && newRole !== "owner") {
        const { count, error: cErr } = await admin
          .from("team_members")
          .select("id", { count: "exact", head: true })
          .eq("team_id", teamId)
          .eq("role", "owner")
          .eq("is_active", true);
        if (cErr) throw cErr;
        if ((count ?? 0) <= 1) {
          return json(
            { error: "This is the only owner. Promote someone else to owner first." },
            409,
          );
        }
      }

      const { error: updErr } = await admin
        .from("team_members")
        .update({ role: newRole })
        .eq("id", current.id);
      if (updErr) throw updErr;

      // Keep the legacy global role table in sync when this is the user's only workspace.
      const { data: otherTeams, error: otErr } = await admin
        .from("team_members")
        .select("id")
        .eq("user_id", userId)
        .neq("team_id", teamId)
        .limit(1);
      if (otErr) throw otErr;
      if (!otherTeams || otherTeams.length === 0) {
        const legacyRole = newRole === "owner" ? "admin" : newRole;
        const { data: existingRole } = await admin
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (existingRole) {
          await admin.from("user_roles").update({ role: legacyRole }).eq("id", existingRole.id);
        } else {
          await admin
            .from("user_roles")
            .insert({ user_id: userId, role: legacyRole, assigned_by: actorId });
        }
      }

      await admin.from("role_audit_log").insert({
        user_id: userId,
        changed_by: actorId,
        team_id: teamId,
        action: "super_admin_role_change",
        old_role: current.role,
        new_role: newRole,
        metadata: { actor_email: actorEmail, source: "super_admin_portal" },
      });

      console.log(
        `[super-admin-set-team-role] ${actorEmail ?? "service"} set ${userId} -> ${newRole} on team ${teamId}`,
      );

      return json({ success: true, role: newRole });
    }

    // ---------- invite someone who has no account yet ----------
    if (action === "invite") {
      const email: string = (body?.email ?? "").trim().toLowerCase();
      const inviteRole: Role = ROLES.includes(body?.role) ? body.role : "owner";
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ error: "A valid email address is required" }, 400);
      }

      const { data: existingInvite } = await admin
        .from("user_invitations")
        .select("id")
        .eq("team_id", teamId)
        .eq("email", email)
        .eq("status", "pending")
        .maybeSingle();

      let invitationId = existingInvite?.id as string | undefined;

      if (invitationId) {
        await admin
          .from("user_invitations")
          .update({
            role: inviteRole,
            expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
          })
          .eq("id", invitationId);
      } else {
        const { data: inserted, error: insErr } = await admin
          .from("user_invitations")
          .insert({
            team_id: teamId,
            email,
            role: inviteRole,
            status: "pending",
            token: crypto.randomUUID(),
            invited_by: actorId,
            expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        invitationId = inserted.id;
      }

      const sendRes = await fetch(`${supabaseUrl}/functions/v1/super-admin-send-invite`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invitation_id: invitationId, app_origin: body?.app_origin }),
      });
      const sendBody = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok) {
        console.error("[super-admin-set-team-role] invite email failed", sendBody);
        return json({ error: "Invitation saved but the email could not be sent" }, 502);
      }

      await admin.from("role_audit_log").insert({
        user_id: actorId,
        changed_by: actorId,
        team_id: teamId,
        action: "super_admin_invite_sent",
        new_role: inviteRole,
        metadata: { actor_email: actorEmail, invited_email: email, source: "super_admin_portal" },
      });

      return json({ success: true, invitation_id: invitationId });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[super-admin-set-team-role] error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
