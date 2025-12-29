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

// Peak season calendar for pricing context
const PEAK_SEASONS = [
  { name: 'Art Basel Miami', start: '12-01', end: '12-08', location: 'Miami', surge: 1.35 },
  { name: 'Christmas Week', start: '12-20', end: '12-26', location: 'all', surge: 1.40 },
  { name: 'New Years Eve', start: '12-27', end: '01-03', location: 'all', surge: 1.50 },
  { name: 'Super Bowl', start: '02-05', end: '02-12', location: 'all', surge: 1.50 },
  { name: 'Miami Grand Prix', start: '05-02', end: '05-04', location: 'Miami', surge: 1.40 },
  { name: 'Spring Break', start: '03-10', end: '03-25', location: 'Miami', surge: 1.25 },
  { name: 'Summer Peak', start: '06-15', end: '08-15', location: 'all', surge: 1.15 },
];

function getCurrentPeakSeason(location?: string): { name: string; surge: number } | null {
  const now = new Date();
  const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  for (const season of PEAK_SEASONS) {
    const inRange = monthDay >= season.start && monthDay <= season.end;
    const locationMatch = season.location === 'all' || !location || season.location.toLowerCase() === location.toLowerCase();
    if (inRange && locationMatch) {
      return { name: season.name, surge: season.surge };
    }
  }
  return null;
}

