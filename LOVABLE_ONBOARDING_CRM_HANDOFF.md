# Loveable Handoff: Onboarding & CRM Enterprise Readiness

**Date:** January 30, 2026  
**Priority:** P0 - Ship Tomorrow  
**Scope:** Streamline onboarding, remove hardcoded data, production-ready CRM

---

## Executive Summary

This sprint focuses on making the onboarding flow and CRM features production-ready:
1. Remove ALL hardcoded/fake data for non-demo accounts
2. Add bulk import option to onboarding
3. Enhance import wizard with duplicate detection
4. Implement real AI insights from actual fleet data
5. Smart post-import navigation

---

## Phase 1: Demo Account Flag (CRITICAL - Do First)

### Database Change Required

Add `is_demo_account` boolean to `teams` table:

```sql
-- Migration: Add demo account flag to teams
ALTER TABLE teams ADD COLUMN is_demo_account BOOLEAN DEFAULT false;

-- Set the demo account (hello@exotiq.ai's team)
UPDATE teams 
SET is_demo_account = true 
WHERE id = (
  SELECT team_id FROM team_members 
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hello@exotiq.ai')
  LIMIT 1
);
```

### Frontend Implementation

Create a hook to check demo status:

**File:** `src/hooks/useDemoAccount.ts`
```typescript
import { useTeam } from '@/contexts/TeamContext';

export const useDemoAccount = () => {
  const { currentTeam } = useTeam();
  return currentTeam?.is_demo_account ?? false;
};
```

Update `TeamContext` to include the new field in team fetching.

### Usage Pattern

```tsx
const isDemoAccount = useDemoAccount();

// Only show placeholder/demo content for demo accounts
{isDemoAccount ? <DemoContent /> : <RealContent />}
```

---

## Phase 2: Remove Hardcoded Data

### Files to Update

| File | What to Change | Action |
|------|---------------|--------|
| `src/components/dashboard/Core.tsx` | `aiInsights` array (lines 20-45) | Replace with real data or hide when empty |
| `src/components/dashboard/Core.tsx` | `systemAlerts` array (lines 47-78) | Replace with real notifications |
| `src/components/dashboard/Core.tsx` | `performanceMetrics` array (lines 89-94) | Calculate from real data |
| `src/components/dashboard/CRMSection.tsx` | "+12%" hardcoded (line 110) | Calculate actual growth |
| `src/components/dashboard/MotorIQEnhanced.tsx` | "$47,230" (line 344) | Use real revenue data |
| `src/components/dashboard/PaymentTracker.tsx` | "+12%" hardcoded (line 134) | Calculate actual growth |
| `src/components/common/UnifiedNotificationCenter.tsx` | "$2,100" payment (line 90) | Use real notification data |

### Core.tsx - AI Insights Replacement

Replace the hardcoded `aiInsights` array with a component that:
1. Uses the existing `useFleetAIInsight` hook
2. Queries `rari_insights` table for stored insights
3. Shows empty state when no data

```tsx
// Instead of hardcoded array, use:
const { vehicles, bookings } = useLocationFilteredFleet();
const fleetInsight = useFleetAIInsight(vehicles, bookings);

// For stored insights:
const { data: storedInsights } = useQuery({
  queryKey: ['rari-insights', user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('rari_insights')
      .select('*')
      .eq('is_read', false)
      .eq('is_dismissed', false)
      .order('priority', { ascending: true })
      .limit(5);
    return data;
  }
});

// Combine real-time insight with stored insights
const aiInsights = [
  ...(fleetInsight ? [formatFleetInsight(fleetInsight)] : []),
  ...(storedInsights || []).map(formatStoredInsight)
];

// If empty, show empty state or hide section
if (aiInsights.length === 0 && !isDemoAccount) {
  return <EmptyInsightsState />;
}
```

### CRMSection.tsx - Real Growth Calculation

```tsx
// Calculate actual growth from customer data
const calculateGrowth = (customers: Customer[]) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
  const sixtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
  
  const currentPeriod = customers.filter(c => 
    new Date(c.created_at) > thirtyDaysAgo
  ).length;
  
  const previousPeriod = customers.filter(c => 
    new Date(c.created_at) > sixtyDaysAgo && 
    new Date(c.created_at) <= thirtyDaysAgo
  ).length;
  
  if (previousPeriod === 0) return null;
  return Math.round(((currentPeriod - previousPeriod) / previousPeriod) * 100);
};

const growth = calculateGrowth(customers);

// In render:
{growth !== null && (
  <span className={`text-xs ${growth >= 0 ? 'text-success' : 'text-destructive'}`}>
    {growth >= 0 ? '+' : ''}{growth}%
  </span>
)}
```

