

# Two Issues: Chrome PDF Blocking + Post-Signing User Flow

## Issue 1: Chrome Blocking the PDF URL

The screenshot shows `ERR_BLOCKED_BY_CLIENT` when Chrome navigates directly to the signed storage URL. This is caused by **ad blockers or browser extensions** blocking the Supabase storage domain. Incognito works because extensions are disabled by default.

This is NOT a code bug -- it's an extension/browser configuration issue. However, we can make the experience more resilient:

**Fix: Use an embedded PDF viewer instead of relying on direct URL navigation.**

Currently the Vault and signing flow use raw signed URLs that the user might click to open in a new tab. Instead:

1. **In VaultEnhanced.tsx** -- when "View" is clicked, show the PDF in an `<iframe>` inside a dialog (same pattern as the signing ceremony's review step) rather than opening a new tab via `window.open()`. This avoids the ad-blocker issue entirely.
2. **For downloads** -- use a programmatic `fetch()` + `blob` + `URL.createObjectURL()` approach to download, which bypasses extension blocking since it happens via JS, not a direct navigation.

Files to change:
- `VaultEnhanced.tsx` -- add a PDF preview dialog and change "View" button to open it inline; change "Download" to use fetch+blob

## Issue 2: Post-Signing User Flow

Currently after signing completes, here's what happens:
1. `SigningCeremony` shows a "Signing Complete" confirmation with the `doc_ref`
2. User clicks "Done" which closes the dialog
3. `onComplete(newDocRef)` callback fires back to `EnhancedBookingDialog`

**What's missing / needs improvement:**

The `onComplete` handler in `EnhancedBookingDialog` needs to:
1. **Refresh the booking documents list** so the newly signed doc appears immediately
2. **Show a success toast** with the doc_ref
3. **Optionally navigate to Vault** or offer a "View in Vault" link

Looking at the current `EnhancedBookingDialog`, I need to check the `onComplete` handler:

The `handleSigningComplete` likely just closes the dialog. It should also refresh `bookingDocuments` state.

**Plan:**

### A. Inline PDF Viewer for Vault (Chrome fix)
- Add a `DocumentPreviewDialog` component that renders an `<iframe>` with the signed URL
- Update VaultEnhanced "View" button to open this dialog instead of `window.open()`
- Update "Download" to use `fetch` → `blob` → `createObjectURL` → programmatic `<a>` click

### B. Post-Signing Flow Polish
- In `EnhancedBookingDialog`, after signing completes:
  - Re-fetch documents for the booking (`bookingDocuments`)
  - Show toast: "Document signed successfully — EXQ-DOC-2026-XXXXX"
  - The signed doc should now appear in the Documents section of the booking dialog
- The signed document also appears in VaultEnhanced on next load (already works via the DB insert)

### Files to Change

| File | Change |
|------|--------|
| `src/components/dashboard/VaultEnhanced.tsx` | Replace `window.open` with inline PDF preview dialog; blob-based download |
| `src/components/dialogs/EnhancedBookingDialog.tsx` | Refresh bookingDocuments after signing; success toast |
| `src/components/common/DocumentPreviewDialog.tsx` | Create -- reusable inline PDF viewer dialog |

