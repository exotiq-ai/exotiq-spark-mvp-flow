import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { safeAppOriginFromRequest } from "../_shared/appOrigin.ts";

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



    const { email, role, permissions, fullName }: InviteRequest = await req.json();
    const inviteeName = (fullName || "").trim() || null;

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

    // Check if email already has pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from("user_invitations")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      throw new Error("An invitation is already pending for this email");
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      throw new Error("A user with this email already exists");
    }

    // Create invitation with team_id
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("user_invitations")
      .insert({
        email,
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
      metadata: { invited_email: email, invitation_id: invitation.id },
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
    const emailResponse = await resend.emails.send({
      from: "Exotiq <noreply@mail.exotiq.ai>",
      to: [email],
      subject: `You've been invited to join ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: #fff; margin: 0; font-size: 28px;">You're Invited!</h1>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hi ${inviteeName || "there"},
          </p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> as a <strong>${role || "viewer"}</strong>.
          </p>
          
          <p style="font-size: 16px; margin-bottom: 30px;">
            Click the button below to accept your invitation and create your account:
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${inviteLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
          </p>
        </body>
        </html>
      `,
    });

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
