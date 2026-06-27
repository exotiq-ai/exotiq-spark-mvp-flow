// Sends @mention notifications for comments posted on records (bookings,
// work orders, inspections, damage claims, etc.). Mirrors mention-notification
// but uses entity_type + entity_id as the dedupe + access-check scope.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ENTITY_TYPES = new Set([
  "booking",
  "vehicle",
  "customer",
  "payment",
  "damage_claim",
  "work_order",
  "vehicle_task",
  "inspection",
  "document",
  "customer_note",
  "partner_payout",
]);

const ENTITY_LABEL: Record<string, string> = {
  booking: "Booking",
  vehicle: "Vehicle",
  customer: "Customer",
  payment: "Payment",
  damage_claim: "Damage Claim",
  work_order: "Work Order",
  vehicle_task: "Task",
  inspection: "Inspection",
  document: "Document",
  customer_note: "Customer Note",
  partner_payout: "Payout",
};

const buildHref = (entityType: string, entityId: string, baseUrl: string) => {
  switch (entityType) {
    case "booking": return `${baseUrl}/dashboard/bookings?bookingId=${entityId}`;
    case "vehicle": return `${baseUrl}/dashboard/fleet?vehicleId=${entityId}`;
    case "customer": return `${baseUrl}/dashboard/customers?customerId=${entityId}`;
    case "damage_claim": return `${baseUrl}/dashboard/damages?claimId=${entityId}`;
    case "work_order":
    case "vehicle_task": return `${baseUrl}/dashboard/fleet?workOrderId=${entityId}`;
    case "inspection": return `${baseUrl}/dashboard/inspections?inspectionId=${entityId}`;
    case "document": return `${baseUrl}/dashboard/settings?tab=documents&docId=${entityId}`;
    case "payment": return `${baseUrl}/dashboard/payments?paymentId=${entityId}`;
    case "partner_payout": return `${baseUrl}/dashboard/partners?payoutId=${entityId}`;
    default: return `${baseUrl}/dashboard`;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.slice(7),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      mentionedUserIds,
      entityType,
      entityId,
      teamId,
      commentId,
      content,
    } = body as {
      mentionedUserIds: string[];
      entityType: string;
      entityId: string;
      teamId: string;
      commentId: string;
      content: string;
    };

    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return new Response(JSON.stringify({ error: "Invalid entity type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderId = user.id;

    // Verify sender can access the record
    const { data: senderAccess } = await supabaseAdmin.rpc("can_access_entity", {
      _user_id: senderId,
      _entity_type: entityType,
      _entity_id: entityId,
    });
    if (!senderAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter recipients: must have access + active team member + not sender
    const accessChecks = await Promise.all(
      (mentionedUserIds || []).map(async (uid) => {
        if (uid === senderId) return null;
        const { data } = await supabaseAdmin.rpc("can_access_entity", {
          _user_id: uid,
          _entity_type: entityType,
          _entity_id: entityId,
        });
        return data ? uid : null;
      }),
    );
    let allowed = accessChecks.filter((x): x is string => !!x);

    // Drop inactive team members
    if (allowed.length > 0 && teamId) {
      const { data: actives } = await supabaseAdmin
        .from("team_members")
        .select("user_id, is_active")
        .eq("team_id", teamId)
        .in("user_id", allowed);
      const activeSet = new Set(
        (actives || []).filter((m) => m.is_active !== false).map((m) => m.user_id),
      );
      allowed = allowed.filter((id) => activeSet.has(id));
    }

    if (allowed.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 60-second dedupe per (recipient, entity, sender)
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("mention_notifications_log")
      .select("recipient_id, channel")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("sender_id", senderId)
      .in("recipient_id", allowed)
      .gte("created_at", since);
    const recentEmail = new Set(
      (recent || []).filter((r) => r.channel === "email").map((r) => r.recipient_id),
    );
    const recentSlack = new Set(
      (recent || []).filter((r) => r.channel === "slack").map((r) => r.recipient_id),
    );

    // Load recipient profiles + prefs + sender profile
    const [{ data: recipients }, { data: prefs }, { data: senderProfile }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", allowed),
        supabaseAdmin
          .from("notification_preferences")
          .select("user_id, email_mentions, slack_enabled, slack_mentions, slack_webhook_url, muted_threads")
          .in("user_id", allowed),
        supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", senderId)
          .maybeSingle(),
      ]);

    const prefMap = new Map((prefs || []).map((p) => [p.user_id, p]));
    const senderName = senderProfile?.full_name || senderProfile?.email || "Someone";
    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://app.exotiq.ai";
    const href = buildHref(entityType, entityId, baseUrl);
    const label = ENTITY_LABEL[entityType] || "record";
    const snippet = content.length > 200 ? content.slice(0, 200) + "…" : content;

    // Filter muted threads
    const isMuted = (userId: string) => {
      const p = prefMap.get(userId);
      const muted = (p?.muted_threads as Array<{ entity_type: string; entity_id: string }> | undefined) || [];
      return muted.some((m) => m.entity_type === entityType && m.entity_id === entityId);
    };

    const emailResults = await Promise.all(
      (recipients || []).map(async (r) => {
        if (!r.email) return null;
        if (recentEmail.has(r.id)) return null;
        if (isMuted(r.id)) return null;
        const p = prefMap.get(r.id);
        if (p?.email_mentions === false) return null;
        try {
          await resend.emails.send({
            from: "ExotIQ <notifications@resend.dev>",
            to: [r.email],
            subject: `${senderName} mentioned you on a ${label.toLowerCase()}`,
            html: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;color:#fff;padding:40px 20px;">
                <div style="max-width:600px;margin:0 auto;background:#141414;border-radius:12px;border:1px solid #262626;overflow:hidden;">
                  <div style="background:linear-gradient(135deg,#b8860b,#d4a847);padding:24px;text-align:center;">
                    <h1 style="margin:0;font-size:22px;color:#000;">You were mentioned</h1>
                  </div>
                  <div style="padding:28px;">
                    <p style="margin:0 0 12px;color:#a0a0a0;font-size:14px;">Hi ${r.full_name || "there"},</p>
                    <p style="margin:0 0 20px;color:#fff;font-size:15px;">
                      <strong style="color:#d4a847;">${senderName}</strong> mentioned you on <strong>${label}</strong>.
                    </p>
                    <div style="background:#1a1a1a;border-left:3px solid #d4a847;padding:14px;border-radius:0 8px 8px 0;margin-bottom:24px;">
                      <p style="margin:0;color:#e0e0e0;font-size:14px;line-height:1.6;">"${snippet.replace(/</g, "&lt;")}"</p>
                    </div>
                    <a href="${href}" style="display:inline-block;background:#d4a847;color:#000;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Open ${label}</a>
                  </div>
                  <div style="padding:16px;background:#0d0d0d;border-top:1px solid #262626;text-align:center;">
                    <p style="margin:0;color:#666;font-size:11px;">Manage notification preferences in Settings.</p>
                  </div>
                </div>
              </div>
            `,
          });
          return { userId: r.id, channel: "email" as const };
        } catch (e) {
          console.error("[entity-mention] email failed", r.id, e);
          return null;
        }
      }),
    );

    const slackResults = await Promise.all(
      (recipients || []).map(async (r) => {
        if (recentSlack.has(r.id)) return null;
        if (isMuted(r.id)) return null;
        const p = prefMap.get(r.id);
        if (!(p?.slack_enabled && p?.slack_mentions && p?.slack_webhook_url)) return null;
        try {
          await fetch(p.slack_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `📌 ${senderName} mentioned you on a ${label}`,
              attachments: [
                {
                  color: "#d4a847",
                  text: snippet,
                  title: `Open ${label}`,
                  title_link: href,
                  footer: "ExotIQ",
                  ts: Math.floor(Date.now() / 1000),
                },
              ],
            }),
          });
          return { userId: r.id, channel: "slack" as const };
        } catch (e) {
          console.error("[entity-mention] slack failed", r.id, e);
          return null;
        }
      }),
    );

    const sent = [...emailResults, ...slackResults].filter(
      (x): x is { userId: string; channel: "email" | "slack" } => !!x,
    );

    if (sent.length > 0) {
      await supabaseAdmin.from("mention_notifications_log").insert(
        sent.map((s) => ({
          conversation_id: null,
          message_id: null,
          entity_type: entityType,
          entity_id: entityId,
          comment_id: commentId,
          sender_id: senderId,
          recipient_id: s.userId,
          channel: s.channel,
        })),
      );
    }

    return new Response(
      JSON.stringify({ success: true, notified: sent.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[entity-mention-notification] error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
