import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateRequest {
  token: string;
}

interface AcceptRequest {
  token: string;
  userId: string;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function notifyAdminsOfNewUser(
  supabaseAdmin: any,
  newUserEmail: string,
  newUserName: string,
  role: string,
  companyName: string
) {
  try {
    // Get all admin user IDs
    const { data: adminRoles, error: adminError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminError || !adminRoles?.length) {
      console.log("No admins found to notify");
      return;
    }

    // Get admin profiles
    const adminUserIds = adminRoles.map((r: any) => r.user_id);
    const { data: adminProfiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", adminUserIds);

    if (profilesError || !adminProfiles?.length) {
      console.log("No admin profiles found");
      return;
    }

    // Send email to each admin
    for (const admin of adminProfiles) {
      if (!RESEND_API_KEY) {
        console.log("RESEND_API_KEY not set, skipping email");
        continue;
      }

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "ExotIQ <notifications@exotiq.io>",
            to: [admin.email],
            subject: `New Team Member Joined: ${newUserName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">New Team Member Alert</h2>
                <p>Hi ${admin.full_name || 'Admin'},</p>
                <p>A new team member has joined ${companyName || 'your organization'}:</p>
                <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 4px 0;"><strong>Name:</strong> ${newUserName}</p>
                  <p style="margin: 4px 0;"><strong>Email:</strong> ${newUserEmail}</p>
                  <p style="margin: 4px 0;"><strong>Role:</strong> ${role}</p>
                </div>
                <p>You can view and manage team members in the Settings → User Management section.</p>
                <p style="color: #666; font-size: 12px; margin-top: 24px;">
                  This is an automated notification from ExotIQ Fleet Management.
                </p>
              </div>
            `,
          }),
        });
        console.log(`Admin notification sent to ${admin.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${admin.email}:`, emailError);
      }

      // Create in-app notification for admin
      await supabaseAdmin.from("notifications").insert({
        user_id: admin.id,
        type: "team_member_joined",
        title: "New Team Member Joined",
        message: `${newUserName} (${newUserEmail}) has joined as ${role}`,
        data: {
          new_user_email: newUserEmail,
          new_user_name: newUserName,
          role: role,
        },
      });
    }

    console.log(`Notified ${adminProfiles.length} admins about new user`);
  } catch (error) {
    console.error("Error notifying admins:", error);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "validate";

    if (action === "validate") {
      // Validate invitation token and return details
      const { token }: ValidateRequest = await req.json();

      if (!token) {
        throw new Error("Token is required");
      }

      console.log("Validating invitation token:", token.substring(0, 10) + "...");

      // Get invitation details
      const { data: invitation, error: inviteError } = await supabaseAdmin
        .from("user_invitations")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .single();

      if (inviteError || !invitation) {
        console.error("Invitation not found:", inviteError);
        throw new Error("Invalid or expired invitation");
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        // Mark as expired
        await supabaseAdmin
          .from("user_invitations")
          .update({ status: "expired" })
          .eq("id", invitation.id);
        throw new Error("This invitation has expired");
      }

      // Get inviter details
      const { data: inviterProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, company_name")
        .eq("id", invitation.invited_by)
        .single();

      // The org name must come from the invitation's TEAM, not the inviter's own
      // profile — a super admin inviting into another tenant would otherwise show
      // their own company name on the invite screen.
      let inviteTeamName: string | null = null;
      if (invitation.team_id) {
        const { data: inviteTeam } = await supabaseAdmin
          .from("teams")
          .select("name")
          .eq("id", invitation.team_id)
          .single();
        inviteTeamName = inviteTeam?.name ?? null;
      }

      console.log("Invitation valid for:", invitation.email);

      return new Response(
        JSON.stringify({
          valid: true,
          invitation: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            permissions: invitation.permissions,
            inviterName: inviterProfile?.full_name || "An administrator",
            companyName:
              inviteTeamName || inviterProfile?.company_name || "exotiq",
            expiresAt: invitation.expires_at,
          },
        }),

        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (action === "accept") {
      // Accept invitation - called after user signs up
      const { token, userId }: AcceptRequest = await req.json();

      if (!token || !userId) {
        throw new Error("Token and userId are required");
      }

      console.log("Accepting invitation for user:", userId);

      // Get invitation
      const { data: invitation, error: inviteError } = await supabaseAdmin
        .from("user_invitations")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .single();

      if (inviteError || !invitation) {
        console.error("Invitation not found:", inviteError);
        throw new Error("Invalid or expired invitation");
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error("This invitation has expired");
      }

      // Get inviter's company name (fallback only)
      const { data: inviterProfile } = await supabaseAdmin
        .from("profiles")
        .select("company_name")
        .eq("id", invitation.invited_by)
        .single();

      // Authoritative org name = the team on the invitation
      let acceptTeamName: string | null = null;
      if (invitation.team_id) {
        const { data: acceptTeam } = await supabaseAdmin
          .from("teams")
          .select("name")
          .eq("id", invitation.team_id)
          .single();
        acceptTeamName = acceptTeam?.name ?? null;
      }

      // Get new user's profile
      const { data: newUserProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();

      const companyName =
        acceptTeamName || inviterProfile?.company_name || "exotiq";

      const newUserName = newUserProfile?.full_name || invitation.email;
      const newUserEmail = newUserProfile?.email || invitation.email;

      // Update the new user's profile with company name and mark onboarding complete.
      // Pre-fill full_name from the invitation if the profile doesn't already have one.
      const profileUpdate: Record<string, unknown> = {
        company_name: companyName,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };
      const invitedFullName = (invitation.full_name || "").trim();
      if (invitedFullName && !newUserProfile?.full_name) {
        profileUpdate.full_name = invitedFullName;
      }

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);

      if (profileError) {
        console.error("Error updating profile:", profileError);
        throw new Error("Failed to update profile");
      }

      // Assign role to user
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role: invitation.role || "viewer",
          permissions: invitation.permissions || [],
          assigned_by: invitation.invited_by,
        });

      if (roleError) {
        console.error("Error assigning role:", roleError);
        // Don't throw - profile is already updated
      }

      // Create team membership for invited user
      if (invitation.team_id) {
        const { error: teamMemberError } = await supabaseAdmin
          .from("team_members")
          .insert({
            team_id: invitation.team_id,
            user_id: userId,
            role: invitation.role || "viewer",
            is_active: true,
            invited_by: invitation.invited_by,
            joined_at: new Date().toISOString(),
          });

        if (teamMemberError) {
          console.error("Error creating team membership:", teamMemberError);
          // Log but don't fail - role is already assigned
        } else {
          console.log("Team membership created for user:", userId, "in team:", invitation.team_id);
        }
      } else {
        console.warn("No team_id on invitation - user will not have team access");
      }

      // Mark invitation as accepted
      const { error: updateError } = await supabaseAdmin
        .from("user_invitations")
        .update({ status: "accepted" })
        .eq("id", invitation.id);

      if (updateError) {
        console.error("Error updating invitation:", updateError);
      }

      // Log to audit
      await supabaseAdmin.from("role_audit_log").insert({
        user_id: userId,
        changed_by: invitation.invited_by,
        action: "invitation_accepted",
        new_role: invitation.role || "viewer",
        new_permissions: invitation.permissions || [],
        metadata: {
          invitation_id: invitation.id,
          email: invitation.email,
        },
        team_id: invitation.team_id,
      });

      // Notify all admins about the new user
      await notifyAdminsOfNewUser(
        supabaseAdmin,
        newUserEmail,
        newUserName,
        invitation.role || "viewer",
        companyName
      );

      console.log("Invitation accepted successfully for:", invitation.email);

      return new Response(
        JSON.stringify({
          success: true,
          companyName: companyName,
          role: invitation.role,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (action === "claim") {
      // Claim any pending invitation matching the CALLER'S VERIFIED EMAIL.
      // Covers users who signed up through the normal form instead of the
      // invite link — without this they end up with no team at all.
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");
      const jwt = authHeader.replace("Bearer ", "");

      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
      const authedUser = userData?.user;
      if (userErr || !authedUser?.email) throw new Error("Unauthorized");

      const userId = authedUser.id;
      const email = authedUser.email.toLowerCase();

      // No-op if already on a team
      const { data: existingMembership } = await supabaseAdmin
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1);

      if (existingMembership && existingMembership.length > 0) {
        return new Response(JSON.stringify({ claimed: false, reason: "already_member" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: invites } = await supabaseAdmin
        .from("user_invitations")
        .select("*")
        .ilike("email", email)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const invitation = (invites ?? []).find(
        (i: any) => new Date(i.expires_at) > new Date() && i.team_id
      );

      if (!invitation) {
        return new Response(JSON.stringify({ claimed: false, reason: "no_pending_invite" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("name")
        .eq("id", invitation.team_id)
        .maybeSingle();

      await supabaseAdmin
        .from("profiles")
        .update({
          company_name: team?.name ?? undefined,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: invitation.role || "viewer",
        permissions: invitation.permissions || [],
        assigned_by: invitation.invited_by,
      });

      const { error: memberErr } = await supabaseAdmin.from("team_members").insert({
        team_id: invitation.team_id,
        user_id: userId,
        role: invitation.role || "viewer",
        is_active: true,
        invited_by: invitation.invited_by,
        joined_at: new Date().toISOString(),
      });
      if (memberErr) {
        console.error("claim: team_members insert failed", memberErr);
        throw new Error("Failed to join team");
      }

      await supabaseAdmin
        .from("user_invitations")
        .update({ status: "accepted" })
        .eq("id", invitation.id);

      await supabaseAdmin.from("role_audit_log").insert({
        user_id: userId,
        changed_by: invitation.invited_by,
        action: "invitation_claimed_by_email",
        new_role: invitation.role || "viewer",
        new_permissions: invitation.permissions || [],
        metadata: { invitation_id: invitation.id, email: invitation.email },
        team_id: invitation.team_id,
      });

      console.log("Invitation claimed by email for:", email);

      return new Response(
        JSON.stringify({
          claimed: true,
          companyName: team?.name ?? "your team",
          role: invitation.role,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      throw new Error("Invalid action");
    }

  } catch (error: any) {
    console.error("Error in accept-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
