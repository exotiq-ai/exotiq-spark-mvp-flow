import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================
// RARI UNIVERSAL QUERY - Natural Language Fleet Intelligence
// Handles ANY query about fleet operations, analytics, forecasting
// ============================================================

interface QueryRequest {
  query: string;
  context?: {
    timeframe?: string;
    locations?: string[];
    vehicleName?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    [key: string]: any;
  };
}

// Query categories and their keywords
const QUERY_PATTERNS = {
  revenue: ['revenue', 'income', 'earnings', 'sales', 'profit', 'money made'],
  vehicles: ['vehicle', 'car', 'fleet', 'available', 'rented', 'maintenance'],
  bookings: ['booking', 'reservation', 'rental', 'active', 'confirmed', 'pending'],
  metrics: ['metric', 'performance', 'utilization', 'occupancy', 'dashboard'],
  analytics: ['analyze', 'analysis', 'compare', 'breakdown', 'vs', 'versus'],
  location: ['miami', 'scottsdale', 'location', 'where', 'city'],
  forecast: ['forecast', 'predict', 'upcoming', 'future', 'demand', 'event'],
  pricing: ['price', 'rate', 'pricing', 'cost', 'surge', 'recommend'],
  customer: ['customer', 'client', 'guest', 'user', 'booking history'],
  maintenance: ['maintenance', 'service', 'repair', 'due', 'schedule'],
  team: ['team', 'staff', 'operator', 'manager', 'admin'],
  idle: ['idle', 'unused', 'sitting', 'not rented', 'empty'],
  payments: ['payment', 'balance', 'outstanding', 'paid', 'unpaid'],
};

// Helper: Detect query intent
function detectQueryIntent(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const intents: string[] = [];
  
  for (const [category, keywords] of Object.entries(QUERY_PATTERNS)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      intents.push(category);
    }
  }
  
  return intents.length > 0 ? intents : ['general'];
}

// Helper: Extract timeframe
function extractTimeframe(query: string, context?: any): { start: Date; end: Date; label: string } {
  const now = new Date();
  const lowerQuery = query.toLowerCase();
  
  // Check context first
  if (context?.startDate && context?.endDate) {
    return {
      start: new Date(context.startDate),
      end: new Date(context.endDate),
      label: 'custom range'
    };
  }
  
  // Parse natural language
  if (lowerQuery.includes('today')) {
    const start = new Date(now.setHours(0, 0, 0, 0));
    const end = new Date(now.setHours(23, 59, 59, 999));
    return { start, end, label: 'today' };
  }
  
  if (lowerQuery.includes('this week')) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: 'this week' };
  }
  
  if (lowerQuery.includes('this month') || lowerQuery.includes('current month')) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, label: 'this month' };
  }
  
  if (lowerQuery.includes('last month')) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end, label: 'last month' };
  }
  
  if (lowerQuery.includes('this year')) {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end, label: 'this year' };
  }
  
  // Default: last 30 days
  const start = new Date(now);
  start.setDate(now.getDate() - 30);
  const end = new Date(now);
  return { start, end, label: 'last 30 days' };
}

// Helper: Extract locations
function extractLocations(query: string, context?: any): string[] {
  const locations: string[] = context?.locations || [];
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('miami')) locations.push('Miami');
  if (lowerQuery.includes('scottsdale')) locations.push('Scottsdale');
  if (lowerQuery.includes('los angeles') || lowerQuery.includes('la')) locations.push('Los Angeles');
  if (lowerQuery.includes('new york') || lowerQuery.includes('ny')) locations.push('New York');
  
  return [...new Set(locations)]; // Remove duplicates
}

