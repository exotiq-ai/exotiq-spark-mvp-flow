## Fix "View Details" + add email notification for tenant documents

### Problem
1. The bell-notification's **View Details** does nothing for `tenant_document_sent` — `handleSystemAction` in `UnifiedNotificationCenter.tsx` only routes booking/payment/damage/maintenance types.
2. No email is sent when a document is queued for signature; the tenant only sees the in-app banner/bell.

### Fix 1 — Route the notification

In `src/components/common/UnifiedNotificationCenter.tsx`, extend `handleSystemAction`:

```ts
} else if (nType === 'tenant_document_sent' || nType === 'tenant_document_signed') {
  params.module = 'vault';
  if (data.tenant_document_id) params.sign = data.tenant_document_id;
}
```

`VaultEnhanced` already reads `?sign=<id>` and opens `TenantDocumentSigner`. For super admins receiving a `tenant_document_signed` notification, the param is harmless (the signer modal only opens for the document's owning team).

Also add an icon/color treatment for the new type so the row visually matches existing system notifications (no UI changes beyond that — keeps the minimalist style).

### Fix 2 — Email the team owner

Default flow uses Lovable's built-in app emails (no third-party SDK), sent from **`compliance@<sender domain>`** with Exotiq branding.

**Template** — `supabase/functions/_shared/transactional-email-templates/tenant-document-awaiting-signature.tsx`:
- Subject: `Action required: signature requested on {title}`
- Body: doc title, doc_ref (e.g. `EXQ-TDOC-2026-00001`), sender = "Exotiq", short ESIGN line, CTA button → `https://app.exotiq.ai/dashboard?module=vault&sign=<id>`
- Inline styles only, white `Body` background, brand accent, no `<style>` tag
- Registered in `registry.ts` as `tenant-document-awaiting-signature`

**Trigger** — extend `supabase/functions/prepare-tenant-document/index.ts`:
1. After inserting the `tenant_documents` row and the in-app notification, look up the **team owner** via `team_members` where `role = 'owner'` for the target `team_id`, then fetch their `profiles.email` (fallback to `auth.users.email` via admin client).
2. Invoke `send-transactional-email` with:
   - `templateName: 'tenant-document-awaiting-signature'`
   - `recipientEmail: owner.email`
   - `idempotencyKey: 'tdoc-sent-' + tenant_document.id`
   - `templateData: { ownerName, title, docRef, signUrl }`
3. Wrap in try/catch — email failure must not roll back the document send. Log to `tenant_document_audit` with event `email_sent` or `email_failed`.

If no email domain / app-email infra is configured yet, run `email_domain--check_email_domain_status` → if missing, prompt the user to complete the setup dialog before deploying the trigger change.

### Files changed
- `src/components/common/UnifiedNotificationCenter.tsx` — add tenant_document branch + icon
- `supabase/functions/_shared/transactional-email-templates/tenant-document-awaiting-signature.tsx` — new
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register template
- `supabase/functions/prepare-tenant-document/index.ts` — owner lookup + email invoke + audit row
- Deploy: `send-transactional-email`, `prepare-tenant-document`

### Out of scope
- Reminder emails (e.g. nudge after 48h unsigned) — defer to Phase 2
- Cc'ing admins — explicitly chose owner-only
- SMS — not requested
- Email to Exotiq on signature completion — already covered by existing `tenant_document_signed` notification; can add later if you want a copy in compliance@

### Verification
- Send a new document from /super-admin → Documents
- Confirm: bell notification's **View Details** opens the signing modal
- Confirm: owner's inbox receives the Exotiq-branded email; CTA opens the modal
- Confirm `tenant_document_audit` shows `email_sent`