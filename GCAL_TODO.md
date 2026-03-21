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

---
*Last updated: March 20, 2026*
