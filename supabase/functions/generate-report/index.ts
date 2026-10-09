import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { logTransfer } from "../_shared/transferGuard.ts";
import { COUNTED_STATUSES, occupiedDays, addDays, safeTimeZone } from "../_shared/motoriq/facts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  reportType: string;
  dateRange: { start: string; end: string };
  format: string;
  data?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { reportType, dateRange, format, data }: ReportRequest = await req.json();

    console.log(`Generating ${reportType} report for ${dateRange.start} to ${dateRange.end}`);

    // Generate report content based on type
    let reportContent: any;

    // The team's time zone: days in a report are the tenant's calendar days.
    let tz = "UTC";
    try {
      const { data: member } = await supabase
        .from("team_members").select("team_id").eq("user_id", claimsData.claims.sub).eq("is_active", true).limit(1).maybeSingle();
      if (member?.team_id) {
        const { data: team } = await supabase.from("teams").select("timezone").eq("id", member.team_id).maybeSingle();
        tz = safeTimeZone(team?.timezone);
      }
    } catch (_) { /* UTC */ }

    switch (reportType) {
      case "revenue":
        reportContent = generateRevenueReport(data, dateRange);
        break;
      case "utilization":
        reportContent = generateUtilizationReport(data, dateRange, tz);
        break;
      case "bookings":
        reportContent = generateBookingsReport(data, dateRange);
        break;
      case "customers":
        reportContent = generateCustomerReport(data, dateRange);
        break;
      case "documents":
        reportContent = generateDocumentsReport(data, dateRange);
        break;
      default:
        reportContent = { error: "Unknown report type" };
    }

    // If AI insights are requested, generate them
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiInsights = null;

    if (LOVABLE_API_KEY && data) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are a fleet management analytics expert. Provide 2-3 concise, actionable insights based on the data provided. Keep each insight under 50 words. Focus on revenue optimization, utilization improvement, and risk identification.",
              },
              {
                role: "user",
                content: `Analyze this ${reportType} data for the period ${dateRange.start} to ${dateRange.end}: ${JSON.stringify(reportContent.summary || reportContent)}`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiInsights = aiData.choices?.[0]?.message?.content || null;
          logTransfer({
            team_id: ((claimsData.claims as any).team_id as string) ?? null,
            user_id: ((claimsData.claims as any).sub as string) ?? null,
            caller: "generate-report",
            model: "google/gemini-2.5-flash",
            provider: "Google (Gemini via Lovable AI Gateway)",
            provider_region: "United States / Global",
            response_bytes: aiInsights ? aiInsights.length : 0,
            status: "ok",
          }).catch(() => {});
        }
      } catch (aiError) {
        console.error("AI insights error:", aiError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reportType,
        dateRange,
        format,
        content: reportContent,
        aiInsights,
        generatedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Report generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateRevenueReport(data: any, dateRange: { start: string; end: string }) {
  const bookings = data?.bookings || [];
  const payments = data?.payments || [];

  const totalRevenue = payments
    .filter((p: any) => p.payment_status === "completed")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  const totalBookingValue = bookings.reduce((sum: number, b: any) => sum + Number(b.total_value), 0);
  const avgBookingValue = bookings.length > 0 ? totalBookingValue / bookings.length : 0;

  return {
    summary: {
      totalRevenue,
      totalBookings: bookings.length,
      avgBookingValue: Math.round(avgBookingValue),
      collectionRate: totalBookingValue > 0 ? Math.round((totalRevenue / totalBookingValue) * 100) : 0,
    },
    details: bookings.map((b: any) => ({
      id: b.id,
      customer: b.customer_name,
      value: b.total_value,
      status: b.status,
      startDate: b.start_date,
    })),
  };
}

/**
 * Utilization over the chosen period, measured from the bookings themselves: the share of the period's days a car
 * was booked, counting active/confirmed/completed bookings only, in the tenant's time zone. The stored
 * vehicles.utilization column is not maintained by anything and is never read.
 */
function generateUtilizationReport(data: any, dateRange: { start: string; end: string }, tz: string) {
  const vehicles = (data?.vehicles || []).filter((v: any) => !v.archived_at && !v.trashed_at);
  const bookings = data?.bookings || [];

  const from = String(dateRange.start).slice(0, 10);
  const to = String(dateRange.end).slice(0, 10);
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 366; d = addDays(d, 1)) days.push(d);
  const inPeriod = new Set(days);

  const vehicleStats = vehicles.map((v: any) => {
    const counted = bookings.filter((b: any) => b.vehicle_id === v.id && COUNTED_STATUSES.has(String(b.status ?? "completed")));
    const booked = new Set<string>();
    let overlapping = 0;
    let revenue = 0;
    for (const b of counted) {
      const hit = occupiedDays(b, tz).filter((d) => inPeriod.has(d));
      if (hit.length === 0) continue;
      hit.forEach((d) => booked.add(d));
      overlapping += 1;
      revenue += Number(b.total_value || 0);
    }
    return {
      id: v.id,
      name: v.name,
      outOfService: String(v.status ?? "").toLowerCase() === "maintenance",
      utilization: days.length > 0 ? Math.round((booked.size / days.length) * 100) : 0,
      bookedDays: booked.size,
      revenue,
      bookingCount: overlapping,
      currentRate: v.current_rate,
    };
  });

  const rentable = vehicleStats.filter((v: any) => !v.outOfService);
  const avgUtilization = rentable.length > 0 && days.length > 0
    ? Math.round(rentable.reduce((sum: number, v: any) => sum + v.utilization, 0) / rentable.length)
    : 0;

  return {
    summary: {
      totalVehicles: vehicles.length,
      avgUtilization,
      periodDays: days.length,
      howMeasured: "Booked days divided by days in the period, from your bookings, in your time zone. Cancelled and unconfirmed bookings are not counted; cars in maintenance are left out of the average.",
      highPerformers: rentable.filter((v: any) => v.utilization >= 80).length,
      underperformers: rentable.filter((v: any) => v.utilization < 50).length,
    },
    details: vehicleStats,
  };
}

function generateBookingsReport(data: any, dateRange: { start: string; end: string }) {
  const bookings = data?.bookings || [];

  const statusCounts = bookings.reduce((acc: any, b: any) => {
    acc[b.status || "unknown"] = (acc[b.status || "unknown"] || 0) + 1;
    return acc;
  }, {});

  return {
    summary: {
      totalBookings: bookings.length,
      confirmed: statusCounts.confirmed || 0,
      pending: statusCounts.pending || 0,
      completed: statusCounts.completed || 0,
      cancelled: statusCounts.cancelled || 0,
    },
    details: bookings.map((b: any) => ({
      id: b.id,
      customer: b.customer_name,
      vehicle: b.vehicle_id,
      startDate: b.start_date,
      endDate: b.end_date,
      value: b.total_value,
      status: b.status,
    })),
  };
}

function generateCustomerReport(data: any, dateRange: { start: string; end: string }) {
  const customers = data?.customers || [];

  const totalLifetimeValue = customers.reduce((sum: number, c: any) => sum + Number(c.lifetime_value || 0), 0);
  const avgLifetimeValue = customers.length > 0 ? totalLifetimeValue / customers.length : 0;

  return {
    summary: {
      totalCustomers: customers.length,
      activeCustomers: customers.filter((c: any) => c.customer_status === "active").length,
      avgLifetimeValue: Math.round(avgLifetimeValue),
      totalLifetimeValue: Math.round(totalLifetimeValue),
    },
    details: customers.map((c: any) => ({
      id: c.id,
      name: c.full_name,
      email: c.email,
      totalBookings: c.total_bookings || 0,
      lifetimeValue: c.lifetime_value || 0,
      status: c.customer_status,
    })),
  };
}

function generateDocumentsReport(data: any, dateRange: { start: string; end: string }) {
  const documents = data?.documents || [];

  const statusCounts = documents.reduce((acc: any, d: any) => {
    acc[d.status || "unknown"] = (acc[d.status || "unknown"] || 0) + 1;
    return acc;
  }, {});

  const expiringSoon = documents.filter((d: any) => {
    if (!d.expires_at) return false;
    const expiryDate = new Date(d.expires_at);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiryDate <= thirtyDaysFromNow && expiryDate > new Date();
  });

  return {
    summary: {
      totalDocuments: documents.length,
      active: statusCounts.active || 0,
      expired: statusCounts.expired || 0,
      expiringSoon: expiringSoon.length,
    },
    details: documents.map((d: any) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      status: d.status,
      expiresAt: d.expires_at,
    })),
  };
}
