import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MentionNotificationRequest {
  mentionedUserIds: string[];
  senderId: string;
  senderName: string;
  messageContent: string;
  conversationId: string;
  messageId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { mentionedUserIds, senderId, senderName, messageContent, conversationId, messageId }: MentionNotificationRequest = await req.json();

    console.log("Processing mention notifications for users:", mentionedUserIds);

    // Get mentioned users' profiles and notification preferences
    const { data: mentionedUsers, error: usersError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", mentionedUserIds);

    if (usersError) {
      console.error("Error fetching mentioned users:", usersError);
      throw usersError;
    }

    if (!mentionedUsers || mentionedUsers.length === 0) {
      console.log("No users found to notify");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get notification preferences for all mentioned users
    const { data: preferences } = await supabaseAdmin
      .from("notification_preferences")
      .select("user_id, email_mentions, slack_enabled, slack_mentions, slack_webhook_url")
      .in("user_id", mentionedUserIds);

    const prefsMap = new Map(preferences?.map(p => [p.user_id, p]) || []);

    // Get conversation details
    const { data: conversation } = await supabaseAdmin
      .from("team_conversations")
      .select("name, type")
      .eq("id", conversationId)
      .single();

    const conversationName = conversation?.name || (conversation?.type === "direct" ? "Direct Message" : "Group Chat");
    const truncatedMessage = messageContent.length > 150 ? messageContent.substring(0, 150) + "..." : messageContent;

    // Process email notifications
    const emailPromises = mentionedUsers
      .filter(user => {
        if (user.id === senderId || !user.email) return false;
        const userPrefs = prefsMap.get(user.id);
        // Default to true if no preferences exist
        return userPrefs?.email_mentions !== false;
      })
      .map(async (user) => {
        try {
          const emailResponse = await resend.emails.send({
            from: "ExotIQ <notifications@resend.dev>",
            to: [user.email],
            subject: `${senderName || "Someone"} mentioned you in ${conversationName}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px; margin: 0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #141414; border-radius: 12px; overflow: hidden; border: 1px solid #262626;">
                  <div style="background: linear-gradient(135deg, #b8860b 0%, #d4a847 100%); padding: 24px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #000000;">You were mentioned</h1>
                  </div>
                  <div style="padding: 32px;">
                    <p style="margin: 0 0 16px 0; color: #a0a0a0; font-size: 14px;">
                      Hi ${user.full_name || "there"},
                    </p>
                    <p style="margin: 0 0 24px 0; color: #ffffff; font-size: 16px;">
                      <strong style="color: #d4a847;">${senderName || "Someone"}</strong> mentioned you in <strong>${conversationName}</strong>:
                    </p>
                    <div style="background-color: #1a1a1a; border-left: 3px solid #d4a847; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                      <p style="margin: 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
                        "${truncatedMessage}"
                      </p>
                    </div>
                    <p style="margin: 0; color: #a0a0a0; font-size: 13px;">
                      Log in to ExotIQ to view the full conversation and reply.
                    </p>
                  </div>
                  <div style="padding: 20px 32px; background-color: #0d0d0d; border-top: 1px solid #262626;">
                    <p style="margin: 0; color: #666666; font-size: 12px; text-align: center;">
                      This notification was sent because you were @mentioned in a team message.
                      <br/>You can manage your notification preferences in Settings.
                    </p>
                  </div>
                </div>
              </body>
              </html>
            `,
          });
          console.log(`Email sent to ${user.email}:`, emailResponse);
          return { userId: user.id, type: "email", success: true };
        } catch (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
          return { userId: user.id, type: "email", success: false, error: emailError };
        }
      });

    // Process Slack notifications
    const slackPromises = mentionedUsers
      .filter(user => {
        if (user.id === senderId) return false;
        const userPrefs = prefsMap.get(user.id);
        return userPrefs?.slack_enabled && userPrefs?.slack_mentions && userPrefs?.slack_webhook_url;
      })
      .map(async (user) => {
        const userPrefs = prefsMap.get(user.id);
        try {
          const slackPayload = {
            text: `📢 ${senderName || "Someone"} mentioned you in ${conversationName}`,
            attachments: [
              {
                color: "#d4a847",
                text: truncatedMessage,
                footer: "ExotIQ Fleet Management",
                ts: Math.floor(Date.now() / 1000)
              }
            ]
          };

          const slackResponse = await fetch(userPrefs!.slack_webhook_url!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(slackPayload)
          });

          if (!slackResponse.ok) {
            throw new Error(`Slack API error: ${await slackResponse.text()}`);
          }

          console.log(`Slack notification sent for user ${user.id}`);
          return { userId: user.id, type: "slack", success: true };
        } catch (slackError) {
          console.error(`Failed to send Slack notification for user ${user.id}:`, slackError);
          return { userId: user.id, type: "slack", success: false, error: slackError };
        }
      });

    const allResults = await Promise.all([...emailPromises, ...slackPromises]);
    const emailSuccess = allResults.filter(r => r.type === "email" && r.success).length;
    const slackSuccess = allResults.filter(r => r.type === "slack" && r.success).length;

    console.log(`Successfully sent ${emailSuccess} emails and ${slackSuccess} Slack notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent: emailSuccess, 
        slackSent: slackSuccess,
        results: allResults 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in mention-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