---

## Phase 3: Onboarding Bulk Import Option

### Update `src/pages/Onboarding.tsx`

Replace Step 3 with a choice screen:

```tsx
{/* Step 3: Add Fleet - Choice Screen */}
{step === 3 && !isEditMode && (
  <motion.div key="step3" /* ... */>
    <div className="text-center">
      <Car className="w-16 h-16 mx-auto mb-4 text-primary" />
      <h2 className="text-2xl font-bold mb-2">Add Your Fleet</h2>
      <p className="text-muted-foreground">
        How would you like to add your vehicles?
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
      {/* Bulk Import Option */}
      <Card 
        className="p-6 cursor-pointer hover:border-primary transition-colors"
        onClick={() => setShowBulkImport(true)}
      >
        <Upload className="w-10 h-10 text-primary mb-4" />
        <h3 className="font-semibold mb-2">Bulk Import</h3>
        <p className="text-sm text-muted-foreground">
          Upload a CSV or Excel file with your fleet data
        </p>
        <Badge className="mt-3">Recommended</Badge>
      </Card>

      {/* Single Vehicle Option */}
      <Card 
        className="p-6 cursor-pointer hover:border-primary transition-colors"
        onClick={() => setShowSingleVehicle(true)}
      >
        <Car className="w-10 h-10 text-primary mb-4" />
        <h3 className="font-semibold mb-2">Add Manually</h3>
        <p className="text-sm text-muted-foreground">
          Enter vehicle details one at a time
        </p>
      </Card>
    </div>

    {/* Add from Photos - Premium Option */}
    <Card 
      className="p-6 cursor-pointer hover:border-accent transition-colors bg-gradient-to-r from-accent/5 to-primary/5"
      onClick={() => setShowPhotoUpload(true)}
    >
      <div className="flex items-center gap-4">
        <Camera className="w-10 h-10 text-accent" />
        <div>
          <h3 className="font-semibold mb-1">Add from Photos</h3>
          <p className="text-sm text-muted-foreground">
            Upload vehicle photos - AI extracts make, model, and details automatically
          </p>
        </div>
        <Sparkles className="w-6 h-6 text-accent ml-auto" />
      </div>
    </Card>

    <Button
      variant="ghost"
      onClick={handleSkipVehicle}
      className="w-full mt-6 text-muted-foreground"
    >
      Skip for now — I'll add vehicles later
    </Button>
  </motion.div>
)}
```

### Import Wizard Integration in Onboarding

When bulk import is selected, show the `ImportWizard` component in a dialog:

```tsx
<Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
  <DialogContent className="max-w-4xl max-h-[90vh]">
    <DialogHeader>
      <DialogTitle>Import Your Fleet</DialogTitle>
      <DialogDescription>
        Upload your vehicle data from CSV or Excel
      </DialogDescription>
    </DialogHeader>
    <ImportWizard 
      onClose={() => setShowBulkImport(false)}
      onComplete={(entityType, count) => {
        setShowBulkImport(false);
        toast({
          title: "Import Complete!",
          description: `${count} vehicles added to your fleet`
        });
        setStep(4); // Move to completion
      }}
    />
  </DialogContent>
</Dialog>
```

---

## Phase 4: Import Wizard Enhancements

### 4.1 Duplicate Detection

Add a pre-import duplicate check step between "Preview" and "Import":

