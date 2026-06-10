# Exotiq Security Audit — Static Review

Scope: `/home/user/exotiq-spark-mvp-flow` (Vite/React/TS + Supabase). 56 edge functions, 120 migrations, `src/`.
Method: 100% static. No DB connection (per constraint). RLS/schema conclusions are from migration files + `src/integrations/supabase/types.ts`; confidence stated per finding.
Date: 2026-06-10. Reviewer: principal security review (read-only).

Severity legend: Critical / High / Medium / Low. "Confidence" = how sure the finding is real given static-only analysis.

---

## 0. Key context

- **Every one of the 56 functions has `verify_jwt = false`** in `supabase/config.toml`. That is not itself a bug — many functions re-implement auth (`supabase.auth.getUser(token)`) in code. The audit below separates functions that genuinely re-auth from those that are actually open.
- LLM provider is **Google Gemini via the Lovable AI gateway** (`ai.gateway.lovable.dev`, `LOVABLE_API_KEY`) plus **ElevenLabs** (TTS/STT/voice agent) and **Resend** (email). No Anthropic/OpenAI. These are the metered/$-per-call dependencies.
- No `_shared` directory exists; CORS + auth are copy-pasted per function, so quality varies function to function.
- No hardcoded live secrets found in `src/` or root `*.md`/`*.sql`/`*.json` (grep for `sk_live`/`sk_test`/`whsec_`/`rk_live`/service-role `eyJ` → clean). `.env` contains only `VITE_SUPABASE_PUBLISHABLE_KEY` (the anon JWT, which is designed to be public) and the project URL. Confidence: high.

---

## 1. Edge functions — open endpoints, auth, money-pumping

### 1.1 `elevenlabs-tools` — service-role data access with attacker-controlled identity fallback — **CRITICAL** (confidence: high)
File: `supabase/functions/elevenlabs-tools/index.ts:484-700`, identity resolution `:527-597`.
Root cause: The function runs with the **service-role key** (`:520-522`, bypasses all RLS) and resolves the caller identity through a *non-blocking* fallback chain:
1. Valid signed tool token (good path).
2. **`body.conversation_metadata.user_id` taken straight from the request body** (`:556-563`) — attacker-controlled.
3. `DEMO_USER_ID` env (`:566-577`).
4. `HARDCODED_DEMO_USER_ID = '99d902d4-5878-4b59-a108-142bafb1c862'` (`:481,:580-584`).
When the bearer token does not verify, the code explicitly comments "Do NOT return 401 here … continue to fallbacks" (`:546-548`). It never rejects an unauthenticated caller. It then (`:643-672`) looks up the user's team, and if none, **auto-joins the chosen user to "any" non-deleted team as `viewer`** and serves that team's data. The read tools (`get_fleet_vehicles`, `get_bookings`, `getPaymentSummary`, `getRevenueAnalysis`, `getOutstandingBalances`, `getVehicleProfitLoss`, `getCustomerProfile`, `getCustomerLifetimeValue`, etc., dispatch table at `:775-2518`) then return another tenant's private fleet, revenue, customer PII and financial data via service role.
Impact: An unauthenticated attacker who knows/guesses any `user_id` UUID (or relies on the hardcoded/demo fallback) reads cross-tenant financial + customer data. Cross-tenant data exfiltration. The function also performs `profiles` and `team_members` upserts (`:632-637`, `:661-667`) with service role on behalf of that identity.
Fix: Require a verified tool token (or a verified Supabase JWT). Remove fallbacks 2–4. Never derive identity from the request body. Stop auto-joining users to arbitrary teams.

### 1.2 `rari-mcp-server` — auth is opt-in; identity from query/header; "first user" fallback — **CRITICAL** (confidence: high)
File: `supabase/functions/rari-mcp-server/index.ts:589-651`, handler `:654-672`.
Root cause:
- `validateAuth()` returns `true` when `MCP_SECRET_TOKEN` is unset (`:591`, comment: "No token configured = open access"). If the secret was never set in this environment, the endpoint is fully open.
- `extractUserId()` accepts the user id from the **`x-user-id` / `x-elevenlabs-user-id` header** (`:606-616`) or `?userId=` **query param** (`:619-631`) — only checks that the profile row exists, not that the caller owns it.
- Last-resort fallback selects **the first user in `profiles`** (`:642-648`) and serves their data.
Downstream it uses the service-role key (`:836`, `:966`, `:999`) and `getUserTeamId()` to query that user's team — bypassing RLS.
Impact: With the single shared bearer token (or none), any caller impersonates any user by passing their UUID, reading that tenant's fleet/financial data. Bearer-token-only auth (no per-user identity binding) is structurally weak for a multi-tenant data API.
Fix: Make `MCP_SECRET_TOKEN` mandatory (fail closed). Bind identity to a verified per-user credential, not a header/param. Remove the "first user" fallback.

