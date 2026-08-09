# exotiq-branded invite emails + login logo

## 1. Rebrand the invite emails

Three emails currently go out with a generic dark-blue gradient header and a purple/violet button — none of them carry the exotiq mark.

- `invite-user` — new teammate invite
- `resend-invite` — reminder invite
- `super-admin-send-invite` — admin-sent invite

New shared design (clean minimal, matching the app):

```text
+------------------------------------------+
|            [ exotiq mark ]  exotiq       |   white background
|                                          |
|   You've been invited to join            |
|   <Company Name>                         |
|                                          |
|   <Inviter> invited you as <role>.        |
|                                          |
|          [  Accept invitation  ]          |   solid black button
|                                          |
|   Link expires in 7 days.                 |
|   ----------------------------------      |
|   exotiq · app.exotiq.ai                  |   small grey footer
+------------------------------------------+
```

Details:
- Logo image served from the app's own domain (`https://app.exotiq.ai/brand/logos/exotiq-mark-black.png`) so it renders in every mail client, with `alt="exotiq"` fallback text.
- Lowercase "exotiq" everywhere except at the start of a sentence.
- No Lovable references, no `*.lovable.app` links (already enforced by the safe-origin allow-list).
- Same markup shared by all three functions so reminders and admin invites look identical.
- Plain-text fallback so the email doesn't look broken in text-only clients.

Technical: extract the HTML into `supabase/functions/_shared/invite-email.ts` (one function taking company, inviter, role, link, and a "reminder" flag), use it from the three functions, then redeploy `invite-user`, `resend-invite`, `super-admin-send-invite`.

## 2. Login page "Drive Exotiq"

I searched the app and the login screen itself has no "Drive Exotiq" text — it shows the exotiq mark plus "Welcome to exotiq". "Drive Exotiq" only exists in renter/marketplace email templates and the legal pages, which are separate from the operator login.

So the wording you saw most likely comes from outside our page markup (Google's sign-in consent screen, or a saved password-manager entry). Send the screenshot and I'll pin down the exact source; if it's the Google consent screen, the fix is renaming the OAuth app, not app code.

Also worth aligning while we're here: the browser tab currently reads "Exotiq — Luxury Fleet Management" with a capital E — I can lowercase it to match the brand rule.
