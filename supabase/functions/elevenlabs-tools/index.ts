import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tool_name, parameters } = await req.json();
    console.log(`Tool called: ${tool_name}`, parameters);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Execute the requested tool
    const result = await executeFunction(tool_name, parameters, supabase, userId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Tool execution error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function executeFunction(functionName: string, args: any, supabase: any, userId: string) {
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

        const totalRevenue = revenue.data?.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0) || 0;
        const activeBookings = bookings.data?.filter((b: any) => b.status === 'active' || b.status === 'confirmed').length || 0;

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
          .maybeSingle();

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
          .maybeSingle();

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
          .maybeSingle();

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
            .maybeSingle();
          if (vehicle) query = query.eq('vehicle_id', vehicle.id);
        }

        const { data: bookings } = await query;
        const totalRevenue = bookings?.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0) || 0;

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
          .maybeSingle();

        if (!customer) return { error: "Customer not found" };

        return { customer };
      }

      case "getVaultDocuments": {
        const { category, status } = args;
        
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
          "Why did the Bugatti go to therapy? It had too many speed issues!"
        ];
        return { joke: jokes[Math.floor(Math.random() * jokes.length)] };
      }

      case "getVehicleSpecs": {
        const { vehicleName } = args;
        
        const specsDatabase: Record<string, any> = {
          "ferrari sf90": {
            make: "Ferrari", model: "SF90 Stradale", engine: "4.0L V8 + Electric Motors",
            horsepower: "986 hp", torque: "590 lb-ft", acceleration: "2.5 sec (0-60 mph)",
            topSpeed: "211 mph", drivetrain: "AWD", weight: "3,461 lbs"
          },
          "lamborghini aventador": {
            make: "Lamborghini", model: "Aventador SVJ", engine: "6.5L V12",
            horsepower: "770 hp", torque: "531 lb-ft", acceleration: "2.8 sec (0-60 mph)",
            topSpeed: "217 mph", drivetrain: "AWD", weight: "3,362 lbs"
          }
        };

        const searchKey = vehicleName.toLowerCase();
        const spec = Object.keys(specsDatabase).find(key => searchKey.includes(key));
        
        if (spec) return specsDatabase[spec];
        return { error: "Vehicle specs not found in database", searched: vehicleName };
      }

      default:
        return { error: `Unknown function: ${functionName}` };
    }
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    return { error: error instanceof Error ? error.message : 'Function execution failed' };
  }
}
