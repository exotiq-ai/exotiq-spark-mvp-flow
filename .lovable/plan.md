## Send tenant-document signature emails through Resend (notify.exotiq.ai)

You verified `notify.exotiq.ai` directly in Resend (not in Lovable's email domain system), so the cleanest path is to keep sending through Resend rather than re-delegate the subdomain to Lovable. Lovable Emails would require removing the Resend DNS records and waiting on NS delegation — not worth it for a single template.

### Approach
- Connect Resend (via Lovable connector) so the API key is injected as `RESEND_API_KEY` and routed through the Lovable connector gateway. If you'd rather skip the connector, we'll fall back to storing `RESEND_API_KEY` as a project secret and calling `api.resend.com` directly.
- Add ONE new edge function `send-compliance-email` dedicated to Exotiq compliance mail from `compliance@notify.exotiq.ai`. Kept separate from any future tenant white-label sender so branding never leaks.
- Hook it into `prepare-tenant-document` after the in-app notification, owner-only, fire-and-forget with audit logging.

### Files to change

1. **New** `supabase/functions/send-compliance-email/index.ts`
   - POST body: `{ to, subject, html, text, idempotency_key, tags? }`
   - Auth: `verify_jwt = false`, but only callable from other edge functions — gate with a shared secret header `x-internal-token` checked against `INTERNAL_FUNCTION_TOKEN` (new secret) so it can't be hit from the browser.
   - Sends via Resend gateway:
     - From: `Exotiq Compliance <compliance@notify.exotiq.ai>`
     - Reply-To: `compliance@exotiq.ai`
     - Tags: `{ category: 'tenant_document', doc_ref }`
   - Returns `{ message_id }` or `{ error }`.

2. **New** inline HTML template builder inside that function (single small file, no React Email needed — keeps it self-contained):
   - White background, Exotiq wordmark, doc title, doc_ref, short ESIGN line, CTA button → `https://app.exotiq.ai/dashboard?module=vault&sign=<id>`, plain-text fallback.

3. **Edit** `supabase/functions/prepare-tenant-document/index.ts`
   - After existing notifications insert, look up team **owner** via `team_members` (`role=owner`, `is_active=true`) → get `profiles.email` (fallback to `auth.admin.getUserById` for email).
   - Build sign URL using `Deno.env.get('APP_PUBLIC_URL')` (new secret, default `https://app.exotiq.ai`).
   - `supabase.functions.invoke('send-compliance-email', { body: …, headers: { 'x-internal-token': … } })` wrapped in try/catch.
   - Log `tenant_document_audit` event: `email_sent` (with `message_id`) or `email_failed` (with `error`).
   - Email failure must NOT roll back the document send.

4. **Edit** `.lovable/plan.md` — mark email step as implemented via Resend.

### Secrets needed
- `RESEND_API_KEY` (via connector — preferred — or manual secret)
- `INTERNAL_FUNCTION_TOKEN` (random string, function-to-function auth)
- `APP_PUBLIC_URL` = `https://app.exotiq.ai`

### Verification
1. Send a document from `/super-admin → Documents` to a test tenant.
2. Confirm owner's inbox receives email from `compliance@notify.exotiq.ai` with working CTA.
3. CTA opens `/dashboard?module=vault&sign=<id>` → signing modal.
4. `tenant_document_audit` shows `email_sent` row with `message_id`.
5. Bell notification's **View Details** opens the same modal (already fixed last turn).

### Out of scope
- Reminder/nudge emails (Phase 2)
- Tenant white-label sender domain
- Email on `tenant_document_signed` to compliance@ (can add later)
- Migrating to Lovable Emails

### Decision needed before I implement
**Do you want to connect Resend via the Lovable connector** (recommended — gateway handles auth, no key in code), **or paste the Resend API key as a project secret** so the function calls Resend directly?
