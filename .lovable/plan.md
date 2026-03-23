

# UI Pass: Fix Cut-Off Popups and Nested Dialog Layouts

## Problem

The DamageCaptureModal (screenshot) is cut off at the bottom because its `DialogContent` has `overflow-hidden` but the base `DialogContent` uses CSS `grid` layout — so the inner div's `flex-1 overflow-auto` pattern doesn't work. The content area can't flex-grow to fill remaining space and enable scrolling. The photo preview also consumes too much vertical space.

The base `DialogContent` (dialog.tsx line 39) uses `grid` with `max-h-[85vh] overflow-y-auto`. Dialogs that override with `overflow-hidden` and expect internal flex scroll need to also add `flex flex-col` — some do, some don't.

## Audit Results

| Dialog | Issue |
|--------|-------|
| **DamageCaptureModal** | `overflow-hidden` + no `flex flex-col` = content cut off. Photo too tall. |
| **DamageReportDialog** | Fine — uses `overflow-y-auto` on content. Photo text mentions "Supabase Storage" (should say "secure storage"). |
| **GenerateReportDialog** | Has `max-h-[90vh]` but no overflow → content could clip on small screens. |
| **InviteUserDialog** | No max-h or overflow — relies on base. Fine for short content. |
| **ShareWithTeamDialog** | Same as above. Fine. |
| **DocumentUploadDialog** | No max-h — fine, short content. |
| **ScheduleMaintenanceDialog** | Needs verification — calendar popover inside dialog. |

## Changes

### 1. Fix DamageCaptureModal layout
- Add `flex flex-col` to `DialogContent` so `flex-1 overflow-auto` works on the details step
- Reduce photo preview height from `aspect-video` to `max-h-32 w-full object-cover` — keeps context without hogging space
- Ensure buttons ("Add Damage" / "Cancel") are always pinned at bottom via `flex-shrink-0`

### 2. Fix DamageReportDialog copy
- Change "SOC2-compliant Supabase Storage" to "secure cloud storage"

### 3. Add missing DialogDescription to suppress console warnings
- DamageCaptureModal, CheckInOutDialog, and any other dialogs triggering the "Missing Description" warning — add a visually-hidden `DialogDescription`

### 4. Fix GenerateReportDialog overflow
- Add `overflow-y-auto` to match its `max-h-[90vh]`

## Files Changed

| File | Change |
|------|--------|
| `src/components/inspections/DamageCaptureModal.tsx` | Add `flex flex-col`, shrink photo, pin footer |
| `src/components/dialogs/DamageReportDialog.tsx` | Fix "Supabase" copy |
| `src/components/dialogs/GenerateReportDialog.tsx` | Add `overflow-y-auto` |

