

# Phase 3: Enhanced Onboarding - Comprehensive Implementation Plan

## Executive Summary

This plan addresses five key enhancements to create an enterprise-grade onboarding experience that reduces friction, improves data quality, and enables team collaboration from day one.

---

## Current State Analysis

### What Exists Today

| Feature | Current State | Storage |
|---------|---------------|---------|
| **Onboarding Progress** | 4-step wizard at `/onboarding` | `localStorage` (user-specific key) |
| **Onboarding Completion Flag** | Single boolean | `profiles.onboarding_completed` |
| **Tour Completion** | Interactive module tour | `profiles.tour_completed` |
| **Import System** | Full wizard with validation, duplicate handling | `import_batches` table |
| **Template Detection** | Entity type auto-detection from headers | `detectEntityType()` in `importUtils.ts` |
| **Team Invitations** | Email-based with role assignment | `user_invitations` table |
| **First Booking Detection** | Confetti celebration | Real-time check in FleetContext |

### Database Tables Already Available

```text
import_batches:
  - id, user_id, team_id, entity_type, file_name
  - total_rows, imported_count, skipped_count, failed_count
  - status, error_details, created_at, completed_at

user_invitations:
  - id, invited_by, team_id, email, role
  - permissions[], status, token, expires_at

profiles:
  - onboarding_completed (boolean)
  - tour_completed (boolean)
  - fleet_size, business_type, company_name

onboarding_responses:
  - Legacy table with session_id, business_name, pain_points etc.
```

---

## Implementation Plan

### 1. Move Onboarding Progress to Database

**Current Problem**: Onboarding state stored in localStorage is lost when users switch devices or clear browser data, causing them to restart the wizard.

**Solution**: Create a dedicated `onboarding_progress` table to persist step-by-step progress.

#### Database Migration

```sql
CREATE TABLE public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  
  -- Step tracking
  current_step INTEGER NOT NULL DEFAULT 1,
  steps_completed INTEGER[] DEFAULT '{}',
  
  -- Form data (persisted between sessions)
  form_data JSONB DEFAULT '{}',
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  source TEXT DEFAULT 'web', -- 'web', 'mobile', 'invite'
  referral_code TEXT,
  
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress"
  ON public.onboarding_progress FOR ALL
  USING (auth.uid() = user_id);
```

#### Code Changes

**File: `src/pages/Onboarding.tsx`**
- Replace `useLocalStorage` hooks with database reads/writes
- Add `useQuery` for initial load and `useMutation` for saves
- Implement cross-device sync indicator
- Auto-save form data on field changes (debounced)

**File: `src/hooks/useOnboardingProgress.ts`** (New)
```typescript
interface OnboardingProgress {
  currentStep: number;
  stepsCompleted: number[];
  formData: OnboardingFormData;
  lastActivityAt: Date;
}

export function useOnboardingProgress() {
  // Load from database on mount
  // Save changes with debounce
  // Track step completion
  // Handle offline/online sync
}
```

#### User Experience
- Progress bar shows completed steps from database
- "Continue where you left off" message on return
- Sync indicator showing save status
- Works seamlessly across devices

---

### 2. Smart Import Templates with Format Detection

**Current Problem**: Template detection only matches entity type by headers. Users may upload files from other rental software with different column naming conventions.

**Solution**: Add software-specific format detection to auto-suggest mappings for popular platforms.

#### Known Rental Software Formats to Support

| Software | Detection Signature | Mapping Strategy |
|----------|---------------------|------------------|
| **Rent Centric** | `rc_id`, `rc_customer_id` columns | Map `rc_*` prefixes |
| **HQ Rental** | `HQ-` prefixed columns | Strip prefix, normalize |
| **Navotar** | `nav_*` columns, specific date format | Custom date parser |
| **Fleet Complete** | `fc_vehicle_id` pattern | Strip prefix |
| **Generic Excel** | Standard column names | Current detection |

#### Implementation

**File: `src/lib/importFormatDetection.ts`** (New)
```typescript
interface DetectedFormat {
  software: string;
  confidence: number;
  suggestedMappings: ColumnMapping[];
  dateFormat: string;
  notes: string[];
}

export function detectImportFormat(headers: string[], sampleRows: Record<string, unknown>[]): DetectedFormat {
  // Check for software-specific signatures
  // Analyze date formats in sample data
  // Return best match with pre-configured mappings
}
```

**File: `src/components/import/FormatDetectionBanner.tsx`** (New)
- Show detected software with confidence
- "We detected this file may be from [Software]. Apply recommended mappings?"
- One-click mapping application

#### UI Enhancement

