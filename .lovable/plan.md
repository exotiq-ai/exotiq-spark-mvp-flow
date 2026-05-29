## Goal

Replace the misleading "DocuSign — Coming Soon" placeholder in the Integrations panel with an **Active** card that accurately represents your in-house e-signature system and signals trust to tenants and their customers.

## Change

**File:** `src/components/dashboard/settings/IntegrationsSection.tsx`

Remove `DocuSign` from the `comingSoonIntegrations` array, and add a new Active card in a "Documents & Signatures" section (rendered the same way the Google Calendar / AI Services cards are).

### Card content

- **Name:** `Vault eSign`
- **Badge:** Active (green, with check)
- **Icon:** `ShieldCheck` (lucide) — reinforces trust
- **Headline copy:** "Legally binding digital signatures, built in"
- **Sub copy:** "ESIGN & UETA compliant. Captures signature, timestamp, IP address, and a full audit trail on every signed rental agreement — then delivers the signed PDF to your customer automatically."
- No Connect button (it's always-on for every tenant).

### Naming rationale

"Vault eSign" ties the feature to your existing **Vault** module (document management), which customers already associate with secure storage. It reads as a first-party product rather than a 3rd-party integration, which is true — and stronger for trust than "DocuSign".

Alternative names if you prefer: `Vault Signatures`, `Exotiq eSign`, `Secure eSign`.

## Out of scope

- No changes to `SigningCeremony`, `generate-signed-pdf`, or `send-signed-document` — only the Integrations settings card.
- Stripe / Twilio / Google Maps placeholder cleanup is deferred to a separate request.
