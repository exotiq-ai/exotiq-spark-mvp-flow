import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from 'https://esm.sh/resend@4.0.0';
import {
  isPlatformAdmin,
  isTeamOwnerOfRecord,
  isUuid,
  oneTimeTokenDigest,
  requireSessionUser,
} from "../_shared/callerSession.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeletionRequest {
  teamId: string;
  resend?: boolean;
  requestId?: string;
}

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // The requester is the signed-in user. Their id and email come from the session.
    const session = await requireSessionUser(req, supabase);
    if (!session.ok) return session.response(corsHeaders);
    const userId = session.userId;
    const email = session.email;

    const { teamId, resend: isResend, requestId }: DeletionRequest = await req.json();

    if (!isUuid(teamId)) {
      return jsonResponse(400, { error: "Missing required fields" });
    }

    // Platform staff accounts do not use the self-service path.
    if (await isPlatformAdmin(supabase, userId)) {
      return jsonResponse(403, { error: "Only the team owner can request data deletion" });
    }

    if (!(await isTeamOwnerOfRecord(supabase, userId, teamId))) {
      return jsonResponse(403, { error: "Only the team owner can request data deletion" });
    }

    // Rate limiting: Check for recent requests (max 3 per day)
    const { count, error: countError } = await supabase
      .from("deletion_requests")
      .select("*", { count: "exact", head: true })
      .eq("requested_by", userId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (countError) {
      console.error("Error checking rate limit:", countError);
    }

    if ((count ?? 0) >= 3 && !isResend) {
      return new Response(
        JSON.stringify({ error: "Too many deletion requests. Please try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The token goes to the requester's inbox only. The table keeps a keyed digest of it.
    const confirmationToken = crypto.randomUUID();
    const tokenDigest = await oneTimeTokenDigest(confirmationToken, teamId, userId);
    let deletionRequestId: string;

    if (isResend && requestId) {
      // Resend: issue a fresh token for the requester's own open request
      if (!isUuid(requestId)) {
        return jsonResponse(404, { error: "Deletion request not found" });
      }

      const { data: reissued, error: reissueError } = await supabase
        .from("deletion_requests")
        .update({ confirmation_token: tokenDigest })
        .eq("id", requestId)
        .eq("team_id", teamId)
        .eq("requested_by", userId)
        .eq("status", "email_sent")
        .gt("scheduled_deletion_at", new Date().toISOString())
        .select("id");

      if (reissueError || !reissued || reissued.length !== 1) {
        return new Response(
          JSON.stringify({ error: "Deletion request not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      deletionRequestId = requestId;
    } else {
      // Create new deletion request
      const { data: newRequest, error: insertError } = await supabase
        .from("deletion_requests")
        .insert({
          team_id: teamId,
          requested_by: userId,
          request_type: "full_data_deletion",
          status: "email_sent",
          confirmation_token: tokenDigest,
          scheduled_deletion_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour expiry
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
        })
        .select("id")
        .single();

      if (insertError || !newRequest) {
        console.error("Error creating deletion request:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create deletion request" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      deletionRequestId = newRequest.id;
    }

    // Build confirmation URL
    const appUrl = Deno.env.get("APP_URL") || "https://app.exotiq.ai";
    const confirmationUrl = `${appUrl}/dashboard?deletion_token=${confirmationToken}`;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "Exotiq <noreply@resend.dev>",
      to: [email],
      subject: "⚠️ Confirm Your Exotiq Data Deletion Request",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .warning { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .warning h3 { color: #dc2626; margin: 0 0 10px 0; }
            .button { display: inline-block; background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .button:hover { background: #991b1b; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .security { background: #f3f4f6; border-radius: 8px; padding: 15px; margin-top: 20px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Data Deletion Request</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to permanently delete all data from your Exotiq account. This action is <strong>irreversible</strong>.</p>
              
              <div class="warning">
                <h3>⚠️ This will permanently delete:</h3>
                <ul>
                  <li>All vehicles and their photos</li>
                  <li>All bookings and payment history</li>
                  <li>All customer records and communications</li>
                  <li>All documents and files</li>
                  <li>Your subscription (no refund)</li>
                </ul>
              </div>
              
              <p>If you want to proceed, click the button below:</p>
              
              <p style="text-align: center;">
                <a href="${confirmationUrl}" class="button">Confirm Account Deletion</a>
              </p>
              
              <p><strong>This link expires in 1 hour.</strong></p>
              
              <div class="security">
                <strong>🔒 Security Notice:</strong><br>
                If you did not request this deletion, please ignore this email and secure your account immediately by changing your password.
              </div>
            </div>
            <div class="footer">
              <p>This email was sent by Exotiq Fleet Management</p>
              <p>If you have questions, contact support@exotiq.com</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Deletion confirmation email sent:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        requestId: deletionRequestId,
        message: "Confirmation email sent",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-deletion-confirmation:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