```text
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Format Detected                                              │
│                                                                 │
│ This looks like a Rent Centric export (92% confidence)         │
│                                                                 │
│ [Apply Rent Centric Mappings]    [Map Manually Instead]        │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Team Member Onboarding Path

**Current Problem**: Invited team members land on the full onboarding wizard even though the company is already set up. They need a streamlined path focused on their role.

**Solution**: Create a differentiated "Team Member Welcome" flow that skips business setup.

#### Logic Flow

```text
User accepts invitation email
        ↓
Check: Is user the team owner?
        ↓
    ┌───YES──────────────────NO───┐
    ↓                             ↓
Full Onboarding              Team Member Onboarding
(4 steps)                    (2 steps)
                                  ↓
                          ┌───────────────────┐
                          │ Step 1: Profile   │
                          │ - Name            │
                          │ - Phone           │
                          │ - Avatar upload   │
                          └───────────────────┘
                                  ↓
                          ┌───────────────────┐
                          │ Step 2: Tour      │
                          │ - Role-based tips │
                          │ - Quick tutorial  │
                          └───────────────────┘
                                  ↓
                            Dashboard
```

#### Implementation

**File: `src/pages/TeamMemberOnboarding.tsx`** (New)
- Lighter 2-step flow
- Profile completion form (name, phone, avatar)
- Role-specific tips (e.g., "As an Operator, you'll focus on bookings")
- Skip directly to interactive tour

**File: `src/contexts/AuthContext.tsx`**
- Modify `checkOnboardingStatus` to detect invited members
- Route to `/team-onboarding` instead of `/onboarding`

**File: `src/components/onboarding/RoleTips.tsx`** (New)
```typescript
const ROLE_TIPS: Record<AppRole, { title: string; tips: string[] }> = {
  operator: {
    title: "You're an Operator",
    tips: [
      "Create and manage bookings in the Book module",
      "Process vehicle pickups and returns",
      "Communicate with customers via the chat feature"
    ]
  },
  manager: {
    title: "You're a Manager",
    tips: [
      "Monitor fleet performance in Pulse",
      "Approve pending bookings",
      "Generate revenue reports"
    ]
  },
  // ... other roles
};
```

---

### 4. First Booking Quick-Start Flow

**Current Problem**: After onboarding, users see an empty dashboard. The path to creating a first booking requires navigating to Book module, understanding the calendar, etc.

**Solution**: Guided "Create First Booking" wizard that walks users through their first successful rental.

#### Trigger Points
1. Post-onboarding completion (if vehicles exist)
2. Empty state in Book module
3. Dashboard "Get Started" card

#### Quick-Start Wizard Steps

```text
Step 1: Select a Vehicle
┌─────────────────────────────────────────────────────────────┐
│ 🚗 Which vehicle is being rented?                           │
│                                                             │
│ ┌─────────────────┐  ┌─────────────────┐                   │
│ │ [BMW M4 image]  │  │ [Porsche image] │                   │
│ │ 2024 BMW M4     │  │ 2023 Porsche    │                   │
│ │ $450/day        │  │ $850/day        │                   │
│ │ [Select]        │  │ [Select]        │                   │
│ └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘

Step 2: Customer Info
┌─────────────────────────────────────────────────────────────┐
│ 👤 Who's renting?                                           │
│                                                             │
│ [Search existing customers...]                              │
│                                                             │
│ ─ OR ─                                                      │
│                                                             │
│ Quick Add:                                                  │
│ Name: [________________]                                    │
│ Phone: [________________]                                   │
│ Email: [________________] (optional)                        │
└─────────────────────────────────────────────────────────────┘

Step 3: Dates & Pickup
┌─────────────────────────────────────────────────────────────┐
│ 📅 When?                                                    │
│                                                             │
│ Pickup:  [Feb 1, 2026] [10:00 AM]                          │
│ Return:  [Feb 5, 2026] [5:00 PM]                           │
│                                                             │
│ Location: [Miami Airport ▼]                                 │
│                                                             │
│ Duration: 4 days = $1,800                                   │
└─────────────────────────────────────────────────────────────┘

