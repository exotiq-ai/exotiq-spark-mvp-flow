import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

// Hard cap so a misconfigured tenant can never burst again.
const MAX_NEW_NOTIFICATIONS_PER_RUN_PER_TEAM = 50;
// Window for "what looks like ancient garbage" — old bookings stop firing alerts.
const LATE_RETURN_LOOKBACK_DAYS = 14;
const PENDING_PICKUP_LOOKBACK_DAYS = 7;
const PENDING_PICKUP_LOOKAHEAD_DAYS = 1;
const PAYMENT_OVERDUE_LOOKBACK_DAYS = 30;
const MAINTENANCE_LOOKBACK_DAYS = 30;

interface AlertContext {
  supabase: ReturnType<typeof createClient>;
  teamId: string;
  memberIds: string[];
  existingRefs: Set<string>;
  notifications: Array<{
    user_id: string;
    type: string;
    title: string;
    message: string;
    data: Record<string, unknown>;
    ref: string;
  }>;
  capHit: boolean;
}

const addAlert = (
  ctx: AlertContext,
  type: string,
  title: string,
  message: string,
  ref: string,
  extraData: Record<string, unknown> = {}
) => {
  if (ctx.capHit) return;
  if (ctx.existingRefs.has(ref)) return;
  ctx.existingRefs.add(ref);
  for (const userId of ctx.memberIds) {
    if (ctx.notifications.length >= MAX_NEW_NOTIFICATIONS_PER_RUN_PER_TEAM) {
      ctx.capHit = true;
      console.warn(
        `[check-fleet-alerts] team ${ctx.teamId} hit MAX_NEW_NOTIFICATIONS_PER_RUN_PER_TEAM=${MAX_NEW_NOTIFICATIONS_PER_RUN_PER_TEAM}; remaining alerts skipped`
      );
      return;
    }
    ctx.notifications.push({
      user_id: userId,
      type,
      title,
      message,
      data: { ref, ...extraData },
      ref,
    });
  }
};

