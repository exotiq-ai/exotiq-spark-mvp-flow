# Support Access for customer accounts

## The problem

You need to work inside a customer's account (upload photos, audit fleet, finish setup) without owning a login there. Asking the customer for their password is not an option, and adding your personal email as a normal team member pollutes their user list and never expires.

## What other SaaS companies do

Almost every B2B SaaS solves this one of two ways:

1. **Support seat / "act as staff on their account"** — support staff get a temporary, revocable membership on the tenant, acting as *themselves*. Every action is attributable to the real support person. Used by Linear, Notion, Vercel.
2. **"Log in as customer" impersonation** — support assumes an actual customer identity in a read/write session with a persistent banner and full audit. Used by Stripe, Shopify, Intercom.

Impersonation looks the most magical but is the riskier one: actions are recorded as the customer, so if something is deleted there's no clean way to prove who did it. Because your product handles money movement (Stripe Connect payouts, refunds, bookings) and signed legal documents, the safer default is **support seats**, with impersonation kept read-only if you want it later.

## Recommended plan: time-boxed Support Access

**Grant a support session from Super Admin**

- New **Support Access** tab in the Super Admin portal listing every tenant.
- "Start support session" on a tenant asks for a reason and a duration (2h / 8h / 24h) and creates a `support_access_grants` row.
- The grant adds the super admin to that tenant with an `admin`-equivalent support role, flagged so it never appears in the customer's Team directory as a normal employee.
- Expired grants are swept automatically; "End session" revokes instantly.

**Working inside the tenant**

- A tenant switcher appears in the top bar for super admins with an active grant, so you can jump between your own account and the customer's without logging out.
- While in a customer tenant, a persistent amber banner reads: *"Support session — you are working inside Exotics By The Bay. Ends in 5h 42m. [End session]"*.
- Everything else in the app works normally, so photo uploads, fleet import, and setup all just work, and every row you create is stamped with your real user id.

**Audit + customer trust**

- Every grant start/end is written to the admin audit log with tenant, reason, duration, and actor.
- Optional but recommended: notify the tenant owner by email when a support session starts, and show a "Support access history" list in their Settings. This is what turns the feature from "vendor can peek at my data" into a trust signal.
- Guardrails: support sessions cannot change billing/subscription, cannot initiate refunds or payouts, and cannot delete the team or remove owners.

**For Exotics By The Bay right now**

Joe's owner invite is already pending. Two paths, and they're not exclusive:
- Ship Support Access and start a session on their tenant to load photos and audit inventory yourself.
- Or, as an immediate unblock today, have Joe accept his invite and invite `hello@exotiq.ai` as an admin, which you remove when the setup work is done.

## Phasing

1. **Phase 1 (recommended now)** — support grants table, Super Admin tab, tenant switcher, banner, audit logging.
2. **Phase 2** — customer-visible support access history and owner email notification.
3. **Phase 3 (only if needed)** — read-only impersonation for reproducing a customer's exact view of a bug.

## Technical notes

- New table `support_access_grants` (tenant, admin user, reason, granted_at, expires_at, revoked_at) with service-role-only writes and RLS allowing the tenant owner to read their own history.
- Support membership is implemented as a `team_members` row plus a `user_roles` row carrying a `is_support` marker, so existing team-scoped RLS keeps working unchanged. No RLS bypasses are introduced.
- `TeamContext` currently resolves a single team from the first membership. It needs an explicit active-team selection persisted per session so the switcher can override the default, without changing behavior for normal single-team users.
- The banner and switcher render only when an unexpired grant exists; expiry is enforced server-side in the grant lookup, not just in the UI.
- A scheduled sweep revokes expired grants and removes the support membership rows.