Step 4: Confirm & Celebrate! 🎉
```

#### Implementation

**File: `src/components/booking/FirstBookingWizard.tsx`** (New)
- Self-contained multi-step dialog
- Simplified vehicle selection (cards, not table)
- Quick customer creation inline
- Smart date picker with availability check
- Confetti on completion

**File: `src/components/dashboard/DashboardOverviewEnhanced.tsx`**
- Add "Create Your First Booking" CTA card when `bookings.length === 0 && vehicles.length > 0`

#### Visual Celebration

On first booking completion:
- Confetti animation
- Achievement badge notification
- "Your fleet is officially in business!" message
- Direct link to view booking details

---

### 5. Import Batch History and Recovery

**Current Problem**: The `import_batches` table records imports but there's no UI to view past imports, retry failed ones, or understand what went wrong.

**Solution**: Build an Import History section with recovery actions.

#### UI Design

```text
┌─────────────────────────────────────────────────────────────────┐
│ Import History                                    [New Import]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Today                                                           │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ✅ bookings_import.csv           4 imported  0 failed       ││
│ │    Bookings • Jan 31, 2026 2:44 AM                          ││
│ │    [View Details] [Download Report]                         ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ⚠️ vehicles_import.csv           8 imported  2 failed       ││
│ │    Vehicles • Jan 31, 2026 1:23 AM                          ││
│ │    [View Failed Rows] [Retry Failed] [Download Report]      ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Yesterday                                                       │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ❌ customers_data.xlsx           0 imported  15 failed      ││
│ │    Customers • Jan 30, 2026 4:15 PM                         ││
│ │    Error: Missing required field 'email'                    ││
│ │    [View Errors] [Re-import] [Delete]                       ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Database Enhancement

```sql
-- Add more detail to import_batches
ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS column_mappings JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS failed_rows JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS original_file_url TEXT,
  ADD COLUMN IF NOT EXISTS can_retry BOOLEAN DEFAULT false;
```

#### Implementation

**File: `src/components/import/ImportHistory.tsx`** (New)
- List of past imports with status badges
- Expandable details showing success/fail breakdown
- Filter by entity type, date range, status

**File: `src/components/import/ImportBatchDetails.tsx`** (New)
- Full breakdown of import results
- Table of failed rows with error messages
- "Fix and Retry" functionality
- Download CSV of failed rows for offline fixing

**File: `src/hooks/useImportHistory.ts`** (New)
```typescript
export function useImportHistory(teamId: string) {
  // Fetch paginated import history
  // Group by date
  // Calculate stats
}
```

#### Recovery Actions

| Action | Description |
|--------|-------------|
| **View Failed Rows** | Table showing which rows failed and why |
| **Retry Failed** | Re-attempt failed rows with same mappings |
| **Download Failed CSV** | Export failed rows for manual fixing |
| **Re-import** | Open wizard pre-filled with original settings |
| **Delete** | Soft-delete import batch from history |

---

## Implementation Priority & Effort

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| 1. Database Progress | HIGH | Medium | Migration |
| 2. Smart Templates | MEDIUM | Medium | None |
| 3. Team Member Path | HIGH | Low | Invitation flow |
| 4. First Booking Wizard | MEDIUM | Medium | Vehicles exist |
| 5. Import History | LOW | Medium | Import batches table |

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useOnboardingProgress.ts` | Database-backed progress tracking |
| `src/pages/TeamMemberOnboarding.tsx` | Lightweight invited user flow |
| `src/lib/importFormatDetection.ts` | Software-specific format detection |
| `src/components/import/FormatDetectionBanner.tsx` | Show detected format |
| `src/components/import/ImportHistory.tsx` | Past imports list |
| `src/components/import/ImportBatchDetails.tsx` | Single import details |
| `src/components/booking/FirstBookingWizard.tsx` | Guided first booking |
| `src/components/onboarding/RoleTips.tsx` | Role-specific guidance |
| `src/hooks/useImportHistory.ts` | Fetch/manage import history |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Onboarding.tsx` | Replace localStorage with DB hooks |
| `src/contexts/AuthContext.tsx` | Detect invited members, route appropriately |
| `src/components/import/ImportWizard.tsx` | Add format detection step |
| `src/components/import/ColumnMapper.tsx` | Accept pre-filled mappings |
| `src/components/dashboard/DashboardOverviewEnhanced.tsx` | Add first booking CTA |

---

## Testing Checklist

### Onboarding Progress
- [ ] New user starts onboarding, progress saved to database
- [ ] User closes browser, returns - continues from same step
- [ ] User switches devices - progress synced
- [ ] Form data preserved between sessions

### Smart Templates
- [ ] Upload Rent Centric export - format detected
- [ ] Apply suggested mappings with one click
- [ ] Manual mapping still works

### Team Member Onboarding
- [ ] Invited user sees simplified 2-step flow
- [ ] Profile completion works
- [ ] Role-specific tips shown
- [ ] Redirects to dashboard after completion

### First Booking Wizard
- [ ] Appears on empty dashboard with vehicles
- [ ] Vehicle selection works
- [ ] Customer quick-add creates record
- [ ] Booking created successfully
- [ ] Confetti celebration fires

### Import History
- [ ] Past imports listed with status
- [ ] Failed rows viewable
- [ ] Retry failed rows works
- [ ] Download failed CSV generates file

