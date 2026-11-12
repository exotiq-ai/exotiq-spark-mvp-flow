import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceOrUser } from "../_shared/serviceAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

interface SlackNotifyRequest {
  user_id?: string;
  webhookUrl?: string;
  event_type?: string;
  title?: string;
  message: string;
  fields?: { title: string; value: string; short?: boolean }[];
  color?: string;
  link?: { url: string; text: string };
  test?: boolean;
}

// Slack incoming webhooks live on these hosts; nothing else is contacted.
const SLACK_WEBHOOK_HOSTS = new Set(["hooks.slack.com", "hooks.slack-gov.com"]);
const isSlackWebhookUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && SLACK_WEBHOOK_HOSTS.has(url.hostname) && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Service-role function: cron token or an authenticated user only.
  const auth = await requireServiceOrUser(req);
  if (!auth.ok) return auth.response(corsHeaders);

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: SlackNotifyRequest = await req.json();
    const { user_id, webhookUrl, event_type, title, message, fields, color, link, test } = body;

    // Handle test messages with direct webhook URL
    if (test && webhookUrl) {
      if (!isSlackWebhookUrl(webhookUrl)) {
        return new Response(
          JSON.stringify({ success: false, message: "Enter a Slack incoming webhook URL" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      const slackPayload = {
        text: message,
        attachments: [
          {
            color: "#d4a847",
            text: message,
            footer: "ExotIQ Fleet Management",
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      const slackResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackPayload)
      });

      if (!slackResponse.ok) {
        const errorText = await slackResponse.text();
        console.error("Slack API error:", errorText);
        return new Response(
          JSON.stringify({ success: false, message: "Failed to send to Slack" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, message: "user_id required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // A signed-in caller sends to their own Slack connection only.
    if (!auth.isCron && user_id !== auth.userId) {
      return new Response(
        JSON.stringify({ success: false, message: "Not authorized for this user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Get user's notification preferences
    const { data: prefs, error: prefsError } = await supabaseClient
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (prefsError || !prefs) {
      console.log("No notification preferences found for user:", user_id);
      return new Response(
        JSON.stringify({ success: false, message: "No notification preferences" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check if Slack is enabled
    if (!prefs.slack_enabled || !isSlackWebhookUrl(prefs.slack_webhook_url)) {
      console.log("Slack not enabled for user:", user_id);
      return new Response(
        JSON.stringify({ success: false, message: "Slack not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check if this event type is enabled
    const eventTypeEnabled = {
      mention: prefs.slack_mentions,
      booking: prefs.slack_bookings,
      payment: prefs.slack_payments,
    }[event_type || ""] ?? true;

    if (!eventTypeEnabled) {
      console.log("Event type not enabled:", event_type);
      return new Response(
        JSON.stringify({ success: false, message: "Event type not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Build Slack message payload
    const slackPayload = {
      text: title || message,
      attachments: [
        {
          color: color || "#d4a847",
          title: title,
          text: message,
          fields: fields?.map(f => ({
            title: f.title,
            value: f.value,
            short: f.short ?? true
          })),
          actions: link ? [
            {
              type: "button",
              text: link.text,
              url: link.url
            }
          ] : undefined,
          footer: "ExotIQ Fleet Management",
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    // Send to Slack
    const slackResponse = await fetch(prefs.slack_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload)
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.error("Slack API error:", errorText);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to send to Slack" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Successfully sent Slack notification for event:", event_type);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in slack-notify:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
