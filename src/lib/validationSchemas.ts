import { z } from 'zod';

// Customer validation schema
export const customerSchema = z.object({
  full_name: z.string().trim().min(1, "Name required").max(100, "Name too long"),
  email: z.string().trim().email("Invalid email").max(255, "Email too long"),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number").optional().or(z.literal('')),
  address: z.string().max(500, "Address too long").optional().or(z.literal('')),
  drivers_license: z.string().max(50, "License number too long").optional().or(z.literal('')),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional().or(z.literal('')),
  insurance_provider: z.string().max(100, "Provider name too long").optional().or(z.literal('')),
  insurance_policy: z.string().max(100, "Policy number too long").optional().or(z.literal('')),
  notes: z.string().max(2000, "Notes too long").optional().or(z.literal('')),
});

// Booking validation schema
export const bookingSchema = z.object({
  customer_name: z.string().trim().min(1, "Customer name required").max(100, "Name too long"),
  customer_email: z.string().email("Invalid email").max(255, "Email too long").optional().nullable().or(z.literal('')),
  customer_phone: z.string().max(20, "Phone too long").optional().nullable().or(z.literal('')),
  customer_id: z.string().uuid("Invalid customer ID").optional().nullable().or(z.literal('')),
  vehicle_id: z.string().uuid("Invalid vehicle ID"),
  start_date: z.string().datetime("Invalid start date"),
  end_date: z.string().datetime("Invalid end date"),
  pickup_location: z.string().min(1, "Pickup location required").max(200, "Location too long"),
  pickup_location_id: z.string().uuid("Invalid location ID").optional().nullable().or(z.literal('')),
  dropoff_location: z.string().max(200, "Location too long").optional().nullable().or(z.literal('')),
  dropoff_location_id: z.string().uuid("Invalid location ID").optional().nullable().or(z.literal('')),
  daily_rate: z.number().positive("Rate must be positive").max(100000, "Rate too high"),
  total_value: z.number().min(0, "Total cannot be negative").max(1000000, "Total too high"),
  discount_amount: z.number().min(0, "Discount cannot be negative").max(1000000, "Discount too high").optional().nullable(),
  discount_reason: z.string().max(100, "Reason too long").optional().nullable().or(z.literal('')),
  status: z.string().max(50, "Status too long").optional().nullable(),
  notes: z.string().max(2000, "Notes too long").optional().nullable().or(z.literal('')),
}).refine(data => new Date(data.end_date) > new Date(data.start_date), {
  message: "End date must be after start date",
  path: ["end_date"]
});

// Message validation schema
export const messageSchema = z.object({
  recipient_name: z.string().min(1, "Recipient name required").max(100, "Name too long"),
  recipient_email: z.string().email("Invalid email").max(255, "Email too long").optional().or(z.literal('')),
  recipient_phone: z.string().max(20, "Phone too long").optional().or(z.literal('')),
  message_type: z.enum(['email', 'sms', 'whatsapp']),
  subject: z.string().max(200, "Subject too long").optional().or(z.literal('')),
  body: z.string().min(1, "Message body required").max(5000, "Message too long"),
  booking_id: z.string().uuid("Invalid booking ID").optional().or(z.literal('')),
}).refine(data => 
  (data.message_type === 'email' && data.recipient_email) ||
  (['sms', 'whatsapp'].includes(data.message_type) && data.recipient_phone),
  {
    message: "Email required for email messages, phone for SMS/WhatsApp",
    path: ['recipient_email']
  }
);

// Damage claim validation schema
export const damageClaimSchema = z.object({
  vehicle_id: z.string().uuid("Invalid vehicle ID"),
  booking_id: z.string().uuid("Invalid booking ID").optional().or(z.literal('')),
  customer_id: z.string().uuid("Invalid customer ID").optional().or(z.literal('')),
  claim_type: z.string().min(1, "Claim type required").max(50, "Type too long"),
  severity: z.enum(['minor', 'moderate', 'severe', 'total_loss']),
  description: z.string().min(10, "Description too short").max(5000, "Description too long"),
  estimated_cost: z.number().min(0, "Cost cannot be negative").max(1000000, "Cost too high").optional(),
  insurance_claim_number: z.string().max(50, "Claim number too long").optional().or(z.literal('')),
});

// Payment validation schema
export const paymentSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID"),
  customer_id: z.string().uuid("Invalid customer ID").optional().or(z.literal('')),
  amount: z.number().positive("Amount must be positive").max(1000000, "Amount too high"),
  payment_type: z.enum(['deposit', 'rental', 'damage', 'refund']),
  payment_method: z.enum(['card', 'cash', 'bank_transfer', 'credit_card', 'stripe', 'zelle', 'venmo', 'paypal', 'wire', 'other']).optional(),
  notes: z.string().max(1000, "Notes too long").optional().or(z.literal('')),
});

// Vehicle validation schema
export const vehicleSchema = z.object({
  name: z.string().min(1, "Vehicle name required").max(100, "Name too long"),
  make: z.string().min(1, "Make required").max(50, "Make too long"),
  model: z.string().min(1, "Model required").max(50, "Model too long"),
  year: z.number().int("Year must be a whole number").min(1900, "Year too old").max(new Date().getFullYear() + 1, "Year too far in future"),
  license_plate: z.string().max(20, "License plate too long").optional().nullable().or(z.literal('')),
  vin: z.string().max(17, "VIN too long").optional().nullable().or(z.literal('')),
  current_rate: z.number().min(0, "Rate cannot be negative").max(100000, "Rate too high"),
  status: z.enum(['available', 'rented', 'maintenance', 'retired', 'booked']).optional(),
});

// Edge function chat messages validation
export const chatMessagesSchema = z.array(z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10000)
})).min(1, "At least one message required").max(50, "Too many messages");