**New File:** `src/lib/importDuplicateCheck.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';
import { ImportEntityType } from './importSchemas';

export interface DuplicateMatch {
  importRow: number;
  importData: Record<string, unknown>;
  existingRecord: Record<string, unknown>;
  matchField: string;
  matchValue: string;
}

export interface DuplicateCheckResult {
  duplicates: DuplicateMatch[];
  newRecords: Record<string, unknown>[];
}

export async function checkForDuplicates(
  rows: Record<string, unknown>[],
  entityType: ImportEntityType,
  teamId: string
): Promise<DuplicateCheckResult> {
  const duplicates: DuplicateMatch[] = [];
  const newRecords: Record<string, unknown>[] = [];
  
  // Get unique field values to check
  const uniqueFields = getUniqueFieldsForEntity(entityType);
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let isDuplicate = false;
    
    for (const field of uniqueFields) {
      const value = row[field];
      if (!value) continue;
      
      // Query for existing record
      const { data: existing } = await supabase
        .from(entityType)
        .select('*')
        .eq('team_id', teamId)
        .eq(field, value)
        .single();
      
      if (existing) {
        duplicates.push({
          importRow: i + 2, // +2 for header and 0-index
          importData: row,
          existingRecord: existing,
          matchField: field,
          matchValue: String(value)
        });
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      newRecords.push(row);
    }
  }
  
  return { duplicates, newRecords };
}

function getUniqueFieldsForEntity(entityType: ImportEntityType): string[] {
  switch (entityType) {
    case 'vehicles':
      return ['vin', 'license_plate'];
    case 'customers':
      return ['email'];
    case 'bookings':
      return []; // Bookings don't have unique constraint
    case 'locations':
      return ['name'];
    default:
      return [];
  }
}
```

### 4.2 Duplicate Resolution UI

**New File:** `src/components/import/DuplicateResolver.tsx`

```tsx
interface DuplicateResolverProps {
  duplicates: DuplicateMatch[];
  onResolve: (resolutions: Map<number, 'skip' | 'overwrite' | 'merge'>) => void;
}

export function DuplicateResolver({ duplicates, onResolve }: DuplicateResolverProps) {
  const [resolutions, setResolutions] = useState<Map<number, 'skip' | 'overwrite' | 'merge'>>(new Map());
  const [applyToAll, setApplyToAll] = useState<'skip' | 'overwrite' | 'merge' | null>(null);

  // ... UI implementation showing side-by-side comparison
  // with Skip / Overwrite / Merge options for each duplicate
}
```

### 4.3 Booking-to-Customer/Vehicle Linking

When importing bookings, add a linking step:

```typescript
// In ImportWizard.tsx, before performImport for bookings:
if (selectedEntity === 'bookings') {
  // Try to link customer_email to existing customers
  const linkedRows = await linkBookingsToExistingRecords(
    validationResult.validRows,
    teamId
  );
  // linkedRows will have customer_id and vehicle_id populated
}
```

**Linking Function:**

```typescript
async function linkBookingsToExistingRecords(
  rows: Record<string, unknown>[],
  teamId: string
): Promise<Record<string, unknown>[]> {
  // Fetch all customers and vehicles for this team
  const { data: customers } = await supabase
    .from('customers')
    .select('id, email, full_name')
    .eq('team_id', teamId);
    
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, name, vin')
    .eq('team_id', teamId);
  
  return rows.map(row => {
    const linkedRow = { ...row };
    
    // Link customer by email
    if (row.customer_email) {
      const customer = customers?.find(c => 
        c.email.toLowerCase() === String(row.customer_email).toLowerCase()
      );
      if (customer) linkedRow.customer_id = customer.id;
    }
    
    // Link vehicle by name or VIN
    if (row.vehicle_name || row.vin) {
      const vehicle = vehicles?.find(v => 
        v.name?.toLowerCase() === String(row.vehicle_name).toLowerCase() ||
        v.vin === row.vin
      );
      if (vehicle) linkedRow.vehicle_id = vehicle.id;
    }
    
    return linkedRow;
  });
}
```

---

## Phase 5: Smart Post-Import Navigation

After successful import, navigate to the relevant module:

```typescript
// In ImportWizard.tsx onComplete handler:
const navigateAfterImport = (entityType: ImportEntityType, count: number) => {
  const routes: Record<ImportEntityType, string> = {
    vehicles: '/dashboard?tab=fleet',
    customers: '/dashboard?tab=book&subtab=crm',
    bookings: '/dashboard?tab=book&subtab=calendar',
    locations: '/dashboard?tab=settings'
  };
  
  toast({
    title: "Import Complete!",
    description: `${count} ${entityType} added successfully`,
    action: (
      <Button variant="outline" size="sm" onClick={() => navigate(routes[entityType])}>
        View {entityType}
      </Button>
    )
  });
  
  // Auto-navigate after 2 seconds
  setTimeout(() => navigate(routes[entityType]), 2000);
};
```

---

