
# Fix Vehicle Thumbnails Not Showing Hero Images

## Problem

Vehicle thumbnails across multiple dashboard views (MotorIQ Fleet Performance, Bookings, Inspections, Damage Claims) are displaying the generic car icon placeholder instead of the actual hero images stored in the database.

The screenshot shows the Fleet Performance section where vehicles like "McLaren Artura Spider", "Cadillac Escalade Black", etc. show the placeholder icon, while "Aston Martin Vantage" shows correctly (because it happens to match the static image mapping).

## Root Cause

The `VehicleThumbnail` component has a **cascading resolution system**:
1. `imageUrl` prop (direct URL) → takes precedence
2. Static `vehicleImageMap` lookup by name → fallback
3. Generic car icon → final fallback

The issue is that **multiple components are not passing the `imageUrl` prop** to `VehicleThumbnail`, so it only tries the static mapping. Vehicles not in the static mapping (like "McLaren Artura Spider" or "Cadillac Escalade Black") fall back to the placeholder.

The database confirms that vehicles have `image_url` populated with signed storage URLs from their hero photos.

## Affected Components

| File | Line | Current Code | Missing |
|------|------|--------------|---------|
| `MotorIQEnhanced.tsx` | 432 | `<VehicleThumbnail vehicleName={vehicle.name} size="sm" />` | `imageUrl` |
| `BookEnhanced.tsx` | 345-350 | Complex lookup, no imageUrl | `imageUrl` |
| `BookEnhanced.tsx` | 448-450 | Only `vehicleName` | `imageUrl` |
| `InspectionsTab.tsx` | 198 | `vehicleName` only | `imageUrl` |
| `InspectionsTab.tsx` | 332-334 | Uses joined inspection data | `imageUrl` |
| `InspectionsTab.tsx` | 417 | `vehicleName` only | `imageUrl` |
| `DamageClaimsSection.tsx` | 219-221 | Uses found vehicle, no imageUrl | `imageUrl` |

## Solution

Add the `imageUrl` prop to all `VehicleThumbnail` usages, passing `vehicle.image_url` from the vehicle objects which are already available in each context.

---

## Technical Implementation

### File 1: `src/components/dashboard/MotorIQEnhanced.tsx`

**Line 432** - Fleet Performance vehicle cards:
```tsx
// Before:
<VehicleThumbnail vehicleName={vehicle.name} size="sm" />

// After:
<VehicleThumbnail 
  vehicleName={vehicle.name} 
  imageUrl={vehicle.image_url} 
  size="sm" 
/>
```

### File 2: `src/components/dashboard/BookEnhanced.tsx`

**Lines 345-352** - Next booking feature card:
```tsx
// Before:
<VehicleThumbnail
  vehicleName={(() => {
    const vehicle = vehicles.find(v => v.id === nextBooking.vehicle_id);
    return vehicle ? vehicle.name : nextBooking.vehicle_name || 'Unknown Vehicle';
  })()}
  size="lg"
  onClick={...}
/>

// After - also pass imageUrl:
<VehicleThumbnail
  vehicleName={(() => {
    const vehicle = vehicles.find(v => v.id === nextBooking.vehicle_id);
    return vehicle ? vehicle.name : nextBooking.vehicle_name || 'Unknown Vehicle';
  })()}
  imageUrl={vehicles.find(v => v.id === nextBooking.vehicle_id)?.image_url}
  size="lg"
  onClick={...}
/>
```

**Lines 448-453** - Today's bookings list:
```tsx
// Before:
<VehicleThumbnail
  vehicleName={getVehicleDisplay(booking)}
  size="avatar"
  onClick={...}
  className="flex-shrink-0 mt-0.5"
/>

// After:
<VehicleThumbnail
  vehicleName={getVehicleDisplay(booking)}
  imageUrl={vehicles.find(v => v.id === booking.vehicle_id)?.image_url}
  size="avatar"
  onClick={...}
  className="flex-shrink-0 mt-0.5"
/>
```

### File 3: `src/components/dashboard/InspectionsTab.tsx`

**Line 198** - Selected vehicle for inspection:
```tsx
// Before:
<VehicleThumbnail vehicleName={selectedInspectionVehicle.name} size="lg" />

// After:
<VehicleThumbnail 
  vehicleName={selectedInspectionVehicle.name} 
  imageUrl={selectedInspectionVehicle.image_url} 
  size="lg" 
/>
```

**Lines 332-336** - Recent inspections list (uses joined data with vehicles):
```tsx
// Before:
<VehicleThumbnail
  vehicleName={getVehicleDisplayName(inspection.vehicles)}
  size="avatar"
  className="flex-shrink-0"
/>

// After - extract image_url from joined vehicle data:
<VehicleThumbnail
  vehicleName={getVehicleDisplayName(inspection.vehicles)}
  imageUrl={inspection.vehicles?.image_url}
  size="avatar"
  className="flex-shrink-0"
/>
```

**Line 417** - Vehicle selector modal:
```tsx
// Before:
<VehicleThumbnail vehicleName={vehicle.name} size="avatar" />

// After:
<VehicleThumbnail 
  vehicleName={vehicle.name} 
  imageUrl={vehicle.image_url} 
  size="avatar" 
/>
```

### File 4: `src/components/dashboard/DamageClaimsSection.tsx`

**Lines 219-224** - Damage claims list:
```tsx
// Before:
<VehicleThumbnail 
  vehicleName={vehicle?.name || ''} 
  size="avatar"
  onClick={...}
  className="flex-shrink-0"
/>

// After:
<VehicleThumbnail 
  vehicleName={vehicle?.name || ''} 
  imageUrl={vehicle?.image_url}
  size="avatar"
  onClick={...}
  className="flex-shrink-0"
/>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/MotorIQEnhanced.tsx` | Add `imageUrl={vehicle.image_url}` to Fleet Performance thumbnails |
| `src/components/dashboard/BookEnhanced.tsx` | Add `imageUrl` lookups to 2 thumbnail instances |
| `src/components/dashboard/InspectionsTab.tsx` | Add `imageUrl` to 3 thumbnail instances |
| `src/components/dashboard/DamageClaimsSection.tsx` | Add `imageUrl={vehicle?.image_url}` to damage claim thumbnails |

---

## Expected Result

After the fix:
- All vehicle thumbnails will display the actual hero photo from the database
- Vehicles with uploaded photos will show their custom images
- The cascading resolution will work correctly: database URL → static mapping → placeholder
- Consistent image display across all dashboard views

