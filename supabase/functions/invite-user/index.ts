import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: string;
  permissions: string[];
}

// Role hierarchy - higher number = more permissions
const roleHierarchy: Record<string, number> = {
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
    const { data: inviterRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !inviterRole) {
      console.error("Role check failed:", roleError);
      throw new Error("You don't have permission to invite users");
    }

    const inviterRoleLevel = roleHierarchy[inviterRole.role] || 0;
    
    // Only admins and managers can invite users
    if (inviterRoleLevel < roleHierarchy.manager) {
      throw new Error("Only admins and managers can invite users");
    }

    // Get inviter's team_id from team_members
    const { data: inviterTeam, error: teamError } = await supabaseAdmin
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (teamError || !inviterTeam?.team_id) {
      console.error("Team lookup failed:", teamError);
      throw new Error("Could not determine your team. Please contact support.");
    }

    const { email, role, permissions }: InviteRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    const targetRoleLevel = roleHierarchy[role] || 1;

    // Managers can only invite operators and viewers (roles below them)
    if (inviterRole.role === "manager") {
      if (targetRoleLevel >= roleHierarchy.manager) {
        throw new Error("Managers can only invite operators and viewers");
      }
    }

    // Non-admins cannot invite admins
    if (role === "admin" && inviterRole.role !== "admin") {
      throw new Error("Only admins can invite other admins");
    }

    // Generate secure invitation token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();

    // Check if email already has pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from("user_invitations")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      throw new Error("An invitation is already pending for this email");
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

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
    const companyName = inviterProfile?.company_name || "Exotiq";

    // Get the app URL from the request origin or use a default
    const origin = req.headers.get("origin") || "https://exotiq.ai";
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
            Hi there,
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
