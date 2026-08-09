# Fix "Join Drive Exotiq" + brand the invite email

## 1. Root cause of "Join Drive Exotiq" (confirmed)

Laura's invitation row is correct — it points at **Denver Exotic Rental Cars**. The invite screen showed the wrong name because the invite-validation function builds the company name from the **inviter's own profile** (`profiles.company_name`) instead of the team on the invitation. Gregory's profile says "Drive Exotiq", so every invite he sends — for any tenant — displays "Join Drive Exotiq".

The same wrong value is also written into the new user's profile at accept time, and the fallback string is "ExotIQ" (wrong casing).

Fix in `supabase/functions/accept-invite`:
- Resolve the display name from `teams.name` via the invitation's `team_id`, in all three paths (validate, accept, claim — claim already does this correctly).
- Only fall back to the inviter's company name when the invitation has no team, and change the last-resort fallback text from "ExotIQ" to "exotiq".
- Write the correct team name into the new member's `profiles.company_name`.

No data repair needed: Laura's profile already reads "Denver Exotic Rental Cars".

Also on the invite screen: "invited you as a Admin" → "invited you as an Admin" (correct article), keeping the logo and layout as-is.

## 2. exotiq-branded invite emails

Three invite emails currently use a generic dark-blue gradient header and a purple button, with no exotiq mark:
`invite-user`, `resend-invite`, `super-admin-send-invite`.

New shared design — logo mark, clean and minimal:

```text
+------------------------------------------+
|            [ exotiq mark ]  exotiq        |   white background
|                                           |
|   You've been invited to join             |
|   <Tenant Name>                           |
|                                           |
|   <Inviter> invited you as an <role>.     |
|                                           |
|          [  Accept invitation  ]          |   solid black button
|                                           |
|   This link expires in 7 days.            |
|   ---------------------------------       |
|   exotiq · app.exotiq.ai                  |   small grey footer
+------------------------------------------+
```

- Logo served from the app's own domain (`https://app.exotiq.ai/brand/logos/exotiq-mark-black.png`) with `alt="exotiq"` so it degrades gracefully.
- Lowercase "exotiq" everywhere except sentence-start.
- No Lovable references and no `*.lovable.app` links.
- Plain-text fallback alongside the HTML.

Technical: extract one shared builder at `supabase/functions/_shared/invite-email.ts` (company, inviter, role, link, reminder flag) and use it from all three functions so reminders and admin invites look identical.

## 3. Deploy

Redeploy `accept-invite`, `invite-user`, `resend-invite`, `super-admin-send-invite`.
