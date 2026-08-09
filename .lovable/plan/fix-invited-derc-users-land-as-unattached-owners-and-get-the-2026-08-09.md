# Fix: invited DERC users land as unattached owners and get the terms gate

## What's actually happening

Verified in the database:

- Denver Exotic Rental Cars' owner (denverexoticrentalcars@gmail.com) **has** accepted the current Terms, Privacy, and AUP (version 2026-06-14) — the Legal settings page is telling the truth.
- Laura (laura@denverexotiqrentalcars.com) signed up at 00:17 UTC today. Her invitation to DERC (role: admin) is **still `pending`**, and she has **no team membership, no team, and no role** at all.

Cause: an invitation is only consumed when the person signs up **through the invite link** (the token in the URL). Laura created her account from the normal sign-up form instead. The signup trigger sees a pending invite for her email and deliberately skips creating a personal team — so she ends up attached to nothing.

Consequences of that orphan state:
- The terms gate can only see her own acceptances (no team = no owner acceptance to inherit), so it blocks her with "updated terms require your acceptance".
- She is treated as a brand-new account rather than a DERC admin.

## Fix

**1. Claim pending invites by email on sign-in/sign-up (the real fix)**

Add a server-side claim step so a matching pending invitation is applied whenever a user authenticates, regardless of whether they used the link:

- Extend the existing `accept-invite` edge function with an `action=claim` path: takes the caller's verified JWT email, finds any `pending`, non-expired invitation for that email, inserts the `team_members` row with the invited role, assigns the user role, and marks the invitation `accepted`.
- Call it once from the auth context after a session is established (sign-in and sign-up), only when the user has no active team membership. Then refresh the team context.
- Guard it: email match must come from the JWT (never the client), skip expired/revoked invites, and no-op if the user is already a member.

**2. Repair Laura's account now**

Attach her to DERC as `admin`, add the matching role row, and mark her invitation accepted, so she is unblocked immediately without a re-invite.

**3. Make the terms gate honest for unattached users**

If a signed-in user has no team at all, they should not be shown an owner-level "accept for your organization" gate. Two adjustments:
- After the invite claim runs, the gate re-evaluates against the DERC owner's acceptance (which is current) and disappears.
- If a user genuinely has no team and no pending invite, keep the gate but show the individual consent statement (not the "bind my organization" wording).

**4. Sweep for other orphans**

Check for any other authenticated users with no team membership and a pending invite for their email, and claim them via the same path (currently only affects DERC; ebtbnick@gmail.com's invite is still pending but that account has not signed up).

## Technical notes

- Files: `supabase/functions/accept-invite/index.ts` (new `claim` action), `src/contexts/AuthContext.tsx` (post-session claim call), `src/components/legal/TermsReacceptanceGate.tsx` (no-team wording), `src/lib/legal/versions.ts` (individual consent statement variant).
- Data repair: one insert into `team_members`, one into `user_roles`, one update on `user_invitations` for Laura.
- No schema change required.