// Query handler: Revenue analysis
async function handleRevenueQuery(supabase: any, userId: string, query: string, context?: any) {
  const timeframe = extractTimeframe(query, context);
  const locations = extractLocations(query, context);
  
  let bookingsQuery = supabase
    .from('bookings')
    .select('total_value, start_date, end_date, status, vehicles(name, location)')
    .eq('user_id', userId)
    .gte('start_date', timeframe.start.toISOString())
    .lte('start_date', timeframe.end.toISOString())
    .in('status', ['confirmed', 'completed', 'active']);
  
  const { data: bookings } = await bookingsQuery;
  
  let filtered = bookings || [];
  if (locations.length > 0) {
    filtered = filtered.filter((b: any) => 
      b.vehicles && locations.some(loc => b.vehicles.location?.includes(loc))
    );
  }
  
  const totalRevenue = filtered.reduce((sum, b) => sum + (Number(b.total_value) || 0), 0);
  const bookingCount = filtered.length;
  
  // Location breakdown if multiple locations or "compare" in query
  if (locations.length > 1 || query.toLowerCase().includes('compare') || query.toLowerCase().includes('vs')) {
    const byLocation: Record<string, number> = {};
    filtered.forEach((b: any) => {
      const loc = b.vehicles?.location || 'Unknown';
      byLocation[loc] = (byLocation[loc] || 0) + (Number(b.total_value) || 0);
    });
    
    return {
      summary: `Revenue ${timeframe.label}: $${totalRevenue.toFixed(0)} from ${bookingCount} bookings`,
      totalRevenue: `$${totalRevenue.toFixed(0)}`,
      bookingCount,
      timeframe: timeframe.label,
      byLocation,
      breakdown: Object.entries(byLocation).map(([loc, rev]) => 
        `${loc}: $${rev.toFixed(0)}`
      ).join(', ')
    };
  }
  
  return {
    summary: `Revenue ${timeframe.label}: $${totalRevenue.toFixed(0)} from ${bookingCount} bookings`,
    totalRevenue: `$${totalRevenue.toFixed(0)}`,
    bookingCount,
    timeframe: timeframe.label
  };
}

// Query handler: Vehicle availability and status
async function handleVehicleQuery(supabase: any, userId: string, query: string, context?: any) {
  const locations = extractLocations(query, context);
  
  let vehiclesQuery = supabase
    .from('vehicles')
    .select('name, make, model, year, status, location, current_rate, utilization')
    .eq('user_id', userId);
  
  if (locations.length > 0) {
    vehiclesQuery = vehiclesQuery.in('location', locations);
  }
  
  const { data: vehicles } = await vehiclesQuery;
  
  if (!vehicles || vehicles.length === 0) {
    return {
      summary: 'No vehicles found matching your query',
      count: 0
    };
  }
  
  // Check for status filters in query
  const lowerQuery = query.toLowerCase();
  let filtered = vehicles;
  
  if (lowerQuery.includes('available')) {
    filtered = vehicles.filter((v: any) => v.status === 'available');
  } else if (lowerQuery.includes('rented') || lowerQuery.includes('active')) {
    filtered = vehicles.filter((v: any) => v.status === 'rented');
  } else if (lowerQuery.includes('maintenance')) {
    filtered = vehicles.filter((v: any) => v.status === 'maintenance');
  } else if (lowerQuery.includes('idle') || lowerQuery.includes('unused')) {
    // Idle = available with low utilization
    filtered = vehicles.filter((v: any) => 
      v.status === 'available' && (v.utilization || 0) < 20
    );
  }
  
  const summary = `Found ${filtered.length} vehicle${filtered.length !== 1 ? 's' : ''}${
    locations.length > 0 ? ` in ${locations.join(', ')}` : ''
  }`;
  
  return {
    summary,
    count: filtered.length,
    vehicles: filtered.slice(0, 20).map((v: any) => ({
      name: `${v.year} ${v.make} ${v.model}`,
      status: v.status,
      location: v.location,
      rate: `$${v.current_rate}/day`,
      utilization: `${v.utilization || 0}%`
    }))
  };
}

// Query handler: Fleet metrics and analytics
async function handleMetricsQuery(supabase: any, userId: string, query: string, context?: any) {
  const timeframe = extractTimeframe(query, context);
  const locations = extractLocations(query, context);
  
  // Get vehicles
  let vehiclesQuery = supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId);
  
  if (locations.length > 0) {
    vehiclesQuery = vehiclesQuery.in('location', locations);
  }
  
  const { data: vehicles } = await vehiclesQuery;
  
  // Get bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .gte('start_date', timeframe.start.toISOString())
    .lte('start_date', timeframe.end.toISOString());
  
  const totalVehicles = vehicles?.length || 0;
  const activeBookings = bookings?.filter((b: any) => 
    ['confirmed', 'active'].includes(b.status)
  ).length || 0;
  
  const totalRevenue = bookings?.reduce((sum, b) => 
    sum + (Number(b.total_value) || 0), 0
  ) || 0;
  
  const avgUtilization = vehicles?.reduce((sum, v) => 
    sum + (v.utilization || 0), 0
  ) / totalVehicles || 0;
  
  return {
    summary: `Fleet Metrics ${timeframe.label}: ${totalVehicles} vehicles, ${activeBookings} active bookings, $${totalRevenue.toFixed(0)} revenue, ${avgUtilization.toFixed(0)}% avg utilization`,
    totalVehicles,
    activeBookings,
    totalRevenue: `$${totalRevenue.toFixed(0)}`,
    averageUtilization: `${avgUtilization.toFixed(0)}%`,
    timeframe: timeframe.label,
    locations: locations.length > 0 ? locations : 'all'
  };
}

