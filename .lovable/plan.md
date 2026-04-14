

# Fix: Ghost Calendar in New Booking Dialog

## Root Cause

In `src/components/dialogs/NewBookingDialog.tsx`:
- **Line 27**: `import { Calendar as CalendarIcon, ... } from 'lucide-react'` — icon aliased to `CalendarIcon`
- **Line 28**: `import { Calendar } from '@/components/ui/calendar'` — full datepicker component
- **Line 301**: `<Calendar className="h-5 w-5 text-primary" />` — uses the datepicker instead of the icon

The full month-grid calendar renders inline in the dialog header, overlaying the Vehicle/Customer fields.

## Fix

One-line change on line 301: replace `Calendar` with `CalendarIcon`.

```tsx
// Before
<Calendar className="h-5 w-5 text-primary" />

// After
<CalendarIcon className="h-5 w-5 text-primary" />
```

No other files affected. The Pickup/Return date popovers already correctly use the `Calendar` component inside their `PopoverContent`, so those are unaffected.

