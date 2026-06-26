# Simplify Chantara's access to J Davidson's Fleet

## Situation

- `chantaralynn@gmail.com` — already a **manager** on J Davidson's Fleet (invited Apr 10, accepted).
- `echantara@gmail.com` — **does not exist** in our auth system. Never signed up. The "empty workspace" theory from my last message was wrong — there is no account under that address at all.
- She believes `echantara@gmail.com` was the invited address. It wasn't, but rather than argue, we just make both work.

## Recommended fix

Send a fresh manager invite to `echantara@gmail.com` for J Davidson's Fleet. When she signs up with that email, she lands directly inside J's team (the invite-acceptance flow already handles this correctly — confirmed in the `user_invitations` flow we patched earlier).

She then has two valid login emails, both with manager access to the same fleet:
- `chantaralynn@gmail.com` (existing, active)
- `echantara@gmail.com` (new invite, pending until she signs up)

No data merge needed because the `echantara` account doesn't exist yet — nothing to consolidate.

## Steps

1. Insert a row into `user_invitations` for `echantara@gmail.com`:
   - `team_id` = J Davidson's Fleet (`c71d6655-710a-46da-95b4-f9b0e5f91386`)
   - `role` = `manager`
   - `invited_by` = J's owner id (`fd9bb57e-…`)
   - `status` = `pending`, standard 7-day expiry
2. Trigger the existing invitation email so she gets the signup link (same path the in-app "Invite member" button uses).
3. Reply to her email: "Sent a fresh invite to echantara@gmail.com — click the link to set a password. Note: chantaralynn@gmail.com is also already active on the fleet, so either email will work going forward."

## What I will NOT do

- Won't delete or touch the `chantaralynn@gmail.com` account — it's the real, active one with history.
- Won't merge accounts (nothing to merge; `echantara` has no account).
- Won't change any auth/RLS logic — invite-accept flow already handles team placement.

## Open question

Do you want me to also leave the `chantaralynn@gmail.com` manager seat in place, or revoke it once she's signed in under `echantara@gmail.com`? Default: leave both, since she clearly uses both addresses.
