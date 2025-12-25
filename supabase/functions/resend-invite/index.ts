import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendRequest {
  invitationId: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    console.log("Starting resend-invite function");

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error("No authorization header");
    }

    // Create client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("User auth failed:", userError);
      throw new Error("Unauthorized");
    }

    console.log("User authenticated:", user.id);

    // Create admin client for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin using the has_role function
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      console.error("Role check failed:", roleError);
      throw new Error("Only admins can resend invitations");
    }

    const { invitationId }: ResendRequest = await req.json();

    if (!invitationId) {
      throw new Error("Invitation ID is required");
    }

    console.log("Processing invitation:", invitationId);

    // Get the existing invitation
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from("user_invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (fetchError || !invitation) {
      console.error("Failed to fetch invitation:", fetchError);
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error(`Cannot resend invitation with status: ${invitation.status}`);
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < now) {
      // Invitation expired, generate new token and extend expiry
      console.log("Invitation expired, generating new token");
    }

    // Generate new secure token for security
    const newToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7); // Extend by 7 days

    // Update invitation with new token and expiry
    const { error: updateError } = await supabaseAdmin
      .from("user_invitations")
      .update({
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
      })
      .eq("id", invitationId);

    if (updateError) {
      console.error("Failed to update invitation:", updateError);
      throw new Error("Failed to update invitation");
    }

    // Log to audit
    await supabaseAdmin.from("role_audit_log").insert({
      user_id: user.id,
      changed_by: user.id,
      action: "invitation_resent",
      metadata: { 
        invitation_id: invitationId, 
        invited_email: invitation.email,
        new_expires_at: newExpiresAt.toISOString()
      },
    });

    // Get inviter's profile for email
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, company_name")
      .eq("id", user.id)
      .single();

    const inviterName = inviterProfile?.full_name || "An administrator";
    const companyName = inviterProfile?.company_name || "Exotiq";

    // Get the app URL from the request origin or use a default
    const origin = req.headers.get("origin") || "https://exotiq.ai";
    const inviteLink = `${origin}/auth?invite=${newToken}`;

    console.log("Sending email to:", invitation.email);

    // Send invitation email
    const emailResponse = await resend.emails.send({
      from: "Exotiq <noreply@mail.exotiq.ai>",
      to: [invitation.email],
      subject: `Reminder: You've been invited to join ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: #fff; margin: 0; font-size: 28px;">Reminder: You're Invited!</h1>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hi there,
          </p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            This is a reminder that <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> as a <strong>${invitation.role || "viewer"}</strong>.
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
        message: "Invitation resent successfully",
        invitation: {
          id: invitationId,
          email: invitation.email,
          expires_at: newExpiresAt.toISOString(),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in resend-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
