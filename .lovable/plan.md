# Assign owner role from the Super Admin portal

## Recommendation

Worth building, but keep it small. Right now every ownership change goes through me, which means it only happens when I'm around and there's no record of it in your own audit trail. A single "People" section inside the tenant drawer you already open removes that dependency. It is not worth a whole new tab.

## What you'll get

Open a tenant in the Super Admin portal (Tenants tab, click a row) and a new **People** section appears under the existing details:

- Every member of that workspace with name, email and current role.
- A role dropdown next to each person (Owner, Admin, Manager, Operator, Viewer).
- Changing someone to Owner asks you to confirm, then applies immediately.
- An "Invite owner by email" button for the case where the person has no account yet — reuses the invite email you already send.
- Guardrails: a workspace can never be left with zero owners, and you can't remove your own support access by accident.
- Every change is written to the audit log with your email, the tenant, who was changed, from which role to which.

## Notes

- Existing owners keep their role unless you explicitly change it — promoting someone to owner does not demote anyone.
- Tenants see the change reflected in their Team Hub straight away.
- This does not give you the ability to sign in as them; that's still the Support Access tab.

## Technical detail

- New edge function `super-admin-set-team-role`: validates the caller's bearer token against `super_admins` (active only) server-side, then upserts the target `user_roles` row scoped to `team_id`, blocking any update that would drop the team's owner count to zero.
- Writes a `role_audit_log` row (actor = super admin user id, target user, old role, new role, team) plus an `admin_audit_log` entry.
- New `SuperAdminPeopleSection` rendered inside `TenantDetailDrawer.tsx`, reading members via a super-admin-scoped query on `team_members` joined to `profiles` and `user_roles`.
- Owner invites reuse the existing `user_invitations` insert plus `super-admin-send-invite`, so no new email template.
- No schema migration required — `user_roles` already carries `team_id` and the `app_role` enum already includes `owner`.
