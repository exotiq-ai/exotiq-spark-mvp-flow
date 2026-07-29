## Combined plan — name-aware invitations + Laura's Denver admin invite

### 1. Schema (migration)
Add nullable `full_name text` to `public.user_invitations`. No policy/grant changes.

### 2. Edge function: `invite-user` (existing, in-app)
- Accept optional `fullName` in the request body; write to `user_invitations.full_name`.
- Greeting changes from `Hi there,` to `Hi ${fullName ?? "there"},`; add name to the "invited to join" line when present.
- Everything else in the template unchanged (Exotiq brand, CTA, expiry copy).

### 3. Edge function: `super-admin-send-invite` (new)
- JWT-verified; only callers listed in `super_admins` may invoke.
- Input: `{ invitation_id }`. Loads the invitation, resolves team name, sends the same Resend template as `invite-user` from `Exotiq <noreply@mail.exotiq.ai>`, subject `You've been invited to join <team name>`, CTA `https://app.exotiq.ai/auth?invite=<token>`, greeting uses `full_name` when set.
- Left deployed for future cross-tenant invites.

### 4. Edge function: `accept-invite` (existing)
- When creating/updating the accepting user's `profiles` row, copy `invitation.full_name` into `profiles.full_name` if the invitation carries one and the profile doesn't already have a name. User can still edit later.

### 5. Deploy `invite-user`, `super-admin-send-invite`, `accept-invite`.

### 6. Issue Laura's invite (data insert)
Insert one `user_invitations` row:
- `team_id` = `c71d6655-710a-46da-95b4-f9b0e5f91386` (Denver Exotic Rental Cars)
- `email` = `ms.lamoruso@gmail.com`
- `full_name` = `Laura Amoruso`
- `role` = `admin`, `permissions` = `[]`
- `invited_by` = `fd9bb57e-8ad7-4db9-9f8e-bfba30aac1e2` (J Davidson)
- `token` = freshly generated, `status` = `pending`, `expires_at` = now + 7 days

Also log a `role_audit_log` row (`action = 'user_invited'`, scoped to Denver, metadata notes it was issued via super-admin).

### 7. Send the email
Invoke `super-admin-send-invite` with the new invitation id. Verify a Resend message id comes back in the function logs.

### Notes
- `team_members` stays as-is — it's a join table with no name column. Laura's name lives on the invitation (for the email) and on her `profiles` row (after accept), which is the correct home.
- No changes to the in-app invite modal in this pass; can add a "Full name (optional)" field in a follow-up.
- No auth-config, rate-limit, or existing UI changes.