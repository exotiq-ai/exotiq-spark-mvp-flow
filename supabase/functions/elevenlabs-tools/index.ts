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
    
    // Extract user_id from conversation metadata
    let userId: string | null = null;
    if (body.conversation_metadata?.user_id) {
      userId = body.conversation_metadata.user_id;
      console.log('Found user_id in conversation metadata:', userId);
    } else if (body.metadata?.user_id) {
      userId = body.metadata.user_id;
      console.log('Found user_id in metadata:', userId);
    }
    
    // ElevenLabs sends data in format: { "toolName": "param_string" } or { "toolName": {...} }
    let toolName: string | undefined;
    let parameters: any = {};
    
    // Check different possible formats
    if (body.tool_name || body.name || body.function_name) {
      // Standard format: { tool_name: "...", parameters: {...} }
      toolName = body.tool_name || body.name || body.function_name;
      parameters = body.parameters || body.args || {};
    } else {
      // ElevenLabs webhook format: { "get_fleet_vehicles": "status:available" }
      const keys = Object.keys(body).filter(k => !['conversation_metadata', 'metadata'].includes(k));
      if (keys.length > 0) {
        toolName = keys[0];
        const paramValue = body[toolName];
        
        // If parameters are a string, parse them
        if (typeof paramValue === 'string') {
          // Parse format like "status:all date_range:this_week"
          const pairs = paramValue.split(' ');
          parameters = {};
          pairs.forEach(pair => {
            const [key, value] = pair.split(':');
            if (key && value) {
              parameters[key] = value;
            }
          });
        } else if (typeof paramValue === 'object') {
          parameters = paramValue;
        }
      }
    }
    
    console.log(`Tool called: ${toolName}`);
    console.log('Parameters:', JSON.stringify(parameters, null, 2));

    // Initialize Supabase with service role for backend operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If no user_id in metadata, fall back to first user for demo
    if (!userId) {
      console.warn('No user_id in conversation metadata, falling back to first user');
      const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      userId = users?.id || 'demo-user-id';
    }
    
    console.log('Using user_id:', userId);
    
    // Verify user exists
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();
    
    if (userError || !userProfile) {
      console.error('User not found:', userId, userError);
      return {
        error: 'User not found',
        summary: 'I could not find your profile. Please make sure you are logged in.'
      };
    }
    
    console.log('User verified:', userProfile.full_name || userProfile.email);

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
  console.log(`[TOOL] Executing: ${functionName} | User: ${userId} | Args:`, JSON.stringify(args));

  try {
    switch (functionName) {
      case "get_fleet_vehicles": {
        const { status } = args;
        console.log(`[get_fleet_vehicles] Querying vehicles for user ${userId}, status: ${status || 'all'}`);
        
        let query = supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId);

        if (status && status !== 'all') {
          query = query.eq('status', status);
        }

        const { data: vehicles, error } = await query.order('created_at', { ascending: false });
        
        if (error) {
          console.error('[get_fleet_vehicles] Database error:', error);
          return {
            error: 'Failed to fetch vehicles',
            summary: 'I encountered an error retrieving your vehicle data. Please try again.'
          };
        }
        
        console.log(`[get_fleet_vehicles] Found ${vehicles?.length || 0} vehicles`);
        
        if (!vehicles || vehicles.length === 0) {
          return {
            count: 0,
            vehicles: [],
            summary: `You don't have any vehicles${status && status !== 'all' ? ` that are ${status}` : ' in your fleet yet'}. Would you like to add your first vehicle?`
          };
        }
        
        const vehicleList = vehicles.map(v => ({
          name: `${v.year} ${v.make} ${v.model}`,
          status: v.status,
          rate: `$${v.current_rate} per day`,
          utilization: `${v.utilization || 0}% utilized`,
          revenue: `$${Number(v.revenue || 0).toFixed(0)} total revenue`
        }));

        return {
          count: vehicles.length,
          vehicles: vehicleList,
          summary: `You have ${vehicles.length} vehicles${status && status !== 'all' ? ` that are ${status}` : ' in your fleet'}. ${vehicleList.slice(0, 3).map(v => v.name).join(', ')}${vehicles.length > 3 ? ' and others' : ''}.`
        };
      }

      case "get_bookings": {
        const { status, start_date, end_date } = args;
        console.log(`[get_bookings] User: ${userId}, Status: ${status || 'all'}, Dates: ${start_date || 'any'} to ${end_date || 'any'}`);
        
        let query = supabase
          .from('bookings')
          .select('*, vehicles(name, make, model, year), customers(full_name, email)')
          .eq('user_id', userId);

        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        if (start_date) {
          query = query.gte('start_date', start_date);
        }
        if (end_date) {
          query = query.lte('end_date', end_date);
        }

        const { data: bookings, error } = await query.order('start_date', { ascending: false}).limit(20);
        
        if (error) {
          console.error('[get_bookings] Database error:', error);
          return {
            error: 'Failed to fetch bookings',
            summary: 'I encountered an error retrieving your booking data.'
          };
        }
        
        console.log(`[get_bookings] Found ${bookings?.length || 0} bookings`);
        
        if (!bookings || bookings.length === 0) {
          return {
            count: 0,
            bookings: [],
            totalRevenue: '$0',
            summary: `You don't have any bookings${status && status !== 'all' ? ` that are ${status}` : ''} matching your criteria.`
          };
        }
        
        const bookingList = bookings.map(b => {
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
        });

        const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
        
        return {
          count: bookings.length,
          bookings: bookingList,
          totalRevenue: `$${totalRevenue.toFixed(0)}`,
          summary: `You have ${bookings.length} bookings${status && status !== 'all' ? ` that are ${status}` : ''}. Total value: $${totalRevenue.toFixed(0)}.`
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
        console.log(`[getFleetMetrics] User: ${userId}, Timeframe: ${timeframe}`);
        
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

        console.log(`[getFleetMetrics] Results - Vehicles: ${vehicles.data?.length || 0}, Active Bookings: ${activeBookings}, Revenue: $${totalRevenue}`);

        return {
          totalVehicles: vehicles.data?.length || 0,
          activeBookings,
          totalBookings: bookings.data?.length || 0,
          revenue: totalRevenue,
          timeframe,
          summary: `Your fleet has ${vehicles.data?.length || 0} vehicles with ${activeBookings} active bookings and $${totalRevenue.toFixed(0)} in revenue for the ${timeframe}.`
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

      case "getDemandForecast": {
        const { city = 'miami', days = 14 } = args;
        console.log(`[getDemandForecast] City: ${city}, Days: ${days}`);
        
        // Call the PredictHQ events edge function
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const predicthqKey = Deno.env.get('PREDICTHQ_API_KEY');
        
        let events: any[] = [];
        let demandMultiplier = 1.0;
        
        if (predicthqKey) {
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/predicthq-events`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ city, days })
            });
            const data = await response.json();
            events = data.events || [];
            demandMultiplier = data.demandMultiplier || 1.0;
          } catch (e) {
            console.error('Error fetching events:', e);
          }
        }
        
        // Get historical bookings for demand context
        const { data: bookings } = await supabase
          .from('bookings')
          .select('start_date, total_value')
          .eq('user_id', userId)
          .gte('start_date', new Date().toISOString())
          .order('start_date', { ascending: true })
          .limit(20);
        
        const upcomingBookings = bookings?.length || 0;
        const upcomingRevenue = bookings?.reduce((sum, b) => sum + Number(b.total_value || 0), 0) || 0;
        
        return {
          city,
          forecastDays: days,
          demandMultiplier,
          upcomingEvents: events.slice(0, 5).map((e: any) => ({
            name: e.name,
            date: e.date,
            category: e.category,
            attendance: e.attendance
          })),
          totalEvents: events.length,
          upcomingBookings,
          upcomingRevenue: `$${upcomingRevenue.toFixed(0)}`,
          summary: events.length > 0 
            ? `For ${city}, there are ${events.length} upcoming events with a ${demandMultiplier.toFixed(2)}x demand multiplier. Top events include ${events.slice(0, 2).map((e: any) => e.name).join(' and ')}. You have ${upcomingBookings} bookings worth $${upcomingRevenue.toFixed(0)} coming up.`
            : `No major events found for ${city} in the next ${days} days. You have ${upcomingBookings} bookings worth $${upcomingRevenue.toFixed(0)} coming up.`
        };
      }

      case "getPricingRecommendation": {
        const { vehicleName } = args;
        console.log(`[getPricingRecommendation] Vehicle: ${vehicleName}`);
        
        // Find the vehicle
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId)
          .or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`)
          .maybeSingle();

        if (!vehicle) {
          return { 
            error: "Vehicle not found",
            summary: `I couldn't find a vehicle matching "${vehicleName}" in your fleet.`
          };
        }

        const currentRate = Number(vehicle.current_rate);
        const utilization = vehicle.utilization || 0;
        
        // Calculate AI-style recommendation
        let suggestedRate = currentRate;
        const factors: string[] = [];
        
        // Utilization-based pricing
        if (utilization > 80) {
          suggestedRate *= 1.15;
          factors.push(`high demand at ${utilization}% utilization`);
        } else if (utilization < 50) {
          suggestedRate *= 0.95;
          factors.push(`low utilization at ${utilization}%`);
        }
        
        // Seasonal adjustment
        const month = new Date().getMonth();
        if ([5, 6, 7, 11].includes(month)) {
          suggestedRate *= 1.10;
          factors.push('peak season premium');
        }
        
        suggestedRate = Math.round(suggestedRate / 5) * 5;
        const difference = suggestedRate - currentRate;
        const percentChange = ((difference / currentRate) * 100).toFixed(1);
        
        return {
          vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          currentRate: `$${currentRate}`,
          suggestedRate: `$${suggestedRate}`,
          difference: difference > 0 ? `+$${difference}` : `$${difference}`,
          percentChange: difference > 0 ? `+${percentChange}%` : `${percentChange}%`,
          factors,
          monthlyImpact: `$${Math.abs(difference * 20).toFixed(0)}/month`,
          summary: suggestedRate > currentRate 
            ? `I recommend increasing the rate for your ${vehicle.year} ${vehicle.make} ${vehicle.model} from $${currentRate} to $${suggestedRate} per day, a ${percentChange}% increase. This is based on ${factors.join(' and ')}. This could add approximately $${Math.abs(difference * 20).toFixed(0)} per month in revenue.`
            : suggestedRate < currentRate
              ? `Consider reducing the rate for your ${vehicle.year} ${vehicle.make} ${vehicle.model} from $${currentRate} to $${suggestedRate} per day to boost bookings. This is based on ${factors.join(' and ')}.`
              : `The current rate of $${currentRate} for your ${vehicle.year} ${vehicle.make} ${vehicle.model} appears optimal given current market conditions.`
        };
      }

      case "getFleetPricingOverview": {
        console.log(`[getFleetPricingOverview] User: ${userId}`);
        
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId);
        
        if (!vehicles || vehicles.length === 0) {
          return {
            summary: "You don't have any vehicles in your fleet yet to analyze pricing for."
          };
        }
        
        const totalVehicles = vehicles.length;
        const avgRate = vehicles.reduce((sum, v) => sum + Number(v.current_rate), 0) / totalVehicles;
        const avgUtilization = vehicles.reduce((sum, v) => sum + (v.utilization || 0), 0) / totalVehicles;
        const totalRevenue = vehicles.reduce((sum, v) => sum + Number(v.revenue || 0), 0);
        
        // Find under and over-utilized vehicles
        const underUtilized = vehicles.filter(v => (v.utilization || 0) < 50);
        const highPerformers = vehicles.filter(v => (v.utilization || 0) > 75);
        
        return {
          totalVehicles,
          averageRate: `$${avgRate.toFixed(0)}`,
          averageUtilization: `${avgUtilization.toFixed(0)}%`,
          totalFleetRevenue: `$${totalRevenue.toFixed(0)}`,
          underUtilizedCount: underUtilized.length,
          highPerformerCount: highPerformers.length,
          topPerformers: highPerformers.slice(0, 3).map(v => ({
            name: `${v.year} ${v.make} ${v.model}`,
            utilization: `${v.utilization}%`,
            rate: `$${v.current_rate}`
          })),
          recommendations: underUtilized.length > 0 
            ? `${underUtilized.length} vehicles are under-utilized and may benefit from price adjustments.`
            : 'Fleet pricing looks healthy!',
          summary: `Your fleet of ${totalVehicles} vehicles has an average daily rate of $${avgRate.toFixed(0)} and ${avgUtilization.toFixed(0)}% average utilization. Total fleet revenue is $${totalRevenue.toFixed(0)}. ${highPerformers.length} vehicles are performing above 75% utilization, while ${underUtilized.length} are below 50%.`
        };
      }

      case "getEventImpact": {
        const { eventName } = args;
        console.log(`[getEventImpact] Searching for event: ${eventName}`);
        
        // This would typically call PredictHQ to search for a specific event
        // For now, return helpful context
        return {
          searched: eventName,
          impact: "Events typically increase demand by 15-30% in the surrounding area",
          recommendation: "Consider adjusting rates 2-3 days before major events to capture increased demand",
          summary: `For events like "${eventName}", you can expect increased demand for luxury vehicle rentals. I recommend raising rates by 15-25% during peak event days and ensuring your highest-demand vehicles are available.`
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
