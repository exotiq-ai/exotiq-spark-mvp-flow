## What's left

The email + notification + signing UI all work. The only blocker is that the PDF preview pane shows **"This content is blocked"**. Two small issues to clean up.

### 1. PDF iframe blocked by CSP (the actual blocker)

The signed Supabase Storage URL we put in the `<iframe src>` is on `https://jlgwbbqydjeokypoenoc.supabase.co`. Our Content-Security-Policy in `index.html` currently allows:

```
frame-src 'self' blob: https://elevenlabs.io https://*.elevenlabs.io;
```

…which does NOT include `https://*.supabase.co`, so the browser blocks the frame (matches the console error: *Framing 'https://jlgwbbqydjeokypoenoc.supabase.co/' violates… frame-src 'self' blob:*).

**Fix:** add `https://*.supabase.co` to the `frame-src` directive in `index.html`. One-line CSP edit, no code changes.

### 2. Dialog a11y warnings

Console also warns:
- `DialogContent requires a DialogTitle`
- `Missing Description or aria-describedby for DialogContent`

`TenantDocumentSigner.tsx` renders a custom header bar instead of `DialogTitle`/`DialogDescription`. Wrap the existing header text in visually-hidden `DialogTitle` + `DialogDescription` (using Radix `VisuallyHidden` or `sr-only`) so screen readers + Radix are satisfied. Purely additive, no visual change.

### 3. Out of scope / already done
- Email send via Resend → done
- Bell notification + deep link → done
- Sign + countersign edge function → already wired

### After the fix
- Reload `/dashboard/vault?sign=…` — the PDF renders inline in the left pane
- No more red CSP / dialog warnings in the console
- Signature flow end-to-end is complete

### Files touched
- `index.html` — extend `frame-src`
- `src/components/signing/TenantDocumentSigner.tsx` — add hidden `DialogTitle` + `DialogDescription`
