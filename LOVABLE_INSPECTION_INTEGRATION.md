# Lovable: Integrate Guided Inspection Widget

Copy this entire prompt into Lovable:

---

```
## Task: Integrate the Guided Inspection Widget into the Book Module

I need you to integrate the new `InspectionWidget` component into the Book module, creating a premium inspection experience that matches our luxury tech aesthetic.

### What Already Exists

1. **The InspectionWidget component** is already built at `src/components/inspections/InspectionWidget.tsx`
2. **The Inspections tab** already exists in `BookEnhanced.tsx` (line ~513)
3. **The database migration** has been applied - all tables and columns are ready

### Design Requirements

Follow our established design system:
- Use `card-premium` class for cards
- Use `btn-premium` class for primary CTAs
- Use `bg-muted/30 rounded-lg p-4` for info sections
- Use our semantic colors: `text-success`, `text-warning`, `text-destructive`
- Icons from lucide-react
- Smooth transitions with `transition-smooth` class
- Premium shadows with `shadow-premium` class

### What I Need You To Build

**1. Replace the Inspections Tab Content**

Replace the current basic inspection form in `BookEnhanced.tsx` (the `<TabsContent value="inspections">` section around line 513-533) with a new premium inspection hub that includes:

**A. Inspection Overview Dashboard**
- Stats row showing: Total Inspections (this month), Pending Reviews, Damage Items Flagged, Average Completion Time
- Use the same stat card pattern as the overview tab (grid layout, icons, clean numbers)

**B. Quick Action Cards (2-column grid on desktop, stack on mobile)**

Card 1: "Start Check-In Inspection"
- Icon: `ArrowDownToLine` or `LogIn`
- Description: "Vehicle arriving - document condition before handoff"
- Button: "Start Check-In" → Opens vehicle selector then launches InspectionWidget with direction="check_in"
- Visual: Subtle green accent border or glow

Card 2: "Start Check-Out Inspection"  
- Icon: `ArrowUpFromLine` or `LogOut`
- Description: "Vehicle departing - document condition at return"
- Button: "Start Check-Out" → Opens vehicle selector then launches InspectionWidget with direction="check_out"
- Visual: Subtle blue accent border

**C. Recent Inspections List**
- Show last 5 inspections from `vehicle_inspections` table
- Each row shows: Vehicle name, inspection type badge (check-in/check-out), date, photo count, damage count (if any, show in red badge)
- Click row → expand to show quick summary or navigate to full details
- Empty state: "No inspections yet. Start your first vehicle inspection above."

**D. Vehicle Selector Modal**
When user clicks "Start Check-In" or "Start Check-Out":
- Show a modal/dialog with searchable vehicle list
- Each vehicle shows: thumbnail (use VehicleThumbnail component), name, status, last inspection date
- Vehicles currently "rented" show at top for check-out
- Vehicles "available" show at top for check-in
- On select → close modal and open InspectionWidget with selected vehicle

**2. Integration Code**

Import the InspectionWidget:
```tsx
import { InspectionWidget } from '@/components/inspections';
```

The widget accepts these props:
```tsx
<InspectionWidget
  vehicleId={selectedVehicle.id}
  vehicleName={`${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`}
  bookingId={associatedBooking?.id} // optional - link to booking if applicable
  direction="check_in" // or "check_out"
  onComplete={() => refetchInspections()}
/>
```

**3. Data Fetching**

Add a query to fetch recent inspections:
```tsx
const { data: recentInspections } = useQuery({
  queryKey: ['recent-inspections'],
  queryFn: async () => {
    const { data } = await supabase
      .from('vehicle_inspections')
      .select(`
        *,
        vehicles(name, make, model, year),
        inspection_photos(id),
        inspection_damage_items(id, severity)
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    return data;
  }
});
```

**4. UI Polish**

- Add subtle animations when cards appear (use framer-motion if already imported)
- Inspection type badges: Check-In = green outline, Check-Out = blue outline
- Damage count badge: red background if severity includes "major", orange if "moderate", yellow if only "minor"
- Show "View All Inspections" link at bottom → future: could navigate to dedicated inspections page
- Mobile responsive: cards stack, stats become 2x2 grid

**5. Empty States**

Use our EmptyState component pattern:
```tsx
<EmptyState
  icon={ClipboardCheck}
  title="No Inspections Yet"
  description="Start documenting vehicle conditions with guided photo capture"
  action={{
    label: "Start First Inspection",
    onClick: () => setShowVehicleSelector(true)
  }}
/>
```

### Files to Modify

1. `src/components/dashboard/BookEnhanced.tsx` - Replace inspections tab content
2. May need to add state for vehicle selector modal
3. Import InspectionWidget from `@/components/inspections`

### DO NOT

- Do NOT modify the InspectionWidget component itself - it's already complete
- Do NOT modify the database schema - migration is done
- Do NOT create new pages - this lives in the existing Book module tab

### Visual Reference

The inspection hub should feel like a "mission control" for vehicle condition tracking:
- Clean, spacious layout
- Clear visual hierarchy (stats at top, actions in middle, history at bottom)
- Premium feel with subtle shadows and smooth interactions
- Matches the quality of the Overview tab in the same module

Make it feel premium, intuitive, and fast. This is a key differentiator for exotic car rental operations.
```

---

## After Lovable Completes This

Tell me and I'll:
1. Review the implementation
2. Test the integration
3. Make any refinements needed
