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
  revenue: ['revenue', 'income', 'earnings', 'sales', 'profit', 'money made', 'p&l', 'profit loss'],
  vehicles: ['vehicle', 'car', 'fleet', 'available', 'rented', 'maintenance'],
  bookings: ['booking', 'reservation', 'rental', 'active', 'confirmed', 'pending'],
  metrics: ['metric', 'performance', 'utilization', 'occupancy', 'dashboard', 'overview'],
  analytics: ['analyze', 'analysis', 'compare', 'breakdown', 'vs', 'versus', 'comparison'],
  location: ['miami', 'scottsdale', 'location', 'where', 'city', 'market'],
  forecast: ['forecast', 'predict', 'upcoming', 'future', 'demand', 'event', 'projection'],
  pricing: ['price', 'rate', 'pricing', 'cost', 'surge', 'recommend', 'optimize'],
  customer: ['customer', 'client', 'guest', 'user', 'booking history', 'segment', 'vip', 'retention'],
  maintenance: ['maintenance', 'service', 'repair', 'due', 'schedule', 'overdue'],
  team: ['team', 'staff', 'operator', 'manager', 'admin'],
  idle: ['idle', 'unused', 'sitting', 'not rented', 'empty', 'underperforming'],
  payments: ['payment', 'balance', 'outstanding', 'paid', 'unpaid', 'owe', 'overdue'],
  profitloss: ['profit', 'loss', 'margin', 'expense', 'cost', 'roi', 'profitable'],
  insights: ['insight', 'recommendation', 'suggest', 'alert', 'opportunity', 'action'],
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

// Query handler: Profit/Loss Analysis
async function handleProfitLossQuery(supabase: any, userId: string, query: string, context?: any) {
  const timeframe = extractTimeframe(query, context);
  const locations = extractLocations(query, context);
  
  // Get vehicles
  let vehiclesQuery = supabase
    .from('vehicles')
    .select('id, name, make, model, year, location, current_rate, utilization, revenue')
    .eq('user_id', userId);
  
  if (locations.length > 0) {
    vehiclesQuery = vehiclesQuery.in('location', locations);
  }
  
  const { data: vehicles } = await vehiclesQuery;
  
  if (!vehicles || vehicles.length === 0) {
    return { summary: 'No vehicles found to analyze.' };
  }
  
  // Get bookings for revenue
  const vehicleIds = vehicles.map((v: any) => v.id);
  const { data: bookings } = await supabase
    .from('bookings')
    .select('vehicle_id, total_value')
    .in('vehicle_id', vehicleIds)
    .in('status', ['completed', 'active'])
    .gte('created_at', timeframe.start.toISOString());
  
  // Get maintenance costs
  const { data: maintenance } = await supabase
    .from('maintenance_schedules')
    .select('vehicle_id, estimated_cost')
    .in('vehicle_id', vehicleIds)
    .eq('status', 'completed')
    .gte('created_at', timeframe.start.toISOString());
  
  // Calculate P/L per vehicle
  const profitLoss = vehicles.map((v: any) => {
    const vBookings = bookings?.filter((b: any) => b.vehicle_id === v.id) || [];
    const vMaint = maintenance?.filter((m: any) => m.vehicle_id === v.id) || [];
    
    const revenue = vBookings.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
    const expenses = vMaint.reduce((sum: number, m: any) => sum + Number(m.estimated_cost || 0), 0);
    
    return {
      name: `${v.year} ${v.make} ${v.model}`,
      location: v.location,
      revenue,
      expenses,
      profit: revenue - expenses,
      margin: revenue > 0 ? ((revenue - expenses) / revenue * 100) : 0
    };
  });
  
  profitLoss.sort((a, b) => b.profit - a.profit);
  
  const totals = profitLoss.reduce((acc, v) => ({
    revenue: acc.revenue + v.revenue,
    expenses: acc.expenses + v.expenses,
    profit: acc.profit + v.profit
  }), { revenue: 0, expenses: 0, profit: 0 });
  
  const profitable = profitLoss.filter(v => v.profit > 0).length;
  
  return {
    summary: `Fleet P/L ${timeframe.label}: $${totals.revenue.toFixed(0)} revenue, $${totals.expenses.toFixed(0)} expenses, $${totals.profit.toFixed(0)} profit (${totals.revenue > 0 ? (totals.profit / totals.revenue * 100).toFixed(1) : 0}% margin). ${profitable}/${vehicles.length} vehicles profitable. Top: ${profitLoss[0]?.name} ($${profitLoss[0]?.profit.toFixed(0)} profit).`,
    totalRevenue: `$${totals.revenue.toFixed(0)}`,
    totalExpenses: `$${totals.expenses.toFixed(0)}`,
    totalProfit: `$${totals.profit.toFixed(0)}`,
    profitMargin: `${totals.revenue > 0 ? (totals.profit / totals.revenue * 100).toFixed(1) : 0}%`,
    profitableVehicles: profitable,
    topPerformers: profitLoss.slice(0, 5).map(v => ({
      name: v.name,
      profit: `$${v.profit.toFixed(0)}`,
      margin: `${v.margin.toFixed(1)}%`
    })),
    timeframe: timeframe.label
  };
}

