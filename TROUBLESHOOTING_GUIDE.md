# EXOTIQ Rari Troubleshooting Guide

**Last Updated:** January 9, 2026  
**Status:** CRITICAL - Migration Required

---

## 🚨 THE SITUATION

There are **TWO Supabase projects** involved:

| Project ID | URL | Owner |
|------------|-----|-------|
| `jlgwbbqydjeokypoenoc` | `https://jlgwbbqydjeokypoenoc.supabase.co` | **LOVEABLE** - This is the production project |
| `mlfzduuclgdscdlztzdi` | `https://mlfzduuclgdscdlztzdi.supabase.co` | **CURSOR MCP** - This is where migrations were applied |

**The app is built on `jlgwbbqydjeokypoenoc` (Loveable's project).**

---

## ✅ WHAT NEEDS TO HAPPEN

### For Loveable:

1. **Apply the migration** from `LOVEABLE_APPLY_THIS_MIGRATION.sql` to the Supabase project
2. **Deploy the edge functions** from `supabase/functions/` to the project
3. **Add secrets** to Edge Functions:
   - `ELEVENLABS_API_KEY` - Your ElevenLabs API key

### The migration will:
- Create `teams`, `profiles`, `team_members` tables
- Add `team_id` column to core tables
- Create a demo team for unauthenticated access
- Set up proper RLS policies

---

## 📁 FILES FOR LOVEABLE

| File | Purpose |
|------|---------|
| `LOVEABLE_APPLY_THIS_MIGRATION.sql` | **RUN THIS** - All schema changes in one file |
| `supabase/functions/elevenlabs-tools/index.ts` | Main webhook handler - deploy this |
| `supabase/functions/elevenlabs-session/index.ts` | Session handler - deploy this |
| `elevenlabs-tools-config.json` | Tool definitions (reference for ElevenLabs setup) |

---

## 🔧 EDGE FUNCTIONS TO DEPLOY

### 1. `elevenlabs-tools`
- **Purpose:** Handles all Rari tool calls from ElevenLabs
- **JWT Verification:** `false` (allows anon access)
- **Source:** `supabase/functions/elevenlabs-tools/index.ts`

### 2. `elevenlabs-session`
- **Purpose:** Gets signed URL from ElevenLabs for voice conversations
- **JWT Verification:** `false`
- **Source:** `supabase/functions/elevenlabs-session/index.ts`
- **Required Secret:** `ELEVENLABS_API_KEY`

---

## 🔑 SECRETS REQUIRED

Add these to Supabase Edge Functions → Secrets:

| Name | Value | Where to Get |
|------|-------|--------------|
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key | ElevenLabs Dashboard → Profile → API Keys |

---

## 🎯 CORRECT PROJECT INFO

**Use this project for everything:**
- **Project ID:** `jlgwbbqydjeokypoenoc`
- **URL:** `https://jlgwbbqydjeokypoenoc.supabase.co`
- **Edge Functions:** `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/`

---

## 📊 EXPECTED DATABASE STATE AFTER MIGRATION

| Table | Purpose |
|-------|---------|
| `teams` | Multi-tenant team/organization support |
| `profiles` | User profile information |
| `team_members` | Links users to teams |
| `vehicles` | Now has `team_id` column |
| `bookings` | Now has `team_id` column |
| `customers` | Now has `team_id` column |
| `maintenance` | Now has `team_id` column |
| `revenue` | Now has `team_id` column |
| `damage_reports` | Now has `team_id` column |

### Demo Team
- **ID:** `00000000-0000-0000-0000-000000000001`
- **Purpose:** Allows Rari to access data without user authentication
- All existing data will be assigned to this team

---

## 🐛 COMMON ERRORS

### Error: `needs_authorization`
**Cause:** ElevenLabs webhook missing Authorization header  
**Fix:** Add header `Authorization: Bearer YOUR_ANON_KEY`

### Error: `ELEVENLABS_API_KEY not configured`
**Cause:** Missing secret in Supabase Edge Functions  
**Fix:** Add `ELEVENLABS_API_KEY` secret

### Error: `relation "teams" does not exist`
**Cause:** Migration not applied  
**Fix:** Run `LOVEABLE_APPLY_THIS_MIGRATION.sql`

### Error: `team_id column doesn't exist`
**Cause:** Migration not applied  
**Fix:** Run `LOVEABLE_APPLY_THIS_MIGRATION.sql`

---

## 🧪 HOW TO TEST

### Test 1: Check Migration Applied
```sql
SELECT COUNT(*) FROM teams;
-- Should return 1 (the demo team)

SELECT COUNT(*) FROM vehicles WHERE team_id IS NOT NULL;
-- Should return count of all vehicles
```

### Test 2: Direct Edge Function Call
```bash
curl -X POST "https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"tool_name": "get_fleet_vehicles", "parameters": {"status": "all"}}'
```

### Test 3: In ElevenLabs
Ask Rari: "How many vehicles do I have?"

---

## 📝 SUMMARY

1. **Loveable's project** (`jlgwbbqydjeokypoenoc`) is the production database
2. **Apply the migration** from `LOVEABLE_APPLY_THIS_MIGRATION.sql`
3. **Deploy edge functions** from `supabase/functions/`
4. **Add `ELEVENLABS_API_KEY`** secret
5. **Test** with the curl commands above

Good luck! 🚀
