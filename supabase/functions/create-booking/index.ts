import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateBookingRequest {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  vehicleName?: string;
  vehicleId?: string;
  startDate: string;
  endDate: string;
  location: string;
  dropoffLocation?: string;
  dailyRate?: number;
  totalValue?: number;
  status?: string;
  notes?: string;
  depositAmount?: number;
  securityDepositAmount?: number;
  requiresDelivery?: boolean;
  deliveryAddress?: string;
  deliveryFee?: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Create admin client for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const bookingData: CreateBookingRequest = await req.json();

    // Validate required fields
    if (!bookingData.customerName) {
      throw new Error("Customer name is required");
    }

    if (!bookingData.startDate || !bookingData.endDate) {
      throw new Error("Start date and end date are required");
    }

    if (!bookingData.vehicleName && !bookingData.vehicleId) {
      throw new Error("Vehicle name or vehicle ID is required");
    }

    if (!bookingData.location) {
      throw new Error("Pickup location is required");
    }

    // Parse dates
    const startDate = new Date(bookingData.startDate);
    const endDate = new Date(bookingData.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("Invalid date format. Use ISO 8601 format (e.g., 2024-01-15T10:00:00Z)");
    }

    if (endDate <= startDate) {
      throw new Error("End date must be after start date");
    }

    // Find vehicle by name or ID
    let vehicle;
    if (bookingData.vehicleId) {
      const { data, error } = await supabaseAdmin
        .from("vehicles")
        .select("*")
        .eq("id", bookingData.vehicleId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        throw new Error("Vehicle not found");
      }
      vehicle = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("vehicles")
        .select("*")
        .eq("user_id", user.id)
        .or(`name.ilike.%${bookingData.vehicleName}%,make.ilike.%${bookingData.vehicleName}%,model.ilike.%${bookingData.vehicleName}%`)
        .limit(1)
        .single();

      if (error || !data) {
        throw new Error(`Vehicle "${bookingData.vehicleName}" not found`);
      }
      vehicle = data;
    }

    // Check vehicle availability for the date range
    const { data: conflicts } = await supabaseAdmin
      .from("bookings")
      .select("id, customer_name, start_date, end_date, status")
      .eq("vehicle_id", vehicle.id)
      .in("status", ["pending", "confirmed", "active"])
      .or(`and(start_date.lte.${bookingData.endDate},end_date.gte.${bookingData.startDate})`);

    if (conflicts && conflicts.length > 0) {
      const conflictDetails = conflicts.map(c => 
        `${c.customer_name} (${new Date(c.start_date).toLocaleDateString()} - ${new Date(c.end_date).toLocaleDateString()})`
      ).join(", ");
      throw new Error(`Vehicle is not available for the selected dates. Conflicting bookings: ${conflictDetails}`);
    }

    // Calculate rental duration in days
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

    // Calculate pricing
    const dailyRate = bookingData.dailyRate || vehicle.current_rate || 0;
    const totalValue = bookingData.totalValue || (dailyRate * durationDays);
    const depositAmount = bookingData.depositAmount || (totalValue * 0.2); // 20% deposit by default
    const securityDeposit = bookingData.securityDepositAmount || (dailyRate * 2); // 2 days as security deposit
    const deliveryFee = bookingData.deliveryFee || (bookingData.requiresDelivery ? 150 : 0);

    // Try to find or create customer record
    let customerId = null;
    if (bookingData.customerEmail) {
      // Check if customer exists
      const { data: existingCustomer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .eq("email", bookingData.customerEmail)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Create new customer record
        const { data: newCustomer, error: customerError } = await supabaseAdmin
          .from("customers")
          .insert({
            user_id: user.id,
            email: bookingData.customerEmail,
            phone: bookingData.customerPhone,
            full_name: bookingData.customerName,
            customer_status: "active",
          })
          .select()
          .single();

        if (!customerError && newCustomer) {
          customerId = newCustomer.id;
        }
      }
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        user_id: user.id,
        vehicle_id: vehicle.id,
        customer_id: customerId,
        customer_name: bookingData.customerName,
        customer_email: bookingData.customerEmail,
        customer_phone: bookingData.customerPhone,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        pickup_location: bookingData.location,
        dropoff_location: bookingData.dropoffLocation || bookingData.location,
        daily_rate: dailyRate,
        total_value: totalValue + deliveryFee,
        status: bookingData.status || "pending",
        notes: bookingData.notes,
        deposit_amount: depositAmount,
        balance_due: totalValue + deliveryFee - depositAmount,
        security_deposit_amount: securityDeposit,
        security_deposit_status: "pending",
        requires_delivery: bookingData.requiresDelivery || false,
        delivery_address: bookingData.deliveryAddress,
        delivery_fee: deliveryFee,
        payment_status: "pending",
      })
      .select(`
        *,
        vehicles:vehicle_id (
          id,
          name,
          make,
          model,
          year,
          license_plate,
          location
        )
      `)
      .single();

    if (bookingError) {
      console.error("Failed to create booking:", bookingError);
      throw new Error(`Failed to create booking: ${bookingError.message}`);
    }

    // Update vehicle status to 'booked' if booking is confirmed
    if (bookingData.status === "confirmed" || bookingData.status === "active") {
      await supabaseAdmin
        .from("vehicles")
        .update({ status: "booked" })
        .eq("id", vehicle.id);
    }

    console.log("Booking created successfully:", booking.id);

    return new Response(
      JSON.stringify({
        success: true,
        booking: {
          id: booking.id,
          customerName: booking.customer_name,
          customerEmail: booking.customer_email,
          customerPhone: booking.customer_phone,
          vehicle: booking.vehicles ? {
            id: booking.vehicles.id,
            name: `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}`,
            licensePlate: booking.vehicles.license_plate,
            location: booking.vehicles.location,
          } : null,
          startDate: booking.start_date,
          endDate: booking.end_date,
          durationDays,
          pickupLocation: booking.pickup_location,
          dropoffLocation: booking.dropoff_location,
          dailyRate: booking.daily_rate,
          totalValue: booking.total_value,
          depositAmount: booking.deposit_amount,
          balanceDue: booking.balance_due,
          securityDeposit: booking.security_deposit_amount,
          deliveryFee: booking.delivery_fee,
          status: booking.status,
          paymentStatus: booking.payment_status,
          notes: booking.notes,
          createdAt: booking.created_at,
        },
        message: `Booking created successfully for ${bookingData.customerName}. Booking ID: ${booking.id}`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-booking function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