// Query handler: Location Comparison
async function handleLocationComparisonQuery(supabase: any, userId: string, query: string, context?: any) {
  const timeframe = extractTimeframe(query, context);
  
  // Get all vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, location, current_rate, utilization, revenue, status')
    .eq('user_id', userId);
  
  if (!vehicles || vehicles.length === 0) {
    return { summary: 'No vehicles found to compare.' };
  }
  
  // Group by location
  const byLocation: Record<string, any> = {};
  
  for (const v of vehicles) {
    const loc = v.location || 'Miami';
    if (!byLocation[loc]) {
      byLocation[loc] = { count: 0, revenue: 0, utilization: 0, available: 0, rented: 0 };
    }
    byLocation[loc].count++;
    byLocation[loc].revenue += Number(v.revenue || 0);
    byLocation[loc].utilization += (v.utilization || 0);
    if (v.status === 'available') byLocation[loc].available++;
    if (v.status === 'rented') byLocation[loc].rented++;
  }
  
  const locations = Object.entries(byLocation).map(([loc, data]: [string, any]) => ({
    location: loc,
    vehicleCount: data.count,
    totalRevenue: `$${data.revenue.toFixed(0)}`,
    avgUtilization: `${(data.utilization / data.count).toFixed(0)}%`,
    available: data.available,
    rented: data.rented,
    revenuePerVehicle: `$${(data.revenue / data.count).toFixed(0)}`
  }));
  
  locations.sort((a, b) => parseFloat(b.totalRevenue.replace('$', '')) - parseFloat(a.totalRevenue.replace('$', '')));
  
  const winner = locations[0];
  
  return {
    summary: `Location Comparison: ${locations.map(l => `${l.location}: ${l.vehicleCount} vehicles, ${l.totalRevenue} revenue, ${l.avgUtilization} utilization`).join(' | ')}. ${winner?.location} is leading.`,
    locations,
    leader: winner?.location,
    timeframe: timeframe.label
  };
}

// Query handler: Idle Vehicles
async function handleIdleVehiclesQuery(supabase: any, userId: string, query: string, context?: any) {
  const locations = extractLocations(query, context);
  
  // Get available vehicles with low utilization
  let vehiclesQuery = supabase
    .from('vehicles')
    .select('id, name, make, model, year, location, current_rate, utilization')
    .eq('user_id', userId)
    .eq('status', 'available');
  
  if (locations.length > 0) {
    vehiclesQuery = vehiclesQuery.in('location', locations);
  }
  
  const { data: vehicles } = await vehiclesQuery;
  
  if (!vehicles || vehicles.length === 0) {
    return { summary: 'No available vehicles found.' };
  }
  
  // Check recent bookings
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  
  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('vehicle_id')
    .in('vehicle_id', vehicles.map((v: any) => v.id))
    .gte('end_date', cutoff.toISOString());
  
  const recentIds = new Set(recentBookings?.map((b: any) => b.vehicle_id) || []);
  
  const idle = vehicles.filter((v: any) => !recentIds.has(v.id) || (v.utilization || 0) < 20);
  
  const idleList = idle.map((v: any) => ({
    name: `${v.year} ${v.make} ${v.model}`,
    location: v.location,
    rate: `$${v.current_rate}`,
    utilization: `${v.utilization || 0}%`
  }));
  
  const potentialLoss = idle.reduce((sum: number, v: any) => sum + (Number(v.current_rate) * 7), 0);
  
  return {
    summary: idle.length > 0 
      ? `${idle.length} idle vehicles (no bookings in 7 days or <20% utilization)${locations.length > 0 ? ` in ${locations.join(', ')}` : ''}. Potential weekly loss: $${potentialLoss.toFixed(0)}. Consider price reductions.`
      : `All vehicles are active! No idle vehicles found.`,
    idleCount: idle.length,
    totalVehicles: vehicles.length,
    potentialLoss: `$${potentialLoss.toFixed(0)}`,
    idleVehicles: idleList.slice(0, 10)
  };
}

