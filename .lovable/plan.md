
## Diagnosis

Your test upload (Avalon Motorsports intake receipt) **succeeded end-to-end**:

- File landed in `expense-receipts` storage (`1780025926051-hez2xn-Avalon - intake reciept .pdf`)
- Edge function parsed it via Gemini at **95% confidence**
- Row inserted into `vehicle_expenses` with `status='pending_review'`, amount $1,637.29, vendor "Avalon Motorsports"

So the backend is fine. The reason it *looks* broken is a UI feedback bug in `src/components/margin/ReceiptUploadDialog.tsx`.

## Root cause

Inside `runAll()`:

```ts
await Promise.all(workers);
setRunning(false);
const ok = items.filter((i) => i.status === "done").length; // stale closure
if (ok > 0) toast.success(...);
onComplete();
```

`items` here is the **closure value from the moment runAll was invoked** — every item is still `"queued"` at that point, so `ok` is always `0`, the success toast never fires, and the dialog stays open with no clear "you're done" signal. The Review tab does refresh in the background via realtime + `onComplete`, but the user can't see it because the dialog covers the screen.

## Fix

Three small changes in `src/components/margin/ReceiptUploadDialog.tsx`:

1. **Track success/error counts in local variables** inside the worker pool instead of reading stale `items` state.
2. **Show an accurate toast** after `Promise.all` resolves:
   - `N receipt(s) added to Review queue` on success
   - `N file(s) failed — see list` on partial/total failure (with the per-item error rows already rendered)
3. **Auto-close the dialog and clear the file list** when every item finished with `status === "done"` and there are no errors. If any item errored, keep the dialog open so the user can see which one and retry.
4. **Minor**: surface the actual error from the edge function invoke (currently swallowed into a blank draft). If `supabase.functions.invoke` returns an error, log it and still create the blank draft, but bubble a short reason into `review_reason` (e.g. "AI parsing failed — please fill in manually") so the Review card explains itself.

No DB, edge function, or schema changes are needed — the pipeline already works. This is purely a frontend feedback fix scoped to one file.

## Out of scope

- Bucket/policy changes (RLS is correct; upload succeeded as owner)
- Edge function logic (Gemini parsed correctly)
- Review tab UI (already refreshes via realtime)
