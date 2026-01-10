import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

/**
 * RARI ENTERPRISE HANDLERS
 * Advanced business intelligence handlers for enterprise-grade fleet analytics
 * 
 * These handlers extend Rari's capabilities with:
 * - Vehicle Profit/Loss Analysis
 * - Multi-Location Comparisons
 * - Outstanding Balance Tracking
 * - Idle Vehicle Detection
 * - Customer Segmentation
 * - Proactive Insights
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Helper: Get user's team ID
async function getUserTeamId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();
  return data?.team_id || null;
}

// ============================================================
// HANDLER: Vehicle Profit/Loss Analysis
// ============================================================
export async function getVehicleProfitLoss(
  supabase: any,
  teamId: string,
  args: { vehicleName?: string; timeframe?: string; location?: string }
) {
  const { vehicleName, timeframe, location } = args;
  
  // Get date filter
  let dateFilter = new Date();
  if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
  else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
  else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
  else if (timeframe === 'quarter') dateFilter.setMonth(dateFilter.getMonth() - 3);
  else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);
  else dateFilter = new Date(0); // All time
  
  // Get vehicles
  let vehicleQuery = supabase
    .from('vehicles')
    .select('id, name, make, model, year, location, current_rate, utilization, revenue')
    .eq('team_id', teamId);
  
  if (vehicleName) {
    vehicleQuery = vehicleQuery.or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`);
  }
  if (location && location !== 'all') {
    vehicleQuery = vehicleQuery.eq('location', location);
  }
  
  const { data: vehicles, error: vehicleError } = await vehicleQuery;
  
  if (vehicleError || !vehicles || vehicles.length === 0) {
    return {
      error: 'No vehicles found',
      summary: `I couldn't find any vehicles matching your criteria.`
    };
  }
  
  // Get bookings (revenue) for each vehicle
  const vehicleIds = vehicles.map((v: any) => v.id);
  const { data: bookings } = await supabase
    .from('bookings')
    .select('vehicle_id, total_value, status')
    .in('vehicle_id', vehicleIds)
    .in('status', ['completed', 'active'])
    .gte('created_at', dateFilter.toISOString());
  
  // Get maintenance costs (expenses) for each vehicle
  const { data: maintenance } = await supabase
    .from('maintenance_schedules')
    .select('vehicle_id, estimated_cost, status')
    .in('vehicle_id', vehicleIds)
    .eq('status', 'completed')
    .gte('created_at', dateFilter.toISOString());
  
  // Get damage claim costs
  const { data: damages } = await supabase
    .from('damage_claims')
    .select('vehicle_id, actual_cost, estimated_cost')
    .in('vehicle_id', vehicleIds)
    .gte('created_at', dateFilter.toISOString());
  
  // Calculate P/L for each vehicle
  const profitLoss = vehicles.map((vehicle: any) => {
    const vehicleBookings = bookings?.filter((b: any) => b.vehicle_id === vehicle.id) || [];
    const vehicleMaintenance = maintenance?.filter((m: any) => m.vehicle_id === vehicle.id) || [];
    const vehicleDamages = damages?.filter((d: any) => d.vehicle_id === vehicle.id) || [];
    
    const revenue = vehicleBookings.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
    const maintenanceCost = vehicleMaintenance.reduce((sum: number, m: any) => sum + Number(m.estimated_cost || 0), 0);
    const damageCost = vehicleDamages.reduce((sum: number, d: any) => sum + Number(d.actual_cost || d.estimated_cost || 0), 0);
    
    const totalExpenses = maintenanceCost + damageCost;
    const profit = revenue - totalExpenses;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    
    return {
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      location: vehicle.location || 'Miami',
      revenue: `$${revenue.toFixed(0)}`,
      expenses: `$${totalExpenses.toFixed(0)}`,
      profit: `$${profit.toFixed(0)}`,
      profitMargin: `${profitMargin.toFixed(1)}%`,
      utilization: `${vehicle.utilization || 0}%`,
      bookingCount: vehicleBookings.length,
      maintenanceCost: `$${maintenanceCost.toFixed(0)}`,
      damageCost: `$${damageCost.toFixed(0)}`,
      isProfitable: profit > 0
    };
  });
  
  // Sort by profit
  profitLoss.sort((a: any, b: any) => 
    parseFloat(b.profit.replace('$', '')) - parseFloat(a.profit.replace('$', ''))
  );
  
  const totalRevenue = profitLoss.reduce((sum: number, v: any) => sum + parseFloat(v.revenue.replace('$', '')), 0);
  const totalExpenses = profitLoss.reduce((sum: number, v: any) => sum + parseFloat(v.expenses.replace('$', '')), 0);
  const totalProfit = totalRevenue - totalExpenses;
  const profitableCount = profitLoss.filter((v: any) => v.isProfitable).length;
  
  return {
    vehicles: profitLoss,
    summary: {
      totalVehicles: profitLoss.length,
      totalRevenue: `$${totalRevenue.toFixed(0)}`,
      totalExpenses: `$${totalExpenses.toFixed(0)}`,
      totalProfit: `$${totalProfit.toFixed(0)}`,
      overallMargin: `${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%`,
      profitableVehicles: profitableCount,
      unprofitableVehicles: profitLoss.length - profitableCount
    },
    timeframe: timeframe || 'all time',
    location: location || 'all',
    topPerformer: profitLoss[0],
    summaryText: `Fleet P/L Analysis (${timeframe || 'all time'})${location ? ` in ${location}` : ''}: Total revenue $${totalRevenue.toFixed(0)}, expenses $${totalExpenses.toFixed(0)}, profit $${totalProfit.toFixed(0)} (${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}% margin). ${profitableCount} of ${profitLoss.length} vehicles are profitable. Top performer: ${profitLoss[0]?.vehicle || 'N/A'}.`
  };
}

// ============================================================
// HANDLER: Compare Locations
// ============================================================
export async function compareLocations(
  supabase: any,
  teamId: string,
  args: { locations?: string[]; timeframe?: string }
) {
  const { locations, timeframe } = args;
  
  // Get date filter
  let dateFilter = new Date();
  if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
  else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
  else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
  else if (timeframe === 'quarter') dateFilter.setMonth(dateFilter.getMonth() - 3);
  else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);
  else dateFilter = new Date(0);
  
  // Get all vehicles grouped by location
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, name, make, model, location, current_rate, utilization, revenue, status')
    .eq('team_id', teamId);
  
  if (!vehicles || vehicles.length === 0) {
    return {
      error: 'No vehicles found',
      summary: "You don't have any vehicles to compare."
    };
  }
  
  // Get bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, vehicle_id, total_value, status, vehicles(location)')
    .eq('team_id', teamId)
    .gte('created_at', dateFilter.toISOString());
  
  // Group data by location
  const locationData: Record<string, any> = {};
  
  for (const vehicle of vehicles) {
    const loc = vehicle.location || 'Miami';
    
    // Filter by requested locations if specified
    if (locations && locations.length > 0 && !locations.some(l => l.toLowerCase() === loc.toLowerCase())) {
      continue;
    }
    
    if (!locationData[loc]) {
      locationData[loc] = {
        location: loc,
        vehicleCount: 0,
        availableCount: 0,
        rentedCount: 0,
        maintenanceCount: 0,
        totalRevenue: 0,
        totalUtilization: 0,
        avgRate: 0,
        bookingCount: 0,
        vehicles: []
      };
    }
    
    locationData[loc].vehicleCount++;
    locationData[loc].totalUtilization += (vehicle.utilization || 0);
    locationData[loc].avgRate += Number(vehicle.current_rate || 0);
    locationData[loc].totalRevenue += Number(vehicle.revenue || 0);
    
    if (vehicle.status === 'available') locationData[loc].availableCount++;
    else if (vehicle.status === 'rented') locationData[loc].rentedCount++;
    else if (vehicle.status === 'maintenance') locationData[loc].maintenanceCount++;
    
    locationData[loc].vehicles.push({
      name: `${vehicle.make} ${vehicle.model}`,
      status: vehicle.status,
      utilization: vehicle.utilization
    });
  }
  
  // Add booking data
  for (const booking of (bookings || [])) {
    const loc = booking.vehicles?.location || 'Miami';
    if (locationData[loc]) {
      locationData[loc].bookingCount++;
    }
  }
  
  // Calculate averages and format
  const comparison = Object.values(locationData).map((loc: any) => ({
    location: loc.location,
    vehicleCount: loc.vehicleCount,
    availableVehicles: loc.availableCount,
    rentedVehicles: loc.rentedCount,
    inMaintenance: loc.maintenanceCount,
    totalRevenue: `$${loc.totalRevenue.toFixed(0)}`,
    avgUtilization: `${(loc.totalUtilization / loc.vehicleCount).toFixed(0)}%`,
    avgDailyRate: `$${(loc.avgRate / loc.vehicleCount).toFixed(0)}`,
    activeBookings: loc.bookingCount,
    revenuePerVehicle: `$${(loc.totalRevenue / loc.vehicleCount).toFixed(0)}`
  }));
  
  // Sort by revenue
  comparison.sort((a: any, b: any) => 
    parseFloat(b.totalRevenue.replace('$', '')) - parseFloat(a.totalRevenue.replace('$', ''))
  );
  
  // Calculate winner
  const winner = comparison[0];
  const runnerUp = comparison[1];
  
  let comparisonText = '';
  if (comparison.length >= 2) {
    const revDiff = parseFloat(winner.totalRevenue.replace('$', '')) - parseFloat(runnerUp.totalRevenue.replace('$', ''));
    const utilDiff = parseFloat(winner.avgUtilization) - parseFloat(runnerUp.avgUtilization);
    comparisonText = `${winner.location} leads with $${revDiff.toFixed(0)} more revenue and ${utilDiff.toFixed(0)}% higher utilization than ${runnerUp.location}.`;
  }
  
  return {
    locations: comparison,
    timeframe: timeframe || 'all time',
    winner: winner?.location,
    summary: `Location Comparison (${timeframe || 'all time'}): ${comparison.map(l => `${l.location}: ${l.vehicleCount} vehicles, ${l.totalRevenue} revenue, ${l.avgUtilization} utilization`).join(' | ')}. ${comparisonText}`
  };
}

// ============================================================
// HANDLER: Outstanding Balances
// ============================================================
export async function getOutstandingBalances(
  supabase: any,
  teamId: string,
  args: { location?: string; minAmount?: number; daysOverdue?: number }
) {
  const { location, minAmount = 0, daysOverdue } = args;
  
  // Get bookings with outstanding balances
  let query = supabase
    .from('bookings')
    .select('*, vehicles(name, make, model, year, location), customers(full_name, email, phone)')
    .eq('team_id', teamId)
    .or('payment_status.eq.pending,balance_due.gt.0');
  
  const { data: bookings, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    return {
      error: 'Failed to fetch balances',
      summary: 'I encountered an error retrieving outstanding balances.'
    };
  }
  
  let filteredBookings = bookings || [];
  
  // Filter by location
  if (location && location !== 'all') {
    filteredBookings = filteredBookings.filter((b: any) => 
      b.vehicles?.location?.toLowerCase() === location.toLowerCase()
    );
  }
  
  // Filter by minimum amount
  if (minAmount > 0) {
    filteredBookings = filteredBookings.filter((b: any) => 
      Number(b.balance_due || b.total_value || 0) >= minAmount
    );
  }
  
  // Filter by days overdue
  if (daysOverdue) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);
    filteredBookings = filteredBookings.filter((b: any) => 
      new Date(b.end_date) < cutoffDate
    );
  }
  
  // Calculate outstanding amounts
  const outstandingList = filteredBookings.map((b: any) => {
    const endDate = new Date(b.end_date);
    const now = new Date();
    const daysOverdueCalc = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      customer: b.customers?.full_name || b.customer_name || 'Unknown',
      email: b.customers?.email || b.customer_email,
      phone: b.customers?.phone || b.customer_phone,
      vehicle: b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'Unknown',
      location: b.vehicles?.location || 'Miami',
      bookingDates: `${new Date(b.start_date).toLocaleDateString()} - ${new Date(b.end_date).toLocaleDateString()}`,
      totalValue: `$${Number(b.total_value || 0).toFixed(0)}`,
      balanceDue: `$${Number(b.balance_due || b.total_value || 0).toFixed(0)}`,
      paymentStatus: b.payment_status,
      daysOverdue: daysOverdueCalc > 0 ? daysOverdueCalc : 0,
      urgency: daysOverdueCalc > 30 ? 'critical' : daysOverdueCalc > 14 ? 'high' : daysOverdueCalc > 7 ? 'medium' : 'low'
    };
  });
  
  // Sort by urgency and amount
  outstandingList.sort((a: any, b: any) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return parseFloat(b.balanceDue.replace('$', '')) - parseFloat(a.balanceDue.replace('$', ''));
  });
  
  const totalOutstanding = outstandingList.reduce((sum: number, b: any) => 
    sum + parseFloat(b.balanceDue.replace('$', '')), 0
  );
  
  const criticalCount = outstandingList.filter((b: any) => b.urgency === 'critical').length;
  const highCount = outstandingList.filter((b: any) => b.urgency === 'high').length;
  
  return {
    outstandingBookings: outstandingList,
    totalOutstanding: `$${totalOutstanding.toFixed(0)}`,
    count: outstandingList.length,
    criticalCount,
    highCount,
    location: location || 'all',
    summary: outstandingList.length > 0
      ? `You have $${totalOutstanding.toFixed(0)} in outstanding balances across ${outstandingList.length} booking${outstandingList.length > 1 ? 's' : ''}${location ? ` in ${location}` : ''}. ${criticalCount > 0 ? `${criticalCount} critical (30+ days overdue). ` : ''}${highCount > 0 ? `${highCount} high priority (14+ days). ` : ''}Top outstanding: ${outstandingList[0]?.customer} owes ${outstandingList[0]?.balanceDue}.`
      : `No outstanding balances found${location ? ` in ${location}` : ''}. All payments are up to date!`
  };
}

// ============================================================
// HANDLER: Idle Vehicles
// ============================================================
export async function getIdleVehicles(
  supabase: any,
  teamId: string,
  args: { daysIdle?: number; location?: string; utilizationThreshold?: number }
) {
  const { daysIdle = 7, location, utilizationThreshold = 20 } = args;
  
  // Get all vehicles
  let vehicleQuery = supabase
    .from('vehicles')
    .select('id, name, make, model, year, location, status, current_rate, utilization, revenue')
    .eq('team_id', teamId)
    .eq('status', 'available');
  
  if (location && location !== 'all') {
    vehicleQuery = vehicleQuery.eq('location', location);
  }
  
  const { data: vehicles, error } = await vehicleQuery;
  
  if (error || !vehicles) {
    return {
      error: 'Failed to fetch vehicles',
      summary: 'I encountered an error checking for idle vehicles.'
    };
  }
  
  // Get recent bookings for each vehicle
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysIdle);
  
  const vehicleIds = vehicles.map((v: any) => v.id);
  
  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('vehicle_id, end_date')
    .in('vehicle_id', vehicleIds)
    .gte('end_date', cutoffDate.toISOString())
    .order('end_date', { ascending: false });
  
  // Find vehicles with no recent bookings
  const recentlyBookedIds = new Set(recentBookings?.map((b: any) => b.vehicle_id) || []);
  
  const idleVehicles = vehicles
    .filter((v: any) => !recentlyBookedIds.has(v.id) || (v.utilization || 0) < utilizationThreshold)
    .map((v: any) => {
      // Find last booking for this vehicle
      const lastBooking = recentBookings?.find((b: any) => b.vehicle_id === v.id);
      const lastBookingDate = lastBooking ? new Date(lastBooking.end_date) : null;
      const daysSinceLastBooking = lastBookingDate 
        ? Math.floor((new Date().getTime() - lastBookingDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        vehicle: `${v.year} ${v.make} ${v.model}`,
        location: v.location || 'Miami',
        currentRate: `$${v.current_rate}`,
        utilization: `${v.utilization || 0}%`,
        totalRevenue: `$${Number(v.revenue || 0).toFixed(0)}`,
        daysSinceLastBooking: daysSinceLastBooking !== null ? daysSinceLastBooking : 'Never booked',
        lastBookingDate: lastBookingDate?.toLocaleDateString() || 'Never',
        recommendation: (v.utilization || 0) < 20 
          ? 'Consider 10-15% price reduction'
          : daysSinceLastBooking && daysSinceLastBooking > 14
            ? 'Run promotion or feature in marketing'
            : 'Monitor for 1 more week'
      };
    });
  
  // Sort by days idle
  idleVehicles.sort((a: any, b: any) => {
    const aDays = typeof a.daysSinceLastBooking === 'number' ? a.daysSinceLastBooking : 999;
    const bDays = typeof b.daysSinceLastBooking === 'number' ? b.daysSinceLastBooking : 999;
    return bDays - aDays;
  });
  
  const potentialRevenueLoss = idleVehicles.reduce((sum: number, v: any) => {
    const rate = parseFloat(v.currentRate.replace('$', ''));
    const days = typeof v.daysSinceLastBooking === 'number' ? v.daysSinceLastBooking : daysIdle;
    return sum + (rate * days);
  }, 0);
  
  return {
    idleVehicles,
    count: idleVehicles.length,
    totalVehicles: vehicles.length,
    idlePercentage: `${((idleVehicles.length / vehicles.length) * 100).toFixed(0)}%`,
    potentialRevenueLoss: `$${potentialRevenueLoss.toFixed(0)}`,
    daysThreshold: daysIdle,
    location: location || 'all',
    summary: idleVehicles.length > 0
      ? `${idleVehicles.length} of ${vehicles.length} vehicles (${((idleVehicles.length / vehicles.length) * 100).toFixed(0)}%) are idle${location ? ` in ${location}` : ''}. Potential revenue loss: $${potentialRevenueLoss.toFixed(0)}. Most idle: ${idleVehicles[0]?.vehicle} (${idleVehicles[0]?.daysSinceLastBooking} days). Recommendation: ${idleVehicles[0]?.recommendation}.`
      : `Great news! All ${vehicles.length} vehicles${location ? ` in ${location}` : ''} have been active in the last ${daysIdle} days.`
  };
}

// ============================================================
// HANDLER: Multi-Location Availability
// ============================================================
export async function getMultiLocationAvailability(
  supabase: any,
  teamId: string,
  args: { startDate: string; endDate: string; vehicleType?: string; make?: string }
) {
  const { startDate, endDate, vehicleType, make } = args;
  
  // Get all vehicles
  let vehicleQuery = supabase
    .from('vehicles')
    .select('id, name, make, model, year, location, status, current_rate')
    .eq('team_id', teamId)
    .eq('status', 'available');
  
  if (make) {
    vehicleQuery = vehicleQuery.ilike('make', `%${make}%`);
  }
  
  const { data: vehicles, error } = await vehicleQuery;
  
  if (error || !vehicles || vehicles.length === 0) {
    return {
      error: 'No vehicles found',
      summary: `I couldn't find any available vehicles matching your criteria.`
    };
  }
  
  // Check for booking conflicts
  const vehicleIds = vehicles.map((v: any) => v.id);
  
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('vehicle_id, start_date, end_date, customer_name')
    .in('vehicle_id', vehicleIds)
    .in('status', ['active', 'confirmed', 'pending'])
    .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);
  
  const conflictedIds = new Set(conflicts?.map((c: any) => c.vehicle_id) || []);
  
  // Group available vehicles by location
  const availabilityByLocation: Record<string, any[]> = {};
  
  for (const vehicle of vehicles) {
    if (conflictedIds.has(vehicle.id)) continue;
    
    const loc = vehicle.location || 'Miami';
    if (!availabilityByLocation[loc]) {
      availabilityByLocation[loc] = [];
    }
    
    availabilityByLocation[loc].push({
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      rate: `$${vehicle.current_rate}/day`,
      make: vehicle.make,
      model: vehicle.model
    });
  }
  
  // Format response
  const locations = Object.entries(availabilityByLocation).map(([loc, vehicles]) => ({
    location: loc,
    availableCount: vehicles.length,
    vehicles: vehicles,
    lowestRate: vehicles.length > 0 
      ? `$${Math.min(...vehicles.map((v: any) => parseFloat(v.rate.replace('$', '').replace('/day', ''))))}/day`
      : 'N/A'
  }));
  
  const totalAvailable = locations.reduce((sum, loc) => sum + loc.availableCount, 0);
  const totalConflicts = conflictedIds.size;
  
  return {
    requestedDates: `${startDate} to ${endDate}`,
    locations,
    totalAvailable,
    totalConflicts,
    summary: totalAvailable > 0
      ? `${totalAvailable} vehicle${totalAvailable > 1 ? 's' : ''} available across ${locations.length} location${locations.length > 1 ? 's' : ''} for ${startDate} to ${endDate}. ${locations.map(l => `${l.location}: ${l.availableCount} (from ${l.lowestRate})`).join(', ')}.`
      : `Unfortunately, no vehicles are available for ${startDate} to ${endDate}. ${totalConflicts} vehicle${totalConflicts > 1 ? 's have' : ' has'} booking conflicts.`
  };
}

// ============================================================
// HANDLER: Customer Segmentation
// ============================================================
export async function getCustomerSegments(
  supabase: any,
  teamId: string,
  args: { segment?: string; location?: string; limit?: number }
) {
  const { segment, location, limit = 20 } = args;
  
  // Get customers with booking data
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, full_name, email, phone, customer_status, total_bookings, lifetime_value')
    .eq('team_id', teamId)
    .order('lifetime_value', { ascending: false })
    .limit(100);
  
  if (error || !customers) {
    return {
      error: 'Failed to fetch customers',
      summary: 'I encountered an error retrieving customer data.'
    };
  }
  
  // Get recent bookings for recency calculation
  const customerIds = customers.map((c: any) => c.id);
  const { data: bookings } = await supabase
    .from('bookings')
    .select('customer_id, created_at, total_value, vehicles(location)')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });
  
  // Calculate RFM scores and segment customers
  const segmentedCustomers = customers.map((customer: any) => {
    const customerBookings = bookings?.filter((b: any) => b.customer_id === customer.id) || [];
    const lastBooking = customerBookings[0];
    const daysSinceLastBooking = lastBooking 
      ? Math.floor((new Date().getTime() - new Date(lastBooking.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    // Determine segment
    let customerSegment: string;
    const ltv = Number(customer.lifetime_value || 0);
    const bookingCount = customer.total_bookings || 0;
    
    if (ltv >= 50000 || bookingCount >= 10) {
      customerSegment = 'vip';
    } else if (ltv >= 20000 || bookingCount >= 5) {
      customerSegment = 'high_value';
    } else if (daysSinceLastBooking <= 30) {
      customerSegment = 'active';
    } else if (daysSinceLastBooking <= 90) {
      customerSegment = 'warm';
    } else if (daysSinceLastBooking <= 180) {
      customerSegment = 'cooling';
    } else if (bookingCount > 0) {
      customerSegment = 'at_risk';
    } else {
      customerSegment = 'new';
    }
    
    return {
      name: customer.full_name,
      email: customer.email,
      phone: customer.phone,
      segment: customerSegment,
      lifetimeValue: `$${ltv.toFixed(0)}`,
      totalBookings: bookingCount,
      daysSinceLastBooking: daysSinceLastBooking < 999 ? daysSinceLastBooking : 'Never',
      lastBookingLocation: lastBooking?.vehicles?.location || 'N/A',
      status: customer.customer_status || 'active'
    };
  });
  
  // Filter by segment if specified
  let filteredCustomers = segmentedCustomers;
  if (segment && segment !== 'all') {
    filteredCustomers = segmentedCustomers.filter((c: any) => c.segment === segment);
  }
  
  // Filter by location if specified
  if (location && location !== 'all') {
    filteredCustomers = filteredCustomers.filter((c: any) => 
      c.lastBookingLocation.toLowerCase() === location.toLowerCase()
    );
  }
  
  // Limit results
  filteredCustomers = filteredCustomers.slice(0, limit);
  
  // Calculate segment counts
  const segmentCounts = segmentedCustomers.reduce((acc: any, c: any) => {
    acc[c.segment] = (acc[c.segment] || 0) + 1;
    return acc;
  }, {});
  
  return {
    customers: filteredCustomers,
    count: filteredCustomers.length,
    totalCustomers: customers.length,
    segmentCounts,
    requestedSegment: segment || 'all',
    location: location || 'all',
    summary: segment 
      ? `Found ${filteredCustomers.length} ${segment} customers${location ? ` in ${location}` : ''}. ${segment === 'at_risk' ? 'Consider re-engagement campaigns.' : segment === 'vip' ? 'These are your top customers—prioritize their experience.' : ''}`
      : `Customer segments: ${Object.entries(segmentCounts).map(([s, c]) => `${s}: ${c}`).join(', ')}. Total: ${customers.length} customers.`
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { handler, args, userId } = await req.json();
    
    if (!handler) {
      return new Response(JSON.stringify({
        error: 'Handler name is required',
        availableHandlers: [
          'getVehicleProfitLoss',
          'compareLocations',
          'getOutstandingBalances',
          'getIdleVehicles',
          'getMultiLocationAvailability',
          'getCustomerSegments'
        ]
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabase = getSupabaseClient();
    
    // Get user ID if not provided
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { data: firstUser } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      effectiveUserId = firstUser?.id;
    }
    
    if (!effectiveUserId) {
      return new Response(JSON.stringify({
        error: 'User ID required',
        summary: 'Unable to identify user account'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get team ID for the user
    const teamId = await getUserTeamId(supabase, effectiveUserId);
    if (!teamId) {
      return new Response(JSON.stringify({
        error: 'No team found',
        summary: 'Unable to find your team. Please ensure you are assigned to a team.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let result;
    
    switch (handler) {
      case 'getVehicleProfitLoss':
        result = await getVehicleProfitLoss(supabase, teamId, args || {});
        break;
      case 'compareLocations':
        result = await compareLocations(supabase, teamId, args || {});
        break;
      case 'getOutstandingBalances':
        result = await getOutstandingBalances(supabase, teamId, args || {});
        break;
      case 'getIdleVehicles':
        result = await getIdleVehicles(supabase, teamId, args || {});
        break;
      case 'getMultiLocationAvailability':
        result = await getMultiLocationAvailability(supabase, teamId, args || {});
        break;
      case 'getCustomerSegments':
        result = await getCustomerSegments(supabase, teamId, args || {});
        break;
      default:
        return new Response(JSON.stringify({
          error: `Unknown handler: ${handler}`,
          availableHandlers: [
            'getVehicleProfitLoss',
            'compareLocations',
            'getOutstandingBalances',
            'getIdleVehicles',
            'getMultiLocationAvailability',
            'getCustomerSegments'
          ]
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Enterprise handler error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      summary: 'I encountered an error processing your request.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
