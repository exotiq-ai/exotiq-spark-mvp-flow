import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const authHeader = req.headers.get('Authorization');
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client for database queries
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from auth header
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    const userId = user?.id;

    if (!userId) {
      throw new Error("User not authenticated");
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
              vehicleName: { type: "string", description: "Vehicle name (e.g., 'Ferrari 488 GTB')" },
              includeBookings: { type: "boolean", description: "Include booking history" }
            },
            required: ["vehicleName"]
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
              customerName: { type: "string", description: "Customer full name" },
              includeHistory: { type: "boolean", description: "Include full booking history" }
            },
            required: ["customerName"]
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
              vehicleName: { type: "string", description: "Vehicle name" },
              startDate: { type: "string", description: "Start date ISO format" },
              endDate: { type: "string", description: "End date ISO format" }
            },
            required: ["vehicleName", "startDate", "endDate"]
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
              timeframe: { type: "string", description: "Analysis period (today/week/month/year)" },
              vehicleName: { type: "string", description: "Optional vehicle filter" }
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
              status: { type: "string", description: "Booking status filter (pending/confirmed/active/completed/cancelled)" },
              daysRange: { type: "number", description: "Look back/forward this many days from today" }
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
              }
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
              customerName: { type: "string", description: "Customer full name" }
            },
            required: ["customerName"]
          }
        }
      }
    ];

    // Database query implementations
    async function executeFunction(functionName: string, args: any) {
      console.log(`Executing function: ${functionName}`, args);

      try {
        switch (functionName) {
          case "getFleetMetrics": {
            const { timeframe } = args;
            let dateFilter = new Date();
            
            if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
            else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
            else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
            else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);

            const [vehicles, bookings, revenue] = await Promise.all([
              supabase.from('vehicles').select('*').eq('user_id', userId),
              supabase.from('bookings').select('*').eq('user_id', userId).gte('created_at', dateFilter.toISOString()),
              supabase.from('bookings').select('total_value').eq('user_id', userId).eq('status', 'completed').gte('created_at', dateFilter.toISOString())
            ]);

            const totalRevenue = revenue.data?.reduce((sum, b) => sum + Number(b.total_value || 0), 0) || 0;
            const activeBookings = bookings.data?.filter(b => b.status === 'active' || b.status === 'confirmed').length || 0;

            return {
              totalVehicles: vehicles.data?.length || 0,
              activeBookings,
              totalBookings: bookings.data?.length || 0,
              revenue: totalRevenue,
              timeframe
            };
          }

          case "getVehicleDetails": {
            const { vehicleName, includeBookings } = args;
            
            const { data: vehicle } = await supabase
              .from('vehicles')
              .select('*')
              .eq('user_id', userId)
              .ilike('name', `%${vehicleName}%`)
              .single();

            if (!vehicle) return { error: "Vehicle not found" };

            let bookingsData = null;
            if (includeBookings) {
              const { data: bookings } = await supabase
                .from('bookings')
                .select('*')
                .eq('vehicle_id', vehicle.id)
                .order('start_date', { ascending: false })
                .limit(10);
              bookingsData = bookings;
            }

            return { vehicle, bookings: bookingsData };
          }

          case "getCustomerProfile": {
            const { customerName, includeHistory } = args;
            
            const { data: customer } = await supabase
              .from('customers')
              .select('*')
              .eq('user_id', userId)
              .ilike('full_name', `%${customerName}%`)
              .single();

            if (!customer) return { error: "Customer not found" };

            let bookingsData = null;
            if (includeHistory) {
              const { data: bookings } = await supabase
                .from('bookings')
                .select('*, vehicles(name)')
                .eq('customer_id', customer.id)
                .order('start_date', { ascending: false });
              bookingsData = bookings;
            }

            return { customer, bookings: bookingsData };
          }

          case "checkAvailability": {
            const { vehicleName, startDate, endDate } = args;
            
            const { data: vehicle } = await supabase
              .from('vehicles')
              .select('id, name, status')
              .eq('user_id', userId)
              .ilike('name', `%${vehicleName}%`)
              .single();

            if (!vehicle) return { error: "Vehicle not found" };

            const { data: conflicts } = await supabase
              .from('bookings')
              .select('*')
              .eq('vehicle_id', vehicle.id)
              .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);

            return {
              vehicle: vehicle.name,
              available: conflicts?.length === 0,
              conflicts: conflicts || []
            };
          }

          case "getRevenueAnalysis": {
            const { timeframe, vehicleName } = args;
            let dateFilter = new Date();
            
            if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
            else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
            else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
            else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);

            let query = supabase
              .from('bookings')
              .select('total_value, vehicles(name)')
              .eq('user_id', userId)
              .gte('created_at', dateFilter.toISOString());

            if (vehicleName) {
              const { data: vehicle } = await supabase
                .from('vehicles')
                .select('id')
                .eq('user_id', userId)
                .ilike('name', `%${vehicleName}%`)
                .single();
              if (vehicle) query = query.eq('vehicle_id', vehicle.id);
            }

            const { data: bookings } = await query;
            const totalRevenue = bookings?.reduce((sum, b) => sum + Number(b.total_value || 0), 0) || 0;

            return { totalRevenue, bookingCount: bookings?.length || 0, timeframe };
          }

          case "getTopPerformers": {
            const { metric, limit } = args;
            
            if (metric === 'revenue') {
              const { data: vehicles } = await supabase
                .from('vehicles')
                .select('name, revenue')
                .eq('user_id', userId)
                .order('revenue', { ascending: false })
                .limit(limit);
              return { metric: 'revenue', performers: vehicles };
            } else if (metric === 'utilization') {
              const { data: vehicles } = await supabase
                .from('vehicles')
                .select('name, utilization')
                .eq('user_id', userId)
                .order('utilization', { ascending: false })
                .limit(limit);
              return { metric: 'utilization', performers: vehicles };
            } else {
              const { data: customers } = await supabase
                .from('customers')
                .select('full_name, total_bookings')
                .eq('user_id', userId)
                .order('total_bookings', { ascending: false })
                .limit(limit);
              return { metric: 'bookings', performers: customers };
            }
          }

          case "searchBookings": {
            const { status, daysRange } = args;
            let query = supabase
              .from('bookings')
              .select('*, vehicles(name), customers(full_name)')
              .eq('user_id', userId);

            if (status) query = query.eq('status', status);
            
            if (daysRange) {
              const dateFilter = new Date();
              dateFilter.setDate(dateFilter.getDate() - daysRange);
              query = query.gte('start_date', dateFilter.toISOString());
            }

            const { data: bookings } = await query.order('start_date', { ascending: false }).limit(20);
            return { bookings: bookings || [], count: bookings?.length || 0 };
          }

          case "getDamageReports": {
            const { status } = args;
            let query = supabase
              .from('damage_claims')
              .select('*, vehicles(name)')
              .eq('user_id', userId);

            if (status !== 'all') query = query.eq('claim_status', status);

            const { data: claims } = await query.order('reported_date', { ascending: false });
            return { claims: claims || [], count: claims?.length || 0 };
          }

          case "getUpcomingMaintenance": {
            const { daysAhead } = args;
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysAhead);

            const { data: maintenance } = await supabase
              .from('maintenance_schedules')
              .select('*, vehicles(name)')
              .eq('user_id', userId)
              .lte('scheduled_date', futureDate.toISOString())
              .gte('scheduled_date', new Date().toISOString())
              .order('scheduled_date', { ascending: true });

            return { maintenance: maintenance || [], count: maintenance?.length || 0 };
          }

          case "getCustomerLifetimeValue": {
            const { customerName } = args;
            
            const { data: customer } = await supabase
              .from('customers')
              .select('full_name, lifetime_value, total_bookings')
              .eq('user_id', userId)
              .ilike('full_name', `%${customerName}%`)
              .single();

            if (!customer) return { error: "Customer not found" };

            return { customer };
          }

          default:
            return { error: "Unknown function" };
        }
      } catch (error) {
        console.error(`Error in ${functionName}:`, error);
        return { error: error.message };
      }
    }

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
- Always call the appropriate function to get real data before answering

Always address users professionally and provide actionable insights based on REAL data from the database.`;

    // Make initial AI request
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // Check if AI wants to call functions
    const choice = aiResponse.choices?.[0];
    if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
      // Execute all function calls
      const functionResults = await Promise.all(
        choice.message.tool_calls.map(async (toolCall: any) => {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          const result = await executeFunction(functionName, functionArgs);
          
          return {
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: JSON.stringify(result)
          };
        })
      );

      // Send function results back to AI for final response
      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            choice.message,
            ...functionResults
          ],
          stream: true,
        }),
      });

      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No function calls, return direct response as stream
    const textContent = choice?.message?.content || "I'm here to help with your fleet operations!";
    const streamData = `data: ${JSON.stringify({ choices: [{ delta: { content: textContent } }] })}\n\ndata: [DONE]\n\n`;
    
    return new Response(streamData, {
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
