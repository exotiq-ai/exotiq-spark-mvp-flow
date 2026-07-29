import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRequest {
  invitation_id: string;
  app_origin?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    // Verify caller is a super admin
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: superAdmin, error: superAdminError } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (superAdminError) {
      console.error("super_admins lookup failed:", superAdminError);
      throw new Error("Permission check failed");
    }
    if (!superAdmin) throw new Error("Only super admins can call this function");

    const { invitation_id, app_origin }: SendRequest = await req.json();
    if (!invitation_id) throw new Error("invitation_id is required");

    const { data: invitation, error: invError } = await supabaseAdmin
      .from("user_invitations")
      .select("*")
      .eq("id", invitation_id)
      .single();

    if (invError || !invitation) {
      console.error("Invitation lookup failed:", invError);
      throw new Error("Invitation not found");
    }

    // Resolve team name for subject/body
    let teamName = "Exotiq";
    if (invitation.team_id) {
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("name")
        .eq("id", invitation.team_id)
        .single();
      if (team?.name) teamName = team.name;
    }

    // Resolve inviter display name
    let inviterName = "Your team";
    if (invitation.invited_by) {
      const { data: inviterProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", invitation.invited_by)
        .single();
      if (inviterProfile?.full_name) inviterName = inviterProfile.full_name;
    }

    const inviteeName = (invitation.full_name || "").trim() || null;
    const origin = (app_origin && app_origin.startsWith("http"))
      ? app_origin.replace(/\/+$/, "")
      : "https://app.exotiq.ai";
    const inviteLink = `${origin}/auth?invite=${invitation.token}`;
    const role = invitation.role || "viewer";

    const emailResponse = await resend.emails.send({
      from: "Exotiq <noreply@mail.exotiq.ai>",
      to: [invitation.email],
      subject: `You've been invited to join ${teamName}`,
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
            <strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> as a <strong>${role}</strong>.
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
            &copy; ${new Date().getFullYear()} ${teamName}. All rights reserved.
          </p>
        </body>
        </html>
      `,
    });

    console.log("super-admin invite email sent:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          team_id: invitation.team_id,
          team_name: teamName,
          role,
        },
        email: emailResponse,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("super-admin-send-invite error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