// Query handler: Bookings
async function handleBookingsQuery(supabase: any, userId: string, query: string, context?: any) {
  const timeframe = extractTimeframe(query, context);
  const lowerQuery = query.toLowerCase();
  
  let bookingsQuery = supabase
    .from('bookings')
    .select('*, vehicles(name, make, model, location), customers(name, email)')
    .eq('user_id', userId)
    .gte('start_date', timeframe.start.toISOString())
    .lte('start_date', timeframe.end.toISOString());
  
  const { data: bookings } = await bookingsQuery;
  let filtered = bookings || [];
  
  // Status filters
  if (lowerQuery.includes('pending')) {
    filtered = filtered.filter((b: any) => b.status === 'pending');
  } else if (lowerQuery.includes('confirmed')) {
    filtered = filtered.filter((b: any) => b.status === 'confirmed');
  } else if (lowerQuery.includes('active')) {
    filtered = filtered.filter((b: any) => b.status === 'active');
  } else if (lowerQuery.includes('completed')) {
    filtered = filtered.filter((b: any) => b.status === 'completed');
  }
  
  return {
    summary: `Found ${filtered.length} booking${filtered.length !== 1 ? 's' : ''} ${timeframe.label}`,
    count: filtered.length,
    bookings: filtered.slice(0, 10).map((b: any) => ({
      vehicle: b.vehicles ? `${b.vehicles.make} ${b.vehicles.model}` : 'Unknown',
      customer: b.customers?.name || 'Unknown',
      status: b.status,
      dates: `${new Date(b.start_date).toLocaleDateString()} - ${new Date(b.end_date).toLocaleDateString()}`,
      value: `$${Number(b.total_value || 0).toFixed(0)}`
    }))
  };
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, context }: QueryRequest = await req.json();
    
    if (!query) {
      return new Response(JSON.stringify({
        error: 'Query is required',
        example: { query: "What's my revenue in Miami this month?" }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('[Universal Query] Received:', query);
    console.log('[Universal Query] Context:', context);
    
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user ID (demo user for now)
    const demoUserId = Deno.env.get('DEMO_USER_ID');
    const { data: firstUser } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .single();
    
    const userId = demoUserId || firstUser?.id;
    
    if (!userId) {
      return new Response(JSON.stringify({
        error: 'No user found',
        summary: 'Unable to identify user account'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Detect query intent
    const intents = detectQueryIntent(query);
    console.log('[Universal Query] Detected intents:', intents);
    
    let result: any;
    
    // Route to appropriate handler based on primary intent
    const primaryIntent = intents[0];
    
    switch (primaryIntent) {
      case 'revenue':
      case 'analytics':
        result = await handleRevenueQuery(supabase, userId, query, context);
        break;
      
      case 'vehicles':
      case 'idle':
        result = await handleVehicleQuery(supabase, userId, query, context);
        break;
      
      case 'bookings':
        result = await handleBookingsQuery(supabase, userId, query, context);
        break;
      
      case 'metrics':
        result = await handleMetricsQuery(supabase, userId, query, context);
        break;
      
      default:
        // Fallback: try metrics as general overview
        result = await handleMetricsQuery(supabase, userId, query, context);
        result.note = "I interpreted this as a general metrics query. Try being more specific for better results!";
    }
    
    console.log('[Universal Query] Result:', result);
    
    return new Response(JSON.stringify({
      ...result,
      query: query,
      intents: intents
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Universal Query] Error:', error);
    
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      summary: 'Sorry, I had trouble processing that query. Can you rephrase it?'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
