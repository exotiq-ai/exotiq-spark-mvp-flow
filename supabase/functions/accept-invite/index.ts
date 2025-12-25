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
            companyName: inviterProfile?.company_name || "ExotIQ",
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

      // Get inviter's company name
      const { data: inviterProfile } = await supabaseAdmin
        .from("profiles")
        .select("company_name")
        .eq("id", invitation.invited_by)
        .single();

      // Update the new user's profile with company name and mark onboarding complete
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          company_name: inviterProfile?.company_name || null,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
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
      });

      console.log("Invitation accepted successfully for:", invitation.email);

      return new Response(
        JSON.stringify({
          success: true,
          companyName: inviterProfile?.company_name,
          role: invitation.role,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
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
