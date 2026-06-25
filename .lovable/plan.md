## Denver Exotics (J Davidson's Fleet) health snapshot

Team `c71d6655…` · owner `denverexoticrentalcars@gmail.com` · manager `chantaralynn@gmail.com` · 95 bookings, last on 2026‑06‑23. Auth-side: no failed logins for either user in the 7‑day auth log window. App-side, four real issues surfaced:

1. **Manager Chantara cannot get past the Terms gate.** She has **zero** rows in `terms_acceptances`. The gate (`TermsReacceptanceGate.tsx`) checks the *signed-in user's own* acceptance history. Non-owner/admin roles see the read-only "your account owner must accept" screen with no checkbox — so she is permanently blocked even though the owner accepted on 2026‑06‑16. This is almost certainly what her teammate reported.
2. **Cross-tenant blast radius is large.** 18 active team members exist platform-wide, but only **4 distinct users** have ever written to `terms_acceptances`. Every non-admin in every tenant is in the same locked state as Chantara.
3. **Owner J Davidson's acceptance is stale.** His 2026‑06‑16 row covers only `terms / privacy / aup` (3 docs). The current required set written by newer signups is 8 docs (adds `dpa, sms, cookies, dmca, transfer_addendum`). On his next login the gate will fire again — fine on its own, but combined with #1 it means he must accept before Chantara is unblocked, and her unblock still won't happen without code changes.
4. **Two pending Denver invites expired on 2026‑05‑26** (`mariamedinadesigns@gmail.com` admin, `aronnovoseletsky@yahoo.com` viewer). If either tried to click their invite link recently they'd hit "invitation expired."

Minor noise (not user-facing blockers): owner's `onboarding_progress` is stuck at step 1 since Jan despite heavy app use; the 2026‑06‑25 late-return notifier fired duplicate notifications (12 events written twice in the same second) for each member. Worth a follow-up, not part of this fix.

## Plan — make the terms gate tenant-safe, then notify Denver

### 1. Fix `TermsReacceptanceGate.tsx` (the root cause of the cross-tenant freeze)

Change the gate's acceptance evaluation from "this user has rows" to "this user is covered." A user is covered if **either** their own `user_id` has accepted every required doc at the current version, **or** any owner/admin on their current team has accepted every required doc at the current version. This matches the legal model already in the schema (`is_authorized_representative = true` when admins accept "on behalf of" the team) and unblocks all existing non-admin members the moment their owner accepts.

Specifically:
- Query `terms_acceptances` for `user_id = me OR (team_id = currentTeam.id AND user_id IN (owners/admins of that team))`, ordered desc, limited.
- Compute `latest` doc→version map from the combined rows; keep the existing `stale` check against `LEGAL_DOCS`.
- Keep the existing UI: owners/admins see the checkbox+accept button; non-admins still see the read-only "ask your owner" screen, but only when the team genuinely has no current admin acceptance.
- Keep `inFlightRef` guard, the `limit(50)`, and the "read failed → allow entry" fallback.

No DB changes, no migration, no RLS change — the existing `Users read their own acceptances` policy already grants `SELECT` on rows where `team_id IS NOT NULL AND is_team_member(auth.uid(), team_id)`, so the broader query is already allowed.

### 2. Verify the fix in-app (Playwright, scoped, no writes)

- Authenticated as Chantara would require her credentials, so instead verify with the existing managed session: load `/dashboard`, then in the page evaluate the new query against `terms_acceptances` with `user_id = '264d5889…'` plus the team-admin OR clause and assert it would resolve as "covered" once the owner's row is current.
- Static check: assert non-admin role still sees the read-only screen when the team has no admin acceptance (force the state with a stubbed return in a unit-style check inside the page console).

### 3. Communicate to Denver

Once the gate is shipped, draft a short note for J Davidson covering:
- "Re-accept the updated terms once when you next sign in (you'll see the dialog — 5 new documents added since June)."
- "Chantara will be unblocked automatically after you accept."
- Offer to re-send the two expired invitations (`mariamedinadesigns@gmail.com`, `aronnovoseletsky@yahoo.com`). I will not auto-resend without your go-ahead because invite emails are user-visible.

### Out of scope for this pass (flagged for a separate ticket)
- Duplicate `late_return` notifications fired on 2026‑06‑25 01:06 (looks like the alerts cron ran twice).
- Owner's `onboarding_progress` stuck at step 1 — cosmetic, but should auto-complete when key milestones are hit.

### Technical details

**File touched:** `src/components/legal/TermsReacceptanceGate.tsx` only.

**New query shape** (inside `evaluate`):
```ts
// 1. Get admin user_ids on the current team (if any).
const adminIds: string[] = [];
if (teamId) {
  const { data: admins } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"]);
  for (const a of admins ?? []) adminIds.push(a.user_id);
}

// 2. Pull this user's rows plus any admin rows scoped to this team.
const userIds = Array.from(new Set([user.id, ...adminIds]));
const { data, error: qErr } = await supabase
  .from("terms_acceptances")
  .select("documents_accepted,user_id,team_id,accepted_at")
  .in("user_id", userIds)
  .or(`team_id.eq.${teamId ?? "00000000-0000-0000-0000-000000000000"},user_id.eq.${user.id}`)
  .order("accepted_at", { ascending: false })
  .limit(100);
```
Then fold all matching rows into the `latest` map exactly as today. The `stale` derivation, the dialog, the consent statement, the `record-terms-acceptance` invoke for admins, and the "ask your owner" read-only path are unchanged.

**Why this is safe for existing customers**
- Owners/admins behavior is identical: same dialog, same payload, same edge function.
- Non-admins only gain access — never lose it. If no admin has accepted, they still see the read-only blocker.
- No schema migration, no backfill, no policy change. Reversible by reverting one file.
