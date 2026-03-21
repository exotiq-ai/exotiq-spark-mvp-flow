
# Rate Tiers & Duration-Based Pricing — Phase 1

## Status: ✅ Implemented

### What's Done
- [x] DB migration: `rate_3hr`, `rate_6hr`, `rate_multiday` on vehicles; `rental_duration_type` on bookings; `min_rate` + `rental_buffer_minutes` on teams
- [x] `pricingUtils.ts`: `durationType` param (optional, defaults to 'daily'), helper functions `getRateForDuration`, `getAvailableDurations`, `getDurationLabel`
- [x] `validationSchemas.ts`: `rental_duration_type` enum + rate tier fields on vehicle schema
- [x] `RateTiersPanel.tsx`: New editable rate table in MotorIQ "Rate Tiers" tab
- [x] `MotorIQEnhanced.tsx`: 5th tab added
- [x] `NewBookingDialog.tsx`: Duration selector chips, rate-tier-aware pricing, "full day reservation" note for hourly
- [x] `FleetVehicleCard.tsx`: Rate tier badges (3h/6h indicators), updated Vehicle interface
- [x] `EnhancedBookingDialog.tsx`: Passes `durationType` to pricing
- [x] `EditBookingDialog.tsx`: Passes `durationType` to pricing
- [x] `RecordPaymentDialog.tsx`: Passes `durationType` to pricing
- [x] `TeamSettingsSection.tsx`: Min rate config field

### Key Design Decisions
- `current_rate` = 24hr/daily rate, NOT renamed (48+ references)
- `durationType` optional, defaults to 'daily' — zero-risk for existing callers
- Multiday threshold: hardcoded at 2+ calendar days
- Phase 1 time picker: informational only, no availability impact
- Rate floor: team-level setting via `useUserSettings`, default $100

### Phase 2 (Future)
- [ ] Timestamp-based availability engine (parallel to date-based)
- [ ] `start_time` / `end_time` columns on bookings
- [ ] Buffer time between hourly rentals using `rental_buffer_minutes`
- [ ] Feature-flagged rollout
- [ ] Utilization metrics updated for hourly rentals

---

# Google Calendar Integration — TODO

## Status: 🟡 Blocked — OAuth 403 Error

### What's Done ✅
- [x] Edge functions created: `gcal-auth`, `gcal-callback`, `gcal-sync`
- [x] Database migration: `google_calendar_event_id` column on bookings
- [x] Frontend: IntegrationsSection rewritten with real connect/disconnect
- [x] FleetContext: auto-sync on booking create/update/cancel
- [x] Secrets stored: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`
- [x] Config: `verify_jwt = false` for all 3 functions
- [x] Redirect URI set in Google Cloud Console

### What's Blocking ❌
- **403 `access_denied`** when Google redirects back after OAuth consent
- Google Cloud Project confirmed correct (Client ID `121670421485-...` matches)
- Redirect URI confirmed correct: `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/gcal-callback`

### Likely Fix (try these)
1. **OAuth Consent Screen → Test Users**: Add your Google account email to the test users list
2. **OR Publish the App**: Move OAuth consent screen from "Testing" to "Published"
3. **Enable Google Calendar API**: Go to APIs & Services → Library → search "Google Calendar API" → Enable

### Google Cloud Console Links
- OAuth Consent Screen: https://console.cloud.google.com/apis/credentials/consent
- Credentials: https://console.cloud.google.com/apis/credentials
- Calendar API: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
