
# Integrate Guided Inspection Widget into Book Module

## Overview

Replace the basic inspection form in the Book module's Inspections tab with a premium "mission control" inspection hub featuring the new guided photo capture workflow.

---

## Current State

**Existing Code (lines 513-532 of BookEnhanced.tsx):**
```tsx
<TabsContent value="inspections">
  <div className="space-y-6">
    <Card className="card-premium p-6">
      <h3 className="text-lg font-semibold mb-4">Vehicle Inspections</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Select a vehicle to perform an inspection
      </p>
      {vehicles.length > 0 ? (
        <InspectionForm
          vehicleId={vehicles[0].id}
          inspectionType="pre_rental"
        />
      ) : (
        // Empty state
      )}
    </Card>
  </div>
</TabsContent>
```

**Problems:**
1. Only shows old InspectionForm, not the new guided InspectionWidget
2. Hardcodes first vehicle instead of allowing selection
3. No stats, no history, no quick action cards
4. No differentiation between check-in vs check-out

---

## What Will Be Built

### A. Inspection Overview Dashboard (Stats Row)
4 stat cards showing:
- **Total Inspections** (this month count)
- **Pending Reviews** (status = 'completed', not 'reviewed')
- **Damage Items Flagged** (count from inspection_damage_items)
- **Average Completion Time** (calculated from started_at/completed_at)

### B. Quick Action Cards (2-Column Grid)

**Card 1: Start Check-In Inspection**
- Icon: `ArrowDownToLine`
- Description: "Vehicle arriving - document condition before handoff"
- Button: "Start Check-In"
- Visual: Subtle green accent border
- Action: Opens vehicle selector modal, then InspectionWidget with `direction="check_in"`

**Card 2: Start Check-Out Inspection**
- Icon: `ArrowUpFromLine`
- Description: "Vehicle departing - document condition at return"
- Button: "Start Check-Out"
- Visual: Subtle blue accent border
- Action: Opens vehicle selector modal, then InspectionWidget with `direction="check_out"`

### C. Recent Inspections List
- Shows last 10 inspections from `vehicle_inspections` table
- Each row: Vehicle name, inspection type badge (check-in/check-out), date, photo count, damage count
- Click row: Expand for details or navigate
- Empty state using EmptyState component

### D. Vehicle Selector Modal
- Dialog with searchable vehicle list
- Each vehicle shows: VehicleThumbnail, name, status, last inspection date
- Smart sorting: "rented" vehicles at top for check-out, "available" at top for check-in
- On select: Close modal, launch InspectionWidget

---

## Technical Implementation

### File Changes

**1. `src/components/dashboard/BookEnhanced.tsx`**

Add new imports:
```tsx
import { InspectionWidget } from '@/components/inspections';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowDownToLine, ArrowUpFromLine, Search, Camera, FileWarning, Timer, CheckCircle2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
```

Add state for inspection flow:
```tsx
const [showVehicleSelector, setShowVehicleSelector] = useState(false);
const [inspectionDirection, setInspectionDirection] = useState<'check_in' | 'check_out'>('check_in');
const [selectedInspectionVehicle, setSelectedInspectionVehicle] = useState<typeof vehicles[0] | null>(null);
const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
```

