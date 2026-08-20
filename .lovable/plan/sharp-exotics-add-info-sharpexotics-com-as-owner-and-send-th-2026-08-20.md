# Sharp Exotics — add info@sharpexotics.com as owner and send the invite

## Current state

Sharp Exotics already exists as a tenant (created today, not a demo account) with one active owner seat: `sharp@exotiq.ai`. There is no invitation on file for `info@sharpexotics.com`, and no account exists yet under the sharpexotics.com domain.

## What will happen

1. Create a pending **owner** invitation for `info@sharpexotics.com` on the Sharp Exotics team, valid for 7 days, attributed to your super-admin account. The existing `sharp@exotiq.ai` owner seat stays untouched.
2. Send the standard exotiq-branded invitation email to that address, from `exotiq <noreply@mail.exotiq.ai>`, with an accept link locked to `https://app.exotiq.ai` (no preview-domain links).
3. Confirm delivery and report back the invitation status and expiry date.

When they click through, the accept-invite flow attaches them to Sharp Exotics as owner rather than spinning up a new solo workspace.

## Notes

- No code or schema changes — this is data plus one email send.
- If they never accept, the invite can be re-sent from the tenant's People settings.

## Technical detail

- Insert one row into `user_invitations` (team_id `cf95932a-c33c-4ce2-b3d2-2cdc974d2b9d`, role `owner`, status `pending`, generated token, 7-day expiry).
- Invoke the `super-admin-send-invite` edge function with that invitation id; it resolves team name, builds the shared invite email, and sends via the existing mail provider.
- Verify with a follow-up query on `user_invitations` for the team.
