# ExotIQ.ai - Complete System Architecture

> AI-Powered Luxury Vehicle Fleet Management Platform
> Built for LLM comprehension of the complete system architecture

---

## Executive Summary

ExotIQ.ai is a comprehensive fleet management platform designed for luxury and exotic vehicle rental businesses. The system combines traditional fleet management capabilities with an AI-powered assistant named **Rari** that can execute voice commands, analyze data, and provide intelligent recommendations.

### Core Value Proposition
- Real-time fleet visibility and control
- AI-assisted decision making via voice and text
- Automated booking and payment tracking
- Predictive maintenance and pricing optimization
- Customer relationship management

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Landing   │  │    Auth     │  │  Dashboard  │  │    Rari AI Layer    │ │
│  │    Page     │  │   System    │  │   Modules   │  │  (Voice + Text)     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                         STATE MANAGEMENT (FleetContext)                      │
│  vehicles[] | bookings[] | customers[] | payments[] | damageClaims[]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                              SUPABASE CLIENT                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE BACKEND                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │   PostgreSQL     │  │  Edge Functions  │  │     Authentication         │ │
│  │   Database       │  │                  │  │                            │ │
│  │                  │  │  • demo-login    │  │  • Email/Password          │ │
│  │  • vehicles      │  │  • elevenlabs-*  │  │  • Magic Link              │ │
│  │  • bookings      │  │  • fleet-copilot │  │  • Demo Mode               │ │
│  │  • customers     │  │                  │  │                            │ │
│  │  • payments      │  └──────────────────┘  └────────────────────────────┘ │
│  │  • profiles      │                                                       │
│  │  • damage_claims │  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │  • documents     │  │   Row Level      │  │      Storage Buckets       │ │
│  │  • inspections   │  │   Security       │  │                            │ │
│  │  • maintenance   │  │   (RLS)          │  │  • Vehicle images          │ │
│  │  • messages      │  │                  │  │  • Documents               │ │
│  └──────────────────┘  └──────────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │   ElevenLabs     │  │   Lovable AI     │  │      Stripe (Future)       │ │
│  │   Voice AI       │  │   Gateway        │  │      Payments              │ │
│  │                  │  │                  │  │                            │ │
│  │  • TTS           │  │  • Gemini 2.5    │  │                            │ │
│  │  • STT           │  │  • GPT-5         │  │                            │ │
│  │  • Conversational│  │                  │  │                            │ │
│  └──────────────────┘  └──────────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend Framework** | React 18.3 | Component-based UI |
| **Build Tool** | Vite | Fast development and bundling |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **UI Components** | shadcn/ui + Radix | Accessible component primitives |
| **Animations** | Framer Motion | Physics-based animations |
| **State Management** | React Context + TanStack Query | Global state and server state |
| **Routing** | React Router v6 | Client-side routing |
| **Forms** | React Hook Form + Zod | Form handling and validation |
| **Charts** | Recharts | Data visualization |
| **Backend** | Supabase | Database, Auth, Edge Functions |
| **Voice AI** | ElevenLabs | Conversational AI with tools |
| **LLM Gateway** | Lovable AI | GPT-5 / Gemini access |

---

## Core Modules

### 1. MotorIQ (Fleet Intelligence)

**Purpose**: Central hub for vehicle management and AI-powered insights.

**Location**: `src/components/dashboard/MotorIQ.tsx`, `MotorIQEnhanced.tsx`

**Features**:
- Vehicle inventory management (add, edit, remove)
- Status tracking (Available, Rented, Maintenance, Reserved)
- AI-suggested pricing optimization
- Utilization analytics
- Image management with dialog previews

**Key Data Structure**:
```typescript
interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  status: 'available' | 'rented' | 'maintenance' | 'reserved';
  current_rate: number;
  suggested_rate?: number;
  utilization?: number;
  revenue?: number;
  image_url?: string;
  license_plate?: string;
  vin?: string;
  user_id: string;
}
```

**AI Integration Points**:
- `useAIPricing` hook for dynamic rate suggestions
- Price optimization dialog with AI recommendations
- Rari can query vehicle status via `get_fleet_vehicles` tool

---

### 2. Pulse (Operations Dashboard)

**Purpose**: Real-time operational insights and revenue tracking.

**Location**: `src/components/dashboard/Pulse.tsx`, `PulseEnhanced.tsx`

**Features**:
- Revenue metrics with animated counters (useCountUp)
- Booking status distribution
- Payment tracking
- Revenue line charts (RevenueLineChart)
- Quick action buttons
- AI insights widget

