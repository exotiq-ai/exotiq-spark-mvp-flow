## Tara (Chantara) — Denver Exotics / J Davidson's Fleet

**Account:** chantaralynn@gmail.com · role: manager · team_member.is_active: true · invitation: accepted (2026-04-10).

### Active blockers

1. **No terms acceptances on record (hard block).**
   `terms_acceptances` is empty for her user. Current required docs (terms, privacy, aup, dpa) all have effective versions she has never accepted, so `TermsReacceptanceGate` will keep her behind the gate on every authenticated route. This is the only true "she can't use the app" blocker.

2. **Onboarding row mis-categorized (soft block / UI confusion).**
   `onboarding_progress` for her user has:
   - `onboarding_type = 'owner'` (she's an invited manager — should be the 2-step invitee flow)
   - `team_id = NULL` (should be `c71d6655…` = J's fleet)
   - `steps_completed = [1, 2, 4]` (step 3 skipped) but `completed_at` is set and `current_step = 4`
   She likely went through the owner wizard before her invite was reconciled. Not blocking auth, but it means the onboarding hook may re-prompt her, and her progress doesn't reflect that she's on J's team.

### Not blockers, but worth noting

- **175 unread notifications.** Noise from the duplicate `late_return` storm + general backlog; she'll be drowning when she next signs in. Worth a one-time mark-as-read for items older than the Phase 1 fix window.
- **No `user_settings` row.** Auto-created on first write — not a blocker, just means she's never opened settings.

### Proposed remediation (read-only until you approve)

a. **Unblock terms gate** — insert `terms_acceptances` rows for her *only if* J's team confirms she's re-accepted out-of-band, OR surface the gate to her so she clicks through herself. Recommend the latter (clean audit trail). No code change needed; she just needs to sign in and accept.

b. **Reconcile onboarding row** — one-row UPDATE on `onboarding_progress`:
   - `onboarding_type = 'invitee'`
   - `team_id = 'c71d6655-710a-46da-95b4-f9b0e5f91386'`
   - leave `completed_at` as-is so she's not re-prompted
   Mirrors the J Davidson fix from Phase 1.

c. **Notification hygiene (optional)** — mark her `late_return` duplicates from 2026-06-25 as read so she isn't greeted by the bug we already fixed. Strictly cosmetic.

d. **Add to the Denver email** — flag (a) and (b) to J's team so they know Tara needs to sign in and click through terms once, and that we corrected her onboarding categorization.

### Out of scope
No schema changes, no policy changes, no auto-accepting terms on her behalf, no edits to tenant-owned data beyond the onboarding row reconciliation (same scope as J's Phase 1 fix).
