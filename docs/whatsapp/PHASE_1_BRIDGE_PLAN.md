# Phase 1: WhatsApp Bridge — Saved Plan

Goal: ship a low-risk, no-Meta-verification wedge that (a) lets guests start a WhatsApp chat with the operator from any Exotiq surface and (b) captures the inbound intent + reply thread back into Exotiq so it lives next to the booking/customer record.

**Out of scope for Phase 1:** Dualhook embedded signup, native WA inbox, AI replies, template messages, agentic booking. Those are Phases 2–4.

**Why skip Dualhook in Phase 1:** Dualhook requires each tenant to do a Meta Business connect flow + WABA approval. Worth it in Phase 2 once we've validated demand. Phase 1 uses zero Meta infrastructure — just `wa.me` links + a generic inbound webhook tenants can optionally point at us.

---

## What ships

### 1. Outbound: click-to-WhatsApp deep links
Add a "Message on WhatsApp" affordance wherever a guest-facing or staff-facing contact exists:
- Public listing / quote pages (guest → operator's WhatsApp)
- Customer detail page (staff → customer's WhatsApp)
- Booking detail page (staff → customer, prefilled with booking ref)
- Inspection / handover flows (staff → customer pickup reminder)

Link format: `https://wa.me/<E164>?text=<urlencoded prefill>`
Prefill templates pull booking ref (BK-01xxx), vehicle name, and pickup date/time.

### 2. Tenant settings: WhatsApp number
New section in Team Settings → "WhatsApp":
- WhatsApp business number (E.164, validated)
- Optional default greeting prefill
- Toggle: "Show WhatsApp button on public pages"
- Display of inbound webhook URL + secret (for Phase 1.5 capture)

### 3. Customer-level WhatsApp number
Add `whatsapp_phone` (nullable, E.164) to `customers`. Default to existing `phone` when present and looks mobile. Surfaced in customer edit dialog.

### 4. Conversation capture (the "bridge")
Two capture paths, both write into existing messaging tables so the thread shows in the unified inbox:

**a) Click tracking (always on):**
When a staff or guest clicks a WhatsApp deep link from Exotiq, log an outbound `whatsapp_link_click` event tied to customer_id + booking_id. This creates/updates a `team_conversation` of type `whatsapp` so the operator sees "Started WhatsApp chat about BK-01023 at 3:42pm" in their inbox — even before any reply lands.

**b) Inbound webhook (opt-in per tenant):**
Public edge function `whatsapp-inbound` accepts a normalised payload (designed to match the shape that Zapier / Make / Periskope / 360dialog forward). Tenants who already run a WhatsApp tool can forward inbound messages to:
```
POST /functions/v1/whatsapp-inbound?team=<team_id>
X-Exotiq-Signature: HMAC-SHA256(secret, body)
```
We match the sender phone → customer, create/append to a `team_conversation` of type `whatsapp`, and notify the assigned staff member. No reply path yet (Phase 2).

This gives tenants instant value with whatever they already use, with no Meta setup.

### 5. Notifications + inbox surfacing
- New conversation type `whatsapp` shown with green badge in TeamMessaging conversation list
- Notification: "New WhatsApp from {customer} re: {booking ref}"
- Deep-link from notification → conversation thread

---

## Risks to flag in the UI

Small inline note on the settings page:
- "Phase 1 is one-way capture. To reply, use WhatsApp directly — native reply from Exotiq ships in Phase 2."
- "wa.me links open the guest's WhatsApp; no message is sent until they tap send."
- "Forwarding inbound messages requires a tool like Zapier or 360dialog. No Meta verification needed for Phase 1."

---

## Technical details

**DB migration:**
- `customers.whatsapp_phone text` (nullable)
- `teams.whatsapp_number text`, `teams.whatsapp_greeting text`, `teams.whatsapp_public_button boolean default false`, `teams.whatsapp_webhook_secret text` (generated on first enable)
- Extend `team_conversations.type` enum (or check constraint) to allow `whatsapp`
- New table `whatsapp_events` (id, team_id, customer_id nullable, booking_id nullable, direction `link_click|inbound`, payload jsonb, conversation_id nullable, created_at) — for analytics + debugging
- RLS: team-scoped on all of the above; `whatsapp-inbound` edge function uses service role after HMAC verification
- GRANT block per house rules (public schema tables need explicit grants to authenticated and service_role)

**Edge functions (new):**
- `whatsapp-inbound` — `verify_jwt = false`, HMAC-verified, normalises payload, upserts conversation + message
- `whatsapp-link-click` — authed, logs click, ensures conversation exists, returns conversation_id so the client can optimistically navigate

**Frontend:**
- `src/lib/whatsapp.ts` — `buildWaMeUrl({ phone, text })`, prefill template helpers
- `<WhatsAppButton />` shared component (variants: icon, full, public)
- Settings panel: `src/components/settings/WhatsAppSection.tsx`
- Customer edit: add `whatsapp_phone` field
- Inbox: render `whatsapp` conversation type with green WA glyph
- Feature flag `whatsappBridge` in `src/lib/featureFlags.ts` — default off, enable per tenant for pilot

**Copy standards:** Per project memory, use "WhatsApp messaging" — no mention of Meta, Cloud API, or BSPs in user-facing text.

**Testing:**
- Vitest for `buildWaMeUrl` + prefill formatting + HMAC verification
- Edge function test for `whatsapp-inbound` (valid sig, invalid sig, unknown sender, known customer)

---

## Rollout

1. Ship behind `whatsappBridge` flag
2. Enable for 2–3 pilot UK tenants (manual flag flip)
3. Measure: link clicks per listing view, inbound webhook adoption, replies per booking
4. Gate Phase 2 (Dualhook + native inbox) on ≥30% of pilot bookings touching WhatsApp

---

## Effort estimate

~2–3 weeks of focused work. Roughly:
- 3 days DB + settings + customer field
- 2 days deep links + button component everywhere
- 3 days inbound webhook + HMAC + inbox rendering
- 2 days notifications + click tracking + analytics
- Rest: QA + pilot enablement
