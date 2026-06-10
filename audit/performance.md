# performance.md — Diagnosis (architect-reviewer)

Baseline (from build): main `index` chunk **2.65 MB** min / 766 KB gz; 92 PWA
precache entries ≈ 5.4 MB. Build output shows partial splitting already exists
(`BookEnhanced` 219 KB, `MotorIQEnhanced` 116 KB, `FleetPageEnhanced` 112 KB,
`CartesianChart` 289 KB) because `src/pages/Dashboard.tsx` lazy-loads its modules.
The 2.65 MB monolith is everything *else*.

---

## P1 — Top-level routes are NOT code-split (CRITICAL for first paint)
- Files: `src/App.tsx:60-98` (18 `<Route>`s, all statically imported);
  `vite.config.ts` (no `build.rollupOptions.manualChunks`).
- Finding: `Dashboard.tsx` lazy-loads its sub-modules (9 `lazy()` calls,
  `:41-49`), but **App-level routes are eager**. Only 2 `lazy()` call sites exist
  outside Dashboard (`grep React.lazy|lazy(() => src` → 2). So the marketing
  `Index`, `Auth`, legal pages, onboarding, and the entire `Dashboard` shell +
  all shared providers land in `index` (2.65 MB). A first-time visitor hitting
  `/` or `/auth` downloads the whole app shell.
- Fix: `const Auth = lazy(() => import('./pages/Auth'))` etc. for all heavy routes
  (Index, Dashboard, SuperAdmin, onboarding), wrapped in one `<Suspense>`. Expect
  the landing/auth entry to drop well under 300 KB gz.

## P2 — `xlsx` (~430-500 KB min) statically imported, pulled into main bundle
- Files: `src/lib/importUtils.ts:2` (`import * as XLSX from 'xlsx'`),
  `src/components/dashboard/CRMSection.tsx:33` (same).
- `xlsx` is only needed when a user imports/exports a spreadsheet — a rare,
  user-initiated action — yet it's a static import, so it's in the eager graph.
- Fix: `const XLSX = await import('xlsx')` inside the parse/export handlers. Removes
  ~half a MB from the critical path.

## P3 — `framer-motion` static-imported in 76 files → entirely in main chunk
- Finding: `grep "from 'framer-motion'" src` → **76** files. framer-motion (~110 KB
  gz) is animation sugar but is now unavoidably eager and tree-shake-resistant at
  this spread. It dominates shared-component weight in `index`.
- Fix options (descending value): (a) move framer-motion usage behind the
  route-split boundary so only the visited route pays for it; (b) replace trivial
  `motion.div` fade/slide with CSS transitions in the most-used shared components;
  (c) at minimum add a `manualChunks` group so it's a cacheable vendor chunk that
  doesn't invalidate on app-code changes.

## P4 — `recharts` (the `CartesianChart` 289 KB chunk) loads with margin/analytics
- Finding: 7 static `recharts` import sites. The 289 KB `CartesianChart` chunk
  confirms recharts is already split off the main bundle (good), but it loads as a
  unit whenever any chart-bearing module mounts. Margin tab pulls multiple chart
  components (`ExpenseBreakdownChart`, `RevenueExpenseTrendChart`, etc.).
- Fix: acceptable as-is given it's already a separate chunk; optionally lazy-mount
  individual charts below the fold. Low priority vs P1-P3.

## P5 — `react-grid-layout` in the customizable dashboard
- Files: `src/components/dashboard/CustomizableDashboard.tsx`, `useDashboardLayout.ts`.
- react-grid-layout + its CSS is heavy and only needed on the customizable overview.
  Confirm it's behind the Dashboard lazy boundary (it is, via DashboardOverview), so
  lower priority — but ensure it isn't also imported by a always-mounted shell component.

## P6 — `manualChunks` absent → poor long-term caching
- File: `vite.config.ts` — no `build.rollupOptions.output.manualChunks`.
- Every app-code change busts the single 2.65 MB hash, forcing re-download of
  vendor code that never changed. Add a vendor split (react/router/supabase/
  recharts/framer-motion/xlsx) for cache stability.

---

## Data-layer performance

## P7 — N+1 in conversation enrichment (3 queries × N conversations)
- File: `src/hooks/useTeamMessaging.ts:177-200`.
- For each conversation, sequentially: last message, members, then member profiles
  (`:179, :190, :197`). For N conversations that's 3N round-trips on every
  conversation-list load. Wrapped in `Promise.all` over the *outer* map so the N are
  parallel, but it's still 3N queries and the profiles query refetches overlapping
  member sets.
- Fix: one batched query per resource — fetch all `conversation_members` for the N
  convo ids via `.in('conversation_id', ids)`, all profiles via one `.in('id', allMemberIds)`,
  and last messages via a windowed query or a `team_conversations.last_message_*`
  denormalized column updated by the existing `sendMessage` path.

## P8 — Whole-table `select('*')` patterns (28 hook sites) without pagination
- Finding: `grep "select('*')" src/hooks` → 28. Several fetch entire tables
  (e.g. `usePresence.ts:71` `user_presence.select('*')` for the whole tenant;
  margin/messaging list loads). For a growing tenant these become unbounded scans
  shipped to the client.
- Fix: project only needed columns (already done in `useMarginData`) and add
  `.range()`/`.limit()` pagination to list fetches; scope `user_presence` to team
  members.

## P9 — Margin module fetches then filters client-side
- File: `src/components/margin/useMarginData.ts:90-160`.
- Bookings/expenses/payouts are fetched by team + date range, then vehicle/location/
  source filters are applied in JS (`:117-160`). For large fleets this over-fetches
  and filters on the client. The `payments` query (`:130-137`) is correctly batched
  via `.in('booking_id', ids)` (good — not N+1). Acceptable for current scale; flag
  for server-side filtering (RPC/view) as data grows.

---

## Implied missing DB indexes (static inference from query patterns)
- `bookings (team_id, start_date)` — `useMarginData.ts:93-97` filters team + start_date range.
- `bookings (vehicle_id, status, start_date, end_date)` — needed for any future
  overlap/availability query (see bugs.md BUG-1) and the booking calendar.
- `partner_payouts (team_id, created_at)` — `useMarginData.ts:106-110`.
- `vehicle_expenses (team_id, status, expense_date)` — `:98-104`; partly covered by
  `idx_vehicle_expenses_team_status` (migration `20260529032907:29`), but not the
  `expense_date` range component.
- `payments (booking_id)` — `.in('booking_id', …)` lookups; likely FK-indexed, verify.
- `team_messages (conversation_id, created_at desc)` — the per-convo "last message"
  query (`useTeamMessaging.ts:179-185`).
Confidence MED — index existence UNVERIFIED against hosted schema; inferred from
filter/order clauses vs migrations.

---

## Priority order
1. **P1** route-level code splitting in `App.tsx` (biggest first-paint win).
2. **P2** dynamic-import `xlsx`.
3. **P3** contain/replace `framer-motion`.
4. **P6** add `manualChunks` for cache stability.
5. **P7** de-N+1 conversation enrichment.
6. **P8/P9** column projection + pagination + (later) server-side margin filtering.
