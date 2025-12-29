# Create Booking Edge Function

This Supabase Edge Function allows creating customer bookings/reservations for vehicles in the fleet management system.

## Endpoint

```
POST /functions/v1/create-booking
```

## Authentication

Requires a valid Supabase JWT token in the Authorization header:

```
Authorization: Bearer <your-token>
```

## Request Body

```json
{
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "+1234567890",
  "vehicleName": "Ferrari SF90",
  "startDate": "2024-02-15",
  "endDate": "2024-02-20",
  "location": "Miami Beach",
  "dropoffLocation": "Miami Airport",
  "status": "confirmed",
  "notes": "Customer prefers early morning pickup",
  "depositAmount": 2000,
  "securityDepositAmount": 5000,
  "requiresDelivery": true,
  "deliveryAddress": "123 Ocean Drive, Miami Beach, FL",
  "deliveryFee": 150
}
```

### Required Fields

- `customerName` (string): Full name of the customer
- `startDate` (string): Start date in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
- `endDate` (string): End date in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
- `location` (string): Pickup location
- `vehicleName` OR `vehicleId`: Either the vehicle name/model or the vehicle UUID

### Optional Fields

- `customerEmail` (string): Customer's email address
- `customerPhone` (string): Customer's phone number
- `vehicleId` (string): UUID of the vehicle (if not using vehicleName)
- `dropoffLocation` (string): Drop-off location (defaults to pickup location)
- `dailyRate` (number): Daily rental rate (defaults to vehicle's current rate)
- `totalValue` (number): Total booking value (auto-calculated if not provided)
- `status` (string): Booking status - "pending", "confirmed", or "active" (default: "pending")
- `notes` (string): Additional notes for the booking
- `depositAmount` (number): Deposit amount (defaults to 20% of total)
- `securityDepositAmount` (number): Security deposit (defaults to 2x daily rate)
- `requiresDelivery` (boolean): Whether delivery is required
- `deliveryAddress` (string): Delivery address if delivery is required
- `deliveryFee` (number): Delivery fee (defaults to $150 if delivery required)

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "booking": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "+1234567890",
    "vehicle": {
      "id": "987fcdeb-51a2-43f1-b456-789012345678",
      "name": "2023 Ferrari SF90 Stradale",
      "licensePlate": "ABC123",
      "location": "Miami"
    },
    "startDate": "2024-02-15T00:00:00.000Z",
    "endDate": "2024-02-20T00:00:00.000Z",
    "durationDays": 5,
    "pickupLocation": "Miami Beach",
    "dropoffLocation": "Miami Airport",
    "dailyRate": 2500,
    "totalValue": 12650,
    "depositAmount": 2530,
    "balanceDue": 10120,
    "securityDeposit": 5000,
    "deliveryFee": 150,
    "status": "confirmed",
    "paymentStatus": "pending",
    "notes": "Customer prefers early morning pickup",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Booking created successfully for John Doe. Booking ID: 123e4567-e89b-12d3-a456-426614174000"
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "Vehicle not found"
}
```

## Features

### Automatic Calculations

- **Duration**: Automatically calculates rental duration in days
- **Pricing**: Auto-calculates total value if not provided (daily rate × duration)
- **Deposit**: Defaults to 20% of total value
- **Security Deposit**: Defaults to 2× daily rate
- **Delivery Fee**: Adds $150 if delivery is required

### Vehicle Availability Check

The function automatically checks if the vehicle is available for the requested dates and returns conflicts if any exist.

### Customer Management

- If `customerEmail` is provided, the function checks for existing customer records
- Creates new customer profile if one doesn't exist
- Links booking to customer profile for tracking lifetime value

### Vehicle Status Updates

- If booking status is "confirmed" or "active", automatically updates vehicle status to "booked"

## Integration with Voice/Chat Interface

This function is integrated with:

1. **ElevenLabs Voice Tools** - Can be called via voice commands through the `createBooking` tool
2. **Fleet Copilot Chat** - Available in the AI chat interface for booking management

### Example Voice Commands

- "Create a booking for John Smith for the Ferrari from February 15th to 20th in Miami"
- "Book the McLaren 720S for Sarah Johnson starting March 1st for 7 days"
- "Make a reservation for the Lamborghini Aventador from next Monday to Friday for Michael Brown"

## Database Schema

The function interacts with the following tables:

- `bookings` - Main booking records
- `vehicles` - Vehicle inventory
- `customers` - Customer profiles (optional, auto-created)

## Security

- Row-level security (RLS) enforced on all tables
- Users can only create bookings for their own vehicles
- JWT authentication required
- All database operations use the authenticated user's context

## Error Handling

The function handles various error scenarios:

- Missing required fields
- Invalid date formats
- End date before start date
- Vehicle not found
- Vehicle unavailable (conflicting bookings)
- Customer creation failures
- Database errors

## Testing

### Using curl

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-booking' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "customerName": "Test Customer",
    "customerEmail": "test@example.com",
    "vehicleName": "Ferrari",
    "startDate": "2024-03-01",
    "endDate": "2024-03-05",
    "location": "Miami Beach",
    "status": "pending"
  }'
```

### Using JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data, error } = await supabase.functions.invoke('create-booking', {
  body: {
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    vehicleName: 'Ferrari SF90',
    startDate: '2024-03-01',
    endDate: '2024-03-05',
    location: 'Miami Beach',
    status: 'confirmed'
  }
});
```

## Related Functions

- `elevenlabs-tools` - Voice interface integration
- `fleet-copilot-chat` - AI chat interface integration
- `accept-invite` - User invitation system
- `invite-user` - Team member management

## Maintenance

The function follows Supabase Edge Functions best practices:

- Uses Deno runtime
- CORS headers for cross-origin requests
- TypeScript interfaces for type safety
- Comprehensive error handling
- Database connection pooling via service role key
