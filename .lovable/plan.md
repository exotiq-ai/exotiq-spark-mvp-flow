
# Next Priority Bites — Plan

Three independent bites, sequenced low-risk → high-touch. Each ships on its own; stop between bites for verification.

---

## Bite A — Auth-harden the two server-to-server edge functions (F-SEC-1 + F-SEC-2)

**Goal:** Fail closed. No more anonymous/spoofed cross-tenant data access.

### A1. `supabase/functions/elevenlabs-tools/index.ts`
- Require shared secret on every request:
  ```ts
  const secret = req.headers.get('x-elevenlabs-secret');
  if (!Deno.env.get('ELEVENLABS_TOOL_SECRET') || secret !== Deno.env.get('ELEVENLABS_TOOL_SECRET')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }
  ```
- Resolve `userId` **only** from a verified Supabase JWT (existing token path) OR from a signed conversation-context payload — never from request-body `user_id`.
- Delete the `DEMO_USER_ID` env fallback, the `HARDCODED_DEMO_USER_ID` constant, and the "auto-join any team" branch.
- Return 401 (not 200 with demo data) when identity cannot be resolved.

### A2. `supabase/functions/rari-mcp-server/index.ts`
- Make `MCP_SECRET_TOKEN` mandatory: fail closed (`401`) if env var unset OR header missing/mismatched.
- Remove `x-user-id` / `x-elevenlabs-user-id` / `?userId=` trust paths.
- Remove "first user in DB" fallback (lines ~641-648) and the `firstUser?.id || 'unknown'` writes at 1562/1568.
- Bind identity to the JWT carried by the MCP client (Rari widget calls already pass the Supabase session JWT).

### A3. Secrets
- Add `ELEVENLABS_TOOL_SECRET` and (verify) `MCP_SECRET_TOKEN` via `secrets--add_secret`.
- **Coordination needed from you:** paste the same `ELEVENLABS_TOOL_SECRET` value into the ElevenLabs tool config (custom header `x-elevenlabs-secret`). Confirm `MCP_SECRET_TOKEN` is set in the Rari MCP client config.

### A4. Verification
- `curl` each function with no/wrong secret → expect 401.
- `curl` with correct secret + valid JWT → expect data scoped to that user's team.
- Live Rari voice test from the app: "What vehicles do I have?" returns correct fleet.

**Risk:** breaks Rari/ElevenLabs immediately if secret config not synced. Mitigation: deploy + configure both sides in one window.

---

## Bite B — DB-level double-booking guard (F-BUG-1-DB)

**Goal:** Make concurrent overlapping bookings impossible at the DB layer.

### B1. Pre-flight audit (read-only, run first)
```sql
SELECT a.id, b.id, a.vehicle_id, a.start_date, a.end_date, b.start_date, b.end_date
FROM bookings a
JOIN bookings b
  ON a.vehicle_id = b.vehicle_id
 AND a.id < b.id
 AND a.status IN ('pending','confirmed')
 AND b.status IN ('pending','confirmed')
 AND tstzrange(a.start_date, a.end_date, '[)') && tstzrange(b.start_date, b.end_date, '[)');
```
Report any existing overlaps. If found → surface to you for resolution before the migration (constraint creation will fail otherwise).

### B2. Migration
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(start_date, end_date, '[)') WITH &&
  ) WHERE (status IN ('pending','confirmed'));
```
Half-open `[)` matches the app's `start < bEnd && end > bStart` semantics — back-to-back bookings (B starts at A's end) remain allowed.

### B3. Client error surfacing
- In `FleetContext.createBooking` and `EnhancedBookingDialog`, catch Postgres error code `23P01` (exclusion_violation) and surface a friendly "This vehicle was just booked for that window — please pick another time" toast, instead of generic failure.

### B4. Verification
- Vitest: existing booking tests still pass.
- Manual: attempt to create overlapping booking in UI → friendly error.
- Atomic test via psql: two simultaneous `INSERT`s → one wins, one fails with `23P01`.

**Risk:** if any current overlaps exist, migration fails — pre-flight catches this.

---

## Bite C — Unify toasts on Sonner (F-UI-1)

**Goal:** One toast queue, one API. Pick Sonner (already preferred per directives, simpler API, most new code uses it).

### C1. Inventory
- `rg -l "from \"@/hooks/use-toast\"|from \"@/components/ui/use-toast\""` → expected ~30 files.
- `rg -l "from \"sonner\""` → expected ~79 files.

### C2. Migrate shadcn `useToast` call sites → Sonner
Mechanical transform per file:
- `import { useToast } from "@/hooks/use-toast"` → `import { toast } from "sonner"`
- Remove `const { toast } = useToast();`
- `toast({ title, description, variant: "destructive" })` → `toast.error(title, { description })`
- `toast({ title, description })` → `toast.success(title, { description })` (or `toast(title, ...)` for neutral)
- `toast({ title, description, action: <ToastAction ...>… })` → `toast(title, { description, action: { label, onClick } })`

### C3. Remove shadcn toast plumbing
- Remove `<Toaster />` (shadcn) from `src/App.tsx`, keep `<Sonner />`.
- Delete `src/components/ui/toaster.tsx`, `src/components/ui/toast.tsx`, `src/components/ui/use-toast.ts`, `src/hooks/use-toast.ts`.
- Keep `useSuccessToast` / `useUndoToast` (already Sonner-based).

### C4. Verification
- `tsc --noEmit` clean (harness runs build).
- `bunx vitest run` green.
- Smoke: trigger a success toast (e.g. create booking) and an error toast (e.g. validation fail) — only one visual style appears, no duplicates.

**Risk:** ~30 files touched; mostly mechanical. Any custom `<ToastAction>` JSX needs the object-form Sonner action conversion.

---

## Sequence & decision points

1. **Bite A first** (security; smallest blast radius if I coordinate secrets with you). I'll pause after writing the code so you can paste secrets + sync ElevenLabs config before we test.
2. **Bite B second** (gated on pre-flight overlap audit — I'll surface results before applying the migration).
3. **Bite C last** (largest file count, no external coordination, easiest to verify).

## Out of scope (still flagged)
F-BUG-2 (fee policy decision), F-BUG-3 (historical payout reconciliation), F-OBS-1/2 (Sentry — new dep, needs your approval), F-OBS-3 (depends on Sentry), F-UI-2 (mobile dead routes — needs product decision: build / redirect / remove?), migration reconciliation, stale `.md` cleanup.

## One question before I start
For Bite C migration, are you OK with me deleting the shadcn toast files outright (clean cut), or do you want them kept for one release as fallback? Default: delete.
