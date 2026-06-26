# Email Communications — Status & Build Plan

_Last updated: 2026-06-26_

## 1. Executive Summary

Exotiq's email system today is a collection of **10 ad-hoc Edge Functions** that each call the **Resend SDK directly**. There is **no shared template package, no queue, no retry, no send log, no suppression list, no unsubscribe, and no per-tenant branding**. Sender addresses are scattered across 4 different domains plus 2 Resend sandbox fallbacks. The booking lifecycle itself (guest confirmation, receipt, pickup reminder, post-rental thank-you, review request, cancellation, refund) has **zero email coverage** — those flows currently live entirely in-app.

Lovable's built-in "Lovable Emails" infrastructure (queued, branded, with a dashboard) is available but **not enabled**.

The honest recommendation: keep Resend (we already pay for the deliverability and we need per-tenant verified domains for the marketplace), but stop using it as 10 disconnected one-off scripts. Consolidate to one sender, add a `email_send_log`, then ship the booking-lifecycle templates as React Email components. Move scheduled sends (reminders, review nudges) onto Inngest in Phase 4.

---

## 2. Current State Inventory

### 2.1 Wired today (all direct-Resend, no queue, no logging)

| Edge function | Purpose | Recipient | From address |
|---|---|---|---|
| `invite-user` | Team member invite | tenant staff | `noreply@mail.exotiq.ai` |
| `resend-invite` | Re-send team invite | tenant staff | `noreply@mail.exotiq.ai` |
| `accept-invite` | Invite-accepted confirmation | tenant staff | `notifications@exotiq.io` |
| `role-change-notification` | RBAC role change | tenant staff | `noreply@mail.exotiq.ai` |
| `mention-notification` | @mentions in comments/messages | tenant staff | `notifications@resend.dev` ⚠️ sandbox |
| `send-compliance-email` | GDPR / compliance notices | tenant + guest | `compliance@notify.exotiq.ai` |
| `send-deletion-confirmation` | Account-deletion confirm | tenant | `noreply@resend.dev` ⚠️ sandbox |
| `send-signed-document` | Signed rental contract PDF | guest | `noreply@exotiq.io` |
| `rari-email-summary` | Rari AI daily summary | tenant owner | `noreply@exotiq.ai` |
| `uptime-check` | Internal infra alerts | Exotiq ops | Resend |

### 2.2 Structural problems

- **4 sender domains in production simultaneously**: `exotiq.ai`, `mail.exotiq.ai`, `notify.exotiq.ai`, `exotiq.io` — each requires its own DKIM/SPF and earns its own sender reputation. This actively hurts deliverability.
- **2 Resend sandbox fallbacks (`resend.dev`)** are reaching real users — these will land in spam and look unprofessional.
- **No shared template module.** Each function inlines its own HTML string. No brand consistency, no React Email, no preview.
- **No `email_send_log` table.** We cannot answer "did Tara get her invite?" without opening the Resend dashboard.
- **No suppression list, no unsubscribe link.** Compliance gap (CAN-SPAM, CASL, GDPR).
- **No retry / queue / DLQ.** A 429 or 5xx silently drops the email.
- **No idempotency keys.** Re-running a booking-state trigger sends duplicate emails.
- **No per-tenant sender.** Every email reads "from Exotiq" — guests never see the rental company's brand. This is a blocker for the marketplace and for tenant white-labeling.

### 2.3 Lovable Emails (built-in) status

**Not set up.** No `setup_email_infra` migration has been run. No `_shared/email-templates/` directory. No `_shared/transactional-email-templates/` directory. No `process-email-queue` worker. No `email_send_log`, `suppressed_emails`, or `email_unsubscribe_tokens` tables.

---

## 3. Gap Analysis — What's Missing

Grouped by booking lifecycle. **None of these are built today.**

