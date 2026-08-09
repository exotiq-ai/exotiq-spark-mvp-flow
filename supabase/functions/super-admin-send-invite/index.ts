import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { safeAppOrigin } from "../_shared/appOrigin.ts";
import { buildInviteEmail } from "../_shared/invite-email.ts";

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Allow direct service-role invocation (used by tooling); otherwise require
    // that the caller's JWT belongs to a super admin.
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isServiceRole = bearer === supabaseServiceKey;

    if (!isServiceRole) {
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) throw new Error("Unauthorized");

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
    }

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
    const origin = safeAppOrigin(app_origin);
    const inviteLink = `${origin}/auth?invite=${invitation.token}`;
    const role = invitation.role || "viewer";

    const inviteEmail = buildInviteEmail({
      companyName: teamName,
      inviterName,
      role,
      inviteLink,
    });

    const emailResponse = await resend.emails.send({
      from: "exotiq <noreply@mail.exotiq.ai>",
      to: [invitation.email],
      subject: inviteEmail.subject,
      html: inviteEmail.html,
      text: inviteEmail.text,
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
