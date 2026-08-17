import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { safeAppOriginFromRequest } from "../_shared/appOrigin.ts";
import { buildInviteEmail } from "../_shared/invite-email.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: string;
  permissions: string[];
  fullName?: string;
}

// Role hierarchy - higher number = more permissions
const roleHierarchy: Record<string, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  operator: 2,
  viewer: 1,
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Create admin client for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get inviter's role
    const { data: inviterRoles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError || !inviterRoles || inviterRoles.length === 0) {
      console.error("Role check failed:", roleError);
      throw new Error("You don't have permission to invite users");
    }

    // Use the highest role the inviter holds
    const inviterRoleName = inviterRoles
      .map((r: { role: string }) => r.role)
      .sort((a: string, b: string) => (roleHierarchy[b] || 0) - (roleHierarchy[a] || 0))[0];
    const inviterRoleLevel = roleHierarchy[inviterRoleName] || 0;

    // Only owners, admins and managers can invite users
    if (inviterRoleLevel < roleHierarchy.manager) {
      throw new Error("Only owners, admins and managers can invite users");
    }

    // Resolve the team the invite belongs to.
    // If the caller is a super admin inside an active support session, the
    // grant is the source of truth so the invite can never land on the wrong
    // tenant. Otherwise fall back to their active membership.
    let inviterTeamId: string | undefined;

    const { data: activeGrant } = await supabaseAdmin
      .from("support_access_grants")
      .select("team_id, expires_at")
      .eq("admin_user_id", user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("granted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeGrant?.team_id) {
      inviterTeamId = activeGrant.team_id as string;
      console.log("Support session active — inviting into tenant", inviterTeamId);
    }

    if (!inviterTeamId) {
      const { data: inviterTeams, error: teamError } = await supabaseAdmin
        .from("team_members")
        .select("team_id, joined_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("joined_at", { ascending: true })
        .limit(1);

      if (teamError) {
        console.error("Team lookup failed:", teamError);
        throw new Error(`Could not determine your team: ${teamError.message}`);
      }
      inviterTeamId = inviterTeams?.[0]?.team_id;
    }

    if (!inviterTeamId) {
      throw new Error("You are not an active member of any account, so there is no team to invite into.");
    }
    const inviterTeam = { team_id: inviterTeamId };



    const payload = await req.json();
    const { email, role, permissions, fullName }: InviteRequest = payload;
    const resendId: string | undefined = payload?.resendId;
    const inviteeName = (fullName || "").trim() || null;

    // Resend path: re-deliver an existing pending invitation for this account.
    if (resendId) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("user_invitations")
        .select("id, email, role, token, team_id, status")
        .eq("id", resendId)
        .eq("team_id", inviterTeam.team_id)
        .maybeSingle();

      if (existingError || !existing) {
        throw new Error("That invitation could not be found on this account");
      }
      if (existing.status !== "pending") {
        throw new Error("That invitation is no longer pending");
      }

      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from("user_invitations")
        .update({ expires_at: newExpiry })
        .eq("id", existing.id);

      const { data: resendTeam } = await supabaseAdmin
        .from("teams")
        .select("name")
        .eq("id", inviterTeam.team_id)
        .maybeSingle();

      const { data: resendProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const resendLink = `${safeAppOriginFromRequest(req)}/auth?invite=${existing.token}`;
      const resendEmailBody = buildInviteEmail({
        companyName: resendTeam?.name || "Exotiq",
        inviterName: resendProfile?.full_name || "Your team",
        role: existing.role || "viewer",
        inviteLink: resendLink,
      });

      const resendResponse = await resend.emails.send({
        from: "exotiq <noreply@mail.exotiq.ai>",
        to: [existing.email],
        subject: resendEmailBody.subject,
        html: resendEmailBody.html,
        text: resendEmailBody.text,
      });

      if (resendResponse.error) {
        console.error("Resend delivery failed:", resendResponse.error);
        throw new Error(`Could not deliver the email: ${resendResponse.error.message}`);
      }

      return new Response(
        JSON.stringify({ success: true, resent: true, invitation: { id: existing.id, email: existing.email, expires_at: newExpiry } }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!email) {
      throw new Error("Email is required");
    }


    const targetRoleLevel = roleHierarchy[role] || 1;

    // Nobody can invite someone at or above their own level (owners excepted)
    if (inviterRoleName === "manager" && targetRoleLevel >= roleHierarchy.manager) {
      throw new Error("Managers can only invite operators and viewers");
    }

    if (inviterRoleName !== "owner" && targetRoleLevel > inviterRoleLevel) {
      throw new Error("You cannot invite a user with more permissions than you");
    }


    // Generate secure invitation token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();

    const normalizedEmail = email.trim().toLowerCase();

    // Pending invitation check is scoped to THIS account — the same person can
    // legitimately be invited into more than one tenant.
    const { data: existingInvites } = await supabaseAdmin
      .from("user_invitations")
      .select("id, expires_at")
      .ilike("email", normalizedEmail)
      .eq("status", "pending")
      .eq("team_id", inviterTeam.team_id);

    const livePending = (existingInvites ?? []).find(
      (i: { expires_at: string }) => new Date(i.expires_at) > new Date(),
    );
    if (livePending) {
      throw new Error("An invitation is already pending for this email on this account");
    }

    // An existing Exotiq user can still be invited — they just accept while
    // signed in instead of creating an account. Only block if they are already
    // an active member of THIS account.
    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      const { data: existingMembership } = await supabaseAdmin
        .from("team_members")
        .select("id, is_active")
        .eq("user_id", existingUser.id)
        .eq("team_id", inviterTeam.team_id)
        .maybeSingle();

      if (existingMembership?.is_active) {
        throw new Error("This person is already a member of this account");
      }
    }

    // Create invitation with team_id
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("user_invitations")
      .insert({
        email: normalizedEmail,
        invited_by: user.id,
        role: role || "viewer",
        permissions: permissions || [],
        token,
        status: "pending",
        team_id: inviterTeam.team_id,
        full_name: inviteeName,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Failed to create invitation:", inviteError);
      throw new Error("Failed to create invitation");
    }

    // Log to audit
    await supabaseAdmin.from("role_audit_log").insert({
      user_id: user.id,
      changed_by: user.id,
      action: "user_invited",
      new_role: role || "viewer",
      new_permissions: permissions || [],
      metadata: { invited_email: normalizedEmail, invitation_id: invitation.id },
      team_id: inviterTeam.team_id,
    });

    // Get inviter's profile for email
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, company_name")
      .eq("id", user.id)
      .single();

    const inviterName = inviterProfile?.full_name || "Your team";

    // The recipient should see the account they are joining, not the inviter's
    // own company (which differs during a support session).
    const { data: inviteTeam } = await supabaseAdmin
      .from("teams")
      .select("name")
      .eq("id", inviterTeam.team_id)
      .maybeSingle();
    const companyName = inviteTeam?.name || inviterProfile?.company_name || "Exotiq";


    // Invite links must always point at an Exotiq-owned domain — never at the
    // sender's browser origin, which may be a build-preview URL.
    const origin = safeAppOriginFromRequest(req);
    const inviteLink = `${origin}/auth?invite=${token}`;

    // Send invitation email
    const inviteEmail = buildInviteEmail({
      companyName,
      inviterName,
      role: role || "viewer",
      inviteLink,
    });

    const emailResponse = await resend.emails.send({
      from: "exotiq <noreply@mail.exotiq.ai>",
      to: [normalizedEmail],
      subject: inviteEmail.subject,
      html: inviteEmail.html,
      text: inviteEmail.text,
    });

    if (emailResponse.error) {
      console.error("Invite email delivery failed:", emailResponse.error);
      throw new Error(`Invitation created, but the email could not be delivered: ${emailResponse.error.message}`);
    }

    console.log("Email sent successfully:", emailResponse);


    return new Response(
      JSON.stringify({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expires_at: invitation.expires_at,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
