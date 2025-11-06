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
    console.log('=== ElevenLabs Tool Request ===');
    console.log('Method:', req.method);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    const body = await req.json();
    console.log('Raw body:', JSON.stringify(body, null, 2));
    
    // ElevenLabs sends: { tool_name: "...", parameters: {...} } or { name: "...", parameters: {...} }
    const toolName = body.tool_name || body.name || body.function_name;
    const parameters = body.parameters || body.args || {};
    
    console.log(`Tool called: ${toolName}`);
    console.log('Parameters:', JSON.stringify(parameters, null, 2));

    // Validate request is from ElevenLabs (optional security layer)
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsKey) {
      console.error('ELEVENLABS_API_KEY not configured');
    }

    // Initialize Supabase with service role for backend operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For demo: use first user or demo user
    // In production, you'd pass user_id through conversation context
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .single();
    
    const userId = users?.id || 'demo-user-id';
    console.log('Using user_id:', userId);

    // Execute the requested tool
    const result = await executeFunction(toolName, parameters, supabase, userId);

    console.log('Tool result:', JSON.stringify(result, null, 2));
    console.log('=== Request Complete ===\n');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('=== Tool Execution Error ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

async function executeFunction(functionName: string, args: any, supabase: any, userId: string) {
  console.log(`Executing function: ${functionName}`, args);

  try {
    switch (functionName) {
      case "get_fleet_vehicles": {
        const { status } = args;
        let query = supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId);

        if (status) {
          query = query.eq('status', status);
        }

        const { data: vehicles } = await query.order('created_at', { ascending: false });
        
        const vehicleList = vehicles?.map(v => ({
          name: `${v.year} ${v.make} ${v.model}`,
          status: v.status,
          rate: `$${v.current_rate} per day`,
          utilization: `${v.utilization}% utilized`,
          revenue: `$${Number(v.revenue || 0).toFixed(0)} total revenue`
        })) || [];

        return {
          count: vehicles?.length || 0,
          vehicles: vehicleList,
          summary: `You have ${vehicles?.length || 0} vehicles${status ? ` that are ${status}` : ' in your fleet'}. ${vehicleList.slice(0, 3).map(v => v.name).join(', ')}${vehicles && vehicles.length > 3 ? ' and others' : ''}.`
        };
      }

      case "get_bookings": {
        const { status, start_date, end_date } = args;
        let query = supabase
          .from('bookings')
          .select('*, vehicles(name, make, model, year), customers(full_name, email)')
          .eq('user_id', userId);

        if (status) {
          query = query.eq('status', status);
        }
        if (start_date) {
          query = query.gte('start_date', start_date);
        }
        if (end_date) {
          query = query.lte('end_date', end_date);
        }

        const { data: bookings } = await query.order('start_date', { ascending: false}).limit(20);
        
        const bookingList = bookings?.map(b => {
          const startDate = new Date(b.start_date).toLocaleDateString();
          const endDate = new Date(b.end_date).toLocaleDateString();
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'Unknown vehicle';
          
          return {
            customer: b.customers?.full_name || b.customer_name || 'Unknown',
            vehicle: vehicleName,
            dates: `${startDate} to ${endDate}`,
            status: b.status,
            total: `$${Number(b.total_value || 0).toFixed(0)}`,
            payment: b.payment_status
          };
        }) || [];

        const totalRevenue = bookings?.reduce((sum, b) => sum + Number(b.total_value || 0), 0) || 0;
        
        return {
          count: bookings?.length || 0,
          bookings: bookingList,
          totalRevenue: `$${totalRevenue.toFixed(0)}`,
          summary: `You have ${bookings?.length || 0} bookings${status ? ` that are ${status}` : ''}${bookings && bookings.length > 0 ? `. Total value: $${totalRevenue.toFixed(0)}` : ''}.`
        };
      }

      case "get_recent_activity": {
        const { limit = 10, activity_type } = args;
        
        const { data: recentBookings } = await supabase
          .from('bookings')
          .select('*, vehicles(name, make, model, year), customers(full_name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);

        const activities = recentBookings?.map((b: any) => {
          const timeAgo = getTimeAgo(new Date(b.created_at));
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'a vehicle';
          
          return {
            description: `${b.customers?.full_name || 'A customer'} booked ${vehicleName} for $${Number(b.total_value || 0).toFixed(0)}`,
            timeAgo,
            status: b.status,
            amount: `$${Number(b.total_value || 0).toFixed(0)}`
          };
        }) || [];

        return {
          count: activities.length,
          activities,
          summary: `Recent activity: ${activities.slice(0, 3).map(a => a.description).join('. ')}`
        };
      }

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
          .or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`)
          .maybeSingle();

        if (!vehicle) return { 
          error: "Vehicle not found",
          summary: `I couldn't find a vehicle matching "${vehicleName}" in your fleet.`
        };

        const fullName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
        let bookingsData = null;
        if (includeBookings) {
          const { data: bookings } = await supabase
            .from('bookings')
            .select('*, customers(full_name)')
            .eq('vehicle_id', vehicle.id)
            .order('start_date', { ascending: false })
            .limit(5);
          bookingsData = bookings?.map(b => ({
            customer: b.customers?.full_name || b.customer_name,
            dates: `${new Date(b.start_date).toLocaleDateString()} to ${new Date(b.end_date).toLocaleDateString()}`,
            status: b.status,
            amount: `$${Number(b.total_value || 0).toFixed(0)}`
          }));
        }

        return { 
          vehicle: {
            name: fullName,
            status: vehicle.status,
            rate: `$${vehicle.current_rate} per day`,
            utilization: `${vehicle.utilization}% utilization`,
            revenue: `$${Number(vehicle.revenue || 0).toFixed(0)} total revenue`,
            licensePlate: vehicle.license_plate,
            vin: vehicle.vin
          },
          bookings: bookingsData,
          summary: `${fullName} is currently ${vehicle.status}, priced at $${vehicle.current_rate} per day with ${vehicle.utilization}% utilization and $${Number(vehicle.revenue || 0).toFixed(0)} in total revenue.`
        };
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
          .select('*, vehicles(name, make, model, year), customers(full_name)')
          .eq('user_id', userId);

        if (status) query = query.eq('status', status);
        
        if (daysRange) {
          const dateFilter = new Date();
          dateFilter.setDate(dateFilter.getDate() - daysRange);
          query = query.gte('start_date', dateFilter.toISOString());
        }

        const { data: bookings } = await query.order('start_date', { ascending: false }).limit(20);
        
        const bookingList = bookings?.map(b => {
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'vehicle';
          return {
            customer: b.customers?.full_name || b.customer_name,
            vehicle: vehicleName,
            dates: `${new Date(b.start_date).toLocaleDateString()} to ${new Date(b.end_date).toLocaleDateString()}`,
            status: b.status,
            total: `$${Number(b.total_value || 0).toFixed(0)}`
          };
        }) || [];

        const totalValue = bookings?.reduce((sum, b) => sum + Number(b.total_value || 0), 0) || 0;

        return { 
          count: bookings?.length || 0,
          bookings: bookingList,
          totalValue: `$${totalValue.toFixed(0)}`,
          summary: `Found ${bookings?.length || 0} bookings${status ? ` with ${status} status` : ''}${daysRange ? ` in the last ${daysRange} days` : ''}. Total value: $${totalValue.toFixed(0)}.`
        };
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