## Phase 6: Real AI Insights System

### Replace Hardcoded Insights with Real Data

The codebase already has excellent AI infrastructure:
- `useFleetAIInsight` hook - Calculates pricing opportunities
- `rari_insights` table - Stores AI-generated insights
- Edge functions for AI analysis

### Create Unified Insights Component

**File:** `src/components/dashboard/RealAIInsights.tsx`

```tsx
import { useFleetAIInsight } from '@/hooks/useFleetAIInsight';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { useDemoAccount } from '@/hooks/useDemoAccount';

// Types of real insights to generate
interface RealInsight {
  id: string;
  type: 'pricing' | 'utilization' | 'retention' | 'maintenance' | 'compliance';
  title: string;
  description: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  confidence: number;
}

export function RealAIInsights() {
  const { vehicles, bookings, customers } = useLocationFilteredFleet();
  const isDemoAccount = useDemoAccount();
  
  // Generate insights from real data
  const insights = useMemo(() => {
    const result: RealInsight[] = [];
    
    // 1. Pricing insight from useFleetAIInsight
    const pricingInsight = useFleetAIInsight(vehicles, bookings);
    if (pricingInsight) {
      result.push({
        id: `pricing-${pricingInsight.vehicleId}`,
        type: 'pricing',
        title: 'Pricing Optimization',
        description: `${pricingInsight.vehicleName} could support a ${pricingInsight.suggestedIncreasePercent}% rate increase`,
        impact: `+$${pricingInsight.potentialMonthlyRevenue}/month`,
        priority: 'high',
        action: 'Review pricing',
        confidence: pricingInsight.confidence
      });
    }
    
    // 2. Underutilized vehicles
    const idleVehicles = vehicles.filter(v => 
      (v.utilization || 0) < 20 && v.status === 'available'
    );
    if (idleVehicles.length > 0) {
      result.push({
        id: 'utilization-low',
        type: 'utilization',
        title: 'Low Utilization Alert',
        description: `${idleVehicles.length} vehicle${idleVehicles.length > 1 ? 's' : ''} under 20% utilization this month`,
        impact: 'Revenue opportunity',
        priority: idleVehicles.length > 2 ? 'high' : 'medium',
        action: 'Consider promotion',
        confidence: 85
      });
    }
    
    // 3. VIP customer retention
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const inactiveVIPs = customers.filter(c => {
      if (c.customer_status !== 'vip') return false;
      const lastBooking = bookings
        .filter(b => b.customer_id === c.id)
        .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
      return !lastBooking || new Date(lastBooking.end_date) < thirtyDaysAgo;
    });
    
    if (inactiveVIPs.length > 0) {
      result.push({
        id: 'retention-vip',
        type: 'retention',
        title: 'VIP Retention Risk',
        description: `${inactiveVIPs.length} VIP customer${inactiveVIPs.length > 1 ? 's haven\'t' : ' hasn\'t'} booked in 30+ days`,
        impact: 'Customer retention',
        priority: 'high',
        action: 'Reach out',
        confidence: 80
      });
    }
    
    // 4. Upcoming maintenance (if maintenance_date field exists)
    const upcomingMaintenance = vehicles.filter(v => {
      if (!v.next_maintenance_date) return false;
      const maintenanceDate = new Date(v.next_maintenance_date);
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      return maintenanceDate <= sevenDaysFromNow;
    });
    
    if (upcomingMaintenance.length > 0) {
      result.push({
        id: 'maintenance-upcoming',
        type: 'maintenance',
        title: 'Maintenance Due',
        description: `${upcomingMaintenance.length} vehicle${upcomingMaintenance.length > 1 ? 's need' : ' needs'} service in the next 7 days`,
        impact: 'Fleet readiness',
        priority: 'medium',
        action: 'Schedule service',
        confidence: 95
      });
    }
    
    return result;
  }, [vehicles, bookings, customers]);
  
  // Empty state for non-demo accounts with no data
  if (insights.length === 0 && !isDemoAccount) {
    return (
      <EmptyState
        icon={<Brain className="h-12 w-12" />}
        title="No insights yet"
        description="AI insights will appear here once you have fleet data"
      />
    );
  }
  
  // For demo accounts, show demo insights if no real data
  if (insights.length === 0 && isDemoAccount) {
    return <DemoInsights />;
  }
  
  return (
    <div className="space-y-4">
      {insights.map(insight => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
}
```

