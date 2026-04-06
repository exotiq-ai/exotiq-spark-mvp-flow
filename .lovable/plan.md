

# Fix Damage Claims Flow — Review & Plan

## Prompt Accuracy Assessment

| Claim | Actual Code | Verdict |
|-------|------------|---------|
| CheckInOutDialog doesn't create damage_claims | Correct — lines 366-381 only insert `inspection_damage_items`, no `damage_claims` created | Accurate |
| Notification sets `view=damage` | Line 300: `params.view = 'damage'` | Accurate |
| VaultEnhanced doesn't read `view` param | Correct — uses `defaultValue="documents"` with no controlled state or searchParams reading | Accurate |
| `damageClaimSchema` in validationSchemas.ts uses `total_loss` | Line in validationSchemas.ts: `severity: z.enum(['minor', 'moderate', 'severe', 'total_loss'])` | Accurate |
| DamageReportDialog uses `major` instead of `severe` | Line 20: `z.enum(["minor", "moderate", "major"])` — yes, mismatch | Accurate |
| `photo_urls` missing from Zod schema | Neither schema includes `photo_urls` | Accurate |

## Pushback & Improvements

### Issue 1 — Auto-creating damage claims from inspections

**Concern**: The prompt says "auto-create for moderate or severe." But the inspection `DamageItem` type uses severity values `minor | moderate | major` (from `src/components/inspections/types.ts`), NOT `minor | moderate | severe`. So the threshold check needs to use `major`, not `severe` — or we first align the severity values (Issue 3).

**Better approach**: Instead of silently auto-creating, the dialog already shows an "Issues found" banner at step 4 (lines 767-798) with a "Create Work Order" button. Add a **second button** there: "File Damage Claim." This gives the operator a deliberate choice rather than surprise records. Auto-creation is risky because:
- Duplicate claims if the operator also manually files one
- The damage type mapping from inspection (`scratch`, `dent`, `crack`) to claim type (`accident`, `vandalism`, `mechanical`) is ambiguous — what's a scratch? Not obviously any of those categories.

**Recommendation**: Add a "File Damage Claim" button on the completion step that pre-fills a `DamageReportDialog` with vehicle, description (from damage items), and photo URLs. Let the operator pick the claim type and confirm. This avoids bad auto-mapping.

### Issue 2 — Deep link to Vault claims tab

No issues. Straightforward fix:
- `VaultEnhanced.tsx`: Add `useSearchParams`, use controlled `value` on `ModuleTabs` instead of `defaultValue`, read `view` param and set tab accordingly
- `UnifiedNotificationCenter.tsx` line 300: Change `view=damage` to `view=claims` to match the tab id

### Issue 3 — Severity alignment

The prompt says "use `minor | moderate | severe | total_loss` everywhere." But there are **three different severity scales** in play:

| Location | Values | Used For |
|----------|--------|----------|
| `validationSchemas.ts` | minor, moderate, severe, total_loss | Schema validation (unused by DamageReportDialog) |
| `DamageReportDialog.tsx` | minor, moderate, major | Filing damage claims via UI |
| `inspections/types.ts` | minor, moderate, major | Inspection damage items |
| `damage_claims` DB column | text (no constraint) | Storage |

**The prompt's schema (`validationSchemas.ts`) isn't even used by `DamageReportDialog`** — that dialog has its own inline Zod schema. So aligning `validationSchemas.ts` alone won't fix the UI.

**Recommendation**: Pick one canonical set. Since `total_loss` is insurance-relevant for claims, use `minor | moderate | severe | total_loss` for **damage claims** and keep `minor | moderate | major` for **inspection damage items** (which are quick field assessments, not insurance claims). These are different contexts. If you want them unified, change inspection types too, but that touches `SEVERITY_CONFIG` display labels and the `GuidedCaptureWizard`.

### Photo URLs in schema

Simple addition — add `photo_urls: z.array(z.string().url()).optional()` to `damageClaimSchema` in `validationSchemas.ts`. But note `DamageReportDialog` doesn't use that schema at all (it has its own inline one), so also add it to the inline schema there.

## Proposed Changes

### 1. `src/components/dialogs/CheckInOutDialog.tsx`
Add a "File Damage Claim" button on the completion step (next to "Create Work Order"). On click, open `DamageReportDialog` pre-filled with vehicle ID, auto-generated description from damage items, and photo URLs from uploaded damage photos.

### 2. `src/components/common/UnifiedNotificationCenter.tsx`
Line 300: Change `params.view = 'damage'` to `params.view = 'claims'`.

### 3. `src/components/dashboard/VaultEnhanced.tsx`
Add `useSearchParams`, controlled tab state, and a `useEffect` to read `view` param and set the active tab. Clear the param after applying.

### 4. `src/components/dialogs/DamageReportDialog.tsx`
Change severity enum from `["minor", "moderate", "major"]` to `["minor", "moderate", "severe", "total_loss"]`. Update the UI select options to match.

### 5. `src/lib/validationSchemas.ts`
Add `photo_urls: z.array(z.string()).max(10).optional()` to `damageClaimSchema`.

### 6. `src/components/inspections/types.ts`
Keep `DamageSeverity = 'minor' | 'moderate' | 'major'` as-is (field assessment context), OR align to `severe` if you want full consistency.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dialogs/CheckInOutDialog.tsx` | Add "File Damage Claim" button on completion step |
| `src/components/common/UnifiedNotificationCenter.tsx` | `view=damage` → `view=claims` |
| `src/components/dashboard/VaultEnhanced.tsx` | Controlled tab state from searchParams |
| `src/components/dialogs/DamageReportDialog.tsx` | Severity: `major` → `severe`, add `total_loss`, add `photo_urls` |
| `src/lib/validationSchemas.ts` | Add `photo_urls` to damageClaimSchema |

