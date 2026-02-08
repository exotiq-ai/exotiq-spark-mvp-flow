import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate the caller
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

    // Get user's team
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

    const teamId = membership.team_id;
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    // Get all active team members for notifications
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("is_active", true);

    const memberIds = (teamMembers || []).map((m: any) => m.user_id);
    if (memberIds.length === 0) {
      return new Response(
        JSON.stringify({ created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing notification refs for today to deduplicate
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("data")
      .in("user_id", memberIds)
      .gte("created_at", `${today}T00:00:00Z`)
      .not("data", "is", null);

    const existingRefs = new Set(
      (existingNotifs || [])
        .map((n: any) => n.data?.ref)
        .filter(Boolean)
    );

    console.log(`Team ${teamId}: ${memberIds.length} members, ${existingRefs.size} existing refs today`);

    const notifications: any[] = [];

    const addAlert = (
      type: string,
      title: string,
      message: string,
      ref: string,
      extraData: Record<string, any> = {}
    ) => {
      if (existingRefs.has(ref)) return;
      existingRefs.add(ref); // prevent dupes within this run
      for (const userId of memberIds) {
        notifications.push({
          user_id: userId,
          type,
          title,
          message,
          data: { ref, date: today, ...extraData },
        });
      }
    };

    // 1. Late Returns — active/confirmed bookings past end_date
    const { data: lateBookings } = await supabase
      .from("bookings")
      .select("id, customer_name, vehicle_name, end_date")
      .eq("team_id", teamId)
      .in("status", ["active", "confirmed"])
      .lt("end_date", now);

    for (const b of lateBookings || []) {
      addAlert(
        "late_return",
        "Late Return",
        `${b.vehicle_name || "Vehicle"} was due back ${b.end_date} — ${b.customer_name}`,
        `late_return_${b.id}`,
        { booking_id: b.id }
      );
    }

    // 2. Pending Pickups — confirmed bookings with start_date today or past, not yet active
    const { data: pendingPickups } = await supabase
      .from("bookings")
      .select("id, customer_name, vehicle_name, start_date")
      .eq("team_id", teamId)
      .eq("status", "confirmed")
      .lte("start_date", now);

    for (const b of pendingPickups || []) {
      addAlert(
        "pending_pickup",
        "Pending Pickup",
        `${b.customer_name} is scheduled to pick up ${b.vehicle_name || "a vehicle"} — awaiting handoff`,
        `pending_pickup_${b.id}`,
        { booking_id: b.id }
      );
    }

    // 3. Payment Overdue — unpaid/partial bookings past start_date
    const { data: overduePayments } = await supabase
      .from("bookings")
      .select("id, customer_name, vehicle_name, total_value, payment_status")
      .eq("team_id", teamId)
      .in("payment_status", ["unpaid", "partial"])
      .lt("start_date", now)
      .not("status", "eq", "cancelled");

    for (const b of overduePayments || []) {
      addAlert(
        "payment_overdue",
        "Payment Overdue",
        `${b.customer_name} owes on booking for ${b.vehicle_name || "vehicle"} ($${b.total_value})`,
        `payment_overdue_${b.id}`,
        { booking_id: b.id }
      );
    }

    // 4. Deposit Due — deposit > 0, not yet paid, start_date within 2 days
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const twoDaysStr = twoDaysFromNow.toISOString();

    const { data: depositDue } = await supabase
      .from("bookings")
      .select("id, customer_name, vehicle_name, deposit_amount, payment_status")
      .eq("team_id", teamId)
      .not("status", "eq", "cancelled")
      .gt("deposit_amount", 0)
      .not("payment_status", "in", '("paid","deposit_paid")')
      .lte("start_date", twoDaysStr)
      .gte("start_date", now);

    for (const b of depositDue || []) {
      addAlert(
        "deposit_due",
        "Deposit Due",
        `$${b.deposit_amount} deposit due from ${b.customer_name} for ${b.vehicle_name || "vehicle"}`,
        `deposit_due_${b.id}`,
        { booking_id: b.id }
      );
    }

    // 5. Maintenance Due — scheduled today or overdue, not completed
    const { data: maintenanceDue } = await supabase
      .from("maintenance_schedules")
      .select("id, vehicle_id, maintenance_type, scheduled_date")
      .eq("team_id", teamId)
      .lte("scheduled_date", today)
      .not("status", "eq", "completed");

    for (const m of maintenanceDue || []) {
      addAlert(
        "maintenance_due",
        "Maintenance Due",
        `${m.maintenance_type} scheduled for ${m.scheduled_date} needs attention`,
        `maintenance_due_${m.id}`,
        { maintenance_id: m.id, vehicle_id: m.vehicle_id }
      );
    }

    // Bulk insert notifications
    let created = 0;
    if (notifications.length > 0) {
      const { error: insertError, data: inserted } = await supabase
        .from("notifications")
        .insert(notifications)
        .select("id");

      if (insertError) {
        console.error("Insert error:", insertError);
      } else {
        created = inserted?.length || 0;
      }
    }

    console.log(`Created ${created} notifications for team ${teamId}`);

    return new Response(
      JSON.stringify({ created, total_checked: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-fleet-alerts error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
