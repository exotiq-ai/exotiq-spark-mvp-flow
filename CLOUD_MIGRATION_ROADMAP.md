# Cloud Migration Roadmap — ExotIQ.ai

> **Purpose:** Step-by-step plan to migrate from Lovable Cloud to a self-managed cloud stack.  
> **Status:** Planning (not started)  
> **Prerequisite:** Complete cloud optimizations in [CLOUD_OPTIMIZATION_TODO.md](./CLOUD_OPTIMIZATION_TODO.md) first.  
> **Created:** 2026-03-05

---

## Current Resource Inventory

### Database (PostgreSQL)
- **48 tables** with full RLS policies
- **16+ tables** published to Supabase Realtime
- **Security Definer functions:** `is_team_member`, `is_team_admin`, `is_team_owner`, `is_super_admin`, `has_role`, etc.
- **Triggers:** profile creation on signup, notification triggers, audit logging
- **Cron jobs:** 30-day notification purge (`pg_cron`)
- **All migrations** stored in `supabase/migrations/` (portable SQL)

### Authentication
- Email/password signup with email verification
- Password reset flow
- Session management via `useSessionHealth`
- Demo login via edge function
- Team invitation flow with token-based acceptance

### Storage (6 Buckets)
| Bucket | Visibility | Contents |
|--------|-----------|----------|
| `vehicle-photos` | Private | Vehicle gallery photos, enhanced versions |
| `damage-photos` | Private | Inspection damage evidence |
| `customer-documents` | Private | ID docs, insurance uploads |
| `message-attachments` | Private | Team chat file attachments |
| `dashboard-banners` | Public | Custom dashboard banners |
| `user-avatars` | Public | Profile pictures |

### Edge Functions (37 Total)
| Category | Functions | Count |
|----------|-----------|-------|
| **Auth/Onboarding** | `demo-login`, `invite-user`, `accept-invite`, `resend-invite`, `revoke-user-sessions` | 5 |
| **Payments/Stripe** | `create-checkout-session`, `check-subscription`, `customer-portal`, `stripe-payment-history`, `stripe-get-balance`, `export-payments`, `create-payment-checkout` | 7 |
| **AI/ML** | `fleet-copilot-chat`, `ai-pricing`, `ai-demand-forecast`, `identify-vehicle`, `analyze-vehicle-photo` | 5 |
| **Voice** | `elevenlabs-session`, `elevenlabs-tools`, `voice-to-text`, `text-to-speech` | 4 |
| **Photos** | `enhance-hero-photo`, `generate-hero-image`, `cleanup-unmatched-photos` | 3 |
| **Notifications** | `role-change-notification`, `mention-notification`, `slack-notify`, `check-fleet-alerts` | 4 |
| **Reports/Data** | `generate-report`, `rari-email-summary`, `rari-message-summary`, `rari-mcp-server` | 4 |
| **External APIs** | `predicthq-events` | 1 |

### Secrets (Stored in Vault)
- `STRIPE_SECRET_KEY`
- `DEMO_PASSWORD`
- `ELEVENLABS_API_KEY`
- `PHOTOROOM_API_KEY`
- `PREDICTHQ_API_KEY`
- Various other API keys for external integrations

---

## Recommended External Stack

| Service | Provider | Cost Estimate | Why |
|---------|----------|--------------|-----|
| **Database + Auth + Realtime** | Supabase Pro (direct) | $25/mo | Same SDK, zero code changes |
| **Storage** | Cloudflare R2 | ~$0.015/GB/mo, no egress | Cheapest for media-heavy apps |
| **Edge Functions** | Deno Deploy | Free tier (100K req/day) | Same Deno runtime, no rewrites |
| **Frontend Hosting** | Cloudflare Pages or Vercel | Free tier | Git-based deploy, CDN included |
| **Secrets** | Doppler or platform env vars | Free–$5/mo | Centralized secret management |
| **Total** | | **~$25–35/mo** | |

**Alternative:** If staying fully within Supabase ecosystem (database + auth + storage + functions), Supabase Pro at $25/mo covers everything except frontend hosting.

---

## Phase 1: External Database + Auth (Lowest Risk)

