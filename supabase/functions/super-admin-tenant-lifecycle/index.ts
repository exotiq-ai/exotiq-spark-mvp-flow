// Super-admin lifecycle actions for a single tenant workspace.
//
// Actions:
//   restart_onboarding — clears setup progress so the owner starts at step one
//   start_demo         — puts the workspace into demo mode (never billed)
//   stop_demo          — takes the workspace out of demo mode
//   set_billing        — pending_activation | grandfathered (manual override)
//
// Every action is written to role_audit_log.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MANUAL_BILLING_STATES = ["pending_activation", "grandfathered"] as const;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    let actorId: string | null = null;
    let actorEmail: string | null = null;

    if (bearer !== serviceKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return json({ error: "Unauthorized" }, 401);

      const { data: superAdmin, error: saError } = await admin
        .from("super_admins")
        .select("user_id, email, is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      if (saError) return json({ error: "Permission check failed" }, 500);
      if (!superAdmin || superAdmin.is_active === false) {
        return json({ error: "Only super admins can call this function" }, 403);
      }
      actorId = user.id;
      actorEmail = superAdmin.email ?? user.email ?? null;
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "";
    const teamId: string | undefined = body?.team_id;
    if (!teamId || typeof teamId !== "string") return json({ error: "team_id is required" }, 400);

    const { data: team, error: teamErr } = await admin
      .from("teams")
      .select("id, name, owner_id, is_demo_account, billing_status, stripe_subscription_id")
      .eq("id", teamId)
      .maybeSingle();
    if (teamErr) throw teamErr;
    if (!team) return json({ error: "Workspace not found" }, 404);

    const audit = async (auditAction: string, metadata: Record<string, unknown>) => {
      await admin.from("role_audit_log").insert({
        user_id: team.owner_id,
        changed_by: actorId,
        team_id: teamId,
        action: auditAction,
        metadata: { ...metadata, actor_email: actorEmail, source: "super_admin_portal" },
      });
    };

    if (action === "restart_onboarding") {
      const { data: members, error: mErr } = await admin
        .from("team_members")
        .select("user_id, role")
        .eq("team_id", teamId)
        .eq("is_active", true);
      if (mErr) throw mErr;

      const ownerIds = (members ?? [])
        .filter((m) => m.role === "owner")
        .map((m) => m.user_id);
      const targets = ownerIds.length ? ownerIds : [team.owner_id].filter(Boolean);
      if (!targets.length) return json({ error: "No owner to restart onboarding for" }, 409);

      // Clear saved progress and put the owner back at the top of the wizard.
      const { error: progErr } = await admin
        .from("onboarding_progress")
        .update({
          current_step: 1,
          steps_completed: [],
          completed_at: null,
          last_activity_at: new Date().toISOString(),
        })
        .in("user_id", targets)
        .eq("team_id", teamId);
      if (progErr) throw progErr;

      const { error: profErr } = await admin
        .from("profiles")
        .update({ onboarding_completed: false, tour_completed: false, tour_skipped_at: null })
        .in("id", targets);
      if (profErr) throw profErr;

      await audit("super_admin_restart_onboarding", { targets });
      return json({ success: true, restarted_for: targets.length });
    }

    if (action === "start_demo" || action === "stop_demo") {
      const isDemo = action === "start_demo";
      if (isDemo && team.stripe_subscription_id) {
        return json(
          { error: "This workspace has a live subscription — cancel it before switching to demo." },
          409,
        );
      }
      const { error: updErr } = await admin
        .from("teams")
        .update({
          is_demo_account: isDemo,
          // Demo workspaces are never billed and never nagged.
          ...(isDemo ? { billing_status: "grandfathered" } : {}),
        })
        .eq("id", teamId);
      if (updErr) throw updErr;

      await audit(isDemo ? "super_admin_start_demo" : "super_admin_stop_demo", {
        previous_billing_status: team.billing_status,
      });
      return json({ success: true, is_demo_account: isDemo });
    }

    if (action === "confirm_platform_fee") {
      const { data: feeRow, error: feeErr } = await admin
        .from("teams")
        .select("platform_fee_percent, platform_fee_confirmed_at")
        .eq("id", teamId)
        .maybeSingle();
      if (feeErr) throw feeErr;

      const pct = body?.platform_fee_percent != null
        ? Number(body.platform_fee_percent)
        : Number(feeRow?.platform_fee_percent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        return json(
          { error: "Set a platform fee percentage greater than 0 and no more than 100 first." },
          400,
        );
      }

      const { error: updErr } = await admin
        .from("teams")
        .update({
          platform_fee_percent: pct,
          platform_fee_confirmed_at: new Date().toISOString(),
        })
        .eq("id", teamId);
      if (updErr) throw updErr;

      await audit("super_admin_confirm_platform_fee", {
        platform_fee_percent: pct,
        previously_confirmed_at: feeRow?.platform_fee_confirmed_at ?? null,
      });
      return json({ success: true, platform_fee_percent: pct });
    }

    if (action === "confirm_deposit_source") {
      const { data: depRow, error: depErr } = await admin
        .from("teams")
        .select("default_deposit_cents, deposit_source_confirmed_at")
        .eq("id", teamId)
        .maybeSingle();
      if (depErr) throw depErr;

      const cents = body?.default_deposit_cents != null
        ? Math.round(Number(body.default_deposit_cents))
        : Number(depRow?.default_deposit_cents);
      if (!Number.isFinite(cents) || cents < 0) {
        return json({ error: "Set a valid default security deposit first." }, 400);
      }

      const { error: updErr } = await admin
        .from("teams")
        .update({
          default_deposit_cents: cents,
          deposit_source_confirmed_at: new Date().toISOString(),
        })
        .eq("id", teamId);
      if (updErr) throw updErr;

      await audit("super_admin_confirm_deposit_source", {
        default_deposit_cents: cents,
        previously_confirmed_at: depRow?.deposit_source_confirmed_at ?? null,
      });
      return json({ success: true, default_deposit_cents: cents });
    }

    if (action === "set_billing") {
      const next = body?.billing_status;
      if (!MANUAL_BILLING_STATES.includes(next)) {
        return json({ error: "Only pending_activation or grandfathered can be set by hand" }, 400);
      }
      if (team.stripe_subscription_id && next === "pending_activation") {
        return json(
          { error: "This workspace has a live subscription — manage it in Stripe instead." },
          409,
        );
      }
      const { error: updErr } = await admin
        .from("teams")
        .update({ billing_status: next })
        .eq("id", teamId);
      if (updErr) throw updErr;

      await audit("super_admin_set_billing_status", {
        from: team.billing_status,
        to: next,
      });
      return json({ success: true, billing_status: next });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[super-admin-tenant-lifecycle] error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
