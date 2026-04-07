import { supabase } from '@/integrations/supabase/client';

// Client-side tools for Rari voice assistant
// These execute in the browser with user's auth context

export function createRariClientTools(userId: string, teamId?: string, userRole?: string) {
  const isRestrictedRole = userRole === 'operator' || userRole === 'viewer';
  const REVENUE_DENIED = "Revenue analytics require manager-level access. Please ask your fleet manager or admin for this information.";
  const PAYMENT_DENIED = "Payment data requires manager-level access. Please ask your fleet manager or admin for this information.";
  return {
    // Fleet Metrics
    getFleetMetrics: async (params: { timeframe?: string; location?: string }) => {
      try {
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, status, location, current_rate, utilization, revenue');
        
        // Filter by team_id if available
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: vehicles } = await vehicleQuery;

        let bookingQuery = supabase
          .from('bookings')
          .select('id, status, total_value, start_date, end_date');
        
        if (teamId) {
          bookingQuery = bookingQuery.eq('team_id', teamId);
        }
        
        const { data: bookings } = await bookingQuery;

        const totalVehicles = vehicles?.length || 0;
        const availableVehicles = vehicles?.filter(v => v.status === 'available').length || 0;
        const rentedVehicles = vehicles?.filter(v => v.status === 'rented').length || 0;
        const activeBookings = bookings?.filter(b => b.status === 'active' || b.status === 'confirmed').length || 0;
        const avgUtilization = vehicles?.length 
          ? Math.round(vehicles.reduce((sum, v) => sum + (v.utilization || 0), 0) / vehicles.length)
          : 0;
        const totalRevenue = vehicles?.reduce((sum, v) => sum + (v.revenue || 0), 0) || 0;

        return JSON.stringify({
          totalVehicles,
          availableVehicles,
          rentedVehicles,
          maintenanceVehicles: vehicles?.filter(v => v.status === 'maintenance').length || 0,
          activeBookings,
          averageUtilization: `${avgUtilization}%`,
          totalRevenue: `$${totalRevenue.toLocaleString()}`,
          status: 'success'
        });
      } catch (error) {
        console.error('getFleetMetrics error:', error);
        return JSON.stringify({ error: 'Failed to fetch fleet metrics', status: 'error' });
      }
    },

    // Location Metrics
    getLocationMetrics: async (params: { location?: string }) => {
      try {
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, location, status, current_rate, utilization, revenue');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: vehicles } = await vehicleQuery;

        // Group by location
        const locationMap: Record<string, any> = {};
        vehicles?.forEach(v => {
          const loc = v.location || 'Unknown';
          if (!locationMap[loc]) {
            locationMap[loc] = { 
              name: loc, 
              vehicleCount: 0, 
              available: 0, 
              rented: 0,
              revenue: 0,
              avgUtilization: 0,
              utilizationSum: 0
            };
          }
          locationMap[loc].vehicleCount++;
          if (v.status === 'available') locationMap[loc].available++;
          if (v.status === 'rented') locationMap[loc].rented++;
          locationMap[loc].revenue += v.revenue || 0;
          locationMap[loc].utilizationSum += v.utilization || 0;
        });

        const locations = Object.values(locationMap).map((loc: any) => ({
          ...loc,
          avgUtilization: loc.vehicleCount ? Math.round(loc.utilizationSum / loc.vehicleCount) : 0,
          revenue: `$${loc.revenue.toLocaleString()}`
        }));

        // Filter if specific location requested
        const result = params.location && params.location !== 'all'
          ? locations.filter(l => l.name.toLowerCase().includes(params.location!.toLowerCase()))
          : locations;

        return JSON.stringify({ locations: result, status: 'success' });
      } catch (error) {
        console.error('getLocationMetrics error:', error);
        return JSON.stringify({ error: 'Failed to fetch location metrics', status: 'error' });
      }
    },

    // Revenue Analysis
    getRevenueAnalysis: async (params: { timeframe?: string; location?: string; vehicleName?: string }) => {
      if (isRestrictedRole) {
        return JSON.stringify({ message: REVENUE_DENIED, status: 'permission_denied' });
      }
      try {
        let paymentsQuery = supabase
          .from('payments')
          .select('amount, payment_status, transaction_date, booking_id')
          .eq('payment_status', 'completed');
        
        if (teamId) {
          paymentsQuery = paymentsQuery.eq('team_id', teamId);
        }
        
        const { data: payments } = await paymentsQuery;

        let bookingsQuery = supabase
          .from('bookings')
          .select('id, total_value, status, vehicle_id, start_date');
        
        if (teamId) {
          bookingsQuery = bookingsQuery.eq('team_id', teamId);
        }
        
        const { data: bookings } = await bookingsQuery;

        const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        const completedBookings = bookings?.filter(b => b.status === 'completed').length || 0;
        const avgBookingValue = completedBookings > 0 
          ? Math.round(totalRevenue / completedBookings) 
          : 0;

        // This month's revenue
        const now = new Date();
        const thisMonth = payments?.filter(p => {
          const date = new Date(p.transaction_date || '');
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        });
        const monthRevenue = thisMonth?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        return JSON.stringify({
          totalRevenue: `$${totalRevenue.toLocaleString()}`,
          monthToDateRevenue: `$${monthRevenue.toLocaleString()}`,
          completedBookings,
          averageBookingValue: `$${avgBookingValue.toLocaleString()}`,
          paymentCount: payments?.length || 0,
          status: 'success'
        });
      } catch (error) {
        console.error('getRevenueAnalysis error:', error);
        return JSON.stringify({ error: 'Failed to fetch revenue analysis', status: 'error' });
      }
    },

    // Get Fleet Vehicles
    get_fleet_vehicles: async (params: { status?: string; location?: string }) => {
      try {
        let query = supabase
          .from('vehicles')
          .select('id, name, make, model, year, status, location, current_rate, utilization');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        if (params.status && params.status !== 'all') {
          query = query.eq('status', params.status);
        }
        if (params.location) {
          query = query.ilike('location', `%${params.location}%`);
        }

        const { data: vehicles } = await query.limit(20);

        const formatted = vehicles?.map(v => ({
          name: v.name,
          make: v.make,
          model: v.model,
          year: v.year,
          status: v.status,
          location: v.location,
          dailyRate: `$${v.current_rate?.toLocaleString() || 0}`,
          utilization: `${v.utilization || 0}%`
        }));

        return JSON.stringify({ 
          vehicles: formatted, 
          count: formatted?.length || 0,
          status: 'success' 
        });
      } catch (error) {
        console.error('get_fleet_vehicles error:', error);
        return JSON.stringify({ error: 'Failed to fetch vehicles', status: 'error' });
      }
    },

    // Get Vehicle Details
    getVehicleDetails: async (params: { vehicleName: string; includeBookings?: boolean }) => {
      try {
        let vehicleQuery = supabase
          .from('vehicles')
          .select('*')
          .or(`name.ilike.%${params.vehicleName}%,make.ilike.%${params.vehicleName}%,model.ilike.%${params.vehicleName}%`)
          .limit(1);
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: vehicles } = await vehicleQuery;

        const vehicle = vehicles?.[0];
        if (!vehicle) {
          return JSON.stringify({ error: `Vehicle "${params.vehicleName}" not found`, status: 'not_found' });
        }

        let bookingInfo = null;
        if (params.includeBookings) {
          const { data: bookings } = await supabase
            .from('bookings')
            .select('id, customer_name, start_date, end_date, status, total_value')
            .eq('vehicle_id', vehicle.id)
            .order('start_date', { ascending: false })
            .limit(5);
          bookingInfo = bookings;
        }

        return JSON.stringify({
          vehicle: {
            name: vehicle.name,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            status: vehicle.status,
            location: vehicle.location,
            dailyRate: `$${vehicle.current_rate?.toLocaleString() || 0}`,
            utilization: `${vehicle.utilization || 0}%`,
            totalRevenue: `$${vehicle.revenue?.toLocaleString() || 0}`,
            licensePlate: vehicle.license_plate,
            vin: vehicle.vin
          },
          recentBookings: bookingInfo,
          status: 'success'
        });
      } catch (error) {
        console.error('getVehicleDetails error:', error);
        return JSON.stringify({ error: 'Failed to fetch vehicle details', status: 'error' });
      }
    },

    // Get Bookings
    get_bookings: async (params: { status?: string; location?: string; start_date?: string; end_date?: string }) => {
      try {
        let query = supabase
          .from('bookings')
          .select('id, customer_name, vehicle_id, start_date, end_date, status, total_value, pickup_location')
          .order('start_date', { ascending: false });
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        if (params.status && params.status !== 'all') {
          query = query.eq('status', params.status);
        }

        const { data: bookings } = await query.limit(20);

        // Get vehicle names
        const vehicleIds = [...new Set(bookings?.map(b => b.vehicle_id) || [])];
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('id, name, make, model')
          .in('id', vehicleIds);

        const vehicleMap = new Map(vehicles?.map(v => [v.id, `${v.make} ${v.model}`]) || []);

        const formatted = bookings?.map(b => ({
          id: b.id.slice(0, 8),
          customer: b.customer_name,
          vehicle: vehicleMap.get(b.vehicle_id) || 'Unknown',
          startDate: b.start_date,
          endDate: b.end_date,
          status: b.status,
          value: `$${b.total_value?.toLocaleString() || 0}`,
          location: b.pickup_location
        }));

        return JSON.stringify({ 
          bookings: formatted, 
          count: formatted?.length || 0,
          status: 'success' 
        });
      } catch (error) {
        console.error('get_bookings error:', error);
        return JSON.stringify({ error: 'Failed to fetch bookings', status: 'error' });
      }
    },

    // Payment Summary
    getPaymentSummary: async (params: { status?: string; timeframe?: string }) => {
      if (isRestrictedRole) {
        return JSON.stringify({ message: PAYMENT_DENIED, status: 'permission_denied' });
      }
      try {
        let paymentsQuery = supabase
          .from('payments')
          .select('amount, payment_status, payment_method, transaction_date');
        
        if (teamId) {
          paymentsQuery = paymentsQuery.eq('team_id', teamId);
        }
        
        const { data: payments } = await paymentsQuery;

        const completed = payments?.filter(p => p.payment_status === 'completed') || [];
        const pending = payments?.filter(p => p.payment_status === 'pending') || [];

        const totalCompleted = completed.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalPending = pending.reduce((sum, p) => sum + (p.amount || 0), 0);

        // By payment method
        const methodBreakdown: Record<string, number> = {};
        completed.forEach(p => {
          const method = p.payment_method || 'other';
          methodBreakdown[method] = (methodBreakdown[method] || 0) + (p.amount || 0);
        });

        return JSON.stringify({
          totalCompleted: `$${totalCompleted.toLocaleString()}`,
          totalPending: `$${totalPending.toLocaleString()}`,
          completedCount: completed.length,
          pendingCount: pending.length,
          byMethod: Object.entries(methodBreakdown).map(([method, amount]) => ({
            method,
            amount: `$${amount.toLocaleString()}`
          })),
          status: 'success'
        });
      } catch (error) {
        console.error('getPaymentSummary error:', error);
        return JSON.stringify({ error: 'Failed to fetch payment summary', status: 'error' });
      }
    },

    // Top Performers
    getTopPerformers: async (params: { metric?: string; limit?: number; location?: string }) => {
      try {
        const limit = params.limit || 5;

        if (params.metric === 'customers') {
          let customerQuery = supabase
            .from('customers')
            .select('full_name, lifetime_value, total_bookings')
            .order('lifetime_value', { ascending: false })
            .limit(limit);
          
          if (teamId) {
            customerQuery = customerQuery.eq('team_id', teamId);
          }
          
          const { data: customers } = await customerQuery;

          return JSON.stringify({
            topCustomers: customers?.map(c => ({
              name: c.full_name,
              lifetimeValue: `$${c.lifetime_value?.toLocaleString() || 0}`,
              bookings: c.total_bookings || 0
            })),
            status: 'success'
          });
        }

        // Default: top vehicles by revenue
        let query = supabase
          .from('vehicles')
          .select('name, make, model, revenue, utilization, location')
          .order(params.metric === 'utilization' ? 'utilization' : 'revenue', { ascending: false });
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        if (params.location) {
          query = query.ilike('location', `%${params.location}%`);
        }

        const { data: vehicles } = await query.limit(limit);

        return JSON.stringify({
          topVehicles: vehicles?.map(v => ({
            name: `${v.make} ${v.model}`,
            location: v.location,
            revenue: `$${v.revenue?.toLocaleString() || 0}`,
            utilization: `${v.utilization || 0}%`
          })),
          status: 'success'
        });
      } catch (error) {
        console.error('getTopPerformers error:', error);
        return JSON.stringify({ error: 'Failed to fetch top performers', status: 'error' });
      }
    },

    // Check Availability
    checkAvailability: async (params: { vehicleName?: string; startDate: string; endDate: string; location?: string }) => {
      try {
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, status, location')
          .eq('status', 'available');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }

        if (params.vehicleName) {
          vehicleQuery = vehicleQuery.or(`name.ilike.%${params.vehicleName}%,make.ilike.%${params.vehicleName}%,model.ilike.%${params.vehicleName}%`);
        }
        if (params.location) {
          vehicleQuery = vehicleQuery.ilike('location', `%${params.location}%`);
        }

        const { data: vehicles } = await vehicleQuery;

        // Check for conflicting bookings
        const vehicleIds = vehicles?.map(v => v.id) || [];
        const { data: conflictingBookings } = await supabase
          .from('bookings')
          .select('vehicle_id')
          .in('vehicle_id', vehicleIds)
          .in('status', ['active', 'confirmed', 'pending'])
          .lte('start_date', params.endDate)
          .gte('end_date', params.startDate);

        const bookedVehicleIds = new Set(conflictingBookings?.map(b => b.vehicle_id) || []);
        const availableVehicles = vehicles?.filter(v => !bookedVehicleIds.has(v.id)) || [];

        return JSON.stringify({
          available: availableVehicles.map(v => ({
            name: `${v.make} ${v.model}`,
            location: v.location
          })),
          count: availableVehicles.length,
          dateRange: `${params.startDate} to ${params.endDate}`,
          status: 'success'
        });
      } catch (error) {
        console.error('checkAvailability error:', error);
        return JSON.stringify({ error: 'Failed to check availability', status: 'error' });
      }
    },

    // Get Recent Activity
    get_recent_activity: async (params: { limit?: number }) => {
      try {
        const limit = params.limit || 10;

        let bookingsQuery = supabase
          .from('bookings')
          .select('id, customer_name, status, created_at, total_value')
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (teamId) {
          bookingsQuery = bookingsQuery.eq('team_id', teamId);
        }
        
        const { data: bookings } = await bookingsQuery;

        return JSON.stringify({
          recentActivity: bookings?.map(b => ({
            type: 'booking',
            customer: b.customer_name,
            status: b.status,
            value: `$${b.total_value?.toLocaleString() || 0}`,
            date: b.created_at
          })),
          status: 'success'
        });
      } catch (error) {
        console.error('get_recent_activity error:', error);
        return JSON.stringify({ error: 'Failed to fetch recent activity', status: 'error' });
      }
    }
  };
}
