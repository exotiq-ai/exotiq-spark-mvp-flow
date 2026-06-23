## What's broken

When a user clicks the invite link, the app calls the `accept-invite` edge function twice (validate on page load, then accept after sign-up). Both calls are malformed, so the edge function receives a body that is literally the string `"[object Object]"` and crashes on `await req.json()`:

```
Error in accept-invite function: SyntaxError: "[object Object]" is not valid JSON
  at packageData (ext:deno_fetch/22_body.js:408:14)
  at async Server.<anonymous> (.../accept-invite/index.ts:97:25)
```

### Bug 1 — validate call (`src/pages/Auth.tsx` ~line 146)

```ts
await supabase.functions.invoke('accept-invite', {
  body: { token },
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }, // ← this
});
```

`supabase-js` auto-serializes a plain object body and sets `Content-Type` for you. When you also pass an explicit `Content-Type` header, the SDK assumes you've already serialized and forwards the body to `fetch` as-is. `fetch` then coerces the object to a string and sends `"[object Object]"`.

### Bug 2 — accept call (`src/contexts/AuthContext.tsx` ~line 203)

```ts
await supabase.functions.invoke('accept-invite?action=accept', {
  body: { token, userId },
  method: 'POST',
});
```

`functions.invoke` URL-encodes the function name, so the `?` becomes `%3F` and the function never sees `action=accept` — it falls through into the default `validate` branch, where the body shape is wrong too. This also triggers the same body-coercion path under some SDK versions.

## Fix

Two small, scoped client-side changes. The edge function itself is correct and stays untouched.

1. **`src/pages/Auth.tsx`** — remove the manual `Content-Type` header so `supabase-js` properly serializes the body:
   ```ts
   await supabase.functions.invoke('accept-invite', {
     body: { token },
     method: 'POST',
   });
   ```

2. **`src/contexts/AuthContext.tsx`** — move `action=accept` out of the function name and into a real query param via the underlying URL. The cleanest way that works with `supabase.functions.invoke` is to pass the action in the body and switch the edge function's branching to prefer body action when present — but to keep the edge function untouched, we instead call the function via `fetch` to the functions endpoint with the query string preserved:
   ```ts
   const url = `${SUPABASE_URL}/functions/v1/accept-invite?action=accept`;
   const res = await fetch(url, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
       apikey: SUPABASE_ANON_KEY,
     },
     body: JSON.stringify({ token, userId }),
   });
   const data = await res.json();
   ```
   (Using the existing `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` already imported in the project's supabase client module.)

## Verification

- Send a fresh invite from `hello@exotiq.ai` to a test address, click the email link:
  - Auth page loads with the invitation pre-filled (validate succeeds, no edge error).
  - After sign-up, the user is added to the team and lands in the dashboard (accept succeeds, role + team_members rows created, invitation marked `accepted`).
- Check `accept-invite` logs: no `SyntaxError: "[object Object]" is not valid JSON`.
- Re-test the existing invite to `thefreshprinceofbenblair@gmail.com` by resending (the old token may already be marked expired/used — if so, send a new one).

## Out of scope

- No changes to the edge function, the invite email, the invitations table, or any auth flow other than fixing the two malformed calls.
