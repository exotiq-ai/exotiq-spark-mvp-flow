

# Add Edit/Crop to BulkUploadModal File List

## Problem
The `PhotoEditorDialog` currently requires a `VehiclePhoto` (a DB record with a URL). In the BulkUploadModal, files are raw `File` objects that haven't been uploaded yet. We need a lightweight adapter.

## Changes

### 1. `src/components/photos/PhotoEditorDialog.tsx`
Expand the props to accept either a `VehiclePhoto` OR a raw image URL + filename. Add an alternate prop signature:

```ts
interface PhotoEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo?: VehiclePhoto;           // existing usage
  imageUrl?: string;              // new: for local file object URLs
  filename?: string;              // new: for naming the output
  onSave: (editedFile: File) => Promise<void>;
}
```

The Cropper already takes a URL string — just resolve it from `photo?.url ?? imageUrl`. No other internal changes needed.

### 2. `src/components/photos/BulkUploadModal.tsx`

**State**: Add `editingIndex: number | null` to track which file is being edited.

**File list row** (lines 292-310): Add an Edit/Crop button (Crop icon) next to the remove button. On click, create a `URL.createObjectURL(file)` and set `editingIndex`.

**Editor dialog**: Render `PhotoEditorDialog` at the bottom of the component. Pass the object URL as `imageUrl`, the filename, and an `onSave` handler that:
1. Revokes the old object URL
2. Replaces the file at `editingIndex` in the `files` array with the edited `File`
3. Closes the editor

**Cleanup**: Revoke object URLs on unmount / when editing changes.

This means users can crop, rotate, and adjust brightness/contrast on any photo *before* hitting Upload — the edited file replaces the original in the queue, and the normal upload pipeline processes it.

### Files Summary

| Action | File |
|--------|------|
| Enhance | `PhotoEditorDialog.tsx` — accept raw `imageUrl` + `filename` as alternative to `VehiclePhoto` |
| Enhance | `BulkUploadModal.tsx` — add Edit/Crop button per file, render editor dialog, replace file on save |

2 files, no new dependencies, no API costs.