### Pre-booking
- Quote / hold confirmation (when a guest requests but hasn't paid)
- Payment-required reminder (24h after quote)

### At confirmation
- **Booking confirmation to guest** (with PDF receipt + rental terms)
- **Booking notification to tenant** (new reservation alert)
- Payment receipt / VAT invoice email (`generate-vat-invoice` already produces the PDF — it just isn't emailed)

### Pre-pickup
- T-72h pickup reminder with check-in instructions, address, what-to-bring
- T-24h reminder with driver license verification link
- T-2h pickup reminder with live ETA / contact card

### In-rental
- Vehicle handoff confirmation (signed inspection PDF)
- Mid-rental check-in (for multi-week rentals)
- Booking modification notice (date change, vehicle swap, price adjustment)

### Post-return
- Vehicle return + final receipt
- Damage / fee adjustment notice
- **Review request** (24h after return) — feeds reputation engine
- Refund issued notice

### Exception flows
- Cancellation confirmation (guest-initiated)
- Cancellation notice (tenant-initiated, with refund details)
- Decline notice (tenant rejects pending booking)
- Payment failure / retry
- Damage claim opened
- Damage claim resolved
- No-show notice

### Tenant-side ops (not guest-facing)
- Daily booking digest
- New review received
- Payout sent
- Maintenance overdue
- Subscription renewal / dunning

**Total templates needed for full coverage:** ~25. **Minimum viable set:** 6 (confirm, receipt, T-24h reminder, post-return thank-you, review request, cancellation).

---

## 4. Architecture Options

### Option A — Lovable Emails (built-in)

Managed pgmq queue, retry with backoff, DLQ, suppression list, unsubscribe tokens, React Email templates in `_shared/`, dashboard at Cloud → Emails.

**Pros:** zero ops; queue + retry + log "for free"; one tool call to scaffold; built-in unsubscribe + bounce/complaint handling; admin dashboard.
**Cons:** **single delegated subdomain only** — cannot send "from each tenant's domain", which is the marketplace dealbreaker; harder to migrate off later; sends through Lovable's pooled Mailgun reputation (which is fine, but it's not _your_ reputation).
**Cost:** included in Lovable Cloud.
**Best for:** if we decide guests always see "from Exotiq" — Phase 1 and 2 in days, not weeks.

### Option B — Resend, hardened (recommended baseline)

Keep Resend (already integrated), but consolidate behind a single shared `send-email` Edge Function backed by React Email templates, an `email_send_log` table, idempotency keys, and a basic suppression list.

**Pros:** keeps existing 10 integrations working during migration; **Resend Domains API supports per-tenant verified domains programmatically** (critical for white-label + marketplace); industry-leading deliverability; React Email is their native format; cheap.
**Cons:** we build queue/retry/dashboard ourselves (or skip and use Resend's dashboard); we own DKIM verification UX for tenants.
**Cost:**
| Tier | Price | Volume |
|---|---|---|
| Free | $0 | 3,000/mo, 100/day, 1 domain |
| Pro | $20/mo | 50,000/mo, unlimited domains, 7-day log retention |
| Scale | $90/mo | 100,000/mo, 90-day retention |
| Enterprise | custom | dedicated IP, SLAs |

At today's scale (~10 tenants, low booking volume) we are well within free tier. The marketplace launch will push us to Pro.

### Option C — Postmark / SendGrid / Mailgun

| Provider | Sweet spot | Pricing | Per-tenant domains |
|---|---|---|---|
| **Postmark** | Highest transactional deliverability; opinionated against marketing | $15 / 10k, $50 / 50k | Yes, via Sender Signatures + Domains API |
| **SendGrid** | Established, broad feature set, weaker UX | $19.95 / 50k | Yes (Subusers + Domain Authentication) |
| **Mailgun** | Pay-as-you-go, EU regions, what Lovable Emails uses underneath | $35 / 50k Foundation tier | Yes (multiple sending domains) |

None offer a compelling reason to switch from Resend given Resend already has React Email + Domains API + we're already integrated.

### Option D — Agentic / workflow tools

Wrap the email sender in a durable workflow runtime to handle **scheduled** sends (T-24h reminder, T+24h review request) and **multi-step** flows (send confirmation → if no driver-license upload in 48h, send reminder → if still none in 7d, cancel + refund).

| Tool | Cost | Fit |
|---|---|---|
| **Inngest** | Free 50k steps/mo, $20/mo for 200k | Best fit. TypeScript-native, Deno-compatible, already has a Lovable connector. Durable retries, sleep-until, fan-out — replaces pg_cron for email scheduling cleanly. |
| **Trigger.dev** | $20/mo Pro | Similar to Inngest. Slightly heavier UI. |
| **n8n / Zapier** | n8n self-host free, Zapier $20+/mo | Visual flows; useful for non-engineering tenant marketing flows; overkill for transactional. |

**Recommendation:** Inngest in Phase 4, not Phase 1. Don't add it until we have at least 2 scheduled-send templates that need it.

---

## 5. Per-Tenant White-Label Sender

This is the deciding architectural question for the marketplace.

| Approach | Resend Domains API | Lovable Emails | Postmark | SendGrid |
|---|---|---|---|---|
| Programmatic domain add | ✅ `POST /domains` | ❌ single delegated zone only | ✅ | ✅ |
| Tenant self-serve DNS verify UI | ✅ poll `GET /domains/:id` | ❌ | ✅ | ✅ |
| Per-tenant DKIM keys | ✅ | ❌ | ✅ | ✅ |
| "Reply-to tenant" without verifying | ✅ via `reply_to` header | ✅ | ✅ | ✅ |

**Two-tier model we should adopt:**
1. **Default tier (no setup):** sent from `bookings@mail.exotiq.ai`, `Reply-To: tenant@theirdomain.com`. Works for everyone immediately.
2. **Pro / Marketplace tier:** tenant adds their domain in Settings → Branding → Email Domain. We POST it to Resend Domains API, show them the DKIM/SPF records to add, poll until verified, then flip their sender to `bookings@theirdomain.com`. Guests now see fully branded email from the rental company.

This requires **Option B (Resend)** as the foundation. Lovable Emails cannot do this today.

---

## 6. Customization Model

- **Templates:** React Email (`@react-email/components`) `.tsx` files in `supabase/functions/_shared/email-templates/`.
- **Brand tokens:** read from `teams` row at send time (`business_name`, `logo_url`, `brand_color`, `support_email`, `support_phone`). Falls back to Exotiq defaults.
- **Layout:** single shared `<EmailLayout>` component (header with logo, footer with address + unsubscribe). All templates wrap it.
- **Preview:** `react-email dev` locally; preview-data fixtures live next to each template.
- **i18n:** start English-only, structure copy through a `t()` helper so we can add locales later without refactoring.
- **Testing:** snapshot tests on rendered HTML; one Playwright test per critical template that asserts the inbox-rendered subject + body.

---

## 7. Cost Model

Volume projection (conservative; assumes 6 lifecycle emails per booking):

| Stage | Active rentals/mo | Emails/mo | Resend tier | Monthly cost |
|---|---|---|---|---|
| Today | ~50 | ~500 | Free | $0 |
| Phase 2 launch (10 tenants) | ~500 | ~5,000 | Free | $0 |
| Marketplace soft-launch | ~2,000 | ~20,000 | Pro | $20 |
| Marketplace scale | ~10,000 | ~100,000 | Scale | $90 |
| Marketplace mature | ~50,000 | ~500,000 | Enterprise | ~$400 |

**Add-ons to budget:**
- Inngest Pro at Phase 4: +$20/mo
- Each verified tenant domain on Resend: **$0** (unlimited on Pro+)
- React Email itself: free (OSS)

**Total operating cost at marketplace scale:** ~$110/mo, all-in. This is a rounding error vs. the value.

---

## 8. Recommended Build Path

### Phase 1 — Foundation (1 sprint)

**Goal:** stop the bleeding. One sender, one log, no sandbox fallbacks.

- [ ] Consolidate all 10 functions onto a single shared `send-email` helper (in `_shared/email/send.ts`).
- [ ] Standardize on **one** verified sender domain: `mail.exotiq.ai`. Remove `exotiq.io`, `notify.exotiq.ai`, and both `resend.dev` fallbacks.
- [ ] Create `email_send_log` table: `id, message_id, template_name, recipient_email, team_id, status, error, metadata, created_at`. Service-role insert; team-scoped select.
- [ ] Add idempotency keys to all 10 callsites (most are easy: `invite-${invitation_id}`, `role-change-${user_id}-${role}`).
- [ ] Add a global `<EmailLayout>` (header + footer + unsubscribe placeholder) and migrate the 10 existing templates to React Email.

### Phase 2 — Booking Lifecycle (1–2 sprints)

**Goal:** the 6 templates that make Exotiq feel like a real product to guests.

1. `booking-confirmation` → guest, at booking confirmed
2. `booking-receipt` → guest, after payment captured (attaches existing VAT invoice PDF)
3. `pickup-reminder-24h` → guest, T-24h before pickup (pg_cron for now)
4. `return-thank-you` → guest, T+1h after return
5. `review-request` → guest, T+24h after return
6. `booking-cancelled` → guest, on cancellation (paths for guest-initiated, tenant-initiated, refund issued)

Each triggered from existing booking state-machine transitions. No new infrastructure required.

### Phase 3 — Marketplace Prereq (2 sprints)

**Goal:** per-tenant verified sender domains.

- [ ] Settings → Branding → Email Domain UI: input domain, show DKIM/SPF records, "Verify" button.
- [ ] Backend: Resend Domains API integration (add, status poll, remove).
- [ ] Send-email helper resolves sender per-team: verified custom domain → fallback to `mail.exotiq.ai` with `Reply-To: tenant@…`.
- [ ] Suppression list table + unsubscribe page (we're already sending high enough volume to need this for CAN-SPAM compliance).

### Phase 4 — Durable Workflows (1 sprint)

**Goal:** kill pg_cron for email scheduling and unlock multi-step flows.

- [ ] Add Inngest connector.
- [ ] Move T-24h reminder and T+24h review request to Inngest `step.sleepUntil`.
- [ ] Add multi-step flows: license-upload reminder cascade, abandoned-quote nudge, no-show follow-up.
- [ ] Build a simple internal email dashboard (deduplicated by `message_id` per the email-dashboard pattern).

### Explicitly **not** recommended

- ❌ Switching to Lovable Emails — single-domain limit blocks marketplace.
- ❌ Switching to Postmark/SendGrid/Mailgun — no benefit over Resend, migration cost is real.
- ❌ Building marketing/newsletter flows on this stack — use a dedicated tool (Customer.io, Loops, or Resend Broadcasts) when that day comes.
- ❌ Using Zapier/n8n for transactional flows — too slow, too brittle, terrible debuggability.

---

## 9. Open Questions for You

1. **Default sender voice:** for guests, do we want "from Exotiq" until a tenant verifies their domain, or "from {Tenant Name} via Exotiq" with reply-to-tenant? (Affects Phase 1 copy.)
2. **Reply handling:** when a guest replies to a booking confirmation, should it route to the tenant's inbox, to Exotiq support, or to an in-app conversation thread (via inbound webhook + the existing `messages` table)?
3. **SMS parity:** should the same lifecycle events also fire SMS (Twilio)? If yes, we should design the trigger layer once to handle both channels.
4. **Marketplace timing:** if Phase 3 (per-tenant domains) is needed before marketplace launch, when is that launch? That sets the ordering of Phase 2 vs Phase 3.
5. **Review platform:** review-request email links to… Google? Internal review system? TrustPilot? We haven't built the destination yet.
6. **Legacy `exotiq.io` and `exotiq.ai` senders:** safe to retire all sends from these domains in Phase 1, or are there external systems (Stripe webhooks, partner integrations) keyed off those addresses?

---

## Appendix — File Inventory

```
supabase/functions/
  accept-invite/                  ← Resend, exotiq.io
  invite-user/                    ← Resend, mail.exotiq.ai
  resend-invite/                  ← Resend, mail.exotiq.ai
  mention-notification/           ← Resend, resend.dev ⚠️
  role-change-notification/       ← Resend, mail.exotiq.ai
  send-compliance-email/          ← Resend, notify.exotiq.ai
  send-deletion-confirmation/     ← Resend, resend.dev ⚠️
  send-signed-document/           ← Resend, exotiq.io
  rari-email-summary/             ← Resend, exotiq.ai
  uptime-check/                   ← Resend, internal
  _shared/
    (no email-templates/ — does not exist)
    (no transactional-email-templates/ — does not exist)
```

No `process-email-queue`, no `email_send_log`, no `suppressed_emails`, no `email_unsubscribe_tokens`. Greenfield for Phase 1.