**Key Metrics Displayed**:
- Total Revenue (MTD)
- Active Bookings
- Fleet Utilization %
- Pending Payments
- Overdue Amounts

**AI Integration Points**:
- AIInsightWidget displays AI-generated fleet recommendations
- Rari can access via `getRevenueAnalysis`, `getPaymentStatus` tools

---

### 3. Book (Reservation Management)

**Purpose**: Complete booking lifecycle management.

**Location**: `src/components/dashboard/Book.tsx`, `BookEnhanced.tsx`

**Features**:
- Visual booking calendar (BookingCalendar)
- Booking creation with customer selection
- Status management (pending → confirmed → completed)
- Conflict detection for overlapping bookings
- Booking details dialog with full information
- Delivery and pickup tracking

**Key Data Structure**:
```typescript
interface Booking {
  id: string;
  vehicle_id: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  start_date: string;
  end_date: string;
  pickup_location: string;
  dropoff_location?: string;
  daily_rate: number;
  total_value: number;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  payment_status: 'pending' | 'partial' | 'paid';
  deposit_amount?: number;
  balance_due?: number;
  notes?: string;
  user_id: string;
}
```

**AI Integration Points**:
- Rari can retrieve bookings via `get_bookings` tool
- Can query by date range, status, or vehicle
- Conflict detection uses `conflictDetection.ts` utilities

---

### 4. Vault (Document Management)

**Purpose**: Secure document storage and compliance tracking.

**Location**: `src/components/dashboard/Vault.tsx`, `VaultEnhanced.tsx`

**Features**:
- Document upload with drag-and-drop
- Category filtering (Insurance, Registration, License, Contract, Inspection)
- Expiration tracking with visual indicators
- Verification status management
- Document preview and download
- Bulk operations

**Key Data Structure**:
```typescript
interface Document {
  id: string;
  name: string;
  type: string;
  file_url: string;
  file_size?: number;
  status: 'active' | 'expired' | 'pending';
  verification_status: 'verified' | 'pending' | 'rejected';
  expires_at?: string;
  vehicle_id?: string;
  customer_id?: string;
  user_id: string;
}
```

**AI Integration Points**:
- Rari can search documents via `searchDocuments` tool
- Can filter by type, status, or associated entity

---

### 5. Core (Administration Hub)

**Purpose**: System configuration, user management, and CRM.

**Location**: `src/components/dashboard/Core.tsx`, `CoreEnhanced.tsx`

**Sub-Modules**:

#### CRM Section (`CRMSection.tsx`)
- Customer database management
- Customer profiles with booking history
- Notes and preferences tracking
- VIP/Blacklist status management
- Lifetime value calculation

#### Damage Claims (`DamageClaimsSection.tsx`)
- Incident reporting
- Severity classification (Minor, Moderate, Severe)
- Insurance claim tracking
- Resolution workflow
- Cost estimation and actuals

#### User Management (`UserManagementSection.tsx`)
- Team member administration
- Role-based access (Admin, Manager, Staff)
- Activity tracking

#### System Settings (`SystemSettingsSection.tsx`)
- Company profile configuration
- Notification preferences
- Integration settings

**Key Customer Data Structure**:
```typescript
interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  drivers_license?: string;
  license_expiry?: string;
  date_of_birth?: string;
  customer_status: 'active' | 'vip' | 'blacklisted';
  total_bookings: number;
  lifetime_value: number;
  insurance_provider?: string;
  insurance_policy?: string;
  insurance_expiry?: string;
  notes?: string;
  preferences?: Record<string, any>;
  user_id: string;
}
```

---

## AI System (Rari)

### Overview

Rari is the AI assistant that provides both voice and text-based interaction with the fleet management system. It uses ElevenLabs for voice capabilities and connects to the Lovable AI gateway for LLM processing.

### Voice Interface

**Location**: `src/components/rari/RariVoiceInterface.tsx`

**Integration Flow**:
```
User speaks → ElevenLabs STT → Tool Execution → Response Generation → ElevenLabs TTS → Audio playback
```

**Components**:
- `RariVoiceInterface.tsx` - Main voice UI component
- `RariVoiceWaveform.tsx` - Audio visualization
- `AskRariButton.tsx` - Floating action button to trigger Rari
- `AskRariQuickAction.tsx` - Alternative trigger component

**ElevenLabs Configuration** (`elevenlabs-tools-config.json`):
```json
{
  "agent": {
    "prompt": {
      "prompt": "You are Rari, an AI assistant for ExotIQ.ai luxury vehicle fleet management...",
      "tools": [/* 14 available tools */]
    },
    "first_message": "Hello! I'm Rari, your ExotIQ.ai fleet assistant...",
    "language": "en"
  }
}
```