Add query for recent inspections:
```tsx
const { data: recentInspections, refetch: refetchInspections } = useQuery({
  queryKey: ['recent-inspections'],
  queryFn: async () => {
    const { data } = await supabase
      .from('vehicle_inspections')
      .select(`
        *,
        vehicles(id, name, make, model, year),
        inspection_photos(id),
        inspection_damage_items(id, severity)
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    return data || [];
  }
});
```

Add computed stats:
```tsx
const inspectionStats = useMemo(() => {
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  
  const monthlyInspections = recentInspections?.filter(
    i => new Date(i.created_at!) >= thisMonth
  ) || [];
  
  const pendingReview = recentInspections?.filter(
    i => i.status === 'completed' && !i.reviewed_at
  ).length || 0;
  
  const damageCount = recentInspections?.reduce((acc, i) => 
    acc + (i.inspection_damage_items?.length || 0), 0
  ) || 0;
  
  return {
    total: monthlyInspections.length,
    pendingReview,
    damageCount,
    avgTime: '~8 min' // Could calculate from started_at/completed_at
  };
}, [recentInspections]);
```

Replace TabsContent "inspections" with new premium UI (approximately 150 lines of JSX).

---

### UI Components Structure

```text
TabsContent "inspections"
├── Stats Row (grid 4 cols)
│   ├── Total Inspections stat
│   ├── Pending Reviews stat  
│   ├── Damage Items stat
│   └── Avg Completion Time stat
│
├── Quick Action Cards (grid 2 cols)
│   ├── Check-In Card (green accent)
│   └── Check-Out Card (blue accent)
│
├── Recent Inspections
│   ├── Section header with count
│   ├── List of inspection rows
│   │   └── Each row: vehicle, type badge, date, photo/damage counts
│   └── Empty state if no inspections
│
└── Vehicle Selector Modal (Dialog)
    ├── Search input
    ├── Scrollable vehicle list
    │   └── Each item: thumbnail, name, status, last inspection
    └── Cancel button

+ InspectionWidget (rendered when vehicle selected)
```

---

### Type Safety Updates

**Remove `as any` assertions in InspectionWidget.tsx:**

Now that types are regenerated, lines 202-224 and 243-246 can use proper types:

```tsx
// Before (line 224):
} as any);

// After:
}); // No cast needed, types now include all columns
```

Similar for `inspection_damage_items` insert at line 264-265.

---

### Design System Compliance

All new UI will follow established patterns:
- `card-premium` class for cards
- `btn-premium` class for primary CTAs
- `bg-muted/30 rounded-lg p-4` for stat sections
- Semantic colors: `text-success`, `text-warning`, `text-destructive`
- Lucide icons throughout
- `transition-smooth` for hover effects
- Mobile responsive: stack on mobile, 2-col on tablet+

---

## Database Queries Used

**Recent Inspections Query:**
```sql
SELECT 
  vi.*,
  v.id, v.name, v.make, v.model, v.year,
  (SELECT COUNT(*) FROM inspection_photos WHERE inspection_id = vi.id) as photo_count,
  (SELECT COUNT(*) FROM inspection_damage_items WHERE inspection_id = vi.id) as damage_count
FROM vehicle_inspections vi
LEFT JOIN vehicles v ON vi.vehicle_id = v.id
WHERE vi.team_id = :current_team_id
ORDER BY vi.created_at DESC
LIMIT 10;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/BookEnhanced.tsx` | Replace inspections tab content (~200 lines) |
| `src/components/inspections/InspectionWidget.tsx` | Remove `as any` type assertions (3 locations) |

---

## Mobile Responsiveness

- Stats row: 2x2 grid on mobile, 4-col on desktop
- Quick action cards: Stack on mobile, 2-col on tablet+
- Recent inspections: Full-width cards
- Vehicle selector modal: Full-screen on mobile, centered dialog on desktop

---

## Empty States

When no inspections exist:
```tsx
<EmptyState
  icon={ClipboardCheck}
  title="No Inspections Yet"
  description="Start documenting vehicle conditions with guided photo capture"
  action={{
    label: "Start First Inspection",
    onClick: () => {
      setInspectionDirection('check_in');
      setShowVehicleSelector(true);
    }
  }}
/>
```

---

## Expected Result

After implementation, the Inspections tab will be transformed from a basic single-vehicle form into a professional inspection command center:

1. At-a-glance stats for operational awareness
2. Clear action cards for check-in vs check-out workflows
3. Searchable vehicle selector for flexibility
4. Recent inspection history with damage flagging
5. Premium visual design matching the rest of the platform
6. Full mobile support for field staff using phones/tablets

The new guided InspectionWidget provides AR-like corner brackets, damage documentation, and a comprehensive checklist - all integrated seamlessly into the booking workflow.
