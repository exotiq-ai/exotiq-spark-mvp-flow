
Goal
- Stop the “Taking longer than expected” loop from coming back after a few minutes.
- Make login + initial dashboard load stable in both the Lovable preview and the published app.
- Keep changes tightly scoped (no “random refactors”), focused only on the real root causes.

What’s actually happening (based on your screenshot + code review)
1) The dashboard loop is not “okay”
- The red console errors to api.lovable.dev / Firestore are editor/preview infrastructure noise and can happen even when the app is fine.
- But the “Taking longer than expected” banner is our app telling you Fleet data fetch is stuck/slow. That can affect published too, because it’s driven by backend queries + app state.

2) The backend permissions (RLS) for team membership are currently recursive
- In the database, the SELECT policy on public.team_members is:
  “Team members can view team roster” USING (is_team_member(auth.uid(), team_id) OR is_super_admin(auth.uid()))
- The function is_team_member() queries team_members again.
- This creates a recursion trap that can intermittently hang or explode query cost. It explains “works once after /reset, then breaks again” patterns because timing + cache + connection variability changes how quickly it hits the trap.

3) FleetContext realtime still subscribes before the team is resolved
- In FleetContext, the realtime subscription effect currently runs as soon as user exists, even while teamLoading is still true.
- That’s why your console shows:
  “Setting up realtime for: <userId>:no-team”
- This causes unnecessary subscriptions and can trigger refresh/refresh races during the exact period we’re trying to stabilize.

4) AuthContext uses an async onAuthStateChange callback with Supabase calls inside
- AuthContext’s onAuthStateChange callback is async and calls:
  - database queries (profiles)
  - auth signOut/refresh
  - functions.invoke
- This pattern is specifically known to cause intermittent auth deadlocks or “stuck signing you in” states, because auth state changes use internal locks and re-entrant calls can wedge the client.
- This is a major reliability smell and aligns with your “stale account / nothing loads” experience.

What we will change (tight scope, high impact)
A) Database fix (required): remove recursive team_members SELECT policy
- Replace the recursive policy with a non-recursive strategy that:
  - still lets team members read appropriate membership rows
  - does NOT rely on querying team_members from inside team_members policies
- Implementation approach:
  1) Create new SECURITY DEFINER helper functions that:
     - only evaluate the current user (no user_id parameter, prevents probing other users)
     - explicitly disable row security inside the function (SET row_security = off) so the lookup cannot re-enter policies
     Examples:
       public.is_my_team_member(p_team_id uuid) returns boolean
       public.is_my_team_admin(p_team_id uuid) returns boolean
  2) Update public.team_members SELECT policy to use these helpers, e.g.:
     - allow if is_my_team_member(team_id) OR is_super_admin(auth.uid())
     (This preserves “team roster visible to team members” behavior without recursion.)
- Why this is still needed even though /reset “worked”:
  - /reset clears caches and can temporarily dodge the recursion timing, but it doesn’t remove the underlying recursion hazard.

B) Frontend fix (small): gate realtime subscriptions on teamLoading
- Update FleetContext realtime effect:
  - Early return if teamLoading is true
  - Use the same “teamKey” concept we already used for initial load (team id or “no-team”) but only after team resolution is complete.
  - Add teamLoading to the effect dependencies.
- Outcome:
  - No more “user:no-team” realtime subscription during team resolution.
  - Less background churn, fewer accidental refresh cascades.

C) Frontend fix (important): make AuthContext auth listener synchronous, defer side-effects
- Refactor AuthContext’s supabase.auth.onAuthStateChange callback to:
  - be synchronous: only set user/session/loading flags immediately
  - move all Supabase calls (DB reads, invoke, signOut, onboarding checks) into a setTimeout(0) task
  - add a “side-effect sequence guard” so stale async work can’t apply after another auth event arrives
- Outcome:
  - Removes a known deadlock class.
  - Prevents “logged out → log back in → wrong/stale session feeling → stuck” loops caused by re-entrant auth operations.

D) Make failures visible and actionable (minimal instrumentation)
- TeamContext:
  - ensure errors are stored into TeamContext.error (right now some paths log devError and stop, but don’t surface a usable error string)
- Dashboard recovery UI:
  - when we show “Taking longer…”, include a short “what we’re waiting on” diagnostic line (authLoading/teamLoading/currentTeam id present) so we can immediately tell whether it’s auth, team resolution, or fleet fetch.

What we will NOT change (to keep this safe)
- We will not rewrite your data model.
- We will not change unrelated RLS policies beyond what’s needed to remove the recursion trap.
- We will not touch service worker / PWA caching strategy unless we see hard evidence it’s involved in this specific loop.
- We will not change the auto-recovery (/reset) behavior that already helped you.

How we will validate (so you’re not guessing)
1) Preview validation
- Hard refresh inside preview
- Sign in
- Confirm console no longer shows:
  - “Setting up realtime for: <userId>:no-team” while teamLoading is true
- Confirm Team says loaded quickly:
  - “[TeamContext] Team loaded …”
- Confirm Fleet fetch completes:
  - “[FleetContext] Refresh complete … vehicles: …”
- Leave it open for 10–15 minutes, switch tabs once, return
- Ensure no “Taking longer than expected” banner returns

2) Published validation
- Open the published URL in a normal browser tab (not inside editor)
- Sign in and repeat a refresh
- Confirm dashboard loads consistently
- If this backend recursion is the culprit (it is), the published app will benefit equally.

Risk & rollback
- DB change is targeted to team membership read behavior. If anything unexpected happens, we can revert the policy to a prior version via another migration.
- Frontend changes are localized to AuthContext and FleetContext effect gating.

Implementation checklist (what I’ll do once you approve)
1) Create a DB migration:
   - Add is_my_team_member + is_my_team_admin helper functions (SECURITY DEFINER, row_security=off)
   - Replace the public.team_members SELECT policy to use the non-recursive helpers
2) Edit src/contexts/FleetContext.tsx:
   - Gate realtime setup on teamLoading
   - Fix dependency array accordingly
3) Edit src/contexts/AuthContext.tsx:
   - Make onAuthStateChange callback synchronous
   - Move all Supabase calls into deferred tasks with guards
4) Small update to TeamContext + DashboardOverviewEnhanced for clearer surfaced error diagnostics
5) Verify via logs and consistent load behavior

Why your “api connection issue” errors aren’t the real blocker
- The ERR_CONNECTION_CLOSED / QUIC errors shown in the console are coming from Lovable/editor tooling endpoints and browser extensions (the inject.bundle.js lines are a giveaway).
- Those are annoying, but they are not the reason your fleet fetch is hanging.
- The recursion + auth callback pattern are real app-level causes that can break both preview and published.