### Available AI Tools

Rari has access to 14 tools for interacting with the fleet system:

| Tool | Purpose | Parameters |
|------|---------|------------|
| `get_fleet_vehicles` | Retrieve vehicle inventory | `status?`, `make?` |
| `get_vehicle_details` | Single vehicle information | `vehicle_id` |
| `get_bookings` | Query reservations | `status?`, `start_date?`, `end_date?`, `vehicle_id?` |
| `get_booking_details` | Single booking information | `booking_id` |
| `get_customers` | Customer database query | `status?`, `search?` |
| `get_customer_details` | Single customer profile | `customer_id` |
| `getRevenueAnalysis` | Financial metrics | `period` (week/month/quarter/year) |
| `getPaymentStatus` | Payment tracking | `booking_id?`, `status?` |
| `getMaintenanceSchedule` | Service schedule | `vehicle_id?`, `status?` |
| `getDamageClaims` | Incident reports | `status?`, `vehicle_id?` |
| `getFleetUtilization` | Usage analytics | `period` |
| `searchDocuments` | Document search | `type?`, `status?`, `vehicle_id?` |
| `getUpcomingTasks` | Task overview | `days` (lookahead) |
| `getAIRecommendations` | AI suggestions | `category` |

### Text Chat Interface

**Location**: `src/components/dashboard/AIAlertsFeed.tsx`

**Backend**: `supabase/functions/fleet-copilot-chat/index.ts`

Uses the Lovable AI gateway (Gemini 2.5 Flash) for text-based queries with streaming responses.

---

## Database Schema

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User accounts | id, email, full_name, company_name, onboarding_completed |
| `vehicles` | Fleet inventory | id, name, make, model, year, status, current_rate, user_id |
| `bookings` | Reservations | id, vehicle_id, customer_id, start_date, end_date, status, user_id |
| `customers` | Client database | id, full_name, email, customer_status, lifetime_value, user_id |
| `payments` | Transaction records | id, booking_id, amount, payment_type, payment_status, user_id |
| `damage_claims` | Incident reports | id, vehicle_id, booking_id, severity, claim_status, user_id |
| `documents` | File storage refs | id, name, type, file_url, status, user_id |
| `vehicle_inspections` | Condition reports | id, vehicle_id, booking_id, inspection_type, user_id |
| `inspection_photos` | Inspection images | id, inspection_id, photo_url, photo_type |
| `maintenance_schedules` | Service planning | id, vehicle_id, maintenance_type, scheduled_date, status |
| `messages` | Communication log | id, booking_id, recipient_name, message_type, status |
| `automated_messages` | Scheduled messages | id, booking_id, customer_id, message_type, scheduled_for |
| `customer_notes` | CRM notes | id, customer_id, note, created_by |
| `user_dashboard_layouts` | UI preferences | id, user_id, layout_data, visible_widgets |
| `user_dashboard_preferences` | Customization | id, user_id, banner_url, logo_url |

### Row Level Security (RLS)

All tables are protected by RLS policies ensuring users can only access their own data:

```sql
-- Example policy pattern used across all tables
CREATE POLICY "Users can only view their own records"
ON public.table_name
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own records"
ON public.table_name
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own records"
ON public.table_name
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own records"
ON public.table_name
FOR DELETE
USING (auth.uid() = user_id);
```

---

## Authentication Flow

**Location**: `src/contexts/AuthContext.tsx`, `src/pages/Auth.tsx`

### Supported Methods

1. **Email/Password**: Standard signup/signin with auto-confirm enabled
2. **Magic Link**: Passwordless email authentication
3. **Demo Mode**: Pre-authenticated demo experience

### Auth Context API

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithMagicLink: (email: string) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  signInAsDemo: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}
```

### Demo Mode

- Accessed via `/demo` route
- Uses `demo-login` edge function
- Pre-populated with sample data
- Full functionality without real account
- `DemoContext` provides demo state management

---

## State Management

### FleetContext

**Location**: `src/contexts/FleetContext.tsx`

Central state container for all fleet data:

```typescript
interface FleetContextType {
  // Data arrays
  vehicles: Vehicle[];
  bookings: Booking[];
  customers: Customer[];
  payments: Payment[];
  damageClaims: DamageClaim[];
  inspections: VehicleInspection[];
  
  // Loading states
  loading: boolean;
  
