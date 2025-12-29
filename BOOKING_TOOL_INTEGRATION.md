# Customer Booking Tool Integration

## Overview

A new customer booking/reservation tool has been successfully integrated into the Exotiq FleetCopilot backend. This tool allows creating bookings with comprehensive parameters including customer information, vehicle selection, dates, location, pricing, and status management.

## What Was Created

### 1. New Supabase Edge Function: `create-booking`

**Location**: `/workspace/supabase/functions/create-booking/index.ts`

**Purpose**: Standalone Edge Function for creating customer bookings

**Features**:
- Vehicle availability checking
- Automatic pricing calculations
- Customer profile management (auto-create if needed)
- Date validation
- Vehicle status updates
- Security deposit and deposit management
- Delivery options support

**API Endpoint**: `POST /functions/v1/create-booking`

### 2. Integration with ElevenLabs Voice Tools

**Updated File**: `/workspace/supabase/functions/elevenlabs-tools/index.ts`

**Added**: `createBooking` case handler in the executeFunction switch statement

**Configuration**: `/workspace/elevenlabs-tools-config.json`

**Tool Name**: `createBooking`

**Capabilities**:
- Can be called via voice commands through ElevenLabs voice interface
- Natural language processing for booking parameters
- Conversational feedback with detailed booking summaries

### 3. Integration with Fleet Copilot Chat

**Updated File**: `/workspace/supabase/functions/fleet-copilot-chat/index.ts`

**Added**: 
- `createBooking` tool definition in the tools array
- `createBooking` case handler in executeFunction

**Capabilities**:
- Available in AI chat interface
- Supports both text and voice commands
- Intelligent error handling and user feedback

### 4. Documentation

**Files Created**:
- `/workspace/supabase/functions/create-booking/README.md` - Comprehensive API documentation
- `/workspace/supabase/functions/create-booking/test-examples.ts` - Testing examples and use cases
- `/workspace/BOOKING_TOOL_INTEGRATION.md` - This summary document

## Database Schema

The tool integrates with existing Supabase tables:

### Tables Used

1. **bookings** - Main booking records
   - All fields from original schema
   - Enhanced with customer_id, payment details, delivery options

2. **vehicles** - Vehicle inventory
   - Reads vehicle information
   - Updates vehicle status when bookings are confirmed

3. **customers** - Customer profiles
   - Auto-creates customer records if email is provided
   - Links bookings to customer profiles for tracking

### Row-Level Security (RLS)

All operations respect existing RLS policies:
- Users can only create bookings for their own vehicles
- Authentication required via JWT
- Service role key used for administrative operations

## API Parameters

### Required Parameters

```typescript
{
  customerName: string;      // Full name of the customer
  vehicleName: string;       // Name/model of vehicle (or vehicleId)
  startDate: string;         // ISO format date (YYYY-MM-DD)
  endDate: string;           // ISO format date (YYYY-MM-DD)
  location: string;          // Pickup location
}
```

### Optional Parameters

```typescript
{
  customerEmail?: string;
  customerPhone?: string;
  vehicleId?: string;        // Alternative to vehicleName
  dropoffLocation?: string;
  dailyRate?: number;
  totalValue?: number;
  status?: "pending" | "confirmed" | "active";
  notes?: string;
  depositAmount?: number;
  securityDepositAmount?: number;
  requiresDelivery?: boolean;
  deliveryAddress?: string;
  deliveryFee?: number;
}
```

## Automatic Calculations

The tool automatically handles:

1. **Duration Calculation**: Days between start and end dates
2. **Pricing**: Total = daily rate × duration + delivery fee
3. **Deposit**: Defaults to 20% of total value
4. **Security Deposit**: Defaults to 2× daily rate
5. **Balance Due**: Total - deposit amount
6. **Delivery Fee**: $150 if delivery is required (configurable)

## Validation & Error Handling

### Input Validation

- ✅ Required fields presence check
- ✅ Date format validation (ISO 8601)
- ✅ Date range validation (end must be after start)
- ✅ Vehicle existence check
- ✅ User authorization check

### Business Logic Validation

- ✅ Vehicle availability checking (conflict detection)
- ✅ Overlapping booking prevention
- ✅ Customer profile validation/creation

### Error Messages

Clear, user-friendly error messages for:
- Missing required fields
- Invalid date formats
- Vehicle not found
- Vehicle unavailable (with conflict details)
- Database errors

## Usage Examples

### 1. Voice Command (via ElevenLabs)

```
User: "Create a booking for John Smith for the Ferrari SF90 
       from March 15th to March 20th in Miami Beach"

Rari: "Perfect! I've created a pending booking for John Smith. 
       The 2023 Ferrari SF90 Stradale is reserved from March 15 
       to March 20 (5 days) at $2,500 per day for a total of 
       $12,500. A deposit of $2,500 is required..."
```

### 2. Chat Interface (via Fleet Copilot Chat)

