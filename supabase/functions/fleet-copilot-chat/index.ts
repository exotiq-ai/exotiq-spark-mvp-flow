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

    // Validate messages input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (messages.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Too many messages (max 50)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate each message
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return new Response(
          JSON.stringify({ error: 'Invalid message format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (msg.content.length > 10000) {
        return new Response(
          JSON.stringify({ error: 'Message content too long (max 10000 chars)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Database query functions
    const tools = [
      {
        type: "function",
        name: "getFleetMetrics",
        description: "Get overall fleet performance metrics for a specific time period",
        parameters: {
          type: "object",
          properties: {
            timeframe: {
              type: "string",
              enum: ["today", "week", "month", "year"],
              description: "The timeframe for metrics"
            }
          },
          required: ["timeframe"]
        }
      },
      {
        type: "function",
        name: "getVehicleDetails",
        description: "Get detailed information about a specific vehicle, optionally including booking history",
        parameters: {
          type: "object",
          properties: {
            vehicleName: { type: "string", description: "The vehicle name or partial name" },
            includeBookings: { type: "boolean", description: "Whether to include booking history", default: false }
          },
          required: ["vehicleName"]
        }
      },
      {
        type: "function",
        name: "getCustomerProfile",
        description: "Get customer details and optionally their booking history",
        parameters: {
          type: "object",
          properties: {
            customerName: { type: "string", description: "The customer name or partial name" },
            includeHistory: { type: "boolean", description: "Whether to include booking history", default: false }
          },
          required: ["customerName"]
        }
      },
      {
        type: "function",
        name: "checkAvailability",
        description: "Check if a vehicle is available for a specific date range",
        parameters: {
          type: "object",
          properties: {
            vehicleName: { type: "string", description: "The vehicle name" },
            startDate: { type: "string", description: "Start date in ISO format" },
            endDate: { type: "string", description: "End date in ISO format" }
          },
          required: ["vehicleName", "startDate", "endDate"]
        }
      },
      {
        type: "function",
        name: "getRevenueAnalysis",
        description: "Get revenue analysis for a timeframe, optionally filtered by vehicle",
        parameters: {
          type: "object",
          properties: {
            timeframe: { type: "string", enum: ["today", "week", "month", "year"] },
            vehicleName: { type: "string", description: "Optional vehicle name filter" }
          },
          required: ["timeframe"]
        }
      },
      {
        type: "function",
        name: "getTopPerformers",
        description: "Get top performing vehicles or customers by a specific metric",
        parameters: {
          type: "object",
          properties: {
            metric: { type: "string", enum: ["revenue", "utilization", "bookings"] },
            limit: { type: "number", description: "Number of results to return", default: 5 }
          },
          required: ["metric"]
        }
      },
      {
        type: "function",
        name: "searchBookings",
        description: "Search bookings with optional filters",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", description: "Booking status filter (confirmed, active, completed, cancelled)" },
            daysRange: { type: "number", description: "Number of days to look back" }
          }
        }
      },
      {
        type: "function",
        name: "getDamageReports",
        description: "Get damage claims with status filter",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["open", "resolved", "all"], default: "all" }
          },
          required: ["status"]
        }
      },
      {
        type: "function",
        name: "getUpcomingMaintenance",
        description: "Get upcoming maintenance schedules",
        parameters: {
          type: "object",
          properties: {
            daysAhead: { type: "number", description: "Number of days to look ahead", default: 30 }
          },
          required: ["daysAhead"]
        }
      },
      {
        type: "function",
        name: "getCustomerLifetimeValue",
        description: "Calculate customer lifetime value",
        parameters: {
          type: "object",
          properties: {
            customerName: { type: "string", description: "Customer name" }
          },
          required: ["customerName"]
        }
      },
      {
        type: "function",
        name: "getVaultDocuments",
        description: "Get documents from the vault with optional filters",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", description: "Document category (insurance, registration, inspection, license)" },
            status: { type: "string", description: "Document status (active, expiring, urgent)" }
          }
        }
      },
      {
        type: "function",
        name: "getWeatherInfo",
        description: "Get current weather information for a location",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City or location name" }
          },
          required: ["location"]
        }
      },
      {
        type: "function",
        name: "getCarJoke",
        description: "Get a random automotive-related joke",
        parameters: {
          type: "object",
          properties: {}
        }
      },
      {
        type: "function",
        name: "getVehicleSpecs",
        description: "Get performance specifications for exotic vehicles",
        parameters: {
          type: "object",
          properties: {
            vehicleName: { type: "string", description: "The vehicle make and model" }
          },
          required: ["vehicleName"]
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

          case "getVaultDocuments": {
            const { category, status } = args;
            
            const { data: documents } = await supabase
              .from('vehicle_documents')
              .select('*')
              .eq('user_id', userId);

            // Mock document structure since we don't have real documents yet
            const mockDocs = [
              { name: "McLaren 720S Insurance", category: "insurance", status: "active", expires: "2025-03-15" },
              { name: "Ferrari SF90 Registration", category: "registration", status: "active", expires: "2025-06-30" },
              { name: "Lamborghini Service Record", category: "inspection", status: "expiring", expires: "2024-11-18" }
            ];

            return { 
              documents: mockDocs,
              summary: `Found ${mockDocs.length} documents in vault`
            };
          }

          case "getWeatherInfo": {
            const { location } = args;
            
            // Simulated weather data - in production integrate with actual weather API
            const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain"];
            return {
              location,
              temperature: `${Math.floor(Math.random() * 30) + 60}°F`,
              conditions: conditions[Math.floor(Math.random() * conditions.length)],
              humidity: `${Math.floor(Math.random() * 40) + 40}%`,
              wind: `${Math.floor(Math.random() * 15) + 5} mph`,
              note: "Weather data is simulated for demo purposes"
            };
          }

          case "getCarJoke": {
            const jokes = [
              "Why did the exotic car break up with the sedan? It said their relationship had no spark plugs!",
              "What do you call a Lamborghini that's been in an accident? A Lamb-bore-gini!",
              "Why don't Ferraris ever get lost? Because they always follow the red line!",
              "What's a McLaren's favorite music? Heavy metal... and carbon fiber!",
              "Why did the Bugatti go to therapy? It had too many speed issues!",
              "What do you call a Porsche in the winter? A Porsicle!",
              "Why are exotic cars terrible at poker? They always show their hand... on the dashboard!",
              "What's an Aston Martin's favorite movie? The Fast and the Luxurious!",
              "Why did the exotic car go to school? To get more horsepower... I mean, brain power!",
              "What's a supercar's least favorite day? Brake day!"
            ];
            return { joke: jokes[Math.floor(Math.random() * jokes.length)] };
          }

          case "getVehicleSpecs": {
            const { vehicleName } = args;
            
            // Performance specs database
            const specsDatabase: Record<string, any> = {
              "ferrari sf90": {
                make: "Ferrari",
                model: "SF90 Stradale",
                engine: "4.0L V8 + Electric Motors",
                horsepower: "986 hp",
                torque: "590 lb-ft",
                acceleration: "2.5 sec (0-60 mph)",
                topSpeed: "211 mph",
                drivetrain: "AWD",
                weight: "3,461 lbs"
              },
              "lamborghini aventador": {
                make: "Lamborghini",
                model: "Aventador SVJ",
                engine: "6.5L V12",
                horsepower: "770 hp",
                torque: "531 lb-ft",
                acceleration: "2.8 sec (0-60 mph)",
                topSpeed: "217 mph",
                drivetrain: "AWD",
                weight: "3,362 lbs"
              },
              "mclaren 720s": {
                make: "McLaren",
                model: "720S",
                engine: "4.0L Twin-Turbo V8",
                horsepower: "710 hp",
                torque: "568 lb-ft",
                acceleration: "2.8 sec (0-60 mph)",
                topSpeed: "212 mph",
                drivetrain: "RWD",
                weight: "3,128 lbs"
              },
              "porsche 911 turbo s": {
                make: "Porsche",
                model: "911 Turbo S",
                engine: "3.8L Twin-Turbo Flat-6",
                horsepower: "640 hp",
                torque: "590 lb-ft",
                acceleration: "2.6 sec (0-60 mph)",
                topSpeed: "205 mph",
                drivetrain: "AWD",
                weight: "3,636 lbs"
              },
              "bugatti chiron": {
                make: "Bugatti",
                model: "Chiron Sport",
                engine: "8.0L Quad-Turbo W16",
                horsepower: "1,479 hp",
                torque: "1,180 lb-ft",
                acceleration: "2.4 sec (0-60 mph)",
                topSpeed: "261 mph",
                drivetrain: "AWD",
                weight: "4,400 lbs"
              }
            };

            const normalizedName = vehicleName.toLowerCase();
            const matchedKey = Object.keys(specsDatabase).find(key => 
              normalizedName.includes(key) || key.includes(normalizedName)
            );

            if (matchedKey) {
              return specsDatabase[matchedKey];
            }

            return {
              note: `Performance specs for ${vehicleName} not found. Try: Ferrari SF90, Lamborghini Aventador, McLaren 720S, Porsche 911 Turbo S, or Bugatti Chiron.`
            };
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

Current Date: October 31, 2025

Core Personality: 
- Confident automotive expert with deep passion for exotic cars
- Professional luxury concierge with real-time fleet intelligence
- Conversational and engaging - you LOVE talking about cars
- Precise and data-driven when providing business insights

Your Dual Capabilities:

1. FLEET OPERATIONS (use function calls for real data):
   - Fleet performance: revenue, utilization, active bookings
   - Vehicle details: status, bookings, maintenance, damage reports
   - Customer intelligence: profiles, history, lifetime value
   - Availability checking and booking analysis
   - Damage reports and maintenance schedules
   - Vault documents and compliance information

2. AUTOMOTIVE EXPERTISE (use your knowledge freely):
   - Performance specifications for exotic vehicles
   - Automotive history, engineering, and technology
   - Car comparisons, recommendations, and insights
   - Racing heritage and motorsports knowledge
   - Automotive jokes and humor (keep it classy)
   - Industry trends and market insights

Communication Guidelines:
- When asked about fleet data → Use function calls for accurate real-time information
- When asked about cars in general → Draw from your automotive expertise freely
- ALWAYS provide complete responses - NEVER truncate important information
- Use clear formatting with bullet points for lists
- Format currency as $X,XXX.XX
- If you need to provide a long response, organize it with clear sections
- Be conversational but professional - imagine you're a luxury car dealership manager who genuinely loves cars

Examples:
- "What's our revenue today?" → Use getFleetMetrics() function
- "Tell me about the Ferrari SF90's engine" → Answer from your automotive knowledge
- "What's the fastest car in our fleet?" → Use getVehicleDetails() + your specs knowledge
- "Tell me a car joke" → Share something fun and classy
- "Compare the Lamborghini Aventador vs McLaren 720S" → Use your engineering knowledge

Remember: You're not just a database assistant - you're an automotive enthusiast who happens to have access to real-time fleet data. Be knowledgeable, passionate, and helpful!`;

    // Trim conversation history to most recent 15 messages to reduce payload size
    const trimmedMessages = messages.slice(-15);
    console.log(`📊 Message count: ${messages.length} → ${trimmedMessages.length} (trimmed)`);

    // Retry wrapper with exponential backoff for AI gateway calls
    const callAIGatewayWithRetry = async (requestBody: any, streamResponse = false, retryCount = 0): Promise<Response> => {
      const maxRetries = 2;
      const retryDelays = [300, 900]; // ms
      const useFallback = retryCount > 0;
      const modelToUse = useFallback ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash";

      console.log(`🤖 AI Request - Model: ${modelToUse}, Retry: ${retryCount}/${maxRetries}`);
      const requestStartTime = Date.now();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...requestBody,
            model: modelToUse,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        const duration = Date.now() - requestStartTime;
        console.log(`⏱️ AI gateway response: ${response.status} (${duration}ms, model: ${modelToUse})`);

        // Handle rate limits - no retry
        if (response.status === 429) {
          console.error("🚨 Rate limit exceeded (429)");
          return new Response(
            JSON.stringify({ 
              error: "RATE_LIMIT_EXCEEDED",
              message: "Rate limit exceeded. Please wait and try again.",
              retryable: false 
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle payment required - no retry
        if (response.status === 402) {
          console.error("🚨 Payment required (402)");
          return new Response(
            JSON.stringify({ 
              error: "SERVICE_UNAVAILABLE",
              message: "Service credits depleted. Please contact support.",
              retryable: false 
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle 5xx errors with retry
        if (response.status >= 500 && retryCount < maxRetries) {
          const errorText = await response.text();
          console.error(`🚨 AI gateway 5xx error (attempt ${retryCount + 1}/${maxRetries + 1}):`, response.status, errorText);
          
          // Wait before retry
          const delay = retryDelays[retryCount];
          console.log(`⏳ Retrying in ${delay}ms with ${retryCount === 0 ? 'same model' : 'fallback model'}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return callAIGatewayWithRetry(requestBody, streamResponse, retryCount + 1);
        }

        // If still failing after retries
        if (!response.ok) {
          const errorText = await response.text();
          console.error("🚨 AI gateway final error:", response.status, errorText);
          return new Response(
            JSON.stringify({ 
              error: "AI_GATEWAY_ERROR",
              message: "AI service temporarily unavailable. Please try again.",
              retryable: true,
              usedFallback: useFallback
            }),
            { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Success - log if using fallback
        if (useFallback) {
          console.log("✅ Request succeeded using fallback model");
        }

        return response;

      } catch (error: any) {
        const duration = Date.now() - requestStartTime;
        
        if (error.name === 'AbortError') {
          console.error(`🚨 Request timeout after ${duration}ms (attempt ${retryCount + 1})`);
          if (retryCount < maxRetries) {
            const delay = retryDelays[retryCount];
            console.log(`⏳ Retrying after timeout in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return callAIGatewayWithRetry(requestBody, streamResponse, retryCount + 1);
          }
          return new Response(
            JSON.stringify({ 
              error: "AI_GATEWAY_TIMEOUT",
              message: "Request timeout. Please try again.",
              retryable: true 
            }),
            { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.error(`🚨 Unexpected error (attempt ${retryCount + 1}):`, error);
        if (retryCount < maxRetries) {
          const delay = retryDelays[retryCount];
          await new Promise(resolve => setTimeout(resolve, delay));
          return callAIGatewayWithRetry(requestBody, streamResponse, retryCount + 1);
        }

        throw error;
      }
    };

    // Make initial AI request with retry logic
    const response = await callAIGatewayWithRetry({
      messages: [
        { role: "system", content: systemPrompt },
        ...trimmedMessages,
      ],
      tools,
    });

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // Check if response contains an error (from retry exhaustion)
    if (aiResponse.error) {
      return new Response(
        JSON.stringify(aiResponse),
        { 
          status: response.status || 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

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

      // Send function results back to AI for final response with retry logic
      const finalResponse = await callAIGatewayWithRetry({
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmedMessages,
          choice.message,
          ...functionResults
        ],
        stream: true,
      }, true);

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
    console.error("🚨 Chat error:", error);
    
    // Handle specific error types
    let status = 500;
    let message = error.message || "Internal server error";
    
    if (error.name === 'AbortError') {
      status = 408;
      message = "Request timeout";
    }
    
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
