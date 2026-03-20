

# Google Calendar Sync — Full Implementation Plan

## Overview

Build a one-way Google Calendar sync (Exotiq → Google) per tenant. When bookings are created, updated, or cancelled, events are automatically pushed to a dedicated "Exotiq Calendar - [Business Name]" calendar in the connected Google account.

## Step 1: Store Secrets

Add two secrets via the `add_secret` tool:
- `GOOGLE_CALENDAR_CLIENT_ID` = `121670421485-ds6jcfs3dl0ob5bgq37772fha1083ji6.apps.googleusercontent.com`
- `GOOGLE_CALENDAR_CLIENT_SECRET` = `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`

## Step 2: Database Migration

Add `google_calendar_event_id` column to `bookings`:

```sql
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
```

## Step 3: Edge Functions (3 new)

### `gcal-auth` — Initiate OAuth Flow
- Accepts `team_id` in POST body
- Validates user is team admin/owner via auth token
- Builds Google OAuth URL with:
  - `scope`: `https://www.googleapis.com/auth/calendar`
  - `redirect_uri`: `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/gcal-callback`
  - `state`: JSON with `team_id` + `user_id`
  - `access_type`: `offline` (for refresh token)
  - `prompt`: `consent` (ensures refresh token returned)
- Returns the OAuth URL for frontend to redirect to

### `gcal-callback` — Handle OAuth Redirect
- Receives `code` and `state` from Google
- Exchanges code for access + refresh tokens
- Creates a secondary calendar named "Exotiq Calendar - [Team Name]" via Calendar API
- Stores tokens + calendar ID in `team_integrations`:
  ```json
  {
    "integration_type": "google_calendar",
    "config": {
      "access_token": "ya29...",
      "refresh_token": "1//...",
      "token_expiry": "2026-03-20T18:00:00Z",
      "calendar_id": "abc123@group.calendar.google.com",
      "connected_email": "user@example.com",
      "calendar_name": "Exotiq Calendar - MPH Club"
    }
  }
  ```
- Redirects user back to dashboard settings with success param

### `gcal-sync` — Create/Update/Delete Events
- Accepts: `{ action: 'create'|'update'|'delete', booking_id, team_id }`
- Fetches integration tokens from `team_integrations`
- Auto-refreshes expired access tokens using refresh token
- Maps booking data to Google Calendar event format:
  - Title: `[Vehicle] - [Customer Name]`
  - Location: pickup location
  - Description: booking details, total, notes
  - Start/End: booking dates
- On create: creates event, stores `google_calendar_event_id` on booking
- On update: updates existing event via event ID
- On delete: deletes event from calendar
- Updates `last_used_at` on the integration record

## Step 4: Frontend Changes

### `IntegrationsSection.tsx` — Complete Rewrite
- **Remove all hardcoded fake data** (fake Stripe "Connected", fake Google Maps "Live", fake API key section)
- **Google Calendar card**: Real connect/disconnect backed by `team_integrations` table
  - Disconnected: "Connect Google Calendar" button → calls `gcal-auth` → redirects to Google
  - Connected: Shows connected email, last sync time, "Sync Now" and "Disconnect" buttons
- **Other integrations** (Stripe, Twilio, DocuSign, Maps): Show as "Coming Soon" with disabled buttons
- **AI Services**: Keep as "Active" (real)
- **Remove fake API key section entirely**
- Query `team_integrations` on mount to get real Google Calendar connection status

### `FleetContext.tsx` — Auto-sync on booking mutations
After `createBooking` succeeds (line ~896): call `gcal-sync` with `action: 'create'`
After `updateBookingStatus` succeeds: call `gcal-sync` with `action: 'update'` (or `delete` if cancelled)
After `updateBookingDetails` succeeds: call `gcal-sync` with `action: 'update'`

All sync calls are fire-and-forget (don't block the UI or show errors for sync failures).

### Dashboard Settings — Handle OAuth Callback
Add URL param detection in settings page: if `?gcal=success`, show toast "Google Calendar connected successfully"

## Step 5: Config

Add to `supabase/config.toml`:
```toml
[functions.gcal-auth]
verify_jwt = false

[functions.gcal-callback]
verify_jwt = false

[functions.gcal-sync]
verify_jwt = false
```

## Files Changed

| File | Action |
|------|--------|
| `supabase/functions/gcal-auth/index.ts` | Create |
| `supabase/functions/gcal-callback/index.ts` | Create |
| `supabase/functions/gcal-sync/index.ts` | Create |
| `supabase/config.toml` | Add 3 function blocks |
| `src/components/dashboard/settings/IntegrationsSection.tsx` | Rewrite — real Google Calendar connect/disconnect, remove all fake data |
| `src/contexts/FleetContext.tsx` | Add gcal-sync calls after booking create/update/cancel |
| Migration SQL | Add `google_calendar_event_id` to bookings |

## Security

- OAuth tokens stored in `team_integrations` with RLS (only team owners/admins can read/write)
- Refresh tokens never exposed to frontend — only edge functions access them via service role key
- Edge functions validate the calling user's team membership before syncing
- `gcal-callback` validates `state` parameter matches authenticated user