async function processTeam(
  supabase: ReturnType<typeof createClient>,
  teamId: string
): Promise<number> {
  const now = new Date();
  const nowIso = now.toISOString();

  const lateFloor = new Date(now);
  lateFloor.setDate(lateFloor.getDate() - LATE_RETURN_LOOKBACK_DAYS);

  const pickupFloor = new Date(now);
  pickupFloor.setDate(pickupFloor.getDate() - PENDING_PICKUP_LOOKBACK_DAYS);
  const pickupCeil = new Date(now);
  pickupCeil.setDate(pickupCeil.getDate() + PENDING_PICKUP_LOOKAHEAD_DAYS);

  const overdueFloor = new Date(now);
  overdueFloor.setDate(overdueFloor.getDate() - PAYMENT_OVERDUE_LOOKBACK_DAYS);

  const depositCeil = new Date(now);
  depositCeil.setDate(depositCeil.getDate() + 2);

  const maintenanceFloor = new Date(now);
  maintenanceFloor.setDate(maintenanceFloor.getDate() - MAINTENANCE_LOOKBACK_DAYS);
  const today = nowIso.split("T")[0];
  const maintenanceFloorDate = maintenanceFloor.toISOString().split("T")[0];

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("is_active", true);

  const memberIds = (teamMembers || [])
    .map((m: { user_id: string }) => m.user_id)
    .filter(Boolean);
  if (memberIds.length === 0) return 0;

  // Re-read existing refs immediately before staging to close the race window.
  // Pull both today's and yesterday's refs so cross-midnight runs don't double-fire.
  const refWindowFloor = new Date(now);
  refWindowFloor.setDate(refWindowFloor.getDate() - 2);

  const { data: existingNotifs } = await supabase
    .from("notifications")
    .select("ref")
    .in("user_id", memberIds)
    .gte("created_at", refWindowFloor.toISOString())
    .not("ref", "is", null);

  const existingRefs = new Set<string>(
    (existingNotifs || [])
      .map((n: { ref: string | null }) => n.ref)
      .filter(Boolean) as string[]
  );

  const ctx: AlertContext = {
    supabase,
    teamId,
    memberIds,
    existingRefs,
    notifications: [],
    capHit: false,
  };

  // 1. Late Returns — only within the recent window
  const { data: lateBookings } = await supabase
    .from("bookings")
    .select("id, customer_name, vehicle_name, end_date")
    .eq("team_id", teamId)
    .in("status", ["active", "confirmed"])
    .lt("end_date", nowIso)
    .gte("end_date", lateFloor.toISOString());

  for (const b of (lateBookings || []) as Array<{
    id: string;
    customer_name: string;
    vehicle_name: string | null;
    end_date: string;
  }>) {
    addAlert(
      ctx,
      "late_return",
      "Late Return",
      `${b.vehicle_name || "Vehicle"} was due back ${b.end_date} — ${b.customer_name}`,
      `late_return_${b.id}`,
      { booking_id: b.id }
    );
  }

  // 2. Pending Pickups — only inside the pickup window
  const { data: pendingPickups } = await supabase
    .from("bookings")
    .select("id, customer_name, vehicle_name, start_date")
    .eq("team_id", teamId)
    .eq("status", "confirmed")
    .gte("start_date", pickupFloor.toISOString())
    .lte("start_date", pickupCeil.toISOString());

  for (const b of (pendingPickups || []) as Array<{
    id: string;
    customer_name: string;
    vehicle_name: string | null;
    start_date: string;
  }>) {
    addAlert(
      ctx,
      "pending_pickup",
      "Pending Pickup",
      `${b.customer_name} is scheduled to pick up ${b.vehicle_name || "a vehicle"} — awaiting handoff`,
      `pending_pickup_${b.id}`,
      { booking_id: b.id }
    );
  }

  // 3. Payment Overdue — only within last 30 days
  const { data: overduePayments } = await supabase
    .from("bookings")
    .select("id, customer_name, vehicle_name, total_value, payment_status")
    .eq("team_id", teamId)
    .in("payment_status", ["unpaid", "partial"])
    .lt("start_date", nowIso)
    .gte("start_date", overdueFloor.toISOString())
    .not("status", "eq", "cancelled");

  for (const b of (overduePayments || []) as Array<{
    id: string;
    customer_name: string;
    vehicle_name: string | null;
    total_value: number | null;
  }>) {
    addAlert(
      ctx,
      "payment_overdue",
      "Payment Overdue",
      `${b.customer_name} owes on booking for ${b.vehicle_name || "vehicle"} ($${b.total_value})`,
      `payment_overdue_${b.id}`,
      { booking_id: b.id }
    );
  }

  // 4. Deposit Due — unchanged 2-day window
  const { data: depositDue } = await supabase
    .from("bookings")
    .select("id, customer_name, vehicle_name, deposit_amount, payment_status")
    .eq("team_id", teamId)
    .not("status", "eq", "cancelled")
    .gt("deposit_amount", 0)
    .not("payment_status", "in", '("paid","deposit_paid")')
    .lte("start_date", depositCeil.toISOString())
    .gte("start_date", nowIso);

  for (const b of (depositDue || []) as Array<{
    id: string;
    customer_name: string;
    vehicle_name: string | null;
    deposit_amount: number;
  }>) {
    addAlert(
      ctx,
      "deposit_due",
      "Deposit Due",
      `$${b.deposit_amount} deposit due from ${b.customer_name} for ${b.vehicle_name || "vehicle"}`,
      `deposit_due_${b.id}`,
      { booking_id: b.id }
    );
  }

  // 5. Maintenance Due — capped lookback
  const { data: maintenanceDue } = await supabase
    .from("maintenance_schedules")
    .select("id, vehicle_id, maintenance_type, scheduled_date")
    .eq("team_id", teamId)
    .lte("scheduled_date", today)
    .gte("scheduled_date", maintenanceFloorDate)
    .not("status", "eq", "completed");

  for (const m of (maintenanceDue || []) as Array<{
    id: string;
    vehicle_id: string;
    maintenance_type: string;
    scheduled_date: string;
  }>) {
    addAlert(
      ctx,
      "maintenance_due",
      "Maintenance Due",
      `${m.maintenance_type} scheduled for ${m.scheduled_date} needs attention`,
      `maintenance_due_${m.id}`,
      { maintenance_id: m.id, vehicle_id: m.vehicle_id }
    );
  }

  if (ctx.notifications.length === 0) return 0;

  // Insert with onConflict ignore on the new unique index. Any duplicate races
  // are silently swallowed at the DB layer.
  const { error: insertError, data: inserted } = await supabase
    .from("notifications")
    .upsert(ctx.notifications, {
      onConflict: "user_id,type,ref",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insertError) {
    console.error(`[check-fleet-alerts] team ${teamId} insert error:`, insertError);
    return 0;
  }
  const created = inserted?.length || 0;
  console.log(`[check-fleet-alerts] team ${teamId}: staged ${ctx.notifications.length}, inserted ${created}`);
  return created;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronToken = Deno.env.get("CRON_TRIGGER_TOKEN");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth: accept either a valid cron token (server-side schedule) or a valid
    // user JWT (manual/legacy single-team trigger).
    const headerToken = req.headers.get("x-cron-token");
    const isCronCall = cronToken && headerToken && headerToken === cronToken;

    let restrictTeamId: string | null = null;

    if (!isCronCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "No auth" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const anonClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!
      );
      const {
        data: { user },
        error: authError,
      } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));

      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: "No team", created: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      restrictTeamId = (membership as { team_id: string }).team_id;
    }

    // Optional ?team_id= override (cron only)
    const url = new URL(req.url);
    const teamIdParam = url.searchParams.get("team_id");
    if (isCronCall && teamIdParam) restrictTeamId = teamIdParam;

    let teamIds: string[];
    if (restrictTeamId) {
      teamIds = [restrictTeamId];
    } else {
      // Cron with no team filter: process every team that has active members.
      const { data: allTeams } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("is_active", true);
      teamIds = Array.from(
        new Set(
          ((allTeams || []) as Array<{ team_id: string }>)
            .map((t) => t.team_id)
            .filter(Boolean)
        )
      );
    }

    let totalCreated = 0;
    let teamsProcessed = 0;
    for (const teamId of teamIds) {
      try {
        totalCreated += await processTeam(supabase, teamId);
        teamsProcessed++;
      } catch (err) {
        console.error(`[check-fleet-alerts] team ${teamId} failed:`, err);
      }
    }

    return new Response(
      JSON.stringify({ created: totalCreated, teams_processed: teamsProcessed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-fleet-alerts error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