```
User: "Book the McLaren for Sarah Johnson next week"

Rari: [Processes request with AI, extracts parameters, creates booking]
      "I've created a booking for Sarah Johnson..."
```

### 3. Direct API Call

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-booking' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "customerName": "John Smith",
    "customerEmail": "john@example.com",
    "vehicleName": "Ferrari SF90",
    "startDate": "2024-03-15",
    "endDate": "2024-03-20",
    "location": "Miami Beach",
    "status": "confirmed"
  }'
```

### 4. JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

const { data, error } = await supabase.functions.invoke('create-booking', {
  body: {
    customerName: 'John Smith',
    vehicleName: 'Ferrari SF90',
    startDate: '2024-03-15',
    endDate: '2024-03-20',
    location: 'Miami Beach'
  }
});
```

## Response Format

### Success Response

```json
{
  "success": true,
  "booking": {
    "id": "uuid",
    "customerName": "John Smith",
    "vehicle": {
      "name": "2023 Ferrari SF90 Stradale",
      "licensePlate": "ABC123",
      "location": "Miami"
    },
    "startDate": "2024-03-15T00:00:00.000Z",
    "endDate": "2024-03-20T00:00:00.000Z",
    "durationDays": 5,
    "dailyRate": 2500,
    "totalValue": 12500,
    "depositAmount": 2500,
    "balanceDue": 10000,
    "status": "confirmed",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Booking created successfully..."
}
```

### Error Response

```json
{
  "success": false,
  "error": "Vehicle not available for the selected dates. Conflicting bookings: Jane Doe (03/16/2024 - 03/18/2024)"
}
```

## Integration Points

### 1. Voice Interface (ElevenLabs)

- Tool available in ElevenLabs tools configuration
- Natural language parameter extraction
- Conversational response formatting
- Integrated with Rari AI personality

### 2. Chat Interface (Fleet Copilot)

- Available as AI tool in chat completions
- Supports function calling via OpenAI-compatible API
- Integrated with Lovable AI gateway
- Context-aware booking creation

### 3. Direct HTTP API

- Standard Supabase Edge Function endpoint
- JWT authentication required
- CORS-enabled for web applications
- RESTful API design

## Security Features

1. **Authentication**:
   - JWT token required
   - User identity verified via Supabase Auth

2. **Authorization**:
   - RLS policies enforced
   - Users can only book their own vehicles
   - Service role key for admin operations

3. **Data Validation**:
   - Input sanitization
   - Type checking
   - Business rule validation

4. **Audit Trail**:
   - All bookings timestamped
   - Customer creation logged
   - Vehicle status changes tracked

## Testing

Test examples provided in:
- `/workspace/supabase/functions/create-booking/test-examples.ts`

Includes tests for:
- Basic booking creation
- Full booking with all options
- Weekend rentals
- Long-term rentals
- Error cases (invalid dates, vehicle not found)
- Conflict detection

## Deployment

The function follows Supabase Edge Functions patterns:

1. **Deploy via Supabase CLI**:
   ```bash
   supabase functions deploy create-booking
   ```

2. **Environment Variables Required**:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`

3. **Deno Runtime**: Uses Deno 1.x runtime (Supabase standard)

## Future Enhancements

Potential improvements for consideration:

1. **Email Notifications**: Send confirmation emails to customers
2. **SMS Notifications**: Text message confirmations
3. **Payment Integration**: Process deposits via Stripe
4. **Calendar Sync**: Sync bookings to external calendars
5. **Insurance Verification**: Automated insurance validation
6. **ID Verification**: Driver's license verification integration
7. **Multi-location Support**: Enhanced location-based filtering
8. **Pricing Rules Engine**: Dynamic pricing based on demand/events
9. **Cancellation Handling**: Automated cancellation processing
10. **Modification Support**: Update existing bookings

## Code Quality

- ✅ TypeScript interfaces for type safety
- ✅ Comprehensive error handling
- ✅ Clear variable naming
- ✅ Inline documentation
- ✅ Follows existing codebase patterns
- ✅ CORS headers for cross-origin support
- ✅ Logging for debugging

## Maintenance

Files to monitor for updates:

1. `/workspace/supabase/functions/create-booking/index.ts`
2. `/workspace/supabase/functions/elevenlabs-tools/index.ts`
3. `/workspace/supabase/functions/fleet-copilot-chat/index.ts`
4. `/workspace/elevenlabs-tools-config.json`

## Support

For questions or issues:

1. Check the README: `/workspace/supabase/functions/create-booking/README.md`
2. Review test examples: `/workspace/supabase/functions/create-booking/test-examples.ts`
3. Check Supabase logs via dashboard or CLI

## Conclusion

The customer booking tool is now fully integrated and ready for use. It provides a comprehensive, production-ready solution for creating vehicle reservations with:

- Multiple interface options (Voice, Chat, API)
- Robust validation and error handling
- Automatic calculations and customer management
- Seamless integration with existing backend
- Clear documentation and testing examples

The implementation follows all existing patterns in the codebase and is ready for deployment.
