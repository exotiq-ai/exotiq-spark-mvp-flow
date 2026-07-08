## Goal
Clean up the reservation cards shown in the calendar day pop-out so the watermark car image no longer appears behind the card, while keeping the vehicle thumbnail on the left.

## What will change
- `src/components/dashboard/BookingCalendar.tsx` — inside the `DayDetailContent` booking list, remove the absolute-positioned, low-opacity background image (`w-20 h-full opacity-[0.07]`) that currently sits behind each card.
- The left-side vehicle thumbnail (`w-9 h-9 rounded-lg`) remains untouched.
- The card border, hover, and layout styling stay the same.

## Why
The user wants the booking cards to be less visually busy and to rely on the thumbnail as the vehicle photo reference.

## Out of scope
- No changes to the calendar grid itself, hover cards, or booking preview card.
- No changes to scroll behavior or mobile drawer sizing.
- No functional or data changes.