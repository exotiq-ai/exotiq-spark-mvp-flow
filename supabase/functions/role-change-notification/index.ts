import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RoleChangeRequest {
  userId: string;
  oldRole: string;
  newRole: string;
  oldPermissions: string[];
  newPermissions: string[];
  changedBy: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  manager: "Manager", 
  operator: "Operator",
  viewer: "Viewer",
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

    // Get current user (admin making the change)
    const { data: { user: adminUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !adminUser) {
      throw new Error("Unauthorized");
    }

    // Create admin client for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: adminUser.id,
      _role: "admin",
    });

    if (!isAdmin) {
      throw new Error("Only admins can trigger role change notifications");
    }

    const { userId, oldRole, newRole, oldPermissions, newPermissions, changedBy }: RoleChangeRequest = await req.json();

    if (!userId || !newRole) {
      throw new Error("User ID and new role are required");
    }

    // Get the affected user's profile
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, company_name")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      console.error("Failed to fetch user profile:", profileError);
      throw new Error("User not found");
    }

    // Get the admin's profile who made the change
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", changedBy)
      .single();

    const adminName = adminProfile?.full_name || "An administrator";
    const companyName = userProfile.company_name || "Exotiq";
    const userName = userProfile.full_name || "Team Member";

    const oldRoleLabel = ROLE_LABELS[oldRole] || oldRole;
    const newRoleLabel = ROLE_LABELS[newRole] || newRole;

    // Determine if this is a promotion or demotion
    const roleHierarchy: Record<string, number> = { admin: 4, manager: 3, operator: 2, viewer: 1 };
    const isPromotion = (roleHierarchy[newRole] || 0) > (roleHierarchy[oldRole] || 0);
    const changeType = isPromotion ? "promoted" : "updated";

    // Send notification email to the affected user
    const emailResponse = await resend.emails.send({
      from: "Exotiq <noreply@mail.exotiq.ai>",
      to: [userProfile.email],
      subject: `Your role has been ${changeType} at ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, ${isPromotion ? '#10b981' : '#6366f1'} 0%, ${isPromotion ? '#059669' : '#4f46e5'} 100%); padding: 40px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: #fff; margin: 0; font-size: 28px;">
              ${isPromotion ? '🎉 Congratulations!' : '📋 Role Update'}
            </h1>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hi ${userName},
          </p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            ${isPromotion 
              ? `Great news! <strong>${adminName}</strong> has promoted you to a new role.`
              : `<strong>${adminName}</strong> has updated your role in ${companyName}.`
            }
          </p>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Previous Role:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${oldRoleLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">New Role:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; color: ${isPromotion ? '#10b981' : '#6366f1'};">${newRoleLabel}</td>
              </tr>
            </table>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Your new permissions are now active. Log in to see your updated access.
          </p>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            If you have any questions about your new role, please contact your administrator.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
          </p>
        </body>
        </html>
      `,
    });

    console.log("Role change notification sent:", emailResponse);

    // Create in-app notification
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: "role_change",
      title: isPromotion ? "You've been promoted!" : "Your role has been updated",
      message: `Your role has been changed from ${oldRoleLabel} to ${newRoleLabel}`,
      data: {
        old_role: oldRole,
        new_role: newRole,
        changed_by: changedBy,
        changed_by_name: adminName,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Role change notification sent" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in role-change-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
