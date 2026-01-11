// @ts-nocheck - TODO: Add full type annotations to this large file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Type definitions for database records
interface Vehicle {
  id: string;
  name?: string;
  make: string;
  model: string;
  year: number;
  status?: string;
  location?: string;
  daily_rate?: number;
  current_rate?: number;
  utilization?: number;
  revenue?: number;
  license_plate?: string;
  vin?: string;
  suggested_rate?: number;
}

interface Booking {
  id: string;
  start_date: string;
  end_date: string;
  status?: string;
  total_amount?: number;
  total_value?: number;
  daily_rate?: number;
  payment_status?: string;
  payment_method?: string;
  customer_name?: string;
  created_at?: string;
  vehicle_id?: string;
  customer_id?: string;
  vehicles?: Vehicle & { vehicle_name?: string };
  customers?: { first_name?: string; last_name?: string; email?: string };
}

interface Customer {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  customer_tier?: string;
  customer_status?: string;
  company_name?: string;
  total_bookings?: number;
  lifetime_value?: number;
}

interface DamageReport {
  id: string;
  severity?: string;
  claim_status?: string;
  estimated_cost?: number;
  reported_date?: string;
  vehicles?: Vehicle;
}

interface MaintenanceRecord {
  id: string;
  maintenance_type?: string;
  scheduled_date?: string;
  estimated_cost?: number;
  status?: string;
  vehicles?: Vehicle;
}

interface ToolResult {
  [key: string]: unknown;
  summary?: string;
  error?: string;
}

// Helper function to get user's team_id
async function getUserTeamId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('[getUserTeamId] Error:', error);
    return null;
  }
  
  return data?.team_id || null;
}

