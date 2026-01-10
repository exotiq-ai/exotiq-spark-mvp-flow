# EXOTIQ Rari Troubleshooting Guide

**Last Updated:** January 9, 2026  
**Status:** CRITICAL - Action Required Before Testing

---

## 🚨 THE MAIN ISSUE (DISCOVERED TONIGHT)

We were unknowingly working with **TWO DIFFERENT Supabase projects**:

| Project ID | URL | What's There |
|------------|-----|--------------|
| `mlfzduuclgdscdlztzdi` | `https://mlfzduuclgdscdlztzdi.supabase.co` | ✅ CORRECT - Has all migrations, 10 real vehicles, teams table, edge functions |
| `jlgwbbqydjeokypoenoc` | `https://jlgwbbqydjeokypoenoc.supabase.co` | ❌ OLD/WRONG - Had 65 demo vehicles, outdated schema |

**ElevenLabs was calling the wrong project!**

---

## ✅ WHAT HAS BEEN DONE

### 1. Database Schema (on `mlfzduuclgdscdlztzdi`)
- Created `teams` table for multi-tenancy
- Created `profiles` table for user profiles  
- Created `team_members` table to link users to teams
- Added `team_id` column to: `vehicles`, `bookings`, `customers`, `maintenance`, `revenue`, `damage_reports`
- Created demo team with ID: `00000000-0000-0000-0000-000000000001`
- Assigned all existing data to demo team
- Set up RLS policies for multi-tenant access

### 2. Edge Functions Deployed (to `mlfzduuclgdscdlztzdi`)
- `elevenlabs-tools` v4 - Main webhook handler for all Rari tools
- `elevenlabs-session` v1 - Gets signed URL from ElevenLabs API (NEW - was missing!)
- `rari-enterprise-handlers` v1 - Enterprise feature handlers
- `rari-universal-query` v1 - Natural language query handler

### 3. Config Files Updated
- `elevenlabs-tools-config.json` - All webhook URLs changed to `mlfzduuclgdscdlztzdi`

---

## ⚠️ ACTION REQUIRED BEFORE TESTING

### Step 1: Add ElevenLabs API Key to Supabase

The `elevenlabs-session` function needs your ElevenLabs API key to work.

1. Go to: **Supabase Dashboard** → Project `mlfzduuclgdscdlztzdi`
2. Navigate to: **Edge Functions** → **Secrets** (or Settings → Secrets)
3. Add new secret:
   - **Name:** `ELEVENLABS_API_KEY`
   - **Value:** Your ElevenLabs API key (get from ElevenLabs dashboard → Profile → API Keys)

### Step 2: Update ElevenLabs Webhook URLs

In ElevenLabs Agent configuration, update ALL webhook tools to use:

```
https://mlfzduuclgdscdlztzdi.supabase.co/functions/v1/elevenlabs-tools
```

### Step 3: Update ElevenLabs Authorization Header

Make sure the workspace secret `EXOTIQ_SUPABASE_KEY_ML` contains:

```
Bearer [ANON_KEY_FROM_mlfzduuclgdscdlztzdi]
```

Get the anon key from: Supabase Dashboard → `mlfzduuclgdscdlztzdi` → Settings → API → anon/public key

---

## 🔧 HOW TO TEST

### Test 1: Direct Edge Function Call

```bash
curl -X POST "https://mlfzduuclgdscdlztzdi.supabase.co/functions/v1/elevenlabs-tools" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"tool_name": "get_fleet_vehicles", "parameters": {"status": "all"}}'
```

Expected response should show **10 vehicles** (not 65).

### Test 2: ElevenLabs Session

```bash
curl -X POST "https://mlfzduuclgdscdlztzdi.supabase.co/functions/v1/elevenlabs-session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"userId": "test-user"}'
```

Should return a signed URL if `ELEVENLABS_API_KEY` is configured.

### Test 3: In ElevenLabs Dashboard

Ask Rari: "How many vehicles do I have?"

Expected: "You have 10 vehicles..."

---

## 📊 DATABASE STATE

### Current Data (as of Jan 9, 2026)

| Table | Count | Notes |
|-------|-------|-------|
| vehicles | 10 | All assigned to demo team |
| bookings | 11 | All assigned to demo team |
| customers | 6 | All assigned to demo team |
| teams | 1 | Demo team created |
| team_members | 0 | No users linked yet |
| auth.users | 0 | No registered users |

### Demo Team ID
```
00000000-0000-0000-0000-000000000001
```

The edge functions default to this team ID when no user is authenticated.

---

## 🔑 IMPORTANT URLS

### Correct Supabase Project
- **Project ID:** `mlfzduuclgdscdlztzdi`
- **URL:** `https://mlfzduuclgdscdlztzdi.supabase.co`
- **Dashboard:** `https://supabase.com/dashboard/project/mlfzduuclgdscdlztzdi`

### Edge Function Endpoints
- **ElevenLabs Tools:** `https://mlfzduuclgdscdlztzdi.supabase.co/functions/v1/elevenlabs-tools`
- **ElevenLabs Session:** `https://mlfzduuclgdscdlztzdi.supabase.co/functions/v1/elevenlabs-session`

### OLD/WRONG Project (DO NOT USE)
- ~~`https://jlgwbbqydjeokypoenoc.supabase.co`~~ ❌

---

## 🐛 COMMON ERRORS

### Error: `needs_authorization`
**Cause:** ElevenLabs isn't sending the Authorization header  
**Fix:** Add `Authorization: Bearer YOUR_ANON_KEY` header to webhook tools

### Error: `ELEVENLABS_API_KEY not configured`
**Cause:** Missing secret in Supabase  
**Fix:** Add `ELEVENLABS_API_KEY` secret to Edge Functions

### Error: 65 vehicles returned (should be 10)
**Cause:** Calling wrong Supabase project  
**Fix:** Update webhook URL to `mlfzduuclgdscdlztzdi`

### Error: `Client tool not defined`
**Cause:** Tool configured as "Client Tool" instead of "Webhook Tool"  
**Fix:** Delete client tool, add as webhook tool

---

## 📁 KEY FILES

| File | Purpose |
|------|---------|
| `elevenlabs-tools-config.json` | Tool definitions for ElevenLabs (copy settings from here) |
| `RARI_ELEVENLABS_SYSTEM_PROMPT.md` | System prompt for Rari agent |
| `supabase/functions/elevenlabs-tools/index.ts` | Main webhook handler |
| `supabase/functions/elevenlabs-session/index.ts` | Session/signed URL handler |

---

## 📞 FOR LOVEABLE

If Loveable is troubleshooting:

1. **Check the Supabase project being used** - Must be `mlfzduuclgdscdlztzdi`
2. **Verify edge functions are deployed** - Check Supabase Dashboard → Edge Functions
3. **Check secrets are set** - `ELEVENLABS_API_KEY` must exist
4. **Test edge functions directly** - Use curl commands above
5. **Check ElevenLabs webhook config** - URL and headers must be correct

The frontend code (`RariVoiceInterface.tsx`, `RariWidgetInterface.tsx`) calls `elevenlabs-session` which must be deployed and have the API key configured.

---

## 🎯 SUMMARY

**Root Cause:** Two Supabase projects, ElevenLabs pointed to wrong one.

**Solution:** 
1. All backend work done on `mlfzduuclgdscdlztzdi` ✅
2. Edge functions deployed ✅
3. Config updated ✅
4. **YOU NEED TO:** Add `ELEVENLABS_API_KEY` secret and update ElevenLabs webhook URLs

Good luck! 🚀