async function executeFunction(functionName: string, args: any, supabase: any, userId: string) {
  console.log(`[TOOL] Executing: ${functionName} | User: ${userId} | Args:`, JSON.stringify(args));

  try {
    switch (functionName) {
      case "get_fleet_vehicles": {
        const { status, location } = args;
        console.log(`[get_fleet_vehicles] Querying vehicles for user ${userId}, status: ${status || 'all'}, location: ${location || 'all'}`);
        
        let query = supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId);

        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        
        if (location && location !== 'all') {
          query = query.eq('location', location);
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
            summary: `You don't have any vehicles${location ? ` in ${location}` : ''}${status && status !== 'all' ? ` that are ${status}` : ''}.`
          };
        }
        
        const vehicleList = vehicles.map(v => ({
          name: `${v.year} ${v.make} ${v.model}`,
          status: v.status,
          location: v.location || 'Miami',
          rate: `$${v.current_rate} per day`,
          utilization: `${v.utilization || 0}% utilized`,
          revenue: `$${Number(v.revenue || 0).toFixed(0)} total revenue`
        }));

        // Group by location for summary
        const locationGroups = vehicles.reduce((acc, v) => {
          const loc = v.location || 'Miami';
          acc[loc] = (acc[loc] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const locationSummary = Object.entries(locationGroups)
          .map(([loc, count]) => `${count} in ${loc}`)
          .join(', ');

        return {
          count: vehicles.length,
          vehicles: vehicleList,
          byLocation: locationGroups,
          summary: `You have ${vehicles.length} vehicles${location ? ` in ${location}` : ` (${locationSummary})`}${status && status !== 'all' ? ` that are ${status}` : ''}. Top vehicles: ${vehicleList.slice(0, 3).map(v => v.name).join(', ')}.`
        };
      }

      case "get_bookings": {
        const { status, start_date, end_date, location } = args;
        console.log(`[get_bookings] User: ${userId}, Status: ${status || 'all'}, Location: ${location || 'all'}`);
        
        let query = supabase
          .from('bookings')
          .select('*, vehicles(name, make, model, year, location), customers(full_name, email)')
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

        const { data: bookings, error } = await query.order('start_date', { ascending: false}).limit(30);
        
        if (error) {
          console.error('[get_bookings] Database error:', error);
          return {
            error: 'Failed to fetch bookings',
            summary: 'I encountered an error retrieving your booking data.'
          };
        }
        
        // Filter by location if specified
        let filteredBookings = bookings || [];
        if (location && location !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase() === location.toLowerCase()
          );
        }
        
        console.log(`[get_bookings] Found ${filteredBookings.length} bookings`);
        
        if (filteredBookings.length === 0) {
          return {
            count: 0,
            bookings: [],
            totalRevenue: '$0',
            summary: `You don't have any bookings${status && status !== 'all' ? ` that are ${status}` : ''}${location ? ` in ${location}` : ''} matching your criteria.`
          };
        }
        
        const bookingList = filteredBookings.map(b => {
          const startDate = new Date(b.start_date).toLocaleDateString();
          const endDate = new Date(b.end_date).toLocaleDateString();
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'Unknown vehicle';
          
          return {
            customer: b.customers?.full_name || b.customer_name || 'Unknown',
            vehicle: vehicleName,
            location: b.vehicles?.location || 'Miami',
            dates: `${startDate} to ${endDate}`,
            status: b.status,
            total: `$${Number(b.total_value || 0).toFixed(0)}`,
            payment: b.payment_status
          };
        });

        const totalRevenue = filteredBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
        
        return {
          count: filteredBookings.length,
          bookings: bookingList,
          totalRevenue: `$${totalRevenue.toFixed(0)}`,
          summary: `You have ${filteredBookings.length} bookings${status && status !== 'all' ? ` that are ${status}` : ''}${location ? ` in ${location}` : ''}. Total value: $${totalRevenue.toFixed(0)}.`
        };
      }

      case "get_recent_activity": {
        const { limit = 10, activity_type } = args;
        
        const { data: recentBookings } = await supabase
          .from('bookings')
          .select('*, vehicles(name, make, model, year, location), customers(full_name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);

        const activities = recentBookings?.map((b: any) => {
          const timeAgo = getTimeAgo(new Date(b.created_at));
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'a vehicle';
          
          return {
            description: `${b.customers?.full_name || 'A customer'} booked ${vehicleName} for $${Number(b.total_value || 0).toFixed(0)}`,
            location: b.vehicles?.location || 'Miami',
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
        const { timeframe, location } = args;
        console.log(`[getFleetMetrics] User: ${userId}, Timeframe: ${timeframe}, Location: ${location || 'all'}`);
        
        let dateFilter = new Date();
        
        if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
        else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
        else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
        else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);

        // Get vehicles with optional location filter
        let vehicleQuery = supabase.from('vehicles').select('*').eq('user_id', userId);
        if (location && location !== 'all') {
          vehicleQuery = vehicleQuery.eq('location', location);
        }
        
        const [vehiclesResult, bookingsResult, revenueResult] = await Promise.all([
          vehicleQuery,
          supabase.from('bookings').select('*, vehicles(location)').eq('user_id', userId).gte('created_at', dateFilter.toISOString()),
          supabase.from('bookings').select('total_value, vehicles(location)').eq('user_id', userId).eq('status', 'completed').gte('created_at', dateFilter.toISOString())
        ]);

        const vehicles = vehiclesResult.data || [];
        let bookings = bookingsResult.data || [];
        let revenue = revenueResult.data || [];
        
        // Filter bookings by location if specified
        if (location && location !== 'all') {
          bookings = bookings.filter((b: any) => b.vehicles?.location?.toLowerCase() === location.toLowerCase());
          revenue = revenue.filter((b: any) => b.vehicles?.location?.toLowerCase() === location.toLowerCase());
        }

        const totalRevenue = revenue.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
        const activeBookings = bookings.filter((b: any) => b.status === 'active' || b.status === 'confirmed').length;
        const avgUtilization = vehicles.length > 0 
          ? vehicles.reduce((sum, v) => sum + (v.utilization || 0), 0) / vehicles.length 
          : 0;

        // Check for peak season
        const peakSeason = getCurrentPeakSeason(location);

        console.log(`[getFleetMetrics] Results - Vehicles: ${vehicles.length}, Active Bookings: ${activeBookings}, Revenue: $${totalRevenue}`);

        return {
          totalVehicles: vehicles.length,
          activeBookings,
          totalBookings: bookings.length,
          revenue: totalRevenue,
          averageUtilization: `${avgUtilization.toFixed(0)}%`,
          location: location || 'all',
          timeframe,
          peakSeason: peakSeason?.name || null,
          surgePricing: peakSeason?.surge || 1.0,
          summary: `${location ? `${location} fleet` : 'Your fleet'} has ${vehicles.length} vehicles with ${activeBookings} active bookings and $${totalRevenue.toFixed(0)} in revenue for the ${timeframe}.${peakSeason ? ` Currently in ${peakSeason.name} with ${((peakSeason.surge - 1) * 100).toFixed(0)}% surge pricing recommended.` : ''}`
        };
      }

      case "getLocationMetrics": {
        const { location } = args;
        console.log(`[getLocationMetrics] Location: ${location || 'all'}`);
        
        // Get all vehicles
        const { data: allVehicles } = await supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId);
        
        if (!allVehicles || allVehicles.length === 0) {
          return {
            summary: "You don't have any vehicles in your fleet yet."
          };
        }
        
        // Group by location
        const locationStats: Record<string, any> = {};
        
        for (const vehicle of allVehicles) {
          const loc = vehicle.location || 'Miami';
          if (!locationStats[loc]) {
            locationStats[loc] = {
              location: loc,
              vehicleCount: 0,
              totalRevenue: 0,
              totalUtilization: 0,
              avgRate: 0,
              vehicles: []
            };
          }
          locationStats[loc].vehicleCount++;
          locationStats[loc].totalRevenue += Number(vehicle.revenue || 0);
          locationStats[loc].totalUtilization += (vehicle.utilization || 0);
          locationStats[loc].avgRate += Number(vehicle.current_rate || 0);
          locationStats[loc].vehicles.push({
            name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            status: vehicle.status,
            utilization: vehicle.utilization,
            rate: vehicle.current_rate
          });
        }
        
        // Calculate averages
        for (const loc of Object.keys(locationStats)) {
          const stats = locationStats[loc];
          stats.avgUtilization = stats.totalUtilization / stats.vehicleCount;
          stats.avgRate = stats.avgRate / stats.vehicleCount;
        }
        
        // Get bookings by location
        const { data: bookings } = await supabase
          .from('bookings')
          .select('*, vehicles(location)')
          .eq('user_id', userId)
          .in('status', ['active', 'confirmed', 'pending']);
        
        for (const booking of (bookings || [])) {
          const loc = booking.vehicles?.location || 'Miami';
          if (locationStats[loc]) {
            locationStats[loc].activeBookings = (locationStats[loc].activeBookings || 0) + 1;
          }
        }
        
        // Check peak season for each location
        for (const loc of Object.keys(locationStats)) {
          const peakSeason = getCurrentPeakSeason(loc);
          locationStats[loc].peakSeason = peakSeason?.name || null;
          locationStats[loc].surgePricing = peakSeason?.surge || 1.0;
        }
        
        // If specific location requested
        if (location && location !== 'all' && locationStats[location]) {
          const stats = locationStats[location];
          return {
            location: stats.location,
            vehicleCount: stats.vehicleCount,
            totalRevenue: `$${stats.totalRevenue.toFixed(0)}`,
            avgUtilization: `${stats.avgUtilization.toFixed(0)}%`,
            avgRate: `$${stats.avgRate.toFixed(0)}`,
            activeBookings: stats.activeBookings || 0,
            peakSeason: stats.peakSeason,
            surgePricing: stats.surgePricing,
            topVehicles: stats.vehicles.slice(0, 5),
            summary: `${location} has ${stats.vehicleCount} vehicles with $${stats.totalRevenue.toFixed(0)} total revenue, ${stats.avgUtilization.toFixed(0)}% average utilization, and ${stats.activeBookings || 0} active bookings.${stats.peakSeason ? ` Currently in ${stats.peakSeason} peak season.` : ''}`
          };
        }
        
        // Return all locations
        const locations = Object.values(locationStats);
        return {
          locationCount: locations.length,
          locations: locations.map((l: any) => ({
            location: l.location,
            vehicleCount: l.vehicleCount,
            totalRevenue: `$${l.totalRevenue.toFixed(0)}`,
            avgUtilization: `${l.avgUtilization.toFixed(0)}%`,
            avgRate: `$${l.avgRate.toFixed(0)}`,
            activeBookings: l.activeBookings || 0,
            peakSeason: l.peakSeason
          })),
          summary: `Your fleet spans ${locations.length} location${locations.length > 1 ? 's' : ''}: ${locations.map((l: any) => `${l.location} (${l.vehicleCount} vehicles, $${l.totalRevenue.toFixed(0)} revenue)`).join('; ')}.`
        };
      }

      case "getPaymentSummary": {
        const { status, timeframe, location } = args;
        console.log(`[getPaymentSummary] Status: ${status || 'all'}, Timeframe: ${timeframe || 'all'}, Location: ${location || 'all'}`);
        
        let dateFilter = new Date();
        if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
        else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
        else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
        else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);
        else dateFilter = new Date(0); // All time
        
        // Get payments with booking and vehicle info
        const { data: payments, error } = await supabase
          .from('payments')
          .select('*, bookings(customer_name, vehicle_id, vehicles(location, name, make, model, year))')
          .eq('user_id', userId)
          .gte('transaction_date', dateFilter.toISOString())
          .order('transaction_date', { ascending: false });
        
        if (error) {
          console.error('[getPaymentSummary] Database error:', error);
          return { error: 'Failed to fetch payments', summary: 'I encountered an error retrieving payment data.' };
        }
        
        let filteredPayments = payments || [];
        
        // Filter by location
        if (location && location !== 'all') {
          filteredPayments = filteredPayments.filter((p: any) => 
            p.bookings?.vehicles?.location?.toLowerCase() === location.toLowerCase()
          );
        }
        
        // Filter by status
        if (status && status !== 'all') {
          filteredPayments = filteredPayments.filter((p: any) => p.payment_status === status);
        }
        
        // Calculate summaries
        const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const byStatus = filteredPayments.reduce((acc, p) => {
          const s = p.payment_status || 'unknown';
          acc[s] = (acc[s] || 0) + Number(p.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        
        const byMethod = filteredPayments.reduce((acc, p) => {
          const m = p.payment_method || 'unknown';
          acc[m] = (acc[m] || 0) + Number(p.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        
        const byType = filteredPayments.reduce((acc, p) => {
          const t = p.payment_type || 'unknown';
          acc[t] = (acc[t] || 0) + Number(p.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        
        // Get outstanding (pending) amount
        const pendingAmount = byStatus['pending'] || 0;
        const completedAmount = byStatus['completed'] || 0;
        
        // Recent transactions
        const recentPayments = filteredPayments.slice(0, 5).map(p => ({
          customer: p.bookings?.customer_name || 'Unknown',
          vehicle: p.bookings?.vehicles ? `${p.bookings.vehicles.year} ${p.bookings.vehicles.make} ${p.bookings.vehicles.model}` : 'Unknown',
          amount: `$${Number(p.amount || 0).toFixed(0)}`,
          method: p.payment_method,
          status: p.payment_status,
          date: new Date(p.transaction_date).toLocaleDateString()
        }));
        
        return {
          totalPayments: filteredPayments.length,
          totalAmount: `$${totalAmount.toFixed(0)}`,
          completedAmount: `$${completedAmount.toFixed(0)}`,
          pendingAmount: `$${pendingAmount.toFixed(0)}`,
          byStatus: Object.entries(byStatus).map(([s, a]) => ({ status: s, amount: `$${a.toFixed(0)}` })),
          byMethod: Object.entries(byMethod).map(([m, a]) => ({ method: m, amount: `$${a.toFixed(0)}` })),
          byType: Object.entries(byType).map(([t, a]) => ({ type: t, amount: `$${a.toFixed(0)}` })),
          recentPayments,
          timeframe: timeframe || 'all time',
          location: location || 'all',
          summary: `${timeframe ? `This ${timeframe}` : 'Total'} payments${location ? ` in ${location}` : ''}: $${totalAmount.toFixed(0)} across ${filteredPayments.length} transactions. Completed: $${completedAmount.toFixed(0)}, Pending: $${pendingAmount.toFixed(0)}.`
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
            location: vehicle.location || 'Miami',
            rate: `$${vehicle.current_rate} per day`,
            suggestedRate: vehicle.suggested_rate ? `$${vehicle.suggested_rate}` : null,
            utilization: `${vehicle.utilization}% utilization`,
            revenue: `$${Number(vehicle.revenue || 0).toFixed(0)} total revenue`,
            licensePlate: vehicle.license_plate,
            vin: vehicle.vin
          },
          bookings: bookingsData,
          summary: `${fullName} in ${vehicle.location || 'Miami'} is currently ${vehicle.status}, priced at $${vehicle.current_rate} per day with ${vehicle.utilization}% utilization and $${Number(vehicle.revenue || 0).toFixed(0)} in total revenue.`
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

        if (!customer) return { 
          error: "Customer not found",
          summary: `I couldn't find a customer matching "${customerName}".`
        };

        let bookingsData = null;
        if (includeHistory) {
          const { data: bookings } = await supabase
            .from('bookings')
            .select('*, vehicles(name, make, model, year, location)')
            .eq('customer_id', customer.id)
            .order('start_date', { ascending: false })
            .limit(10);
          bookingsData = bookings?.map(b => ({
            vehicle: b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'Unknown',
            location: b.vehicles?.location || 'Miami',
            dates: `${new Date(b.start_date).toLocaleDateString()} to ${new Date(b.end_date).toLocaleDateString()}`,
            status: b.status,
            total: `$${Number(b.total_value || 0).toFixed(0)}`
          }));
        }

        return { 
          customer: {
            name: customer.full_name,
            email: customer.email,
            phone: customer.phone,
            status: customer.customer_status,
            totalBookings: customer.total_bookings || 0,
            lifetimeValue: `$${Number(customer.lifetime_value || 0).toFixed(0)}`,
            idVerified: customer.id_verified,
            insuranceVerified: customer.insurance_verified
          },
          bookings: bookingsData,
          summary: `${customer.full_name} is a ${customer.customer_status || 'regular'} customer with ${customer.total_bookings || 0} bookings and $${Number(customer.lifetime_value || 0).toFixed(0)} lifetime value.`
        };
      }

      case "checkAvailability": {
        const { vehicleName, startDate, endDate, location } = args;
        
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, year, status, location, current_rate')
          .eq('user_id', userId);
        
        if (vehicleName) {
          vehicleQuery = vehicleQuery.or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`);
        }
        if (location) {
          vehicleQuery = vehicleQuery.eq('location', location);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (!vehicles || vehicles.length === 0) {
          return { 
            error: "No vehicles found",
            summary: `I couldn't find any vehicles matching your criteria.`
          };
        }
        
        const availabilityResults = [];
        for (const vehicle of vehicles) {
          const { data: conflicts } = await supabase
            .from('bookings')
            .select('id, start_date, end_date, customer_name')
            .eq('vehicle_id', vehicle.id)
            .in('status', ['active', 'confirmed', 'pending'])
            .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);
          
          availabilityResults.push({
            vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            location: vehicle.location,
            rate: `$${vehicle.current_rate}`,
            available: !conflicts || conflicts.length === 0,
            conflicts: conflicts?.map(c => ({
              dates: `${new Date(c.start_date).toLocaleDateString()} to ${new Date(c.end_date).toLocaleDateString()}`,
              customer: c.customer_name
            })) || []
          });
        }
        
        const available = availabilityResults.filter(r => r.available);
        const unavailable = availabilityResults.filter(r => !r.available);
        
        return {
          requestedDates: `${startDate} to ${endDate}`,
          availableVehicles: available,
          unavailableVehicles: unavailable,
          summary: available.length > 0 
            ? `${available.length} vehicle${available.length > 1 ? 's are' : ' is'} available for ${startDate} to ${endDate}: ${available.map(v => v.vehicle).join(', ')}.`
            : `Unfortunately, no matching vehicles are available for those dates. ${unavailable.length} vehicle${unavailable.length > 1 ? 's have' : ' has'} conflicts.`
        };
      }

      case "getRevenueAnalysis": {
        const { timeframe, vehicleName, location } = args;
        let dateFilter = new Date();
        
        if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
        else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
        else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
        else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);

        let query = supabase
          .from('bookings')
          .select('total_value, daily_rate, vehicles(name, make, model, year, location)')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('created_at', dateFilter.toISOString());

        const { data: bookings } = await query;
        
        let filteredBookings = bookings || [];
        
        // Filter by location
        if (location && location !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase() === location.toLowerCase()
          );
        }
        
        // Filter by vehicle name
        if (vehicleName) {
          filteredBookings = filteredBookings.filter((b: any) => {
            const name = b.vehicles ? `${b.vehicles.make} ${b.vehicles.model}`.toLowerCase() : '';
            return name.includes(vehicleName.toLowerCase());
          });
        }
        
        const totalRevenue = filteredBookings.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
        const avgDailyRate = filteredBookings.length > 0 
          ? filteredBookings.reduce((sum: number, b: any) => sum + Number(b.daily_rate || 0), 0) / filteredBookings.length 
          : 0;

        return { 
          totalRevenue: `$${totalRevenue.toFixed(0)}`,
          bookingCount: filteredBookings.length,
          avgDailyRate: `$${avgDailyRate.toFixed(0)}`,
          timeframe,
          location: location || 'all',
          summary: `${timeframe ? `This ${timeframe}` : 'Total'} revenue${location ? ` from ${location}` : ''}: $${totalRevenue.toFixed(0)} across ${filteredBookings.length} completed bookings with an average daily rate of $${avgDailyRate.toFixed(0)}.`
        };
      }

      case "getTopPerformers": {
        const { metric, limit = 5, location } = args;
        
        if (metric === 'revenue') {
          let query = supabase
            .from('vehicles')
            .select('name, make, model, year, revenue, location')
            .eq('user_id', userId);
          
          if (location && location !== 'all') {
            query = query.eq('location', location);
          }
          
          const { data: vehicles } = await query.order('revenue', { ascending: false }).limit(limit);
          
          const performers = vehicles?.map(v => ({
            name: `${v.year} ${v.make} ${v.model}`,
            location: v.location,
            revenue: `$${Number(v.revenue || 0).toFixed(0)}`
          })) || [];
          
          return { 
            metric: 'revenue', 
            performers,
            summary: `Top ${performers.length} vehicles by revenue${location ? ` in ${location}` : ''}: ${performers.map(p => `${p.name} ($${Number(p.revenue.replace('$', '')).toFixed(0)})`).join(', ')}.`
          };
        } else if (metric === 'utilization') {
          let query = supabase
            .from('vehicles')
            .select('name, make, model, year, utilization, location')
            .eq('user_id', userId);
          
          if (location && location !== 'all') {
            query = query.eq('location', location);
          }
          
          const { data: vehicles } = await query.order('utilization', { ascending: false }).limit(limit);
          
          const performers = vehicles?.map(v => ({
            name: `${v.year} ${v.make} ${v.model}`,
            location: v.location,
            utilization: `${v.utilization || 0}%`
          })) || [];
          
          return { 
            metric: 'utilization', 
            performers,
            summary: `Top ${performers.length} vehicles by utilization${location ? ` in ${location}` : ''}: ${performers.map(p => `${p.name} (${p.utilization})`).join(', ')}.`
          };
        } else {
          const { data: customers } = await supabase
            .from('customers')
            .select('full_name, total_bookings, lifetime_value')
            .eq('user_id', userId)
            .order('lifetime_value', { ascending: false })
            .limit(limit);
          
          const performers = customers?.map(c => ({
            name: c.full_name,
            bookings: c.total_bookings || 0,
            lifetimeValue: `$${Number(c.lifetime_value || 0).toFixed(0)}`
          })) || [];
          
          return { 
            metric: 'customers', 
            performers,
            summary: `Top ${performers.length} customers by lifetime value: ${performers.map(p => `${p.name} (${p.lifetimeValue})`).join(', ')}.`
          };
        }
      }

      case "searchBookings": {
        const { status, daysRange, location } = args;
        let query = supabase
          .from('bookings')
          .select('*, vehicles(name, make, model, year, location), customers(full_name)')
          .eq('user_id', userId);

        if (status) query = query.eq('status', status);
        
        if (daysRange) {
          const dateFilter = new Date();
          dateFilter.setDate(dateFilter.getDate() - daysRange);
          query = query.gte('start_date', dateFilter.toISOString());
        }

        const { data: bookings } = await query.order('start_date', { ascending: false }).limit(30);
        
        let filteredBookings = bookings || [];
        if (location && location !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase() === location.toLowerCase()
          );
        }
        
        const bookingList = filteredBookings.map(b => {
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'vehicle';
          return {
            customer: b.customers?.full_name || b.customer_name,
            vehicle: vehicleName,
            location: b.vehicles?.location || 'Miami',
            dates: `${new Date(b.start_date).toLocaleDateString()} to ${new Date(b.end_date).toLocaleDateString()}`,
            status: b.status,
            total: `$${Number(b.total_value || 0).toFixed(0)}`
          };
        });

        const totalValue = filteredBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);

        return { 
          count: filteredBookings.length,
          bookings: bookingList,
          totalValue: `$${totalValue.toFixed(0)}`,
          summary: `Found ${filteredBookings.length} bookings${status ? ` with ${status} status` : ''}${location ? ` in ${location}` : ''}${daysRange ? ` in the last ${daysRange} days` : ''}. Total value: $${totalValue.toFixed(0)}.`
        };
      }

      case "getDamageReports": {
        const { status, location } = args;
        let query = supabase
          .from('damage_claims')
          .select('*, vehicles(name, make, model, year, location)')
          .eq('user_id', userId);

        if (status && status !== 'all') query = query.eq('claim_status', status);

        const { data: claims } = await query.order('reported_date', { ascending: false });
        
        let filteredClaims = claims || [];
        if (location && location !== 'all') {
          filteredClaims = filteredClaims.filter((c: any) => 
            c.vehicles?.location?.toLowerCase() === location.toLowerCase()
          );
        }
        
        const claimList = filteredClaims.map(c => ({
          vehicle: c.vehicles ? `${c.vehicles.year} ${c.vehicles.make} ${c.vehicles.model}` : 'Unknown',
          location: c.vehicles?.location || 'Miami',
          severity: c.severity,
          status: c.claim_status,
          estimatedCost: c.estimated_cost ? `$${c.estimated_cost}` : 'TBD',
          reportedDate: new Date(c.reported_date).toLocaleDateString()
        }));
        
        return { 
          claims: claimList, 
          count: filteredClaims.length,
          summary: `You have ${filteredClaims.length} damage report${filteredClaims.length !== 1 ? 's' : ''}${status && status !== 'all' ? ` with ${status} status` : ''}${location ? ` in ${location}` : ''}.`
        };
      }

      case "getUpcomingMaintenance": {
        const { daysAhead = 30, location } = args;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        const { data: maintenance } = await supabase
          .from('maintenance_schedules')
          .select('*, vehicles(name, make, model, year, location)')
          .eq('user_id', userId)
          .lte('scheduled_date', futureDate.toISOString())
          .gte('scheduled_date', new Date().toISOString())
          .order('scheduled_date', { ascending: true });

        let filteredMaintenance = maintenance || [];
        if (location && location !== 'all') {
          filteredMaintenance = filteredMaintenance.filter((m: any) => 
            m.vehicles?.location?.toLowerCase() === location.toLowerCase()
          );
        }
        
        const maintenanceList = filteredMaintenance.map(m => ({
          vehicle: m.vehicles ? `${m.vehicles.year} ${m.vehicles.make} ${m.vehicles.model}` : 'Unknown',
          location: m.vehicles?.location || 'Miami',
          type: m.maintenance_type,
          scheduledDate: new Date(m.scheduled_date).toLocaleDateString(),
          estimatedCost: m.estimated_cost ? `$${m.estimated_cost}` : 'TBD',
          status: m.status
        }));

        return { 
          maintenance: maintenanceList, 
          count: filteredMaintenance.length,
          summary: `You have ${filteredMaintenance.length} maintenance task${filteredMaintenance.length !== 1 ? 's' : ''} scheduled in the next ${daysAhead} days${location ? ` in ${location}` : ''}.`
        };
      }

      case "getCustomerLifetimeValue": {
        const { customerName } = args;
        
        const { data: customer } = await supabase
          .from('customers')
          .select('full_name, lifetime_value, total_bookings, customer_status')
          .eq('user_id', userId)
          .ilike('full_name', `%${customerName}%`)
          .maybeSingle();

        if (!customer) return { 
          error: "Customer not found",
          summary: `I couldn't find a customer matching "${customerName}".`
        };

        return { 
          customer: {
            name: customer.full_name,
            status: customer.customer_status,
            totalBookings: customer.total_bookings || 0,
            lifetimeValue: `$${Number(customer.lifetime_value || 0).toFixed(0)}`
          },
          summary: `${customer.full_name} is a ${customer.customer_status || 'regular'} customer with ${customer.total_bookings || 0} bookings and $${Number(customer.lifetime_value || 0).toFixed(0)} lifetime value.`
        };
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
        const { city = 'miami', days = 14, location } = args;
        const effectiveLocation = location || city;
        console.log(`[getDemandForecast] Location: ${effectiveLocation}, Days: ${days}`);
        
        // Check for peak season
        const peakSeason = getCurrentPeakSeason(effectiveLocation);
        
        // Call the PredictHQ events edge function
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const predicthqKey = Deno.env.get('PREDICTHQ_API_KEY');
        
        let events: any[] = [];
        let demandMultiplier = peakSeason?.surge || 1.0;
        
        if (predicthqKey) {
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/predicthq-events`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ city: effectiveLocation, days })
            });
            const data = await response.json();
            events = data.events || [];
            demandMultiplier = Math.max(demandMultiplier, data.demandMultiplier || 1.0);
          } catch (e) {
            console.error('Error fetching events:', e);
          }
        }
        
        // Get historical bookings for demand context
        let bookingsQuery = supabase
          .from('bookings')
          .select('start_date, total_value, vehicles(location)')
          .eq('user_id', userId)
          .gte('start_date', new Date().toISOString())
          .order('start_date', { ascending: true })
          .limit(20);
        
        const { data: bookings } = await bookingsQuery;
        
        let filteredBookings = bookings || [];
        if (effectiveLocation && effectiveLocation !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase().includes(effectiveLocation.toLowerCase())
          );
        }
        
        const upcomingBookings = filteredBookings.length;
        const upcomingRevenue = filteredBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
        
        return {
          location: effectiveLocation,
          forecastDays: days,
          demandMultiplier,
          peakSeason: peakSeason?.name || null,
          upcomingEvents: events.slice(0, 5).map((e: any) => ({
            name: e.name,
            date: e.date,
            category: e.category,
            attendance: e.attendance
          })),
          totalEvents: events.length,
          upcomingBookings,
          upcomingRevenue: `$${upcomingRevenue.toFixed(0)}`,
          summary: peakSeason 
            ? `${effectiveLocation} is currently in ${peakSeason.name} peak season with a ${((peakSeason.surge - 1) * 100).toFixed(0)}% surge multiplier. You have ${upcomingBookings} bookings worth $${upcomingRevenue.toFixed(0)} coming up.`
            : events.length > 0 
              ? `For ${effectiveLocation}, there are ${events.length} upcoming events with a ${demandMultiplier.toFixed(2)}x demand multiplier. Top events include ${events.slice(0, 2).map((e: any) => e.name).join(' and ')}. You have ${upcomingBookings} bookings worth $${upcomingRevenue.toFixed(0)} coming up.`
              : `No major events found for ${effectiveLocation} in the next ${days} days. You have ${upcomingBookings} bookings worth $${upcomingRevenue.toFixed(0)} coming up.`
        };
      }

      case "getPricingRecommendation": {
        const { vehicleName, location } = args;
        console.log(`[getPricingRecommendation] Vehicle: ${vehicleName}, Location: ${location}`);
        
        // Find the vehicle
        let vehicleQuery = supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId);
        
        if (vehicleName) {
          vehicleQuery = vehicleQuery.or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`);
        }
        if (location) {
          vehicleQuery = vehicleQuery.eq('location', location);
        }
        
        const { data: vehicle } = await vehicleQuery.maybeSingle();

        if (!vehicle) {
          return { 
            error: "Vehicle not found",
            summary: `I couldn't find a vehicle matching "${vehicleName}"${location ? ` in ${location}` : ''}.`
          };
        }

        const currentRate = Number(vehicle.current_rate);
        const utilization = vehicle.utilization || 0;
        const vehicleLocation = vehicle.location || 'Miami';
        
        // Check for peak season
        const peakSeason = getCurrentPeakSeason(vehicleLocation);
        
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
        
        // Peak season adjustment
        if (peakSeason) {
          suggestedRate *= peakSeason.surge;
          factors.push(`${peakSeason.name} peak season (${((peakSeason.surge - 1) * 100).toFixed(0)}% surge)`);
        } else {
          // Basic seasonal adjustment
          const month = new Date().getMonth();
          if ([5, 6, 7, 11].includes(month)) {
            suggestedRate *= 1.10;
            factors.push('peak season premium');
          }
        }
        
        // Use suggested_rate from DB if available
        if (vehicle.suggested_rate && Math.abs(vehicle.suggested_rate - suggestedRate) < 100) {
          suggestedRate = vehicle.suggested_rate;
        }
        
        suggestedRate = Math.round(suggestedRate / 5) * 5;
        const difference = suggestedRate - currentRate;
        const percentChange = ((difference / currentRate) * 100).toFixed(1);
        
        return {
          vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          location: vehicleLocation,
          currentRate: `$${currentRate}`,
          suggestedRate: `$${suggestedRate}`,
          difference: difference > 0 ? `+$${difference}` : `$${difference}`,
          percentChange: difference > 0 ? `+${percentChange}%` : `${percentChange}%`,
          factors,
          peakSeason: peakSeason?.name || null,
          monthlyImpact: `$${Math.abs(difference * 20).toFixed(0)}/month`,
          summary: suggestedRate > currentRate 
            ? `I recommend increasing the rate for your ${vehicle.year} ${vehicle.make} ${vehicle.model} in ${vehicleLocation} from $${currentRate} to $${suggestedRate} per day, a ${percentChange}% increase. This is based on ${factors.join(' and ')}. This could add approximately $${Math.abs(difference * 20).toFixed(0)} per month in revenue.`
            : suggestedRate < currentRate
              ? `Consider reducing the rate for your ${vehicle.year} ${vehicle.make} ${vehicle.model} in ${vehicleLocation} from $${currentRate} to $${suggestedRate} per day to boost bookings. This is based on ${factors.join(' and ')}.`
              : `The current rate of $${currentRate} for your ${vehicle.year} ${vehicle.make} ${vehicle.model} in ${vehicleLocation} appears optimal given current market conditions.`
        };
      }

      case "getFleetPricingOverview": {
        const { location } = args;
        console.log(`[getFleetPricingOverview] User: ${userId}, Location: ${location || 'all'}`);
        
        let query = supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId);
        
        if (location && location !== 'all') {
          query = query.eq('location', location);
        }
        
        const { data: vehicles } = await query;
        
        if (!vehicles || vehicles.length === 0) {
          return {
            summary: `You don't have any vehicles${location ? ` in ${location}` : ''} to analyze pricing for.`
          };
        }
        
        const totalVehicles = vehicles.length;
        const avgRate = vehicles.reduce((sum, v) => sum + Number(v.current_rate), 0) / totalVehicles;
        const avgUtilization = vehicles.reduce((sum, v) => sum + (v.utilization || 0), 0) / totalVehicles;
        const totalRevenue = vehicles.reduce((sum, v) => sum + Number(v.revenue || 0), 0);
        
        // Find under and over-utilized vehicles
        const underUtilized = vehicles.filter(v => (v.utilization || 0) < 50);
        const highPerformers = vehicles.filter(v => (v.utilization || 0) > 75);
        
        // Check for peak season
        const peakSeason = getCurrentPeakSeason(location);
        
        // Group by location if showing all
        const byLocation = vehicles.reduce((acc, v) => {
          const loc = v.location || 'Miami';
          if (!acc[loc]) {
            acc[loc] = { count: 0, revenue: 0, avgRate: 0 };
          }
          acc[loc].count++;
          acc[loc].revenue += Number(v.revenue || 0);
          acc[loc].avgRate += Number(v.current_rate || 0);
          return acc;
        }, {} as Record<string, { count: number; revenue: number; avgRate: number }>);
        
        for (const loc of Object.keys(byLocation)) {
          byLocation[loc].avgRate = byLocation[loc].avgRate / byLocation[loc].count;
        }
        
        return {
          totalVehicles,
          averageRate: `$${avgRate.toFixed(0)}`,
          averageUtilization: `${avgUtilization.toFixed(0)}%`,
          totalFleetRevenue: `$${totalRevenue.toFixed(0)}`,
          underUtilizedCount: underUtilized.length,
          highPerformerCount: highPerformers.length,
          location: location || 'all',
          peakSeason: peakSeason?.name || null,
          surgePricing: peakSeason?.surge || 1.0,
          byLocation: Object.entries(byLocation).map(([loc, stats]) => ({
            location: loc,
            vehicleCount: stats.count,
            revenue: `$${stats.revenue.toFixed(0)}`,
            avgRate: `$${stats.avgRate.toFixed(0)}`
          })),
          topPerformers: highPerformers.slice(0, 3).map(v => ({
            name: `${v.year} ${v.make} ${v.model}`,
            location: v.location,
            utilization: `${v.utilization}%`,
            rate: `$${v.current_rate}`
          })),
          recommendations: underUtilized.length > 0 
            ? `${underUtilized.length} vehicles are under-utilized and may benefit from price adjustments.`
            : 'Fleet pricing looks healthy!',
          summary: `Your fleet${location ? ` in ${location}` : ''} has ${totalVehicles} vehicles with an average daily rate of $${avgRate.toFixed(0)} and ${avgUtilization.toFixed(0)}% average utilization. Total fleet revenue is $${totalRevenue.toFixed(0)}. ${highPerformers.length} vehicles are performing above 75% utilization, while ${underUtilized.length} are below 50%.${peakSeason ? ` Currently in ${peakSeason.name} peak season.` : ''}`
        };
      }

      case "getEventImpact": {
        const { eventName, location } = args;
        console.log(`[getEventImpact] Searching for event: ${eventName}, Location: ${location}`);
        
        // Check peak seasons calendar first
        const peakSeason = PEAK_SEASONS.find(s => 
          s.name.toLowerCase().includes(eventName.toLowerCase()) ||
          eventName.toLowerCase().includes(s.name.toLowerCase())
        );
        
        if (peakSeason) {
          return {
            searched: eventName,
            eventName: peakSeason.name,
            dates: `${peakSeason.start} to ${peakSeason.end}`,
            location: peakSeason.location,
            surgePricing: peakSeason.surge,
            impact: `${((peakSeason.surge - 1) * 100).toFixed(0)}% surge pricing recommended`,
            recommendation: `During ${peakSeason.name}, increase rates by ${((peakSeason.surge - 1) * 100).toFixed(0)}% to capture peak demand. Ensure high-value vehicles are available.`,
            summary: `${peakSeason.name} runs from ${peakSeason.start} to ${peakSeason.end} in ${peakSeason.location}. I recommend a ${((peakSeason.surge - 1) * 100).toFixed(0)}% price surge during this period to maximize revenue.`
          };
        }
        
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
          },
          "mclaren 720s": {
            make: "McLaren", model: "720S Spider", engine: "4.0L Twin-Turbo V8",
            horsepower: "710 hp", torque: "568 lb-ft", acceleration: "2.8 sec (0-60 mph)",
            topSpeed: "212 mph", drivetrain: "RWD", weight: "3,128 lbs"
          },
          "bugatti chiron": {
            make: "Bugatti", model: "Chiron Sport", engine: "8.0L Quad-Turbo W16",
            horsepower: "1,479 hp", torque: "1,180 lb-ft", acceleration: "2.4 sec (0-60 mph)",
            topSpeed: "261 mph", drivetrain: "AWD", weight: "4,400 lbs"
          },
          "porsche 911": {
            make: "Porsche", model: "911 Turbo S", engine: "3.7L Twin-Turbo Flat-6",
            horsepower: "640 hp", torque: "590 lb-ft", acceleration: "2.6 sec (0-60 mph)",
            topSpeed: "205 mph", drivetrain: "AWD", weight: "3,636 lbs"
          },
          "rolls-royce": {
            make: "Rolls-Royce", model: "Phantom", engine: "6.75L Twin-Turbo V12",
            horsepower: "563 hp", torque: "664 lb-ft", acceleration: "5.1 sec (0-60 mph)",
            topSpeed: "155 mph", drivetrain: "RWD", weight: "5,644 lbs"
          }
        };

        const searchKey = vehicleName.toLowerCase();
        const spec = Object.keys(specsDatabase).find(key => searchKey.includes(key) || key.includes(searchKey));
        
        if (spec) {
          const specData = specsDatabase[spec];
          return {
            ...specData,
            summary: `The ${specData.make} ${specData.model} features a ${specData.engine} producing ${specData.horsepower} and ${specData.torque}. It does 0-60 in ${specData.acceleration} with a top speed of ${specData.topSpeed}.`
          };
        }
        return { 
          error: "Vehicle specs not found in database", 
          searched: vehicleName,
          summary: `I don't have detailed specs for "${vehicleName}" in my database. Try asking about Ferrari SF90, Lamborghini Aventador, McLaren 720S, Bugatti Chiron, Porsche 911, or Rolls-Royce.`
        };
      }

      case "logFeedback": {
        const { feedbackType, keywords, userQuery, rariResponse, context } = args;
        console.log(`[logFeedback] Logging feedback: ${feedbackType}`);
        
        const { error } = await supabase
          .from('rari_feedback')
          .insert({
            user_id: userId,
            feedback_type: feedbackType || 'feature_request',
            keywords: keywords ? keywords.split(',').map((k: string) => k.trim()) : [],
            user_query: userQuery,
            rari_response: rariResponse,
            context: context ? JSON.parse(context) : null
          });

        if (error) {
          console.error('[logFeedback] Error:', error);
          return { 
            success: false, 
            error: error.message,
            summary: "I apologize, I couldn't save that feedback. But I've noted your request."
          };
        }

        return { 
          success: true,
          summary: "I've logged your feedback. This feature is coming soon, and the team will review your request. Is there anything else I can help you with?"
        };
      }

      case "featureComingSoon": {
        const { featureName, userRequest } = args;
        console.log(`[featureComingSoon] Feature requested: ${featureName}`);
        
        // Log as feature request
        await supabase
          .from('rari_feedback')
          .insert({
            user_id: userId,
            feedback_type: 'feature_request',
            keywords: [featureName],
            user_query: userRequest,
            rari_response: `Feature coming soon: ${featureName}`,
            context: { requested_feature: featureName }
          });

        return {
          feature: featureName,
          status: 'coming_soon',
          summary: `That's a great idea! The ${featureName} feature is coming soon. I've logged your request so the team knows you need this. In the meantime, is there something else I can help you with?`
        };
      }

      case "createBooking": {
        const { 
          customerName, 
          customerEmail, 
          customerPhone, 
          vehicleName, 
          startDate, 
          endDate, 
          location, 
          dropoffLocation,
          status = 'pending',
          notes 
        } = args;
        
        console.log(`[createBooking] Creating booking for ${customerName}, vehicle: ${vehicleName}, dates: ${startDate} to ${endDate}`);
        
        // Validate required fields
        if (!customerName || !vehicleName || !startDate || !endDate || !location) {
          return {
            error: 'Missing required fields',
            summary: 'I need the customer name, vehicle name, start date, end date, and pickup location to create a booking.'
          };
        }

        // Parse dates
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return {
            error: 'Invalid date format',
            summary: 'The dates provided are not in a valid format. Please use YYYY-MM-DD format.'
          };
        }

        if (end <= start) {
          return {
            error: 'Invalid date range',
            summary: 'The end date must be after the start date.'
          };
        }

        // Find vehicle by name
        const { data: vehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', userId)
          .or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`)
          .limit(1)
          .maybeSingle();

        if (vehicleError || !vehicle) {
          return {
            error: 'Vehicle not found',
            summary: `I couldn't find a vehicle matching "${vehicleName}" in your fleet.`
          };
        }

        // Check availability
        const { data: conflicts } = await supabase
          .from('bookings')
          .select('id, customer_name, start_date, end_date')
          .eq('vehicle_id', vehicle.id)
          .in('status', ['pending', 'confirmed', 'active'])
          .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);

        if (conflicts && conflicts.length > 0) {
          const conflictInfo = conflicts.map(c => 
            `${c.customer_name} (${new Date(c.start_date).toLocaleDateString()} - ${new Date(c.end_date).toLocaleDateString()})`
          ).join(', ');
          
          return {
            error: 'Vehicle not available',
            available: false,
            conflicts: conflicts.length,
            summary: `The ${vehicle.year} ${vehicle.make} ${vehicle.model} is not available for those dates. Conflicting bookings: ${conflictInfo}.`
          };
        }

        // Calculate duration and pricing
        const durationMs = end.getTime() - start.getTime();
        const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
        const dailyRate = vehicle.current_rate || 0;
        const totalValue = dailyRate * durationDays;
        const depositAmount = totalValue * 0.2; // 20% deposit
        const securityDeposit = dailyRate * 2; // 2 days as security

        // Try to find or create customer record
        let customerId = null;
        if (customerEmail) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('user_id', userId)
            .eq('email', customerEmail)
            .maybeSingle();

          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            // Create new customer
            const { data: newCustomer } = await supabase
              .from('customers')
              .insert({
                user_id: userId,
                email: customerEmail,
                phone: customerPhone,
                full_name: customerName,
                customer_status: 'active',
              })
              .select()
              .maybeSingle();

            if (newCustomer) {
              customerId = newCustomer.id;
            }
          }
        }

        // Create the booking
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            user_id: userId,
            vehicle_id: vehicle.id,
            customer_id: customerId,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            start_date: start.toISOString(),
            end_date: end.toISOString(),
            pickup_location: location,
            dropoff_location: dropoffLocation || location,
            daily_rate: dailyRate,
            total_value: totalValue,
            status: status,
            notes: notes,
            deposit_amount: depositAmount,
            balance_due: totalValue - depositAmount,
            security_deposit_amount: securityDeposit,
            security_deposit_status: 'pending',
            payment_status: 'pending',
          })
          .select()
          .single();

        if (bookingError) {
          console.error('[createBooking] Error:', bookingError);
          return {
            error: 'Failed to create booking',
            summary: `I encountered an error while creating the booking: ${bookingError.message}`
          };
        }

        // Update vehicle status if confirmed
        if (status === 'confirmed' || status === 'active') {
          await supabase
            .from('vehicles')
            .update({ status: 'booked' })
            .eq('id', vehicle.id);
        }

        console.log(`[createBooking] Successfully created booking ${booking.id}`);

        return {
          success: true,
          bookingId: booking.id,
          customerName: booking.customer_name,
          vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          vehicleLocation: vehicle.location || 'Miami',
          startDate: new Date(booking.start_date).toLocaleDateString(),
          endDate: new Date(booking.end_date).toLocaleDateString(),
          durationDays,
          pickupLocation: booking.pickup_location,
          dropoffLocation: booking.dropoff_location,
          dailyRate: `$${booking.daily_rate}`,
          totalValue: `$${booking.total_value}`,
          depositAmount: `$${booking.deposit_amount}`,
          balanceDue: `$${booking.balance_due}`,
          securityDeposit: `$${booking.security_deposit_amount}`,
          status: booking.status,
          summary: `Perfect! I've created a ${status} booking for ${customerName}. The ${vehicle.year} ${vehicle.make} ${vehicle.model} is reserved from ${new Date(booking.start_date).toLocaleDateString()} to ${new Date(booking.end_date).toLocaleDateString()} (${durationDays} days) at $${booking.daily_rate} per day for a total of $${booking.total_value}. A deposit of $${booking.deposit_amount} is required, with a balance due of $${booking.balance_due}. Pickup location: ${booking.pickup_location}. Booking ID: ${booking.id}.`
        };
      }

      default:
        // Log unknown requests as potential feature needs
        console.log(`[UNKNOWN] Function not found: ${functionName}`);
        await supabase
          .from('rari_feedback')
          .insert({
            user_id: userId,
            feedback_type: 'not_working',
            keywords: [functionName],
            user_query: JSON.stringify(args),
            rari_response: `Unknown function: ${functionName}`,
            context: { function_name: functionName, args }
          });
        
        return { 
          error: `I don't have that capability yet, but I've noted your request.`,
          summary: `That feature isn't available yet, but I've logged it for the team. Is there something else I can help you with?`
        };
    }
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    return { error: error instanceof Error ? error.message : 'Function execution failed' };
  }
}
