import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeedbackNotificationRequest {
  feedbackId: string;
  userId: string;
  category: string;
  priority: string;
  userQuery: string;
  context?: Record<string, any>;
  notifyAdmins?: boolean;
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

    const { 
      feedbackId, 
      userId, 
      category, 
      priority, 
      userQuery, 
      context,
      notifyAdmins = true 
    }: FeedbackNotificationRequest = await req.json();

    console.log("Processing feedback notification:", { feedbackId, category, priority });

    // Get user profile
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("Error fetching user profile:", userError);
      throw userError;
    }

    const userName = userProfile?.full_name || "A user";
    const userEmail = userProfile?.email || "unknown";

    // Get admin users
    const { data: adminRoles, error: adminError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);

    if (adminError) {
      console.error("Error fetching admin roles:", adminError);
      throw adminError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admin users found");
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: "No admins to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminUserIds = adminRoles.map(r => r.user_id);

    // Get admin profiles
    const { data: adminProfiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", adminUserIds);

    if (profilesError) {
      console.error("Error fetching admin profiles:", profilesError);
      throw profilesError;
    }

    if (!adminProfiles || adminProfiles.length === 0) {
      console.log("No admin profiles found");
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: "No admin profiles found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get notification preferences for admins
    const { data: notificationSettings } = await supabaseAdmin
      .from("admin_notification_settings")
      .select("*")
      .in("user_id", adminUserIds);

    const settingsMap = new Map(notificationSettings?.map(s => [s.user_id, s]) || []);

    // Determine notification color based on priority
    const priorityColors: Record<string, string> = {
      critical: "#dc2626",
      high: "#ea580c",
      medium: "#d4a847",
      low: "#65a30d",
    };

    const priorityEmojis: Record<string, string> = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🟢",
    };

    const categoryEmojis: Record<string, string> = {
      feature_request: "💡",
      bug_report: "🐛",
      improvement: "⚡",
      question: "❓",
      other: "📝",
    };

    const color = priorityColors[priority] || "#d4a847";
    const priorityEmoji = priorityEmojis[priority] || "📋";
    const categoryEmoji = categoryEmojis[category] || "📝";

    // Create app URL for the feedback
    const appUrl = Deno.env.get("APP_URL") || "https://app.exotiq.com";
    const feedbackUrl = `${appUrl}/dashboard?tab=feedback&id=${feedbackId}`;

    // Process email notifications
    const emailPromises = adminProfiles
      .filter(admin => {
        if (!admin.email || !notifyAdmins) return false;
        const settings = settingsMap.get(admin.id);
        
        // Check notification preferences
        if (!settings) return true; // Default to sending if no settings exist
        
        if (priority === "critical" && !settings.email_critical_priority) return false;
        if (priority === "high" && !settings.email_high_priority) return false;
        if (!settings.email_new_feedback) return false;
        
        return true;
      })
      .map(async (admin) => {
        try {
          const emailResponse = await resend.emails.send({
            from: "ExotIQ Feedback <notifications@resend.dev>",
            to: [admin.email],
            subject: `${priorityEmoji} New ${priority} priority feedback: ${category.replace('_', ' ')}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px; margin: 0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #141414; border-radius: 12px; overflow: hidden; border: 1px solid #262626;">
                  <div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); padding: 24px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">
                      ${priorityEmoji} New User Feedback
                    </h1>
                  </div>
                  <div style="padding: 32px;">
                    <p style="margin: 0 0 16px 0; color: #a0a0a0; font-size: 14px;">
                      Hi ${admin.full_name || "Admin"},
                    </p>
                    <p style="margin: 0 0 24px 0; color: #ffffff; font-size: 16px;">
                      <strong style="color: #d4a847;">${userName}</strong> submitted new feedback:
                    </p>
                    
                    <div style="background-color: #1a1a1a; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #a0a0a0; font-size: 13px;">Category:</td>
                          <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right;">
                            ${categoryEmoji} ${category.replace('_', ' ').toUpperCase()}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #a0a0a0; font-size: 13px;">Priority:</td>
                          <td style="padding: 8px 0; text-align: right;">
                            <span style="display: inline-block; padding: 4px 12px; background-color: ${color}33; color: ${color}; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                              ${priorityEmoji} ${priority}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #a0a0a0; font-size: 13px;">User:</td>
                          <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right;">
                            ${userName} (${userEmail})
                          </td>
                        </tr>
                      </table>
                    </div>

                    <div style="background-color: #1a1a1a; border-left: 4px solid ${color}; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                      <p style="margin: 0 0 8px 0; color: #a0a0a0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                        Feedback Details
                      </p>
                      <p style="margin: 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
                        ${userQuery.length > 300 ? userQuery.substring(0, 300) + "..." : userQuery}
                      </p>
                    </div>

                    ${context ? `
                    <div style="background-color: #1a1a1a; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                      <p style="margin: 0 0 8px 0; color: #a0a0a0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                        Additional Context
                      </p>
                      <pre style="margin: 0; color: #d0d0d0; font-size: 12px; line-height: 1.4; overflow-x: auto;">${JSON.stringify(context, null, 2)}</pre>
                    </div>
                    ` : ''}

                    <div style="text-align: center; margin-top: 32px;">
                      <a href="${feedbackUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #b8860b 0%, #d4a847 100%); color: #000000; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                        View Feedback Details →
                      </a>
                    </div>
                  </div>
                  <div style="padding: 20px 32px; background-color: #0d0d0d; border-top: 1px solid #262626;">
                    <p style="margin: 0; color: #666666; font-size: 12px; text-align: center;">
                      This notification was sent because you're an admin with feedback notifications enabled.
                      <br/>You can manage your notification preferences in Settings.
                    </p>
                  </div>
                </div>
              </body>
              </html>
            `,
          });
          
          console.log(`Email sent to admin ${admin.email}:`, emailResponse);
          return { adminId: admin.id, type: "email", success: true };
        } catch (emailError) {
          console.error(`Failed to send email to ${admin.email}:`, emailError);
          return { adminId: admin.id, type: "email", success: false, error: emailError };
        }
      });

    // Process Slack notifications for admins with Slack enabled
    const { data: slackPreferences } = await supabaseAdmin
      .from("notification_preferences")
      .select("user_id, slack_enabled, slack_webhook_url")
      .in("user_id", adminUserIds)
      .eq("slack_enabled", true);

    const slackPromises = (slackPreferences || [])
      .filter(pref => {
        const settings = settingsMap.get(pref.user_id);
        if (!settings) return true;
        
        if (priority === "critical" && !settings.slack_critical_priority) return false;
        if (priority === "high" && !settings.slack_high_priority) return false;
        if (!settings.slack_new_feedback) return false;
        
        return true;
      })
      .map(async (pref) => {
        try {
          const slackPayload = {
            text: `${priorityEmoji} New ${priority} priority feedback from ${userName}`,
            attachments: [
              {
                color: color,
                title: `${categoryEmoji} ${category.replace('_', ' ').toUpperCase()}`,
                text: userQuery.length > 200 ? userQuery.substring(0, 200) + "..." : userQuery,
                fields: [
                  {
                    title: "Priority",
                    value: priority.toUpperCase(),
                    short: true
                  },
                  {
                    title: "User",
                    value: userName,
                    short: true
                  }
                ],
                actions: [
                  {
                    type: "button",
                    text: "View Details",
                    url: feedbackUrl
                  }
                ],
                footer: "ExotIQ Feedback System",
                ts: Math.floor(Date.now() / 1000)
              }
            ]
          };

          const slackResponse = await fetch(pref.slack_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(slackPayload)
          });

          if (!slackResponse.ok) {
            throw new Error(`Slack API error: ${await slackResponse.text()}`);
          }

          console.log(`Slack notification sent for admin ${pref.user_id}`);
          return { adminId: pref.user_id, type: "slack", success: true };
        } catch (slackError) {
          console.error(`Failed to send Slack notification for admin ${pref.user_id}:`, slackError);
          return { adminId: pref.user_id, type: "slack", success: false, error: slackError };
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
        totalNotified: emailSuccess + slackSuccess,
        results: allResults 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in feedback-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