---

## Testing Checklist

### Demo Account Flag
- [ ] `hello@exotiq.ai` team shows demo content
- [ ] New signups get empty states (no demo content)
- [ ] All hardcoded data only shows for demo account

### Import Wizard
- [ ] Bulk import option appears in onboarding Step 3
- [ ] Duplicate detection catches existing records
- [ ] Merge/Skip/Overwrite options work correctly
- [ ] Booking import links to existing customers/vehicles
- [ ] Post-import navigates to correct module

### AI Insights
- [ ] Real insights generated from fleet data
- [ ] Empty state shows when no data
- [ ] Insights update when data changes
- [ ] No hardcoded vehicle names or dollar amounts

### Onboarding Flow
- [ ] Step 3 shows choice (Bulk Import / Manual / Photos)
- [ ] All three paths work correctly
- [ ] Skip option still available
- [ ] Progress saves between steps

---

## Files Changed Summary

### ✅ ALREADY BUILT BY CURSOR (Ready to Use)

| File | Change Type | Status |
|------|-------------|--------|
| `src/hooks/useDemoAccount.ts` | New file - Demo account detection hook | ✅ DONE |
| `src/contexts/TeamContext.tsx` | Added `is_demo_account` to Team interface | ✅ DONE |
| `src/lib/importDuplicateCheck.ts` | New file - Duplicate detection utility | ✅ DONE |
| `src/components/import/DuplicateResolver.tsx` | New file - Duplicate resolution UI | ✅ DONE |
| `src/components/dashboard/RealAIInsights.tsx` | New file - Real AI insights component | ✅ DONE |
| `src/pages/Onboarding.tsx` | Added bulk import choice to Step 3 | ✅ DONE |

### 🔧 FOR LOVEABLE TO COMPLETE

| File | Change Type | Priority |
|------|-------------|----------|
| `teams` table | Add `is_demo_account` BOOLEAN column (migration) | P0 |
| `src/components/dashboard/Core.tsx` | Replace hardcoded data with `RealAIInsights` | P0 |
| `src/components/dashboard/CRMSection.tsx` | Calculate real growth % | P0 |
| `src/components/dashboard/MotorIQEnhanced.tsx` | Use real revenue data | P0 |
| `src/components/dashboard/PaymentTracker.tsx` | Calculate real growth % | P0 |
| `src/components/import/ImportWizard.tsx` | Integrate duplicate check step | P1 |

---

## Quick Integration Guide

### Using the New Components

**1. Replace hardcoded AI Insights in Core.tsx:**
```tsx
// Replace the hardcoded aiInsights array with:
import { RealAIInsights } from '@/components/dashboard/RealAIInsights';

// In the render, replace the AI Insights card with:
<RealAIInsights maxInsights={5} onInsightAction={(insight) => {
  // Handle insight action (e.g., navigate to vehicle, open pricing dialog)
  console.log('Action on insight:', insight);
}} />
```

**2. Check for demo account anywhere:**
```tsx
import { useDemoAccount } from '@/hooks/useDemoAccount';

function MyComponent() {
  const isDemoAccount = useDemoAccount();
  
  return isDemoAccount ? <DemoContent /> : <RealContent />;
}
```

**3. Add duplicate checking to ImportWizard:**
```tsx
import { checkForDuplicates, applyDuplicateResolutions } from '@/lib/importDuplicateCheck';
import { DuplicateResolver } from '@/components/import/DuplicateResolver';

// After validation, before import:
const duplicateResult = await checkForDuplicates(
  validationResult.validRows,
  selectedEntity,
  currentTeam.id
);

if (duplicateResult.duplicates.length > 0) {
  // Show DuplicateResolver component
  // On resolve, call applyDuplicateResolutions()
}
```

---

## Questions for Loveable

1. **Team Schema Access:** Can you confirm the `teams` table exists and add the `is_demo_account` column?

2. **hello@exotiq.ai Team ID:** What is the team_id for the demo account? We need this for the migration.

3. **Photo Hub Integration:** The `AddVehicleFromPhotoWizard` component exists - should we integrate it into onboarding Step 3?

4. **AI Insight Storage:** Should insights generated in `RealAIInsights` also be stored in `rari_insights` table for persistence?

---

**Ready for implementation!** 🚀