### 1.3 `generate-hero-image` — fully open, service-role write + paid image generation — **HIGH** (confidence: high)
File: `supabase/functions/generate-hero-image/index.ts:39-75`.
Root cause: No `Authorization` check at all. Takes `userId`/`teamId`/`vehicleId` from the request body (`:46`), uses the **service-role key** for Storage writes (`:57,75`), and calls Gemini **image generation** (the most expensive Gemini call) via `LOVABLE_API_KEY`. No application rate limiting (the only `429` at `:110` just forwards the provider's own limit).
Impact: (a) Cost-pumping — anyone can drive unbounded paid image-generation calls. (b) Unauthorized writes — attacker supplies arbitrary `vehicleId`/`teamId`/`userId` and writes generated images into another tenant's storage/photo records.
Fix: Require and verify a JWT; derive `userId`/`teamId` from it; add per-user rate limiting.

### 1.4 `rari-email-summary` — open, IDOR read + arbitrary-recipient email — **HIGH** (confidence: high)
File: `supabase/functions/rari-email-summary/index.ts:10-49`.
Root cause: No auth. Takes `{ conversationId, recipientEmail }` from the body (`:16`), reads **any** `rari_conversations` + `rari_messages` by id with the **service-role key** (`:24-32`, no ownership check = IDOR), then emails the full transcript to the **attacker-supplied `recipientEmail`** via Resend.
Impact: (a) Exfiltrate any conversation transcript by iterating conversation ids. (b) Email-abuse / spoofed-sender spam vector (send Exotiq-branded mail to arbitrary addresses on demand), risking the Resend sender reputation.
Fix: Require auth; verify the caller is a member of the conversation's team; restrict `recipientEmail` to the authenticated user / vetted addresses.

### 1.5 `rari-message-summary` — open, identity from body — **MEDIUM** (confidence: high)
File: `supabase/functions/rari-message-summary/index.ts:15-18,110-117`.
Root cause: No auth; `{ conversationId, userId }` taken from body, used to read a conversation and write a notification (`user_id: userId`) via service role. Same IDOR/identity-spoofing class as 1.4 but lower blast radius (writes a notification, summarizes a conversation). Gemini cost per call.
Fix: Verify JWT; derive `userId`; check conversation ownership.

### 1.6 `demo-login` — shared demo account with hardcoded fallback password — **MEDIUM** (confidence: high)
File: `supabase/functions/demo-login/index.ts:74-99`.
What it grants: Signs in as `hello@exotiq.ai` with `DEMO_PASSWORD` **or the hardcoded fallback `'demo123456'`** (`:75`) and returns a **real Supabase session** (access + refresh tokens) to any caller. So the strength of the demo backdoor is exactly `demo123456` unless `DEMO_PASSWORD` is set in the environment. The demo user is seeded into a demo team (migrations referencing `hello@exotiq.ai` / demo team: `20260528014214`, `20260605163938`, `20260528180850`). Anyone can mint a valid session for that account and exercise whatever that account can do under RLS.
Mitigations present: in-memory per-IP rate limit, 100 logins/hr (`:43-58`) — weak (per-instance memory, resets on cold start, and explicitly disabled when IP is "unknown", `:38`).
Risk: If the demo account shares a team with any real/sensitive data, or has write/admin role, this is a tenant breach. If it is a fully isolated sandbox team, risk is limited to demo-data tampering + being a free authenticated foothold to reach the service-role functions in 1.1/1.2.
Fix: Require `DEMO_PASSWORD` to be set (fail closed, never ship `demo123456`); guarantee the demo account is `viewer` on an isolated team with no PII; rotate regularly.

### 1.7 No application-level rate limiting on paid endpoints — **MEDIUM** (confidence: high)
Only `demo-login` implements request-count limiting (in-memory, per-IP). The other "rate limit" hits in `text-to-speech:89`, `generate-hero-image:110`, `ai-pricing`, `identify-vehicle`, `parse-expense-receipt`, `fleet-copilot-chat` are just **pass-throughs of the upstream 429**, not local throttles. Authenticated-but-cheap-to-obtain access (1.6) plus no throttle on ElevenLabs TTS/STT and Gemini calls = cost-amplification once any session is obtained. Open functions (1.3) need no session at all.
Fix: Add per-user/per-IP token-bucket limits (DB- or KV-backed) on every metered function.

### 1.8 Functions verified to correctly self-authenticate (NOT findings)
These call `auth.getUser`/`getClaims` and 401 before doing paid/privileged work — `verify_jwt=false` is acceptable for them: `text-to-speech`, `voice-to-text`, `elevenlabs-session` (derives `userId` from JWT, issues a 15-min HS256 tool token — good design), `fleet-copilot-chat`, `rari-universal-query`, `ai-pricing`, `ai-demand-forecast`, `ai-event-intelligence`, `analyze-vehicle-photo`, `identify-vehicle`, `generate-report`, `predicthq-events`, `parse-expense-receipt`, `fill-rental-template`, and all `stripe-*` money functions (see §3).

---

## 2. Edge functions — secrets, CORS, injection, webhook verification

### 2.1 `stripe-webhook` signature verification — CORRECT (NOT a finding) (confidence: high)
File: `supabase/functions/stripe-webhook/index.ts:18-31`. Uses `stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET)` on the **raw** body, rejects missing signature, returns 400 on signature failure (`:476`). Idempotency via `stripe_webhook_events` (`:39-52`). `verify_jwt=false` is required here (Stripe can't send a Supabase JWT). Good.

### 2.2 `stripe-webhook` deterministic UUID is a homemade non-crypto hash — **LOW** (confidence: high)
File: `supabase/functions/stripe-webhook/index.ts:` `chargeIdToUuid()` (DJB2-style `Math.imul` hash, comment admits "use Web Crypto … in real prod"). Used only as an idempotency key for the processing-fee `vehicle_expenses` insert. Collision → a dropped fee row, not a security breach. Cosmetic/correctness, not security-critical.

### 2.3 CORS wildcard on all 55 functions — **LOW** (confidence: high)
Every function sets `Access-Control-Allow-Origin: '*'`. Combined with bearer-token auth (not cookies) this is the standard Supabase Edge pattern and not directly exploitable, but it removes browser-origin defense-in-depth for the open functions in §1. Tighten to the app origin(s) where feasible.

### 2.4 SQL injection — NOT present (confidence: high)
`rari-universal-query`, `elevenlabs-tools`, `rari-mcp-server` build all DB access through the Supabase query builder (`.from().eq().gte()…`). The numerous `${…}` are **output string formatting** of results, not query construction. No raw SQL string concatenation, no `execute_sql`/`rpc` with interpolated SQL found in the data-query functions.

### 2.5 Prompt injection into DB-querying LLM tools — **LOW/MEDIUM** (confidence: medium)
The Rari agent (ElevenLabs + `fleet-copilot-chat` + `rari-universal-query`) takes free-text user input and maps it to a **fixed allowlist of named tools** with typed params; tools are team-scoped server-side via `teamId`. So prompt injection cannot reach arbitrary SQL or other tenants *as long as `teamId` is correctly derived from a verified identity*. The real exposure is the identity-resolution weakness in 1.1/1.2 (if `teamId` comes from an attacker-controlled `user_id`, injection is moot — they already have the data). Treat 1.1/1.2 as the controlling issue.

### 2.6 Service-role-to-bypass-RLS-for-unauthenticated-callers — see §1.1, §1.2, §1.3, §1.4
This is the dominant theme: multiple functions hold `SUPABASE_SERVICE_ROLE_KEY` and act before establishing a trustworthy identity. The Stripe functions (§3) do this correctly (auth first, then service role + team-membership check). The Rari/media functions above do not.

---

## 3. Stripe money-movement functions — auth posture (mostly GOOD)

`create-payment-checkout`, `customer-portal`, `export-payments`, `stripe-payment-history`, `stripe-get-balance`, `stripe-create-hold`, `stripe-capture-hold`, `stripe-release-hold`, `stripe-create-refund` all: require `Authorization`, call `auth.getUser(token)`, then look up `team_members`/`teams` and use the team's own connected `stripe_account_id` for the Stripe call (e.g. `stripe-create-hold/index.ts:29-60`). Cross-team abuse is bounded because operations run against the caller's connected account. **No auth finding** here. (Silent-DB-write issues in these functions are covered in `observability.md`.)
`create-checkout-session` treats auth as optional (`:68-72`, subscription signup) — acceptable for a pre-auth pricing checkout, but confirm price/tier is server-derived, not client-supplied. **LOW** (confidence: medium).

---

## 4. RLS — reconciled FINAL state (static, across 120 migrations)

Approach: later migrations `DROP POLICY IF EXISTS` then recreate; only final state counted. Heavy reliance on `SECURITY DEFINER` helper functions.

### 4.1 Core tenant tables are team-scoped — GOOD (confidence: high)
`vehicles`, `bookings`, `payments`, `damage_claims`, `maintenance_schedules`, `documents`, `customers` — final policies (migration `20260103050456…`, customers `20251226193106…`) gate SELECT on `auth.uid() = user_id OR is_team_member_of_record(auth.uid(), team_id) OR is_super_admin(auth.uid())`, and writes additionally require `has_role(...)`. RLS enabled on all. Proper multi-tenant isolation.

### 4.2 SECURITY DEFINER functions all set `search_path` — GOOD / NO mutable-search_path finding (confidence: high)
Audited all 107 `SECURITY DEFINER` occurrences across 43 migrations. The three files whose `SECURITY DEFINER` count exceeded `SET search_path` count (`20251224061511`, `20260107045115`, `20260527223011`) were **false positives** — the extra counts are the words "SECURITY DEFINER" appearing in **comments**; every actual function definition carries `SET search_path = public` (or `public, storage`). Linchpin helpers verified: `is_super_admin` (`20260528014214:59-80`), `is_team_member`/`is_team_admin` (`20260103040654:124-169`), and all helpers in `20260530203000_harden_tenant_rls_policies.sql`. No mutable-search_path exposure.

### 4.3 `is_super_admin` matches by email — **LOW** (confidence: medium)
`is_super_admin` (`20260528014214:66-79`) grants super-admin if the caller's `profiles.email` (case-insensitive) matches a `super_admins.email`, even when `super_admins.user_id` is NULL. If `profiles.email` can be set to an arbitrary unverified value (e.g. via a profile-update path that doesn't go through email-verification), a user could claim a pre-provisioned super-admin email and escalate. Verify that `profiles.email` is only ever set from the verified `auth.users` email. Defense-in-depth: match on `user_id` only.

### 4.4 `super_admins` table — broad GRANT but writes blocked by RLS — **LOW** (confidence: high)
`GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admins TO authenticated` (`20260528014214:56`). RLS is **enabled** (`20260103010236:9`) but only a **SELECT** policy exists (`20260103010250`). With RLS on and no INSERT/UPDATE/DELETE policy, those writes are **denied by default** for `authenticated` — so this is NOT exploitable privilege escalation. It is, however, a misleading GRANT (relies entirely on RLS as the only barrier on the most sensitive table). Tighten: `REVOKE INSERT/UPDATE/DELETE … FROM authenticated`; manage super-admins via a `SECURITY DEFINER` RPC gated on existing super-admin.

### 4.5 `USING (true)` permissive policies — reviewed, all intentional (confidence: high)
- `maintenance_windows` SELECT `USING (true)` for authenticated (`20260530172605:31-35`) — global UI overlay, read-only, writes are super-admin only. Acceptable.
- `maintenance_notify_subscribers` INSERT `WITH CHECK (true)` for anon+authenticated (`20260530172605:85-89`) — write-only subscribe; SELECT restricted to super-admins. Acceptable (note: anon can spam inserts — minor; pair with a uniqueness/rate control).
- `entity_comments` historical `USING (true)` (`20260127061612`) is superseded by team-scoped delete policy in the harden migration. The remaining read breadth across team comments is by design.
No `USING (true)` policy currently exposes tenant data cross-tenant. Confidence high but DB-introspection would confirm no stray legacy policy survives.

### 4.6 INSERT policies use `WITH CHECK (auth.uid() = user_id)` only — **LOW** (confidence: medium)
On vehicles/bookings/payments/etc., INSERT only checks the row's `user_id` = caller; it does not constrain `team_id`. A user could insert a row stamped with a `team_id` they don't belong to (they'd still own it via `user_id`). Low impact (they can only create rows attributed to themselves; reads are still team-gated), but it muddies tenant accounting. Consider `WITH CHECK (auth.uid() = user_id AND is_team_member_of_record(auth.uid(), team_id))`.

### 4.7 Storage + realtime hardening — GOOD (confidence: high)
`20260530203000` replaces broad storage policies with team/conversation-scoped `SECURITY DEFINER` path checks for `customer-documents` and `message-attachments`, and gates `realtime.messages` per-topic via `can_access_realtime_topic`. Solid.

---

## 5. Frontend

### 5.1 No hardcoded server secrets in `src/` — GOOD (confidence: high)
Only the anon publishable key + URL in `.env` (designed public). No `sk_*`, `whsec_`, `rk_live`, or service-role JWT in `src/` or root docs.

### 5.2 Client-side role checks (`useUserRole`) are UI-only — acceptable, with caveat — **LOW** (confidence: high)
`src/hooks/useUserRole.ts` fetches role via the `get_my_role` RPC (server-derived from `auth.uid()`, not spoofable) and is used purely to show/hide UI. When role is null it explicitly grants UI access ("let them access the app without restrictions", `:60`). This is safe **only because** server enforcement (RLS write policies requiring `has_role`) is the real gate — which holds for RLS-backed tables. The gap: service-role edge functions (§1.1/1.2) do NOT re-check role, so anything reachable there is not protected by `useUserRole` or RLS.

### 5.3 Session handling — standard supabase-js (confidence: medium)
`demo-login` returns a real session to the browser (§1.6). Otherwise auth flows through `@/integrations/supabase/client`. No tokens persisted insecurely in `src/` were found.

---

## 6. Prior audit reports — re-verified

- `RLS_AUDIT_REPORT_JAN_2_2026.md`: its findings reference tables `investor_contacts`, `instagram_posts`, `survey_submissions`, `contact_submissions`, `applications`, `investor_emails`. **None exist** in the current schema (`types.ts` has 0 matches; 109 tables total). That report describes a **different/earlier project** and is **STALE / not applicable** to this codebase. `conversation_members` (the one real table it cites) now has proper RLS (harden migration). Status: **N/A / FIXED-by-rewrite**.
- `COMPREHENSIVE_AUDIT_REPORT_JAN_2026.md` and the various `SUPABASE_RLS_*` summaries claim tenant RLS was hardened — **CONFIRMED** for core tables (§4.1) and storage/realtime (§4.7). Status: **FIXED / verified**.
- The service-role-function identity weaknesses (§1.1/1.2) and open paid endpoints (§1.3/1.4) are **STILL OPEN** and are not addressed by any prior report I could map.

---

## Top 5 by severity

1. **CRITICAL — `elevenlabs-tools` cross-tenant data access via attacker-controlled identity** (`elevenlabs-tools/index.ts:527-672`). Service-role queries with identity taken from request body / hardcoded demo fallback; never returns 401. Reads other tenants' fleet, revenue, customer PII.
2. **CRITICAL — `rari-mcp-server` opt-in auth + spoofable user id + "first user" fallback** (`rari-mcp-server/index.ts:589-651`). Open if `MCP_SECRET_TOKEN` unset; impersonate any user via `x-user-id`/`?userId=`; service-role data access.
3. **HIGH — `generate-hero-image` fully open, service-role write + paid Gemini image generation** (`generate-hero-image/index.ts:39-75`). Cost-pumping + cross-tenant storage writes, no auth, no rate limit.
4. **HIGH — `rari-email-summary` open IDOR + arbitrary-recipient email** (`rari-email-summary/index.ts:16-49`). Exfiltrate any conversation transcript; email-abuse via attacker-supplied recipient.
5. **MEDIUM — `demo-login` hardcoded fallback password `demo123456`** (`demo-login/index.ts:75`). Anyone can mint a real session for `hello@exotiq.ai` unless `DEMO_PASSWORD` is set; weak in-memory rate limit; this session is also the cheap foothold that amplifies #1–#4 and the metered functions (§1.7).