### Steps
- [ ] Create a new Supabase project at [supabase.com](https://supabase.com) (or Neon/Railway for Postgres-only)
- [ ] Apply all SQL migrations from `supabase/migrations/` in order
- [ ] Verify all RLS policies, triggers, and functions are created
- [ ] Verify `pg_cron` jobs are recreated (notification purge)
- [ ] Export existing data from Lovable Cloud tables (use `supabase db dump` or manual CSV export)
- [ ] Import data into new project
- [ ] Export auth users using Supabase Management API (`/auth/v1/admin/users`)
- [ ] Import users into new project (password hashes are portable within Supabase)
- [ ] Update environment variables in frontend:
  - `VITE_SUPABASE_URL` → new project URL
  - `VITE_SUPABASE_PUBLISHABLE_KEY` → new anon key
- [ ] Test all auth flows: signup, login, password reset, demo login
- [ ] Test all CRUD operations with RLS

### Rollback
Revert environment variables to Lovable Cloud values. No data loss since both databases exist simultaneously.

### Risk Assessment
- **Low risk** if staying within Supabase (same SDK, same API)
- **Medium risk** if moving to non-Supabase Postgres (must rewrite auth, realtime, RLS)
- **Data migration** is the most time-consuming step

### Validation Checklist
- [ ] All 48 tables created with correct schemas
- [ ] All RLS policies applied and tested
- [ ] All Security Definer functions working (`is_team_member`, `has_role`, etc.)
- [ ] Auth signup/login/reset flows working
- [ ] Demo login edge function connects to new project
- [ ] Realtime subscriptions working on all published tables

---

## Phase 2: Migrate Storage

### Steps
- [ ] Create storage buckets in new provider (R2, S3, or new Supabase project storage)
- [ ] Write migration script to copy files from Lovable Cloud storage:
  ```bash
  # For each bucket, list all files and download/re-upload
  # Supabase Storage API: GET /storage/v1/object/list/{bucket}
  ```
- [ ] Update storage helper functions in `src/lib/photoUpload.ts`:
  - `uploadVehiclePhoto()` → point to new storage
  - `deleteVehiclePhoto()` → point to new storage
  - `getSignedPhotoUrl()` → point to new storage or use public URLs
- [ ] Update edge functions that reference storage:
  - `enhance-hero-photo`
  - `generate-hero-image`
  - `cleanup-unmatched-photos`
  - `analyze-vehicle-photo`
- [ ] Update any hardcoded storage URLs in the database (photo URLs stored in `vehicle_photos`, `inspection_photos`, etc.)
- [ ] Test all photo upload, display, and deletion flows

### Rollback
Keep Lovable Cloud storage active during migration. Only decommission after verification.

### Risk Assessment
- **Medium risk** — storage URLs are stored in database records. Must update all references.
- **Photo-heavy app** — migration may take significant time depending on volume.

### Validation Checklist
- [ ] All vehicle photos load correctly
- [ ] Photo upload works for new photos
- [ ] Enhanced/hero photos display correctly
- [ ] Damage claim photos accessible
- [ ] Customer documents downloadable
- [ ] Message attachments load in chat
- [ ] Avatar images display in UI

---

## Phase 3: Migrate Edge Functions

### Steps
- [ ] Choose runtime: **Deno Deploy** (zero changes) or **Cloudflare Workers** (requires `Deno.env.get` → `env.VAR`)
- [ ] For Deno Deploy:
  - Create a Deno Deploy project
  - Deploy each function from `supabase/functions/*/index.ts`
  - Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars to point to new database
  - Set all other secrets (Stripe, ElevenLabs, etc.)
- [ ] For self-hosted Supabase:
  - Functions deploy automatically with `supabase functions deploy`
  - No code changes needed
- [ ] Update frontend API calls:
  - Replace `supabase.functions.invoke('function-name')` with direct fetch to new function URLs
  - Or keep using Supabase SDK if staying within Supabase ecosystem
- [ ] Test each function category:
  - Auth functions (demo-login, invite flows)
  - Payment functions (checkout, subscription check)
  - AI functions (copilot, pricing, demand forecast)
  - Voice functions (ElevenLabs session, TTS, STT)
  - Photo functions (enhance, analyze, cleanup)
  - Notification functions (email, Slack)
  - Report functions (generate-report, summaries)

### Rollback
Keep Lovable Cloud functions active. Route traffic back by reverting API URLs.

### Risk Assessment
- **Low risk** if staying on Deno Deploy (same runtime)
- **Medium risk** if moving to Cloudflare Workers (API differences)
- **Each function is self-contained** — can migrate one at a time

### Validation Checklist
- [ ] All 37 functions deployed and responding
- [ ] All secrets configured in new environment
- [ ] CORS headers working for frontend domain
- [ ] Rate limiting still functional (demo-login)
- [ ] External API calls working (Stripe, ElevenLabs, PredictHQ, PhotoRoom)

---

## Phase 4: Migrate Auth (Highest Risk)

> **Skip this phase if using Supabase Pro** — auth migrates automatically with Phase 1.

### Steps (Only if moving to Auth0/Clerk/custom)
- [ ] Export all users from Supabase Auth
- [ ] Import users into new auth provider (password hashes may not be portable across providers)
- [ ] Rewrite `src/contexts/AuthContext.tsx` to use new auth SDK
- [ ] Update all `supabase.auth.*` calls throughout the codebase:
  - `supabase.auth.signInWithPassword()`
  - `supabase.auth.signUp()`
  - `supabase.auth.resetPasswordForEmail()`
  - `supabase.auth.getUser()`
  - `supabase.auth.getSession()`
  - `supabase.auth.onAuthStateChange()`
  - `supabase.auth.signOut()`
  - `supabase.auth.refreshSession()`
- [ ] Update edge functions that verify auth tokens
- [ ] Update RLS policies if auth provider uses different user ID format
- [ ] Implement session management equivalent to `useSessionHealth`
- [ ] Send password reset emails to all users (if hashes aren't portable)

### Rollback
Extremely difficult once users have been migrated. Recommend running both systems in parallel with feature flags.

### Risk Assessment
- **HIGH RISK** — Auth touches every part of the application
- **User disruption** — Users may need to reset passwords
- **Recommend staying on Supabase Auth** to avoid this phase entirely

### Validation Checklist
- [ ] New user signup works
- [ ] Existing user login works
- [ ] Password reset flow works
- [ ] Session persistence across page reloads
- [ ] Token refresh works
- [ ] All protected routes still protected
- [ ] All RLS policies still enforce correctly with new auth tokens

---

## Phase 5: Frontend Hosting

### Steps
- [ ] Choose host: Cloudflare Pages, Vercel, or Netlify
- [ ] Connect GitHub repository
- [ ] Configure build command: `npm run build` (Vite)
- [ ] Set environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
  - Any other `VITE_*` variables
- [ ] Configure custom domain (if applicable)
- [ ] Set up SSL certificate (usually automatic)
- [ ] Configure redirects for SPA routing (all paths → `index.html`)
- [ ] Test PWA functionality (service worker, offline mode)
- [ ] Update CORS origins in edge functions to allow new domain
- [ ] Update Stripe webhook URLs and redirect URLs
- [ ] Update OAuth redirect URLs (if applicable)

### Rollback
Keep Lovable publishing active. DNS switch back to Lovable domain.

### Risk Assessment
- **Low risk** — standard Vite deployment, well-documented for all major hosts
- **PWA considerations** — service worker paths must be correct

### Validation Checklist
- [ ] Site loads on new domain
- [ ] All routes work (no 404 on refresh)
- [ ] PWA installs correctly
- [ ] Service worker updates work
- [ ] Offline banner appears when offline
- [ ] All API calls reach correct backends
- [ ] No mixed content warnings (HTTP/HTTPS)

---

## Cost Comparison

| Resource | Lovable Cloud (Current) | Supabase Pro + R2 (Proposed) |
|----------|------------------------|------------------------------|
| Database | Included | $25/mo (Supabase Pro) |
| Auth | Included | Included with Supabase Pro |
| Storage | Included | ~$1–5/mo (R2, depends on volume) |
| Realtime | Included | Included with Supabase Pro |
| Edge Functions | Included | Free (Deno Deploy) or included |
| Frontend Hosting | Included | Free (Cloudflare Pages/Vercel) |
| **Total** | **Lovable plan cost** | **~$25–35/mo** |

---

## Timeline Estimate

| Phase | Duration | Can Run in Parallel |
|-------|----------|-------------------|
| Phase 1: Database + Auth | 1–2 days | No (foundation) |
| Phase 2: Storage | 1–2 days | Yes (after Phase 1) |
| Phase 3: Edge Functions | 2–3 days | Yes (after Phase 1) |
| Phase 4: Auth Migration | 3–5 days (skip if Supabase) | No |
| Phase 5: Frontend Hosting | 1 day | Yes (after all others) |
| **Total** | **5–8 days** (Supabase) / **10–14 days** (non-Supabase) | |

---

## Pre-Migration Checklist

- [ ] Complete all optimizations in [CLOUD_OPTIMIZATION_TODO.md](./CLOUD_OPTIMIZATION_TODO.md)
- [ ] Document all current environment variables and secrets
- [ ] Take a full database backup
- [ ] Download all storage bucket contents
- [ ] Document all custom domains and DNS records
- [ ] Notify team about planned migration window
- [ ] Set up monitoring on new infrastructure before switching
- [ ] Create rollback plan for each phase

---

## Post-Migration Checklist

- [ ] All features working on new infrastructure
- [ ] Performance benchmarks match or exceed previous
- [ ] All team members can log in
- [ ] All data intact (row counts match)
- [ ] All files accessible (storage migration complete)
- [ ] Monitoring and alerting configured
- [ ] Backup strategy in place for new infrastructure
- [ ] Documentation updated with new architecture
- [ ] Old Lovable Cloud project can be archived (but not deleted — cannot disconnect Cloud)