// Query handler: Payments/Outstanding
async function handlePaymentsQuery(supabase: any, userId: string, query: string, context?: any) {
  const locations = extractLocations(query, context);
  
  // Get bookings with outstanding balances
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, vehicles(location, make, model), customers(full_name)')
    .eq('user_id', userId)
    .or('payment_status.eq.pending,balance_due.gt.0');
  
  let filtered = bookings || [];
  
  if (locations.length > 0) {
    filtered = filtered.filter((b: any) => 
      locations.some(loc => b.vehicles?.location?.toLowerCase().includes(loc.toLowerCase()))
    );
  }
  
  const outstanding = filtered.map((b: any) => {
    const endDate = new Date(b.end_date);
    const daysOverdue = Math.floor((Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      customer: b.customers?.full_name || b.customer_name,
      vehicle: b.vehicles ? `${b.vehicles.make} ${b.vehicles.model}` : 'Unknown',
      amount: Number(b.balance_due || b.total_value || 0),
      daysOverdue: Math.max(0, daysOverdue)
    };
  });
  
  outstanding.sort((a, b) => b.amount - a.amount);
  
  const total = outstanding.reduce((sum, b) => sum + b.amount, 0);
  const critical = outstanding.filter(b => b.daysOverdue > 30).length;
  
  return {
    summary: outstanding.length > 0
      ? `$${total.toFixed(0)} outstanding across ${outstanding.length} booking${outstanding.length > 1 ? 's' : ''}. ${critical > 0 ? `${critical} critical (30+ days overdue). ` : ''}Top: ${outstanding[0]?.customer} owes $${outstanding[0]?.amount.toFixed(0)}.`
      : 'No outstanding balances. All payments are current!',
    totalOutstanding: `$${total.toFixed(0)}`,
    count: outstanding.length,
    criticalCount: critical,
    outstandingBookings: outstanding.slice(0, 10).map(b => ({
      customer: b.customer,
      vehicle: b.vehicle,
      amount: `$${b.amount.toFixed(0)}`,
      daysOverdue: b.daysOverdue
    }))
  };
}

// Query handler: Customer Segmentation
async function handleCustomerQuery(supabase: any, userId: string, query: string, context?: any) {
  const lowerQuery = query.toLowerCase();
  
  // Check for segment keywords
  let targetSegment = '';
  if (lowerQuery.includes('vip')) targetSegment = 'vip';
  else if (lowerQuery.includes('at risk') || lowerQuery.includes('at-risk')) targetSegment = 'at_risk';
  else if (lowerQuery.includes('high value')) targetSegment = 'high_value';
  else if (lowerQuery.includes('new')) targetSegment = 'new';
  
  // Get customers
  const { data: customers } = await supabase
    .from('customers')
    .select('id, full_name, email, total_bookings, lifetime_value, customer_status')
    .eq('user_id', userId)
    .order('lifetime_value', { ascending: false })
    .limit(50);
  
  if (!customers) {
    return { summary: 'Unable to retrieve customer data.' };
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
      ? Math.floor((Date.now() - new Date(lastBooking.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    const ltv = Number(c.lifetime_value || 0);
    const count = c.total_bookings || 0;
    
    let segment: string;
    if (ltv >= 50000 || count >= 10) segment = 'vip';
    else if (ltv >= 20000 || count >= 5) segment = 'high_value';
    else if (daysSince <= 30) segment = 'active';
    else if (daysSince <= 90) segment = 'warm';
    else if (count > 0) segment = 'at_risk';
    else segment = 'new';
    
    return { ...c, segment, daysSince, ltv };
  });
  
  // Filter if segment specified
  let filtered = segmented;
  if (targetSegment) {
    filtered = segmented.filter(c => c.segment === targetSegment);
  }
  
  // Count segments
  const counts = segmented.reduce((acc: any, c) => {
    acc[c.segment] = (acc[c.segment] || 0) + 1;
    return acc;
  }, {});
  
  return {
    summary: targetSegment 
      ? `${filtered.length} ${targetSegment.replace('_', ' ')} customers. ${targetSegment === 'at_risk' ? 'Consider re-engagement campaigns.' : targetSegment === 'vip' ? 'Prioritize their experience.' : ''}`
      : `Customer segments: ${Object.entries(counts).map(([s, c]) => `${s.replace('_', ' ')}: ${c}`).join(', ')}. Total: ${customers.length}.`,
    customers: filtered.slice(0, 10).map(c => ({
      name: c.full_name,
      segment: c.segment,
      lifetimeValue: `$${c.ltv.toFixed(0)}`,
      bookings: c.total_bookings || 0
    })),
    segmentCounts: counts,
    requestedSegment: targetSegment || 'all'
  };
}

// Query handler: Insights
async function handleInsightsQuery(supabase: any, userId: string, query: string, context?: any) {
  const insights: any[] = [];
  
  // Check idle vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('name, make, model, utilization, status')
    .eq('user_id', userId)
    .eq('status', 'available')
    .lt('utilization', 30);
  
  if (vehicles && vehicles.length > 0) {
    insights.push({
      type: 'utilization',
      priority: 'medium',
      title: `${vehicles.length} vehicles with low utilization`,
      action: 'Consider price adjustments'
    });
  }
  
  // Check upcoming maintenance
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const { data: maintenance } = await supabase
    .from('maintenance_schedules')
    .select('id')
    .eq('user_id', userId)
    .lte('scheduled_date', nextWeek.toISOString())
    .gte('scheduled_date', new Date().toISOString())
    .eq('status', 'scheduled');
  
  if (maintenance && maintenance.length > 0) {
    insights.push({
      type: 'maintenance',
      priority: 'high',
      title: `${maintenance.length} vehicles need service this week`,
      action: 'Review maintenance schedule'
    });
  }
  
  // Check outstanding payments
  const { data: outstanding } = await supabase
    .from('bookings')
    .select('id')
    .eq('user_id', userId)
    .eq('payment_status', 'pending');
  
  if (outstanding && outstanding.length > 0) {
    insights.push({
      type: 'payments',
      priority: 'high',
      title: `${outstanding.length} bookings with outstanding payments`,
      action: 'Follow up on payments'
    });
  }
  
  return {
    summary: insights.length > 0 
      ? `${insights.length} insight${insights.length > 1 ? 's' : ''}: ${insights.map(i => i.title).join('. ')}.`
      : 'No urgent insights. Your fleet is running smoothly!',
    insights,
    count: insights.length
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
        result = await handleRevenueQuery(supabase, userId, query, context);
        break;
      
      case 'profitloss':
        result = await handleProfitLossQuery(supabase, userId, query, context);
        break;
      
      case 'analytics':
        // Check if it's a location comparison
        if (query.toLowerCase().includes('compare') || query.toLowerCase().includes('vs')) {
          result = await handleLocationComparisonQuery(supabase, userId, query, context);
        } else {
          result = await handleRevenueQuery(supabase, userId, query, context);
        }
        break;
      
      case 'vehicles':
        result = await handleVehicleQuery(supabase, userId, query, context);
        break;
      
      case 'idle':
        result = await handleIdleVehiclesQuery(supabase, userId, query, context);
        break;
      
      case 'bookings':
        result = await handleBookingsQuery(supabase, userId, query, context);
        break;
      
      case 'payments':
        result = await handlePaymentsQuery(supabase, userId, query, context);
        break;
      
      case 'customer':
        result = await handleCustomerQuery(supabase, userId, query, context);
        break;
      
      case 'insights':
        result = await handleInsightsQuery(supabase, userId, query, context);
        break;
      
      case 'metrics':
      case 'location':
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
