# Email Communications — Status & Build Plan

Deliverable: a single new markdown file at `docs/EMAIL_COMMS_STATUS.md` (no code or schema changes). It will document where Exotiq stands today on tenant + guest email, what's missing, provider options with real costs, and a recommended build path.

## What I already know from the codebase

**Currently wired (all via Resend SDK directly, no queue, no logging, no templates package):**

| Edge function | Purpose | From address |
|---|---|---|
| `invite-user` / `resend-invite` | Team member invites | `noreply@mail.exotiq.ai` |
| `accept-invite` | Invite acceptance confirmation | `notifications@exotiq.io` |
| `role-change-notification` | RBAC role updates | `noreply@mail.exotiq.ai` |
| `mention-notification` | @mentions in comments/messages | `notifications@resend.dev` (Resend sandbox — not branded) |
| `send-compliance-email` | GDPR / compliance notices | `compliance@notify.exotiq.ai` |
| `send-deletion-confirmation` | Account deletion confirms | `noreply@resend.dev` (sandbox) |
| `send-signed-document` | Signed rental docs to guests | `noreply@exotiq.io` |
| `rari-email-summary` | Rari AI daily summary | `noreply@exotiq.ai` |
| `uptime-check` | Internal alerts | Resend |

**Inconsistencies worth calling out in the doc:**
- 4 different sender domains in use: `exotiq.ai`, `mail.exotiq.ai`, `notify.exotiq.ai`, `exotiq.io`, plus 2 fallbacks on `resend.dev`.
- No central template package, no shared layout/branding, no React Email components.
- No queue, no retry, no `email_send_log`, no suppression list, no unsubscribe.
- No per-tenant sender (every email comes "from Exotiq", not from the rental company).

**What is NOT built (the heart of your question):**
- Booking confirmation to guest
- Booking confirmation/receipt to tenant
- Pickup reminder (T-24h / T-2h)
- Post-rental thank-you + review request
- Payment receipt / VAT invoice email (VAT invoice exists as PDF; not emailed)
- Damage claim notice to guest
- Refund issued notice
- Cancellation notice
- Tenant white-label sender (per-fleet "from" domain)

**Lovable Emails (built-in) is NOT set up** — no `setup_email_infra` run, no `_shared/email-templates/`, no `_shared/transactional-email-templates/`, no `process-email-queue`.

## Document structure I'll write

1. **Executive summary** — one-paragraph "where we stand."
2. **Current state inventory** — the table above + the inconsistencies list.
3. **Gap analysis** — every missing guest- and tenant-facing email, grouped by booking lifecycle (pre-book, confirm, pre-pickup, in-rental, post-return, exception flows).
4. **Architecture options** — four routes, with honest trade-offs:
   - **A. Lovable Emails (built-in)** — managed queue, retry, DLQ, suppression, unsubscribe, React Email templates, dashboard. Cost: included in Lovable Cloud; sending via Lovable's pooled Mailgun. Best for: fastest path, single sender domain, low ops.
   - **B. Resend direct (what we have today, hardened)** — keep Resend, add a shared `send-email` function, React Email templates package, `email_send_log` table, idempotency keys, basic suppression. Cost: Resend $0 (3k/mo, 100/day) → $20/mo (50k) → $90/mo (100k). Best for: full control over sender domains incl. per-tenant.
   - **C. Postmark / SendGrid / Mailgun** — comparison row only (Postmark ~$15/10k, best deliverability for transactional; SendGrid $19.95/50k; Mailgun pay-as-you-go).
   - **D. Agentic / workflow tools** — Resend + Inngest (durable retries, fan-out, scheduled "T-24h" reminders without cron-in-Postgres), or n8n / Trigger.dev for visual flows. Cost: Inngest free tier 50k steps/mo, $20/mo for 200k.
5. **Per-tenant white-label sender** — what each provider supports (Resend domains API: programmatic add + DNS verify; Lovable Emails: single delegated subdomain only today). This is the deciding factor for the marketplace path.
6. **Customization model** — React Email templates, brand tokens pulled from `teams` (logo, color, business name), preview data, snapshot tests.
7. **Cost model** — projected monthly volume at 100 / 500 / 2,000 active rentals, mapped to each provider's pricing tier, including DKIM/domain add-on costs.
8. **Recommendation** — staged plan:
   - **Phase 1 (this sprint):** consolidate existing 10 functions onto one shared sender + one verified domain (`mail.exotiq.ai`), add `email_send_log`, kill `resend.dev` fallbacks. No new templates yet.
   - **Phase 2:** ship the 6 booking-lifecycle templates (confirm, receipt, T-24h reminder, post-return thank-you, review request, cancellation) as React Email components. Trigger from existing booking state changes.
   - **Phase 3 (marketplace prereq):** per-tenant verified sender domains via Resend Domains API, with a self-serve "verify your domain" flow in tenant Settings → Branding.
   - **Phase 4:** move scheduled sends (reminders, review nudges) onto Inngest for durable retries and easy delay logic instead of pg_cron.
9. **Open questions for you** — single sender vs per-tenant, whether guests reply to tenant or to Exotiq, SMS/in-app parity, marketplace timing.

## Out of scope for this turn
- No code, no migrations, no template scaffolding, no provider switch — just the markdown analysis.

Approve and I'll write the file.