serve(async (req) => {
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

    // If no user_id in metadata, fall back to DEMO_USER_ID env var, then first user
    if (!userId) {
      const demoUserId = Deno.env.get('DEMO_USER_ID');
      if (demoUserId) {
        console.log('Using DEMO_USER_ID from environment:', demoUserId);
        userId = demoUserId;
      } else {
        console.warn('No user_id in conversation metadata, falling back to first user');
        const { data: users } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .single();
        userId = users?.id || 'demo-user-id';
      }
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
      return new Response(
        JSON.stringify({
          error: 'User not found',
          summary: 'I could not find your profile. Please make sure you are logged in.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('User verified:', userProfile.full_name || userProfile.email);

    // Get user's team_id for multi-tenant queries
    const teamId = await getUserTeamId(supabase, userId);
    console.log('User team_id:', teamId);
    
    if (!teamId) {
      console.warn('No team found for user, queries may return limited data');
    }

    // Ensure toolName is defined
    if (!toolName) {
      return new Response(
        JSON.stringify({ error: 'No tool name specified', summary: 'I could not understand which action you wanted.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Execute the requested tool with team_id
    const result = await executeFunction(toolName, parameters, supabase, userId, teamId);

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

// Helper function to build team filter for multi-tenant queries
function buildTeamFilter(teamId: string | null): { field: string; value: string } | null {
  if (!teamId) return null;
  return { field: 'team_id', value: teamId };
}

async function executeFunction(functionName: string, args: Record<string, unknown>, supabase: SupabaseClient, userId: string, teamId: string | null): Promise<ToolResult> {
  console.log(`[TOOL] Executing: ${functionName} | User: ${userId} | Team: ${teamId} | Args:`, JSON.stringify(args));

  try {
    switch (functionName) {
      case "get_fleet_vehicles": {
        const { status, location } = args as { status?: string; location?: string };
        console.log(`[get_fleet_vehicles] Querying vehicles for team ${teamId}, status: ${status || 'all'}, location: ${location || 'all'}`);
        
        let query = supabase
          .from('vehicles')
          .select('*');
        
        // Filter by team_id
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        
        if (location && location !== 'all') {
          query = query.ilike('location', `%${location}%`);
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
        
        const vehicleData = (vehicles || []) as Vehicle[];
        
        if (vehicleData.length === 0) {
          return {
            count: 0,
            vehicles: [],
            summary: `You don't have any vehicles${location ? ` in ${location}` : ''}${status && status !== 'all' ? ` that are ${status}` : ''}.`
          };
        }
        
        const vehicleList = vehicleData.map((v: Vehicle) => ({
          name: `${v.year} ${v.make} ${v.model}`,
          status: v.status,
          location: v.location || 'Miami',
          rate: `$${v.daily_rate || v.current_rate} per day`,
          utilization: `${(v.utilization || 70)}% utilized`,
          revenue: `$${Number(v.revenue || 0).toFixed(0)} total revenue`
        }));

        // Group by location for summary
        const locationGroups = vehicleData.reduce((acc: Record<string, number>, v: Vehicle) => {
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
        console.log(`[get_bookings] Team: ${teamId}, Status: ${status || 'all'}, Location: ${location || 'all'}`);
        
        let query = supabase
          .from('bookings')
          .select('*, vehicles(vehicle_name, make, model, year, location), customers(first_name, last_name, email)');
        
        // Filter by team_id
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

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
            b.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
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
          const customerName = b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : b.customer_name || 'Unknown';
          
          return {
            customer: customerName,
            vehicle: vehicleName,
            location: b.vehicles?.location || 'Miami',
            dates: `${startDate} to ${endDate}`,
            status: b.status,
            total: `$${Number(b.total_value || b.total_amount || 0).toFixed(0)}`,
            payment: b.payment_status
          };
        });

        const totalRevenue = filteredBookings.reduce((sum, b) => sum + Number(b.total_value || b.total_amount || 0), 0);
        
        return {
          count: filteredBookings.length,
          bookings: bookingList,
          totalRevenue: `$${totalRevenue.toFixed(0)}`,
          summary: `You have ${filteredBookings.length} bookings${status && status !== 'all' ? ` that are ${status}` : ''}${location ? ` in ${location}` : ''}. Total value: $${totalRevenue.toFixed(0)}.`
        };
      }

      case "get_recent_activity": {
        const { limit = 10, activity_type } = args;
        
        let query = supabase
          .from('bookings')
          .select('*, vehicles(vehicle_name, make, model, year, location), customers(first_name, last_name)');
        
        // Filter by team_id
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        const { data: recentBookings } = await query
          .order('created_at', { ascending: false })
          .limit(limit);

        const activities = recentBookings?.map((b: any) => {
          const timeAgo = getTimeAgo(new Date(b.created_at));
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'a vehicle';
          const customerName = b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : b.customer_name || 'A customer';
          
          return {
            description: `${customerName} booked ${vehicleName} for $${Number(b.total_value || b.total_amount || 0).toFixed(0)}`,
            location: b.vehicles?.location || 'Miami',
            timeAgo,
            status: b.status,
            amount: `$${Number(b.total_value || b.total_amount || 0).toFixed(0)}`
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
        console.log(`[getFleetMetrics] Team: ${teamId}, Timeframe: ${timeframe}, Location: ${location || 'all'}`);
        
        let dateFilter = new Date();
        
        if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
        else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
        else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
        else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);

        // Get vehicles with optional location filter
        let vehicleQuery = supabase.from('vehicles').select('*');
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        if (location && location !== 'all') {
          vehicleQuery = vehicleQuery.ilike('location', `%${location}%`);
        }
        
        // Get bookings with team filter
        let bookingsQuery = supabase.from('bookings').select('*, vehicles(location)');
        if (teamId) {
          bookingsQuery = bookingsQuery.eq('team_id', teamId);
        }
        bookingsQuery = bookingsQuery.gte('created_at', dateFilter.toISOString());
        
        // Get revenue bookings with team filter
        let revenueQuery = supabase.from('bookings').select('total_value, vehicles(location)');
        if (teamId) {
          revenueQuery = revenueQuery.eq('team_id', teamId);
        }
        revenueQuery = revenueQuery.eq('status', 'completed').gte('created_at', dateFilter.toISOString());
        
        const [vehiclesResult, bookingsResult, revenueResult] = await Promise.all([
          vehicleQuery,
          bookingsQuery,
          revenueQuery
        ]);

        const vehicles = vehiclesResult.data || [];
        let bookings = bookingsResult.data || [];
        let revenue = revenueResult.data || [];
        
        // Filter bookings by location if specified
        if (location && location !== 'all') {
          bookings = bookings.filter((b: any) => b.vehicles?.location?.toLowerCase().includes(location.toLowerCase()));
          revenue = revenue.filter((b: any) => b.vehicles?.location?.toLowerCase().includes(location.toLowerCase()));
        }

        const totalRevenue = revenue.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
        const activeBookings = bookings.filter((b: any) => b.status === 'active' || b.status === 'confirmed').length;
        const avgUtilization = vehicles.length > 0 
          ? vehicles.reduce((sum, v) => sum + ((v.utilization || 70) || 0), 0) / vehicles.length 
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
          summary: `${location ? `${location} fleet` : 'Your fleet'} has ${vehicles.length} vehicles with ${activeBookings} active bookings and $${totalRevenue.toFixed(0)} in revenue for the ${timeframe || 'period'}.${peakSeason ? ` Currently in ${peakSeason.name} with ${((peakSeason.surge - 1) * 100).toFixed(0)}% surge pricing recommended.` : ''}`
        };
      }

      case "getLocationMetrics": {
        const { location } = args;
        console.log(`[getLocationMetrics] Team: ${teamId}, Location: ${location || 'all'}`);
        
        // Get all vehicles
        let vehicleQuery = supabase
          .from('vehicles')
          .select('*');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: allVehicles } = await vehicleQuery;
        
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
          locationStats[loc].totalUtilization += vehicle.utilization || 70;
          locationStats[loc].avgRate += Number(vehicle.current_rate || vehicle.daily_rate || 0);
          locationStats[loc].vehicles.push({
            name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            status: vehicle.status,
            utilization: vehicle.utilization || 70,
            rate: vehicle.current_rate || vehicle.daily_rate
          });
        }
        
        // Calculate averages
        for (const loc of Object.keys(locationStats)) {
          const stats = locationStats[loc];
          stats.avgUtilization = stats.totalUtilization / stats.vehicleCount;
          stats.avgRate = stats.avgRate / stats.vehicleCount;
        }
        
        // Get bookings by location
        let bookingsQuery = supabase
          .from('bookings')
          .select('*, vehicles(location)');
        
        if (teamId) {
          bookingsQuery = bookingsQuery.eq('team_id', teamId);
        }
        
        const { data: bookings } = await bookingsQuery.in('status', ['active', 'confirmed', 'pending']);
        
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
        if (location && location !== 'all') {
          const matchingLoc = Object.keys(locationStats).find(l => l.toLowerCase().includes(location.toLowerCase()));
          if (matchingLoc && locationStats[matchingLoc]) {
            const stats = locationStats[matchingLoc];
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
              summary: `${stats.location} has ${stats.vehicleCount} vehicles with $${stats.totalRevenue.toFixed(0)} total revenue, ${stats.avgUtilization.toFixed(0)}% average utilization, and ${stats.activeBookings || 0} active bookings.${stats.peakSeason ? ` Currently in ${stats.peakSeason} peak season.` : ''}`
            };
          }
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
        console.log(`[getPaymentSummary] Team: ${teamId}, Status: ${status || 'all'}, Timeframe: ${timeframe || 'all'}, Location: ${location || 'all'}`);
        
        let dateFilter = new Date();
        if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
        else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
        else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
        else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);
        else dateFilter = new Date(0); // All time
        
        // Get payments with team filter
        let paymentsQuery = supabase
          .from('payments')
          .select('*, bookings(vehicles(location))');
        
        if (teamId) {
          paymentsQuery = paymentsQuery.eq('team_id', teamId);
        }
        
        const { data: payments, error } = await paymentsQuery
          .gte('created_at', dateFilter.toISOString())
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('[getPaymentSummary] Database error:', error);
          return { error: 'Failed to fetch payments', summary: 'I encountered an error retrieving payment data.' };
        }
        
        let filteredPayments = payments || [];
        
        // Filter by location if specified
        if (location && location !== 'all') {
          filteredPayments = filteredPayments.filter((p: any) => 
            p.bookings?.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        // Filter by status
        if (status && status !== 'all') {
          filteredPayments = filteredPayments.filter((p: any) => p.payment_status === status);
        }
        
        // Calculate summaries
        const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const completedPayments = filteredPayments.filter(p => p.payment_status === 'completed');
        const pendingPayments = filteredPayments.filter(p => p.payment_status === 'pending');
        
        const completedAmount = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const pendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        
        const byMethod = filteredPayments.reduce((acc, p) => {
          const m = p.payment_method || 'unknown';
          acc[m] = (acc[m] || 0) + Number(p.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        
        return {
          totalPayments: filteredPayments.length,
          totalAmount: `$${totalAmount.toFixed(0)}`,
          completedAmount: `$${completedAmount.toFixed(0)}`,
          pendingAmount: `$${pendingAmount.toFixed(0)}`,
          completedCount: completedPayments.length,
          pendingCount: pendingPayments.length,
          byMethod: Object.entries(byMethod).map(([m, a]) => ({ method: m, amount: `$${a.toFixed(0)}` })),
          timeframe: timeframe || 'all time',
          location: location || 'all',
          summary: `${timeframe ? `This ${timeframe}` : 'Total'} payments${location ? ` in ${location}` : ''}: $${totalAmount.toFixed(0)} across ${filteredPayments.length} transactions. Completed: $${completedAmount.toFixed(0)}, Pending: $${pendingAmount.toFixed(0)}.`
        };
      }

      case "getVehicleDetails": {
        const { vehicleName, includeBookings } = args;
        
        let vehicleQuery = supabase
          .from('vehicles')
          .select('*');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: vehicle } = await vehicleQuery
          .or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`)
          .limit(1)
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
            .select('*, customers(first_name, last_name)')
            .eq('vehicle_id', vehicle.id)
            .order('start_date', { ascending: false })
            .limit(5);
          bookingsData = bookings?.map(b => {
            const customerName = b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : b.customer_name || 'Unknown';
            return {
              customer: customerName,
              dates: `${new Date(b.start_date).toLocaleDateString()} to ${new Date(b.end_date).toLocaleDateString()}`,
              status: b.status,
              amount: `$${Number(b.total_value || b.total_amount || 0).toFixed(0)}`
            };
          });
        }

        return { 
          vehicle: {
            name: fullName,
            status: vehicle.status,
            location: vehicle.location || 'Miami',
            rate: `$${vehicle.current_rate || vehicle.daily_rate} per day`,
            suggestedRate: vehicle.suggested_rate ? `$${vehicle.suggested_rate}` : null,
            utilization: `${vehicle.utilization || 70}% utilization`,
            revenue: `$${Number(vehicle.revenue || 0).toFixed(0)} total revenue`,
            licensePlate: vehicle.license_plate,
            vin: vehicle.vin
          },
          bookings: bookingsData,
          summary: `${fullName} in ${vehicle.location || 'Miami'} is currently ${vehicle.status}, priced at $${vehicle.current_rate || vehicle.daily_rate} per day with ${vehicle.utilization || 70}% utilization.`
        };
      }

      case "getCustomerProfile": {
        const { customerName, includeHistory } = args;
        
        let customerQuery = supabase
          .from('customers')
          .select('*');
        
        if (teamId) {
          customerQuery = customerQuery.eq('team_id', teamId);
        }
        
        const { data: customers } = await customerQuery
          .or(`full_name.ilike.%${customerName}%,email.ilike.%${customerName}%`)
          .limit(1);
        
        const customer = customers?.[0];

        if (!customer) return { 
          error: "Customer not found",
          summary: `I couldn't find a customer matching "${customerName}".`
        };

        const fullName = customer.full_name;
        
        let bookingsData = null;
        let totalBookings = customer.total_bookings || 0;
        let lifetimeValue = customer.lifetime_value || 0;
        
        if (includeHistory) {
          const { data: bookings } = await supabase
            .from('bookings')
            .select('*, vehicles(make, model, year, location)')
            .eq('customer_id', customer.id)
            .order('start_date', { ascending: false })
            .limit(10);
          
          if (bookings) {
            totalBookings = bookings.length;
            lifetimeValue = bookings.reduce((sum, b) => sum + Number(b.total_value || b.total_amount || 0), 0);
            
            bookingsData = bookings.map(b => ({
              vehicle: b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'Unknown',
              location: b.vehicles?.location || 'Miami',
              dates: `${new Date(b.start_date).toLocaleDateString()} to ${new Date(b.end_date).toLocaleDateString()}`,
              status: b.status,
              total: `$${Number(b.total_value || b.total_amount || 0).toFixed(0)}`
            }));
          }
        }

        return { 
          customer: {
            name: fullName,
            email: customer.email,
            phone: customer.phone,
            status: customer.customer_status,
            totalBookings,
            lifetimeValue: `$${lifetimeValue.toFixed(0)}`
          },
          bookings: bookingsData,
          summary: `${fullName} is a ${customer.customer_status || 'regular'} customer with ${totalBookings} bookings and $${lifetimeValue.toFixed(0)} lifetime value.`
        };
      }

      case "checkAvailability": {
        const { vehicleName, startDate, endDate, location } = args;
        
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, year, status, location, current_rate');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        if (vehicleName) {
          vehicleQuery = vehicleQuery.or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`);
        }
        if (location) {
          vehicleQuery = vehicleQuery.ilike('location', `%${location}%`);
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
        else dateFilter = new Date(0);

        let query = supabase
          .from('bookings')
          .select('*, vehicles(make, model, year, location)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        const { data: bookings } = await query
          .eq('status', 'completed')
          .gte('created_at', dateFilter.toISOString());
        
        let filteredBookings = bookings || [];
        
        if (location && location !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        if (vehicleName) {
          filteredBookings = filteredBookings.filter((b: any) => {
            const name = `${b.vehicles?.make} ${b.vehicles?.model}`.toLowerCase();
            return name.includes(vehicleName.toLowerCase());
          });
        }
        
        const totalRevenue = filteredBookings.reduce((sum: number, b: any) => sum + Number(b.total_value || b.total_amount || 0), 0);
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
        
        if (metric === 'revenue' || metric === 'utilization') {
          let query = supabase
            .from('vehicles')
            .select('name, make, model, year, revenue, utilization, location');
          
          if (teamId) {
            query = query.eq('team_id', teamId);
          }
          
          if (location && location !== 'all') {
            query = query.ilike('location', `%${location}%`);
          }
          
          const { data: vehicles } = await query
            .order(metric === 'utilization' ? 'utilization' : 'revenue', { ascending: false })
            .limit(limit);
          
          const performers = vehicles?.map(v => ({
            name: `${v.year} ${v.make} ${v.model}`,
            location: v.location,
            revenue: `$${Number(v.revenue || 0).toFixed(0)}`,
            utilization: `${v.utilization || 70}%`
          })) || [];
          
          return { 
            metric, 
            performers,
            summary: `Top ${performers.length} vehicles by ${metric}${location ? ` in ${location}` : ''}: ${performers.map(p => `${p.name} (${metric === 'revenue' ? p.revenue : p.utilization})`).join(', ')}.`
          };
        } else {
          // Top customers
          let query = supabase
            .from('customers')
            .select('full_name, total_bookings, lifetime_value');
          
          if (teamId) {
            query = query.eq('team_id', teamId);
          }
          
          const { data: customers } = await query
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
          .select('*, vehicles(make, model, year, location), customers(first_name, last_name)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

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
            b.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        const bookingList = filteredBookings.map(b => {
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'vehicle';
          return {
            customer: b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : b.customer_name || 'Unknown',
            vehicle: vehicleName,
            location: b.vehicles?.location || 'Miami',
            dates: `${new Date(b.start_date).toLocaleDateString()} to ${new Date(b.end_date).toLocaleDateString()}`,
            status: b.status,
            total: `$${Number(b.total_value || b.total_amount || 0).toFixed(0)}`
          };
        });

        const totalValue = filteredBookings.reduce((sum, b) => sum + Number(b.total_value || b.total_amount || 0), 0);

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
          .select('*, vehicles(make, model, year, location)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        if (status && status !== 'all') query = query.eq('claim_status', status);

        const { data: claims } = await query.order('reported_date', { ascending: false });
        
        let filteredClaims = claims || [];
        if (location && location !== 'all') {
          filteredClaims = filteredClaims.filter((c: any) => 
            c.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
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

        let query = supabase
          .from('maintenance_schedules')
          .select('*, vehicles(make, model, year, location)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        const { data: maintenance } = await query
          .lte('scheduled_date', futureDate.toISOString())
          .gte('scheduled_date', new Date().toISOString())
          .order('scheduled_date', { ascending: true });

        let filteredMaintenance = maintenance || [];
        if (location && location !== 'all') {
          filteredMaintenance = filteredMaintenance.filter((m: any) => 
            m.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
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
        
        let query = supabase
          .from('customers')
          .select('full_name, lifetime_value, total_bookings, customer_status');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        const { data: customer } = await query
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
        
        // Mock documents for now
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
        console.log(`[getDemandForecast] Team: ${teamId}, Location: ${effectiveLocation}, Days: ${days}`);
        
        // Check for peak season
        const peakSeason = getCurrentPeakSeason(effectiveLocation);
        
        let demandMultiplier = peakSeason?.surge || 1.0;
        
        // Get upcoming bookings for demand context
        let bookingsQuery = supabase
          .from('bookings')
          .select('start_date, total_value, vehicles(location)');
        
        if (teamId) {
          bookingsQuery = bookingsQuery.eq('team_id', teamId);
        }
        
        const { data: bookings } = await bookingsQuery
          .gte('start_date', new Date().toISOString())
          .order('start_date', { ascending: true })
          .limit(20);
        
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
          upcomingBookings,
          upcomingRevenue: `$${upcomingRevenue.toFixed(0)}`,
          summary: peakSeason 
            ? `${effectiveLocation} is currently in ${peakSeason.name} peak season with a ${((peakSeason.surge - 1) * 100).toFixed(0)}% surge multiplier. You have ${upcomingBookings} bookings worth $${upcomingRevenue.toFixed(0)} coming up.`
            : `Standard demand period for ${effectiveLocation}. You have ${upcomingBookings} bookings worth $${upcomingRevenue.toFixed(0)} coming up.`
        };
      }

      case "getPricingRecommendation": {
        const { vehicleName, location } = args;
        console.log(`[getPricingRecommendation] Team: ${teamId}, Vehicle: ${vehicleName}, Location: ${location}`);
        
        // Find the vehicle
        let vehicleQuery = supabase
          .from('vehicles')
          .select('*');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        if (vehicleName) {
          vehicleQuery = vehicleQuery.or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`);
        }
        if (location) {
          vehicleQuery = vehicleQuery.ilike('location', `%${location}%`);
        }
        
        const { data: vehicle } = await vehicleQuery.maybeSingle();

        if (!vehicle) {
          return { 
            error: "Vehicle not found",
            summary: `I couldn't find a vehicle matching "${vehicleName}"${location ? ` in ${location}` : ''}.`
          };
        }

        const currentRate = Number(vehicle.current_rate || vehicle.daily_rate);
        const utilization = vehicle.utilization || 70;
        const vehicleLocation = vehicle.location || 'Miami';
        
        // Check for peak season
        const peakSeason = getCurrentPeakSeason(vehicleLocation);
        
        // Calculate recommendation
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
        console.log(`[getFleetPricingOverview] Team: ${teamId}, Location: ${location || 'all'}`);
        
        let query = supabase
          .from('vehicles')
          .select('*');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        if (location && location !== 'all') {
          query = query.ilike('location', `%${location}%`);
        }
        
        const { data: vehicles } = await query;
        
        if (!vehicles || vehicles.length === 0) {
          return {
            summary: `You don't have any vehicles${location ? ` in ${location}` : ''} to analyze pricing for.`
          };
        }
        
        const totalVehicles = vehicles.length;
        const avgRate = vehicles.reduce((sum, v) => sum + Number(v.current_rate || v.daily_rate || 0), 0) / totalVehicles;
        const avgUtilization = vehicles.reduce((sum, v) => sum + (v.utilization || 70), 0) / totalVehicles;
        const totalRevenue = vehicles.reduce((sum, v) => sum + Number(v.revenue || 0), 0);
        
        // Find under and over-utilized vehicles
        const underUtilized = vehicles.filter(v => (v.utilization || 70) < 50);
        const highPerformers = vehicles.filter(v => (v.utilization || 70) > 75);
        
        // Check for peak season
        const peakSeason = getCurrentPeakSeason(location);
        
        // Group by location
        const byLocation = vehicles.reduce((acc, v) => {
          const loc = v.location || 'Miami';
          if (!acc[loc]) {
            acc[loc] = { count: 0, revenue: 0, avgRate: 0 };
          }
          acc[loc].count++;
          acc[loc].revenue += Number(v.revenue || 0);
          acc[loc].avgRate += Number(v.current_rate || v.daily_rate || 0);
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
            utilization: `${v.utilization || 70}%`,
            rate: `$${v.current_rate || v.daily_rate}`
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

      // ============================================================
      // ENTERPRISE HANDLERS - Advanced Business Intelligence
      // ============================================================

      case "getVehicleProfitLoss": {
        const { vehicleName, timeframe, location } = args;
        console.log(`[getVehicleProfitLoss] Team: ${teamId}, Vehicle: ${vehicleName || 'all'}, Timeframe: ${timeframe || 'all'}, Location: ${location || 'all'}`);
        
        // Get date filter
        let dateFilter = new Date();
        if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
        else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
        else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
        else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);
        else dateFilter = new Date(0);
        
        // Get vehicles
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, year, location, current_rate, utilization, revenue');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        if (vehicleName) {
          vehicleQuery = vehicleQuery.or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`);
        }
        if (location && location !== 'all') {
          vehicleQuery = vehicleQuery.ilike('location', `%${location}%`);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (!vehicles || vehicles.length === 0) {
          return { summary: `I couldn't find any vehicles matching your criteria.` };
        }
        
        // Get bookings for revenue
        const vehicleIds = vehicles.map((v: any) => v.id);
        const { data: bookings } = await supabase
          .from('bookings')
          .select('vehicle_id, total_value')
          .in('vehicle_id', vehicleIds)
          .in('status', ['completed', 'active'])
          .gte('created_at', dateFilter.toISOString());
        
        // Get maintenance costs
        const { data: maintenance } = await supabase
          .from('maintenance_schedules')
          .select('vehicle_id, estimated_cost')
          .in('vehicle_id', vehicleIds)
          .eq('status', 'completed')
          .gte('created_at', dateFilter.toISOString());
        
        // Calculate P/L
        const profitLoss = vehicles.map((vehicle: any) => {
          const vBookings = bookings?.filter((b: any) => b.vehicle_id === vehicle.id) || [];
          const vMaintenance = maintenance?.filter((m: any) => m.vehicle_id === vehicle.id) || [];
          
          const revenue = vBookings.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
          const expenses = vMaintenance.reduce((sum: number, m: any) => sum + Number(m.estimated_cost || 0), 0);
          const profit = revenue - expenses;
          
          return {
            vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            location: vehicle.location || 'Miami',
            revenue: `$${revenue.toFixed(0)}`,
            expenses: `$${expenses.toFixed(0)}`,
            profit: `$${profit.toFixed(0)}`,
            profitMargin: revenue > 0 ? `${((profit / revenue) * 100).toFixed(1)}%` : '0%',
            utilization: `${vehicle.utilization || 70}%`
          };
        });
        
        profitLoss.sort((a: any, b: any) => parseFloat(b.profit.replace('$', '')) - parseFloat(a.profit.replace('$', '')));
        
        const totalRevenue = profitLoss.reduce((sum: number, v: any) => sum + parseFloat(v.revenue.replace('$', '')), 0);
        const totalExpenses = profitLoss.reduce((sum: number, v: any) => sum + parseFloat(v.expenses.replace('$', '')), 0);
        const totalProfit = totalRevenue - totalExpenses;
        
        return {
          vehicles: profitLoss,
          totalRevenue: `$${totalRevenue.toFixed(0)}`,
          totalExpenses: `$${totalExpenses.toFixed(0)}`,
          totalProfit: `$${totalProfit.toFixed(0)}`,
          overallMargin: totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : '0%',
          timeframe: timeframe || 'all time',
          summary: `Fleet P/L (${timeframe || 'all time'})${location ? ` in ${location}` : ''}: Revenue $${totalRevenue.toFixed(0)}, Expenses $${totalExpenses.toFixed(0)}, Profit $${totalProfit.toFixed(0)} (${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}% margin). Top performer: ${profitLoss[0]?.vehicle || 'N/A'} with ${profitLoss[0]?.profit || '$0'} profit.`
        };
      }

      case "compareLocations": {
        const { locations: requestedLocations, timeframe } = args;
        console.log(`[compareLocations] Team: ${teamId}, Locations: ${requestedLocations || 'all'}, Timeframe: ${timeframe || 'all'}`);
        
        // Get all vehicles grouped by location
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, location, current_rate, utilization, revenue, status');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (!vehicles || vehicles.length === 0) {
          return { summary: "You don't have any vehicles to compare." };
        }
        
        // Group by location
        const locationData: Record<string, any> = {};
        
        for (const vehicle of vehicles) {
          const loc = vehicle.location || 'Miami';
          if (!locationData[loc]) {
            locationData[loc] = {
              location: loc,
              vehicleCount: 0,
              availableCount: 0,
              rentedCount: 0,
              totalRevenue: 0,
              totalUtilization: 0,
              avgRate: 0
            };
          }
          
          locationData[loc].vehicleCount++;
          locationData[loc].totalUtilization += (vehicle.utilization || 70);
          locationData[loc].totalRevenue += Number(vehicle.revenue || 0);
          locationData[loc].avgRate += Number(vehicle.current_rate || 0);
          
          if (vehicle.status === 'available') locationData[loc].availableCount++;
          if (vehicle.status === 'rented') locationData[loc].rentedCount++;
        }
        
        // Calculate averages
        const locations = Object.values(locationData).map((loc: any) => ({
          location: loc.location,
          vehicleCount: loc.vehicleCount,
          availableCount: loc.availableCount,
          rentedCount: loc.rentedCount,
          revenue: `$${loc.totalRevenue.toFixed(0)}`,
          avgUtilization: `${(loc.totalUtilization / loc.vehicleCount).toFixed(0)}%`,
          avgRate: `$${(loc.avgRate / loc.vehicleCount).toFixed(0)}`
        }));
        
        // Sort by revenue
        locations.sort((a, b) => parseFloat(b.revenue.replace('$', '')) - parseFloat(a.revenue.replace('$', '')));
        
        return {
          locations,
          locationCount: locations.length,
          summary: `Location comparison: ${locations.map(l => `${l.location} (${l.vehicleCount} vehicles, ${l.revenue} revenue, ${l.avgUtilization} utilization)`).join('; ')}.`
        };
      }

      case "getOutstandingBalances": {
        const { location, minAmount } = args;
        console.log(`[getOutstandingBalances] Team: ${teamId}, Location: ${location || 'all'}, MinAmount: ${minAmount || 0}`);
        
        // Get bookings with outstanding balances
        let query = supabase
          .from('bookings')
          .select('*, vehicles(make, model, year, location), customers(first_name, last_name, email, phone)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        const { data: bookings } = await query
          .or('payment_status.eq.pending,balance_due.gt.0')
          .order('created_at', { ascending: false });
        
        let filteredBookings = bookings || [];
        
        if (location && location !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        if (minAmount && minAmount > 0) {
          filteredBookings = filteredBookings.filter((b: any) => 
            Number(b.balance_due || b.total_value || 0) >= minAmount
          );
        }
        
        const outstandingList = filteredBookings.map((b: any) => {
          const endDate = new Date(b.end_date);
          const daysOverdue = Math.floor((new Date().getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            customer: b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : b.customer_name || 'Unknown',
            vehicle: b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'Unknown',
            location: b.vehicles?.location || 'Miami',
            balanceDue: `$${Number(b.balance_due || b.total_value || 0).toFixed(0)}`,
            daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
            urgency: daysOverdue > 30 ? 'critical' : daysOverdue > 14 ? 'high' : 'normal'
          };
        });
        
        const totalOutstanding = outstandingList.reduce((sum: number, b: any) => sum + parseFloat(b.balanceDue.replace('$', '')), 0);
        
        return {
          outstandingBookings: outstandingList,
          totalOutstanding: `$${totalOutstanding.toFixed(0)}`,
          count: outstandingList.length,
          summary: outstandingList.length > 0
            ? `You have $${totalOutstanding.toFixed(0)} in outstanding balances across ${outstandingList.length} booking${outstandingList.length > 1 ? 's' : ''}${location ? ` in ${location}` : ''}. Top outstanding: ${outstandingList[0]?.customer} owes ${outstandingList[0]?.balanceDue}.`
            : `No outstanding balances found${location ? ` in ${location}` : ''}. All payments are up to date!`
        };
      }

      case "getIdleVehicles": {
        const { daysIdle = 7, location } = args;
        console.log(`[getIdleVehicles] Team: ${teamId}, DaysIdle: ${daysIdle}, Location: ${location || 'all'}`);
        
        // Get available vehicles
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, year, location, current_rate, utilization')
          .eq('status', 'available');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        if (location && location !== 'all') {
          vehicleQuery = vehicleQuery.ilike('location', `%${location}%`);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (!vehicles || vehicles.length === 0) {
          return { summary: `No available vehicles found${location ? ` in ${location}` : ''}.` };
        }
        
        // Get recent bookings
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysIdle);
        
        const { data: recentBookings } = await supabase
          .from('bookings')
          .select('vehicle_id, end_date')
          .in('vehicle_id', vehicles.map((v: any) => v.id))
          .gte('end_date', cutoffDate.toISOString());
        
        const recentlyBookedIds = new Set(recentBookings?.map((b: any) => b.vehicle_id) || []);
        
        const idleVehicles = vehicles
          .filter((v: any) => !recentlyBookedIds.has(v.id))
          .map((v: any) => ({
            vehicle: `${v.year} ${v.make} ${v.model}`,
            location: v.location || 'Miami',
            currentRate: `$${v.current_rate}`,
            utilization: `${v.utilization || 70}%`,
            recommendation: (v.utilization || 70) < 20 ? 'Consider 10-15% price reduction' : 'Run promotion'
          }));
        
        const potentialLoss = idleVehicles.reduce((sum: number, v: any) => 
          sum + (parseFloat(v.currentRate.replace('$', '')) * daysIdle), 0
        );
        
        return {
          idleVehicles,
          count: idleVehicles.length,
          totalVehicles: vehicles.length,
          potentialRevenueLoss: `$${potentialLoss.toFixed(0)}`,
          daysThreshold: daysIdle,
          summary: idleVehicles.length > 0
            ? `${idleVehicles.length} of ${vehicles.length} vehicles are idle (no bookings in ${daysIdle} days)${location ? ` in ${location}` : ''}. Potential revenue loss: $${potentialLoss.toFixed(0)}. Most idle: ${idleVehicles[0]?.vehicle}. ${idleVehicles[0]?.recommendation}.`
            : `Great news! All ${vehicles.length} vehicles${location ? ` in ${location}` : ''} have been active in the last ${daysIdle} days.`
        };
      }

      case "getMultiLocationAvailability": {
        const { startDate, endDate, vehicleType, make } = args;
        console.log(`[getMultiLocationAvailability] Team: ${teamId}, Dates: ${startDate} to ${endDate}, Type: ${vehicleType || 'all'}, Make: ${make || 'all'}`);
        
        if (!startDate || !endDate) {
          return { error: 'Start and end dates are required', summary: 'Please specify the dates you need a vehicle for.' };
        }
        
        // Get all available vehicles
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, year, location, current_rate')
          .eq('status', 'available');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        if (make) {
          vehicleQuery = vehicleQuery.ilike('make', `%${make}%`);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (!vehicles || vehicles.length === 0) {
          return { summary: `No available vehicles found matching your criteria.` };
        }
        
        // Check for conflicts
        const { data: conflicts } = await supabase
          .from('bookings')
          .select('vehicle_id')
          .in('vehicle_id', vehicles.map((v: any) => v.id))
          .in('status', ['active', 'confirmed', 'pending'])
          .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);
        
        const conflictedIds = new Set(conflicts?.map((c: any) => c.vehicle_id) || []);
        
        // Group by location
        const byLocation: Record<string, any[]> = {};
        
        for (const vehicle of vehicles) {
          if (conflictedIds.has(vehicle.id)) continue;
          
          const loc = vehicle.location || 'Miami';
          if (!byLocation[loc]) byLocation[loc] = [];
          
          byLocation[loc].push({
            vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            rate: `$${vehicle.current_rate}/day`
          });
        }
        
        const locations = Object.entries(byLocation).map(([loc, vehicleList]) => ({
          location: loc,
          availableCount: vehicleList.length,
          vehicles: vehicleList,
          lowestRate: vehicleList.length > 0 ? `$${Math.min(...vehicleList.map((v: any) => parseFloat(v.rate.replace('$', '').replace('/day', ''))))}/day` : 'N/A'
        }));
        
        const totalAvailable = locations.reduce((sum, loc) => sum + loc.availableCount, 0);
        
        return {
          requestedDates: `${startDate} to ${endDate}`,
          locations,
          totalAvailable,
          summary: totalAvailable > 0
            ? `${totalAvailable} vehicle${totalAvailable > 1 ? 's' : ''} available for ${startDate} to ${endDate}. ${locations.map(l => `${l.location}: ${l.availableCount} (from ${l.lowestRate})`).join(', ')}.`
            : `No vehicles available for ${startDate} to ${endDate}. All matching vehicles have booking conflicts.`
        };
      }

      case "getCustomerSegments": {
        const { segment, location, limit = 10 } = args;
        console.log(`[getCustomerSegments] Team: ${teamId}, Segment: ${segment || 'all'}, Location: ${location || 'all'}`);
        
        // Get customers with booking data
        let customerQuery = supabase
          .from('customers')
          .select('id, full_name, email, customer_status, total_bookings, lifetime_value');
        
        if (teamId) {
          customerQuery = customerQuery.eq('team_id', teamId);
        }
        
        const { data: customers } = await customerQuery
          .order('lifetime_value', { ascending: false })
          .limit(50);
        
        if (!customers) {
          return { summary: 'I encountered an error retrieving customer data.' };
        }
        
        // Get recent bookings for recency
        const { data: bookings } = await supabase
          .from('bookings')
          .select('customer_id, created_at')
          .in('customer_id', customers.map((c: any) => c.id))
          .order('created_at', { ascending: false });
        
        // Segment customers
        const segmented = customers.map((c: any) => {
          const lastBooking = bookings?.find((b: any) => b.customer_id === c.id);
          const daysSince = lastBooking 
            ? Math.floor((new Date().getTime() - new Date(lastBooking.created_at).getTime()) / (1000 * 60 * 60 * 24))
            : 999;
          
          const ltv = Number(c.lifetime_value || 0);
          const bookingCount = c.total_bookings || 0;
          
          let seg: string;
          if (ltv >= 50000 || bookingCount >= 10) seg = 'vip';
          else if (ltv >= 20000 || bookingCount >= 5) seg = 'high_value';
          else if (daysSince <= 30) seg = 'active';
          else if (daysSince <= 90) seg = 'warm';
          else if (bookingCount > 0) seg = 'at_risk';
          else seg = 'new';
          
          return {
            name: c.full_name,
            email: c.email,
            segment: seg,
            lifetimeValue: `$${ltv.toFixed(0)}`,
            totalBookings: bookingCount,
            daysSinceLastBooking: daysSince < 999 ? daysSince : 'Never'
          };
        });
        
        // Filter
        let filtered = segmented;
        if (segment && segment !== 'all') {
          filtered = segmented.filter((c: any) => c.segment === segment);
        }
        
        filtered = filtered.slice(0, limit);
        
        // Count segments
        const counts = segmented.reduce((acc: any, c: any) => {
          acc[c.segment] = (acc[c.segment] || 0) + 1;
          return acc;
        }, {});
        
        return {
          customers: filtered,
          count: filtered.length,
          segmentCounts: counts,
          summary: segment 
            ? `Found ${filtered.length} ${segment} customers. ${segment === 'at_risk' ? 'Consider re-engagement campaigns.' : segment === 'vip' ? 'These are your top customers—prioritize their experience.' : ''}`
            : `Customer segments: ${Object.entries(counts).map(([s, c]) => `${s}: ${c}`).join(', ')}. Total: ${customers.length} customers.`
        };
      }

      case "getRariInsights": {
        const { priority, limit = 5 } = args;
        console.log(`[getRariInsights] Team: ${teamId}, Priority: ${priority || 'all'}, Limit: ${limit}`);
        
        // Generate insights on-the-fly based on current data
        const insights: any[] = [];
        
        // Check for idle vehicles
        let vehicleQuery = supabase
          .from('vehicles')
          .select('name, make, model, year, location, utilization, status')
          .eq('status', 'available')
          .lt('utilization', 30);
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (vehicles && vehicles.length > 0) {
          insights.push({
            type: 'utilization',
            priority: 'medium',
            title: `${vehicles.length} vehicles with low utilization`,
            description: `${vehicles.slice(0, 3).map((v: any) => `${v.make} ${v.model}`).join(', ')} have under 30% utilization`,
            action: 'Consider price adjustments or promotions'
          });
        }
        
        // Check for upcoming maintenance
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        let maintenanceQuery = supabase
          .from('maintenance_schedules')
          .select('*, vehicles(name, make, model)')
          .lte('scheduled_date', nextWeek.toISOString())
          .gte('scheduled_date', new Date().toISOString())
          .eq('status', 'scheduled');
        
        if (teamId) {
          maintenanceQuery = maintenanceQuery.eq('team_id', teamId);
        }
        
        const { data: maintenance } = await maintenanceQuery;
        
        if (maintenance && maintenance.length > 0) {
          insights.push({
            type: 'maintenance',
            priority: 'high',
            title: `${maintenance.length} vehicles need service this week`,
            description: `Schedule maintenance for ${maintenance.slice(0, 3).map((m: any) => m.vehicles?.name || 'vehicle').join(', ')}`,
            action: 'Review and confirm maintenance appointments'
          });
        }
        
        // Check peak season
        const peakSeason = getCurrentPeakSeason();
        if (peakSeason) {
          insights.push({
            type: 'pricing',
            priority: 'high',
            title: `${peakSeason.name} peak season active`,
            description: `Demand is elevated. Recommended ${((peakSeason.surge - 1) * 100).toFixed(0)}% surge pricing.`,
            action: 'Review and adjust vehicle rates'
          });
        }
        
        // Filter by priority if specified
        let filtered = insights;
        if (priority && priority !== 'all') {
          filtered = insights.filter(i => i.priority === priority);
        }
        
        return {
          insights: filtered.slice(0, limit),
          count: filtered.length,
          summary: filtered.length > 0
            ? `I have ${filtered.length} insight${filtered.length > 1 ? 's' : ''} for you: ${filtered.slice(0, 2).map(i => i.title).join('. ')}.`
            : 'No new insights at this time. Your fleet is running smoothly!'
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
