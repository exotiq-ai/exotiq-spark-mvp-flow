import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Hardcoded demo team — no user input controls this
const DEMO_TEAM_ID = "c1de6533-ab44-4973-a123-007a8007b5ba";

// Curated vehicle IDs (most photogenic fleet)
const CURATED_VEHICLE_IDS = [
  "63feeaf7-ea17-4dfd-ba0e-0c1f90f4df58", // Ferrari F8 Tributo
  "b10e229f-fdde-4635-a629-497547a3e9c3", // McLaren 765LT
  "b0db7c2e-65e2-4dd1-a3f4-413d65639825", // McLaren GT
  "d32c8aea-edd9-41d5-a944-a3cafd40fd62", // Porsche GT3 RS
  "04a58a47-d292-44e8-b169-eb955a620231", // Rolls-Royce Cullinan
  "2209f34f-7920-4330-b656-c86ef3ac43c5", // Lamborghini Urus
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS and read demo team data
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parallel fetch of curated demo data
    const [vehiclesRes, bookingsRes, customersRes, paymentsRes] = await Promise.all([
      supabase
        .from("vehicles")
        .select("*")
        .eq("team_id", DEMO_TEAM_ID)
        .in("id", CURATED_VEHICLE_IDS),
      supabase
        .from("bookings")
        .select("*")
        .eq("team_id", DEMO_TEAM_ID)
        .order("start_date", { ascending: false })
        .limit(50),
      supabase
        .from("customers")
        .select("*")
        .eq("team_id", DEMO_TEAM_ID)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("payments")
        .select("*")
        .eq("team_id", DEMO_TEAM_ID)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const vehicles = vehiclesRes.data || [];
    const bookings = bookingsRes.data || [];
    const customers = customersRes.data || [];
    const payments = paymentsRes.data || [];

    // Compute revenue metrics from bookings
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const confirmedBookings = bookings.filter(
      (b: any) => b.status === "confirmed" || b.status === "completed"
    );

    const todayRevenue = confirmedBookings
      .filter((b: any) => new Date(b.start_date) >= todayStart)
      .reduce((sum: number, b: any) => sum + (parseFloat(b.total_value) || 0), 0);

    const monthRevenue = confirmedBookings
      .filter((b: any) => new Date(b.start_date) >= monthStart)
      .reduce((sum: number, b: any) => sum + (parseFloat(b.total_value) || 0), 0);

    // Utilization: active bookings / total vehicles
    const activeBookings = bookings.filter((b: any) => {
      const start = new Date(b.start_date);
      const end = new Date(b.end_date);
      return start <= now && end >= now && (b.status === "confirmed" || b.status === "active");
    });
    const utilization = vehicles.length > 0
      ? Math.round((activeBookings.length / vehicles.length) * 100)
      : 0;

    const avgDailyRate = confirmedBookings.length > 0
      ? Math.round(
          confirmedBookings.reduce((sum: number, b: any) => sum + (parseFloat(b.daily_rate) || 0), 0) /
          confirmedBookings.length
        )
      : 0;

    const snapshot = {
      vehicles,
      bookings,
      customers,
      payments,
      revenue: {
        today: todayRevenue,
        month: monthRevenue,
        change: 12, // Simulated positive trend
      },
      metrics: {
        utilization,
        avgDailyRate,
        activeBookings: activeBookings.length,
        totalVehicles: vehicles.length,
      },
    };

    return new Response(JSON.stringify(snapshot), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("demo-data-snapshot error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
