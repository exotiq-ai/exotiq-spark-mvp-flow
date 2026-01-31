
# Fix Three-Dot Menu on Errored Photos

## Problem

When a photo fails to load, the error fallback overlay covers the hover actions overlay (the three-dot dropdown menu). The fallback is positioned with `absolute inset-0` and sits on top of the dropdown, blocking all interactions.

Looking at the screenshot, the photos with broken images show the placeholder icon but no way to access the delete/manage menu.

## Root Cause

In `PhotoThumbnail` component (lines 526-537), when an image errors:
1. The image is hidden (`display: none`)
2. A fallback div is created with `absolute inset-0` class
3. This fallback is appended inside the container
4. The fallback sits on top of the hover actions overlay (z-index conflict)
5. Users cannot hover or click to access the dropdown menu

## Solution

Change the structure so the hover actions overlay always remains clickable:

1. **Add `z-index` to hover actions overlay** - Ensure it sits above the error fallback
2. **Add `pointer-events-none` to error fallback** - Allow clicks to pass through to the action buttons below

## Implementation

### File: `src/components/photos/VehiclePhotoManager.tsx`

**Change 1:** Update the hover actions overlay to have a higher z-index (line 565):

```tsx
{/* Hover Actions - add z-10 to ensure it's above fallback */}
<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
```

**Change 2:** Update the error fallback to not block pointer events (line 532-534):

```tsx
fallback.className = 'thumb-error-fallback absolute inset-0 flex items-center justify-center bg-muted pointer-events-none';
```

This ensures:
- The error fallback shows the "image unavailable" icon
- The hover overlay with the dropdown menu remains accessible
- Users can still delete, replace, or manage errored photos

## Files to Modify

| File | Change |
|------|--------|
| `src/components/photos/VehiclePhotoManager.tsx` | Add `z-10` to hover actions div, add `pointer-events-none` to error fallback |

## Expected Result

After the fix:
- Errored photos show the placeholder icon
- Hovering reveals the semi-transparent overlay with the three-dot button
- Clicking the menu shows Delete, Set as Hero, and other options
- Users can delete broken photos from the Photo Hub
