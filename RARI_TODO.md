# RARI AI Assistant - TODO & Integration Needs

## Current Status
RARI is powered by ElevenLabs Conversational AI with real-time data access via custom tools.

## Storage & SOC2 Compliance

### Where Data is Stored
All data is stored in **Supabase Cloud (AWS)** which is SOC2 Type II compliant:

| Data Type | Storage Location | Bucket/Table | SOC2 Status |
|-----------|-----------------|--------------|-------------|
| Customer Documents | Supabase Storage | `customer-documents` (private) | ✅ Compliant |
| Damage Photos | Supabase Storage | `damage-photos` (private) | ✅ Compliant |
| Vehicle Photos | Supabase Storage | `vehicle-photos` (private) | ✅ Compliant |
| Dashboard Banners | Supabase Storage | `dashboard-banners` (public) | ✅ Compliant |
| All Database Tables | Supabase PostgreSQL | Public schema with RLS | ✅ Compliant |
| RARI Feedback | Supabase PostgreSQL | `rari_feedback` table | ✅ Compliant |

### Security Features
- **Row Level Security (RLS)** enabled on all tables
- **Private buckets** for sensitive documents
- **User-scoped file paths** (files stored under `{user_id}/filename`)
- **Encrypted at rest** via Supabase infrastructure

---

## RARI Improvements Needed

### 1. Voice Settings (ElevenLabs Dashboard)
**Action Required:** Update RARI's voice settings in ElevenLabs dashboard:
- [ ] Increase speech speed (currently too slow)
- [ ] Reduce latency optimization setting
- [ ] Consider switching to a more dynamic voice model

### 2. Response Style
**Action Required:** Update system prompt in ElevenLabs agent configuration:
- [ ] Shorter, more concise responses
- [ ] More casual/human conversational style
- [ ] Avoid overly formal language
- [ ] Use contractions (I'm, we're, you'll)

### 3. Feedback Logging (COMPLETED ✅)
RARI now logs user feedback when:
- A feature doesn't exist
- User needs aren't being met
- Wrong responses are given

Table: `rari_feedback`
- `feedback_type`: 'feature_request', 'not_working', 'other'
- `keywords`: Array of relevant keywords
- `user_query`: What the user asked
- `rari_response`: What RARI said
- `context`: Additional context JSON

---

## Resend Email Integration

### Purpose
Allow RARI to email customer support (hello@exotiq.ai) with:
- Urgent issues needing immediate fixes
- Feature requests from users
- Bug reports from the Command Center

### Integration Steps

1. **Create Resend Account**
   - Go to https://resend.com
   - Sign up and verify domain (exotiq.ai)
   - Get API key

2. **Add Resend Secret**
   - Add `RESEND_API_KEY` to Supabase secrets

3. **Create Edge Function**
   Create `supabase/functions/rari-email-support/index.ts`:
   ```typescript
   import { Resend } from 'resend';
   
   const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
   
   // Send email to hello@exotiq.ai
   await resend.emails.send({
     from: 'RARI <rari@exotiq.ai>',
     to: ['hello@exotiq.ai'],
     subject: `[RARI Alert] ${type}: ${summary}`,
     html: emailBody
   });
   ```

4. **Add ElevenLabs Tool**
   Add `sendSupportEmail` tool to elevenlabs-tools-config.json

### Email Types
- `urgent_fix`: Critical issues needing immediate attention
- `feature_request`: User-requested features
- `bug_report`: Bugs discovered during use
- `feedback`: General user feedback

---

## Nice-to-Have: ID Photo to Profile

### Implementation Plan
1. When ID is uploaded for verification, extract face region
2. Store cropped headshot in `customer-documents` bucket
3. Update customer profile with `avatar_url`

### Technical Approach
Option A: Client-side face detection with TensorFlow.js
Option B: Edge function with external face detection API

### Dependencies
- Face detection library or API
- Image processing capability
- User consent for biometric data

---

## ElevenLabs Tools Available

Current tools RARI can use:
- `getFleetMetrics` - Fleet performance data
- `getVehicleDetails` - Specific vehicle info
- `getCustomerProfile` - Customer lookup
- `checkAvailability` - Vehicle availability
- `getRevenueAnalysis` - Revenue data
- `getTopPerformers` - Top vehicles/customers
- `searchBookings` - Search bookings
- `getDamageReports` - Damage claims
- `getUpcomingMaintenance` - Maintenance schedule
- `getDemandForecast` - AI demand forecast
- `getPricingRecommendation` - AI pricing
- `getFleetPricingOverview` - Fleet pricing
- `get_fleet_vehicles` - All vehicles
- `get_bookings` - All bookings
- `get_recent_activity` - Recent activity

### Tools to Add
- [ ] `logFeedback` - Log user feedback (needs ElevenLabs config)
- [ ] `sendSupportEmail` - Email support team
- [ ] `extractIdPhoto` - Extract headshot from ID

---

## Contact
For RARI issues: hello@exotiq.ai