  // CRUD operations
  addVehicle: (vehicle: VehicleInsert) => Promise<Vehicle>;
  updateVehicle: (id: string, updates: VehicleUpdate) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  
  addBooking: (booking: BookingInsert) => Promise<Booking>;
  updateBooking: (id: string, updates: BookingUpdate) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  
  addCustomer: (customer: CustomerInsert) => Promise<Customer>;
  updateCustomer: (id: string, updates: CustomerUpdate) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  
  addPayment: (payment: PaymentInsert) => Promise<Payment>;
  
  addDamageClaim: (claim: DamageClaimInsert) => Promise<DamageClaim>;
  updateDamageClaim: (id: string, updates: DamageClaimUpdate) => Promise<void>;
  
  // Refresh functions
  refreshVehicles: () => Promise<void>;
  refreshBookings: () => Promise<void>;
  refreshCustomers: () => Promise<void>;
  refreshPayments: () => Promise<void>;
  refreshDamageClaims: () => Promise<void>;
}
```

### Realtime Subscriptions

**Location**: `src/hooks/useRealtimeSubscriptions.ts`

Subscribes to Supabase realtime channels for:
- bookings (INSERT, UPDATE)
- payments (INSERT)
- damage_claims (INSERT)
- customers (INSERT)
- vehicle_inspections (INSERT)

Triggers toast notifications and context refreshes on changes.

---

## Edge Functions

### 1. demo-login

**Purpose**: Create or authenticate demo user
**Path**: `/functions/v1/demo-login`
**Method**: POST

### 2. elevenlabs-session

**Purpose**: Generate signed URL for ElevenLabs conversational AI
**Path**: `/functions/v1/elevenlabs-session`
**Method**: POST
**Requires**: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` secrets

### 3. elevenlabs-tools

**Purpose**: Execute AI tool calls from ElevenLabs agent
**Path**: `/functions/v1/elevenlabs-tools`
**Method**: POST
**Handles**: All 14 Rari AI tools

### 4. fleet-copilot-chat

**Purpose**: Text-based AI chat via Lovable AI gateway
**Path**: `/functions/v1/fleet-copilot-chat`
**Method**: POST
**Uses**: `LOVABLE_API_KEY` (auto-configured)

### 5. text-to-speech

**Purpose**: Convert text to speech via ElevenLabs
**Path**: `/functions/v1/text-to-speech`
**Method**: POST

### 6. voice-to-text

**Purpose**: Convert speech to text
**Path**: `/functions/v1/voice-to-text`
**Method**: POST

---

## Animation System

### Framer Motion Presets

**Location**: `src/lib/animations.ts`

**Spring Configurations**:
```typescript
export const springs = {
  gentle: { type: "spring", stiffness: 120, damping: 14, mass: 1 },
  snappy: { type: "spring", stiffness: 400, damping: 30, mass: 1 },
  bouncy: { type: "spring", stiffness: 300, damping: 10, mass: 1 },
  smooth: { type: "spring", stiffness: 200, damping: 20, mass: 1 }
};
```

**Animation Variants**:
- `fadeInUp` - Content reveal
- `fadeIn` - Simple opacity transition
- `scaleIn` - Scale entrance
- `slideInRight/Left` - Horizontal slides
- `staggerContainer/Item` - List animations
- `pressScale` - Button press feedback
- `hoverLift` - Card hover effect
- `hoverGlow` - Glow on hover
- `rariBreathingGlow` - Rari button ambient animation
- `rariPulse` - Rari activity indicator
- `aiThinking` - AI processing animation
- `successCheckmark` - Success confirmation
- `errorShake` - Error feedback

### CSS Keyframes

**Location**: `tailwind.config.ts`

Custom animations:
- `shimmer` - Skeleton loading effect
- `gradient-flow` - Background gradient animation
- `breathing-glow` - Ambient glow pulse
- `wave` - Voice waveform bars
- `shake` - Error shake
- `toast-slide-in/out` - Notification animations
- `draw-check` - Checkmark draw animation

### Accessibility

`prefersReducedMotion()` utility checks user preferences and `getSafeVariant()` returns simplified animations for users who prefer reduced motion.

---

## Validation System

**Location**: `src/lib/validationSchemas.ts`

Zod schemas for all form inputs:

```typescript
// Vehicle validation
export const vehicleSchema = z.object({
  name: z.string().min(1, "Vehicle name is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().min(1900).max(new Date().getFullYear() + 1),
  current_rate: z.number().min(0, "Rate must be positive"),
  // ...
});

// Booking validation
export const bookingSchema = z.object({
  vehicle_id: z.string().uuid(),
  customer_name: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  // ...
}).refine(data => new Date(data.end_date) > new Date(data.start_date), {
  message: "End date must be after start date"
});

// Customer validation
export const customerSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  // ...
});

// Payment validation
export const paymentSchema = z.object({
  amount: z.number().positive(),
  payment_type: z.enum(['deposit', 'rental', 'damage', 'other']),
  payment_method: z.enum(['credit_card', 'debit_card', 'cash', 'wire_transfer', 'check']),
  // ...
});
```

