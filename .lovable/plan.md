

# Fix Banner Photo Upload — Input Unmounts on File Dialog Open

## Root Cause

The file `<input>` element is inside a conditional block that only renders when `showUploadButton` is `true`. When the native file picker opens, the browser fires `onMouseLeave` on the banner div (the mouse is no longer "over" it), which sets `showUploadButton = false`, **removing the input from the DOM**. The `onChange` callback never fires because the element is gone.

## Fix

**`src/components/dashboard/DashboardBanner.tsx`** — Two changes:

1. **Move the hidden `<input>` outside the conditional block** so it's always in the DOM regardless of hover state. Only the visible button label stays conditionally rendered.

2. **Guard `onMouseLeave`** to not hide controls while uploading (the `isUploading` state is already tracked):
   ```tsx
   onMouseLeave={() => {
     if (!isUploading) setShowUploadButton(false);
   }}
   ```

The `<input id="banner-upload" type="file" ... />` moves from inside the `{showUploadButton && (...)}` block to just after it, as a direct child of the outer `<div>`. It's already `className="hidden"` so there's no visual change.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/DashboardBanner.tsx` | Move hidden input outside conditional render; guard onMouseLeave |

