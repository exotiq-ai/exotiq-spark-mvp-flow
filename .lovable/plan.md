# Mobile calendar drawer + Google Calendar cancellation & pickup sync

Two independent fixes to the Booking module, both scoped small.

---

## 1. Mobile day drawer — fit the screen and scroll

**What happens today:** On mobile, tapping a day on the calendar opens a bottom drawer listing that day's reservations. The drawer is capped at `70vh` but its inner scroll container never actually scrolls — long lists get cut off and there's no way to reach the reservations at the bottom.

**Fix (visual only, no logic changes):**
- `DrawerContent`: switch from `max-h-[70vh]` to a proper flex column — `flex flex-col max-h-[85vh]` — so the header stays pinned and the list gets the remaining height.
- `DrawerHeader`: add `flex-shrink-0` so it doesn't get squeezed.
- `ScrollArea` inside the drawer: replace `flex-1` alone with `flex-1 min-h-0` so the browser actually gives it a bounded height to scroll inside.
- Same `min-h-0` fix on the desktop side-panel `ScrollArea` (`h-[calc(100vh-320px)]`) which has the same latent issue on shorter laptop screens.

Users will be able to scroll through all reservations on a busy day, and the drawer never overflows past the viewport.

File touched: `src/components/dashboard/BookingCalendar.tsx` (lines 1001, 1018–1041).

---

## 2. Google Calendar — sync cancellations and carry pickup info

**Why cancellations don't sync today:** When a booking is cancelled, we call `updateBookingDetails({ status: 'cancelled' })`, which fires the sync as `action: "update"`. The edge function then re-writes the same Google event with a red color (`colorId: 11`) but leaves it on the calendar. So on Google it looks like a still-scheduled event, just red — easy to miss, and it still blocks the timeslot visually for anyone glancing at Google Calendar.

**Is this "normal"?** No — this is a bug in our sync, not a Google limitation. Google Calendar fully supports event deletion via the API. Our own code path just never asks for it on cancel.

**Fix (three small changes):**

**A. Delete the Google event when a booking is cancelled/declined/no-show.**
In `FleetContext.updateBookingDetails`, before firing the sync, check if the incoming `updates.status` is `cancelled`, `declined`, or `no_show`. If so, send `action: "delete"` instead of `"update"`. This mirrors the logic already used in the cancel-booking path (line 969) and closes the gap when cancellation happens via inline edit rather than the dedicated cancel action.

**B. Sync vehicle changes.**
`updateBookingVehicle` currently updates the DB but never touches Google Calendar, so swapping the car leaves the Google event showing the old vehicle name in the title. Add a `syncBookingToGCal("update", bookingId, teamId)` call after a successful update, matching the pattern in `updateBookingDetails`.

**C. Include pickup/return times and locations in the Google event.**
In `supabase/functions/gcal-sync/index.ts`, extend the event body:
- Prepend the description with `Pickup: <pickup_time> @ <pickup_location>` and `Return: <return_time> @ <return_location>` lines (only render lines whose fields exist).
- Keep the event as all-day (`start.date` / `end.date`) — we don't have reliable timezone data per booking yet, so promoting to timed events risks wrong hours across time zones. All the pickup detail lives in the description where dispatchers actually read it.

Files touched:
- `src/contexts/FleetContext.tsx` — `updateBookingDetails` (add status-aware action), `updateBookingVehicle` (add sync call).
- `supabase/functions/gcal-sync/index.ts` — extend event `description`.

---

## Explicitly out of scope (revisit later if you want)

- Promoting Google events to timed events with a proper team timezone. Needs a `teams.timezone` field and UI to set it; worth a dedicated pass.
- Two-way sync (changes made in Google Calendar flowing back to Exotiq). Requires a webhook/watch channel and conflict rules — a real project on its own.
- A manual "Resync this team's calendar" admin action. Useful, but only after we see whether the fixes above cover the day-to-day pain.

## Verification

1. On mobile viewport, open a day with 6+ bookings → drawer opens at ~85vh and scrolls smoothly to the last item.
2. Cancel a booking via the inline edit menu → in Google Calendar, the event disappears (not just turns red). Edge function log shows `action=delete`.
3. Change a booking's assigned vehicle → Google event title updates to the new vehicle name within a few seconds.
4. Open any synced event in Google Calendar → description shows Pickup/Return time + location lines above Customer/Notes.