---

## File Structure

```
src/
├── assets/                    # Static assets (vehicle images)
├── components/
│   ├── charts/               # Recharts visualizations
│   ├── common/               # Shared components (LoadingSpinner, ErrorBoundary, etc.)
│   ├── dashboard/            # Main dashboard modules
│   │   ├── MotorIQ.tsx      # Fleet management
│   │   ├── Pulse.tsx        # Operations dashboard
│   │   ├── Book.tsx         # Booking management
│   │   ├── Vault.tsx        # Document management
│   │   ├── Core.tsx         # Administration
│   │   └── widgets/         # Dashboard widget components
│   ├── dialogs/              # Modal dialogs (AddVehicle, NewBooking, etc.)
│   ├── landing/              # Marketing landing page
│   ├── providers/            # Context providers
│   ├── rari/                 # AI assistant components
│   └── ui/                   # shadcn/ui components
├── contexts/
│   ├── AuthContext.tsx       # Authentication state
│   ├── DemoContext.tsx       # Demo mode state
│   └── FleetContext.tsx      # Fleet data state
├── hooks/                    # Custom React hooks
├── integrations/
│   └── supabase/            # Supabase client and types
├── lib/                      # Utilities
│   ├── animations.ts        # Framer Motion presets
│   ├── conflictDetection.ts # Booking conflict logic
│   ├── validation.ts        # Form validation
│   └── utils.ts             # General utilities
├── pages/                    # Route components
└── main.tsx                  # App entry point

supabase/
├── config.toml              # Supabase configuration
└── functions/               # Edge functions
    ├── demo-login/
    ├── elevenlabs-session/
    ├── elevenlabs-tools/
    ├── fleet-copilot-chat/
    ├── text-to-speech/
    └── voice-to-text/
```

---

## Environment Variables

### Client-Side (Vite)
```env
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon-key]
```

### Edge Function Secrets
```env
ELEVENLABS_API_KEY=[api-key]
ELEVENLABS_AGENT_ID=[agent-id]
LOVABLE_API_KEY=[auto-configured]
```

---

## Key User Flows

### 1. New Booking Creation
```
User clicks "New Booking" → NewBookingDialog opens → 
Select vehicle (filtered by availability) → 
Select/create customer → 
Set dates (conflict check runs) → 
Calculate pricing → 
Submit → Supabase insert → 
Context refresh → Calendar updates → 
Toast notification
```

### 2. Voice Command Execution
```
User clicks Rari button → 
ElevenLabs session created → 
User speaks command → 
STT converts to text → 
LLM processes intent → 
Tool call dispatched to elevenlabs-tools → 
Database query executed → 
Response formatted → 
TTS converts to speech → 
Audio plays → UI updates
```

### 3. Payment Recording
```
User opens booking → 
Clicks "Record Payment" → 
RecordPaymentDialog opens → 
Enter amount/method → 
Submit → Payment inserted → 
Booking balance_due updated → 
PaymentTracker reflects change → 
Toast notification
```

---

## Performance Optimizations

1. **Code Splitting**: Dynamic imports for large components
2. **Virtual Lists**: `VirtualList` component for large data sets
3. **Optimized Images**: `OptimizedImage` component with lazy loading
4. **Debounced Search**: `useDebounce` hook for search inputs
5. **Memoization**: Strategic use of useMemo/useCallback
6. **Skeleton States**: Perceived performance with loading skeletons

---

## Security Model

1. **Authentication Required**: All dashboard routes protected by `ProtectedRoute`
2. **Row Level Security**: All database tables have RLS policies
3. **User Isolation**: `user_id` foreign key on all records
4. **API Key Protection**: Secrets stored in Supabase, never exposed to client
5. **CORS Configuration**: Edge functions configured with appropriate headers

---

## Future Extensibility

The architecture supports easy addition of:
- Additional AI tools (add to elevenlabs-tools-config.json and edge function)
- New dashboard modules (create component, add to module navigation)
- Payment processing (Stripe integration ready)
- Multi-tenant support (organization_id addition to schema)
- Mobile app (API-ready backend)

---

*This documentation is designed for AI/LLM comprehension of the ExotIQ.ai system architecture.*
