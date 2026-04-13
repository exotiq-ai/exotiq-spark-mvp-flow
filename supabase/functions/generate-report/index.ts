import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

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

    switch (reportType) {
      case "revenue":
        reportContent = generateRevenueReport(data, dateRange);
        break;
      case "utilization":
        reportContent = generateUtilizationReport(data, dateRange);
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

function generateUtilizationReport(data: any, dateRange: { start: string; end: string }) {
  const vehicles = data?.vehicles || [];
  const bookings = data?.bookings || [];

  const vehicleStats = vehicles.map((v: any) => {
    const vehicleBookings = bookings.filter((b: any) => b.vehicle_id === v.id);
    const revenue = vehicleBookings.reduce((sum: number, b: any) => sum + Number(b.total_value), 0);

    return {
      id: v.id,
      name: v.name,
      utilization: v.utilization || 0,
      revenue,
      bookingCount: vehicleBookings.length,
      currentRate: v.current_rate,
    };
  });

  const avgUtilization = vehicleStats.length > 0
    ? Math.round(vehicleStats.reduce((sum: number, v: any) => sum + v.utilization, 0) / vehicleStats.length)
    : 0;

  return {
    summary: {
      totalVehicles: vehicles.length,
      avgUtilization,
      highPerformers: vehicleStats.filter((v: any) => v.utilization >= 80).length,
      underperformers: vehicleStats.filter((v: any) => v.utilization < 50).length,
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
