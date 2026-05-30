# Secret diff

## Referenced in edge functions but NOT configured
- `APP_URL`
- `FRONTEND_URL`
- `MCP_SECRET_TOKEN`

## Configured but NOT referenced in edge function source (may be used by frontend/connectors or stale)
- `PHOTOROOM_API_KEY`
- `VITE_GOOGLE_PLACES_API_KEY`

## Runtime-provided (do not need to be set as secrets)
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
