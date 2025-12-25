import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlackNotifyRequest {
  user_id: string;
  event_type: string;
  title: string;
  message: string;
  fields?: { title: string; value: string; short?: boolean }[];
  color?: string;
  link?: { url: string; text: string };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_id, event_type, title, message, fields, color, link }: SlackNotifyRequest = await req.json();

    // Get user's Slack integration config
    const { data: integrationConfig, error: configError } = await supabaseClient
      .from("integration_configs")
      .select("*")
      .eq("user_id", user_id)
      .eq("integration_type", "slack")
      .eq("is_active", true)
      .single();

    if (configError || !integrationConfig) {
      console.log("No active Slack integration found for user:", user_id);
      return new Response(
        JSON.stringify({ success: false, message: "No active Slack integration" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const config = integrationConfig.config as {
      webhook_url?: string;
      enabled_events?: string[];
      channel?: string;
    };

    // Check if this event type is enabled
    if (config.enabled_events && !config.enabled_events.includes(event_type) && !config.enabled_events.includes("all")) {
      console.log("Event type not enabled:", event_type);
      return new Response(
        JSON.stringify({ success: false, message: "Event type not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (!config.webhook_url) {
      return new Response(
        JSON.stringify({ success: false, message: "Webhook URL not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Build Slack message payload
    const slackPayload = {
      text: title,
      attachments: [
        {
          color: color || "#1E3A5F", // Default to primary color
          title,
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
          footer: "Exotiq Fleet Management",
          footer_icon: "https://exotiq.io/logo.png",
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    // Send to Slack
    const slackResponse = await fetch(config.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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

    // Update last_used_at
    await supabaseClient
      .from("integration_configs")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", integrationConfig.id);

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
