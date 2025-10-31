import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Database query functions
    const tools = [
      {
        type: "function",
        function: {
          name: "getFleetMetrics",
          description: "Get comprehensive fleet metrics including total vehicles, active bookings, revenue, and utilization rates for a specific timeframe",
          parameters: {
            type: "object",
            properties: {
              timeframe: {
                type: "string",
                enum: ["today", "week", "month", "year"],
                description: "Time period for metrics"
              }
            },
            required: ["timeframe"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getVehicleDetails",
          description: "Get detailed information about a specific vehicle including current status, bookings, maintenance history, and performance metrics",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string", description: "Vehicle UUID" },
              includeBookings: { type: "boolean", description: "Include booking history" }
            },
            required: ["vehicleId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getCustomerProfile",
          description: "Get customer profile with booking history, lifetime value, payment history, and preferences",
          parameters: {
            type: "object",
            properties: {
              customerId: { type: "string", description: "Customer UUID" },
              includeHistory: { type: "boolean", description: "Include full booking history" }
            },
            required: ["customerId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "checkAvailability",
          description: "Check vehicle availability for specific date range and identify any conflicts",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string", description: "Vehicle UUID" },
              startDate: { type: "string", description: "Start date ISO format" },
              endDate: { type: "string", description: "End date ISO format" }
            },
            required: ["vehicleId", "startDate", "endDate"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getRevenueAnalysis",
          description: "Analyze revenue by timeframe with breakdowns by vehicle, trends, and comparisons",
          parameters: {
            type: "object",
            properties: {
              timeframe: { type: "string", description: "Analysis period" },
              vehicleId: { type: "string", description: "Optional vehicle filter" }
            },
            required: ["timeframe"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getTopPerformers",
          description: "Get top performing vehicles or customers by specified metric",
          parameters: {
            type: "object",
            properties: {
              metric: {
                type: "string",
                enum: ["revenue", "utilization", "bookings"],
                description: "Performance metric to rank by"
              },
              limit: { type: "number", description: "Number of results to return" }
            },
            required: ["metric", "limit"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "searchBookings",
          description: "Search and filter bookings by status, date range, customer, or vehicle",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", description: "Booking status filter" },
              startDate: { type: "string", description: "Date range start" },
              endDate: { type: "string", description: "Date range end" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getDamageReports",
          description: "Get damage claims and reports with optional filters by status or vehicle",
          parameters: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["open", "resolved", "all"],
                description: "Filter by claim status"
              },
              vehicleId: { type: "string", description: "Optional vehicle filter" }
            },
            required: ["status"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getUpcomingMaintenance",
          description: "Get maintenance schedules for vehicles within specified days ahead",
          parameters: {
            type: "object",
            properties: {
              daysAhead: {
                type: "number",
                description: "Number of days to look ahead for maintenance"
              }
            },
            required: ["daysAhead"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getCustomerLifetimeValue",
          description: "Calculate detailed customer lifetime value including total bookings, revenue, and trends",
          parameters: {
            type: "object",
            properties: {
              customerId: { type: "string", description: "Customer UUID" }
            },
            required: ["customerId"]
          }
        }
      }
    ];

    const systemPrompt = `You are Rari (pronounced "Rarri" like Ferrari), the FleetCopilot™ AI assistant for EXOTIQ luxury car rental operations.

Personality: Confident, knowledgeable, precise - like a luxury concierge with comprehensive fleet intelligence.

You have real-time access to the entire fleet database through function calls. Use them proactively to answer questions with accurate data and metrics.

Capabilities:
- Fleet performance: revenue, utilization, active bookings
- Vehicle details: status, bookings, maintenance, damage reports
- Customer intelligence: profiles, history, lifetime value, trends
- Availability checks: real-time conflict detection
- Revenue analysis: timeframe comparisons, optimization opportunities
- Operational insights: top performers, upcoming maintenance, damage claims

Communication Style:
- Be proactive: if you see optimization opportunities, mention them
- Use metrics and data to back up recommendations
- Keep responses concise but complete
- When discussing revenue or metrics, always provide context (comparisons, trends)
- If you need to call a function, explain what you're checking

Always address users professionally and provide actionable insights.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        tool_choice: "auto",
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
