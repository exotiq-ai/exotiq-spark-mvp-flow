# Lock invite links to exotiq domains — no builder-platform links, ever

## What actually happened

Your invite emails are 100% exotiq-branded: they are sent from `Exotiq <noreply@mail.exotiq.ai>` through your own email provider, with your own HTML. There is no builder branding in the email itself, and the "Edit with Lovable" badge is already hidden on the published app.

The problem is the **link inside the invite**. The invite URL is built from the browser origin of whoever pressed "Send invite":

```text
inviteLink = <origin of the sender's browser tab> + /auth?invite=<token>
```

When invites are sent from the builder preview tab (a `*.lovable.app` preview URL) instead of `app.exotiq.ai`, the recipient gets a preview-domain link. Opening that link lands them on the builder's access screen, and clicking through there generates the "requesting access to the project" email you received. That is exactly what happened with James's invite — nothing was shared, and he has no access.

Same weakness exists in the resend-invite path.

## The fix

Stop trusting the sender's browser origin for anything that goes into an email. Force invite links onto an approved exotiq domain.

1. **Allow-list origins for invite links.** Accept only `https://app.exotiq.ai`, `https://exotiq.ai`, and the custom app domains. Anything else — preview domains, localhost, unknown hosts — falls back to `https://app.exotiq.ai`. Applied to:
   - the invite send function
   - the resend-invite function
   - the super-admin invite function (already defaults correctly, will be hardened with the same allow-list so a passed-in origin can't override it)
2. **Sweep every other outbound email/redirect link** built from the request origin (billing portal, checkout returns, Connect onboarding, smoke runner) and put them behind the same shared allow-list helper, so no email or Stripe return can ever point at a preview domain.
3. **Guard against regressions.** A single shared helper (`safeAppOrigin`) becomes the only way an origin reaches a link, so future functions can't reintroduce the bug.

## Cleanup for James

The access request in the builder's People settings should be declined — declining does not affect his exotiq admin invite, which is still pending and valid until Aug 15. He should be re-sent the invite once the fix ships so his link points at `app.exotiq.ai`.

## Technical notes

- New `supabase/functions/_shared/appOrigin.ts` exporting `safeAppOrigin(candidate?: string | null): string` with a hard-coded allow-list and `https://app.exotiq.ai` default.
- Update `invite-user`, `resend-invite`, `super-admin-send-invite`, `customer-portal`, `create-checkout-session`, `create-payment-checkout`, `stripe-connect-onboard`, `stripe-connect-refresh`, `admin-create-test-connect`, `admin-smoke-run` to use it.
- Redeploy the affected functions.
- No database or schema changes.

## Note on what can't be changed from here

The access-request email you received came from the build platform's own project-sharing system, not from your app. It can't be turned off from inside the code, but once invite links can no longer point at a preview domain, nobody receiving an exotiq invite will ever land on that screen.
