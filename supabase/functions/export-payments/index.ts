import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[EXPORT-PAYMENTS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { format = "csv", start_date, end_date } = await req.json().catch(() => ({}));

    // Build query
    let query = supabaseClient
      .from("payments")
      .select(`
        id,
        amount,
        payment_type,
        payment_method,
        payment_status,
        transaction_date,
        notes,
        created_at,
        booking_id,
        bookings (
          customer_name,
          customer_email,
          start_date,
          end_date,
          vehicle_id,
          vehicles (name, make, model, license_plate)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (start_date) {
      query = query.gte("created_at", start_date);
    }
    if (end_date) {
      query = query.lte("created_at", end_date);
    }

    const { data: payments, error: dbError } = await query;
    if (dbError) throw new Error(`Database error: ${dbError.message}`);

    logStep("Fetched payments", { count: payments?.length || 0 });

    if (format === "csv") {
      // Generate CSV
      const headers = [
        "Date",
        "Transaction ID",
        "Customer Name",
        "Customer Email",
        "Vehicle",
        "Payment Type",
        "Payment Method",
        "Amount",
        "Status",
        "Booking Start",
        "Booking End",
        "Notes"
      ];

      const rows = (payments || []).map((p) => {
        const booking = p.bookings as Record<string, unknown> | null;
        const vehicle = booking?.vehicles as Record<string, unknown> | null;
        return [
          new Date(p.created_at || "").toLocaleDateString(),
          p.id,
          booking?.customer_name || "",
          booking?.customer_email || "",
          vehicle ? `${vehicle.make} ${vehicle.model}` : "",
          p.payment_type || "",
          p.payment_method || "",
          p.amount?.toFixed(2) || "0.00",
          p.payment_status || "",
          booking?.start_date || "",
          booking?.end_date || "",
          (p.notes || "").replace(/,/g, ";").replace(/\n/g, " ")
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      return new Response(csvContent, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="payments-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
        status: 200,
      });
    }

    if (format === "quickbooks") {
      // Generate QuickBooks IIF format
      const iifRows = [
        "!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO",
        "!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO",
        "!ENDTRNS"
      ];

      (payments || []).forEach((p) => {
        const booking = p.bookings as Record<string, unknown> | null;
        const date = new Date(p.created_at || "").toLocaleDateString("en-US");
        const customerName = (booking?.customer_name as string || "Customer").replace(/\t/g, " ");
        const amount = p.amount?.toFixed(2) || "0.00";
        const memo = (p.notes || p.payment_type || "").replace(/\t/g, " ");

        iifRows.push(`TRNS\tPAYMENT\t${date}\tUndeposited Funds\t${customerName}\t${amount}\t${memo}`);
        iifRows.push(`SPL\tPAYMENT\t${date}\tRental Income\t${customerName}\t-${amount}\t${memo}`);
        iifRows.push("ENDTRNS");
      });

      const iifContent = iifRows.join("\n");

      return new Response(iifContent, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename="payments-quickbooks-${new Date().toISOString().split('T')[0]}.iif"`,
        },
        status: 200,
      });
    }

    // Default: return JSON
    return new Response(JSON.stringify({ payments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
