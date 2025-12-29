# Customer Booking Tool - Quick Start Guide

## What Was Built

A complete customer booking/reservation system for your fleet management platform with:

- ✅ **New Edge Function**: `create-booking` for handling booking creation
- ✅ **Voice Integration**: Works with ElevenLabs voice interface
- ✅ **Chat Integration**: Works with Fleet Copilot AI chat
- ✅ **Direct API**: RESTful endpoint for programmatic access

## How to Use

### 1. Via Voice (ElevenLabs)

Simply say:
```
"Create a booking for John Smith for the Ferrari SF90 
from March 15th to March 20th in Miami Beach"
```

Rari will:
- Find the vehicle
- Check availability
- Calculate pricing
- Create the booking
- Provide confirmation with all details

### 2. Via Chat (Fleet Copilot)

Type in the chat:
```
"Book the McLaren for Sarah Johnson starting next Monday for 5 days"
```

The AI will extract the parameters and create the booking automatically.

### 3. Via Direct API

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

### 4. Via JavaScript/TypeScript

```typescript
const { data, error } = await supabase.functions.invoke('create-booking', {
  body: {
    customerName: 'John Smith',
    customerEmail: 'john@example.com',
    vehicleName: 'Ferrari SF90',
    startDate: '2024-03-15',
    endDate: '2024-03-20',
    location: 'Miami Beach'
  }
});

if (error) {
  console.error('Booking failed:', error);
} else {
  console.log('Booking created:', data.booking);
}
```

## Required Parameters

Only 5 fields are required:

1. **customerName**: Customer's full name
2. **vehicleName**: Name or model of the vehicle (e.g., "Ferrari SF90")
3. **startDate**: Start date (YYYY-MM-DD format)
4. **endDate**: End date (YYYY-MM-DD format)
5. **location**: Pickup location

Everything else is calculated automatically!

## What Gets Calculated Automatically

- ✅ **Duration**: Number of days
- ✅ **Total Price**: Daily rate × duration
- ✅ **Deposit**: 20% of total (customizable)
- ✅ **Security Deposit**: 2× daily rate (customizable)
- ✅ **Balance Due**: Total - deposit
- ✅ **Delivery Fee**: $150 if delivery requested

## Smart Features

### 1. Availability Checking
Automatically checks if the vehicle is available and shows conflicts if any.

### 2. Customer Management
- Finds existing customer by email
- Creates new customer profile if needed
- Links booking to customer for lifetime value tracking

### 3. Vehicle Status Updates
- Updates vehicle status to "booked" when confirmed
- Prevents double-booking

### 4. Flexible Vehicle Search
Can find vehicles by:
- Full name
- Make
- Model
- Partial matches

Example: "Ferrari", "SF90", or "Ferrari SF90" all work!

## Example Responses

### Success Response
```json
{
  "success": true,
  "booking": {
    "id": "abc-123",
    "customerName": "John Smith",
    "vehicle": {
      "name": "2023 Ferrari SF90 Stradale"
    },
    "startDate": "2024-03-15",
    "endDate": "2024-03-20",
    "durationDays": 5,
    "dailyRate": 2500,
    "totalValue": 12500,
    "depositAmount": 2500,
    "balanceDue": 10000,
    "status": "confirmed"
  }
}
```

### Error Response (Vehicle Unavailable)
```json
{
  "success": false,
  "error": "Vehicle not available for the selected dates. Conflicting bookings: Jane Doe (03/16/2024 - 03/18/2024)"
}
```

## Optional Parameters

Want more control? Add any of these:

- `customerEmail` - For customer profile linking
- `customerPhone` - Contact number
- `dropoffLocation` - Different from pickup
- `status` - "pending", "confirmed", or "active"
- `notes` - Special instructions
- `dailyRate` - Override vehicle's rate
- `totalValue` - Override calculated total
- `depositAmount` - Custom deposit
- `securityDepositAmount` - Custom security deposit
- `requiresDelivery` - Set to `true` for delivery
- `deliveryAddress` - Where to deliver
- `deliveryFee` - Custom delivery charge

## Deployment

To deploy:

```bash
cd /workspace
supabase functions deploy create-booking
supabase functions deploy elevenlabs-tools
supabase functions deploy fleet-copilot-chat
```

## Testing

Run the test examples:

```bash
# See test-examples.ts for all test cases
cd /workspace/supabase/functions/create-booking
```

## Documentation

- **Full API Docs**: See `README.md` in the function folder
- **Test Examples**: See `test-examples.ts`
- **Integration Details**: See `/workspace/BOOKING_TOOL_INTEGRATION.md`
- **Implementation Checklist**: See `/workspace/BOOKING_TOOL_CHECKLIST.md`

## Key Files

```
/workspace/
├── supabase/functions/
│   ├── create-booking/
│   │   ├── index.ts              # Main function
│   │   ├── README.md             # Full documentation
│   │   └── test-examples.ts      # Test suite
│   ├── elevenlabs-tools/
│   │   └── index.ts              # Voice integration
│   └── fleet-copilot-chat/
│       └── index.ts              # Chat integration
├── elevenlabs-tools-config.json  # Voice tool config
├── BOOKING_TOOL_INTEGRATION.md   # Complete overview
├── BOOKING_TOOL_CHECKLIST.md     # Implementation status
└── BOOKING_TOOL_QUICKSTART.md    # This file
```

## Common Use Cases

### Weekend Rental
```json
{
  "customerName": "Michael Brown",
  "vehicleName": "Lamborghini Aventador",
  "startDate": "2024-03-22",
  "endDate": "2024-03-24",
  "location": "South Beach"
}
```

### Week-Long Business Trip
```json
{
  "customerName": "Emily Davis",
  "customerEmail": "emily@company.com",
  "vehicleName": "Porsche 911",
  "startDate": "2024-05-01",
  "endDate": "2024-05-08",
  "location": "Downtown Miami",
  "status": "confirmed",
  "notes": "Needs parking pass"
}
```

### With Delivery
```json
{
  "customerName": "Robert Wilson",
  "customerEmail": "robert@example.com",
  "vehicleName": "McLaren 720S",
  "startDate": "2024-06-01",
  "endDate": "2024-06-05",
  "location": "Miami Beach",
  "requiresDelivery": true,
  "deliveryAddress": "100 Lincoln Road, Miami Beach"
}
```

## Need Help?

1. Check the full README for detailed API documentation
2. Review test-examples.ts for more usage patterns
3. Check Supabase function logs for debugging
4. Verify environment variables are set correctly

## That's It! 🎉

The booking tool is ready to use. It integrates seamlessly with your existing fleet management system and provides a simple, powerful way to create customer bookings with automatic validations, calculations, and integrations.
