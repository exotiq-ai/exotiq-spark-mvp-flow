
# Review & Implementation Plan: Onboarding CRM Enterprise Readiness

## Document Accuracy Assessment

### What's Correct
- **`src/hooks/useDemoAccount.ts`**: Well-implemented hook with good documentation
- **`src/lib/importDuplicateCheck.ts`**: Enterprise-grade with batch queries, proper normalization
- **`src/components/dashboard/RealAIInsights.tsx`**: Correctly uses existing hooks, handles all edge cases
- **`src/components/import/DuplicateResolver.tsx`**: Clean UI with side-by-side comparison
- **`src/contexts/TeamContext.tsx`**: Properly includes `is_demo_account` in Team interface
- **`src/pages/Onboarding.tsx`**: Step 3 choice screen is well-designed

### Issues Found

**1. Database Schema - `is_demo_account` column missing**
The `teams` table doesn't have the `is_demo_account` column yet. Current columns:
```
id, name, owner_id, slug, logo_url, timezone, settings, 
is_deleted, deleted_at, deleted_by, deletion_scheduled_for, 
created_at, updated_at
```

**2. Build Errors in Edge Functions**
Multiple TypeScript errors in `elevenlabs-tools` and `rari-mcp-server` (pre-existing, unrelated to this feature):
- Type casting issues with `Uint8Array`
- Missing type annotations on callback parameters
- `.catch()` method misuse on Supabase queries

**3. Photo Import - Incomplete Integration**
The current "Add from Photos" option just shows a toast. Per your preference, we need to integrate `AddVehicleFromPhotoWizard` directly.

**4. Insight Persistence - Not Implemented**
Per your preference to persist insights, `RealAIInsights` needs to save generated insights to `rari_insights` table.

**5. Post-Import Navigation - Not Implemented**
Per your preference, after bulk import in onboarding, users should navigate to Fleet module, not continue onboarding.

---

## Implementation Plan

### Phase 1: Database Migration (Priority)

Add `is_demo_account` column to `teams` table:

```sql
-- Add demo account flag
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_demo_account BOOLEAN DEFAULT false;

-- Set demo account for hello@exotiq.ai
UPDATE teams 
SET is_demo_account = true 
WHERE id = (
  SELECT tm.team_id 
  FROM team_members tm
  JOIN profiles p ON p.id = tm.user_id
  WHERE LOWER(p.email) = 'hello@exotiq.ai'
  AND tm.is_active = true
  LIMIT 1
);
```

### Phase 2: Integrate AddVehicleFromPhotoWizard into Onboarding

Update `src/pages/Onboarding.tsx`:
1. Import `AddVehicleFromPhotoWizard` component
2. Add dialog state for photo wizard
3. Replace the toast with actual dialog integration
4. Handle completion callback to advance to step 4

```text
Files to modify:
- src/pages/Onboarding.tsx (add photo wizard dialog integration)
```

### Phase 3: Integrate Duplicate Detection into ImportWizard

Update `src/components/import/ImportWizard.tsx`:
1. Add `'duplicates'` step between `'preview'` and `'import'`
2. Import duplicate checking utilities
3. After validation, check for duplicates
4. If duplicates found, show `DuplicateResolver` component
5. Apply resolutions before performing import

```text
Files to modify:
- src/components/import/ImportWizard.tsx (add duplicate step)
```

### Phase 4: Insight Persistence to Database

Update `src/components/dashboard/RealAIInsights.tsx`:
1. After generating insights, save new ones to `rari_insights` table
2. Check for existing insights with same `internal_id` to avoid duplicates
3. Mark insights as `is_read` when user takes action
4. Add mutation for dismissing insights

```text
Files to modify:
- src/components/dashboard/RealAIInsights.tsx (add persistence)
```

### Phase 5: Replace Hardcoded Data in Core.tsx

Update `src/components/dashboard/Core.tsx`:
1. Replace hardcoded `aiInsights` array with `RealAIInsights` component
2. Replace hardcoded `systemAlerts` with real notifications from database
3. Replace hardcoded `performanceMetrics` with calculated values

```text
Files to modify:
- src/components/dashboard/Core.tsx (integrate real data)
```

### Phase 6: Calculate Real Growth Percentages

Update growth calculations in:
- `src/components/dashboard/CRMSection.tsx` - customer growth
- `src/components/dashboard/PaymentTracker.tsx` - payment growth
- `src/components/dashboard/MotorIQEnhanced.tsx` - revenue data

```text
Files to modify:
- src/components/dashboard/CRMSection.tsx
- src/components/dashboard/PaymentTracker.tsx
- src/components/dashboard/MotorIQEnhanced.tsx
```

### Phase 7: Post-Import Navigation to Fleet

Update import completion handling:
1. In `Onboarding.tsx`, after import completes, navigate to `/dashboard?tab=fleet`
2. In `ImportWizard.tsx`, add navigation helper

```text
Files to modify:
- src/pages/Onboarding.tsx (navigate to fleet after import)
```

### Phase 8: Fix Edge Function Build Errors

Fix TypeScript errors in:
- `supabase/functions/elevenlabs-session/index.ts`
- `supabase/functions/elevenlabs-tools/index.ts`
- `supabase/functions/rari-mcp-server/index.ts`
- `supabase/functions/rari-universal-query/index.ts`

These are mostly type annotation issues on callback parameters and proper casting.

---

## Technical Details

### Duplicate Detection Flow

```text
Preview Step → Duplicate Check → Resolution Step (if needed) → Import

If duplicates found:
┌─────────────────────────────────────┐
│ DuplicateResolver Component         │
├─────────────────────────────────────┤
│ Apply to all: [Skip] [Overwrite] [Merge] │
├─────────────────────────────────────┤
│ Row 2: VIN ABC123 matches existing  │
│ ○ Skip  ○ Overwrite  ○ Merge        │
│ [Compare values ▼]                  │
├─────────────────────────────────────┤
│ Row 5: Email john@... matches       │
│ ○ Skip  ○ Overwrite  ○ Merge        │
└─────────────────────────────────────┘
```

### Insight Persistence Schema

```typescript
// New insights saved to rari_insights table
{
  user_id: user.id,
  team_id: currentTeam?.id,
  insight_type: insight.type,       // 'pricing' | 'utilization' | etc.
  priority: insight.priority,       // 'high' | 'medium' | 'low'
  title: insight.title,
  description: insight.description,
  related_entity_type: 'vehicle' | 'customer',
  related_entity_id: insight.vehicleId || insight.customerId,
  metadata: { confidence: insight.confidence, impact: insight.impact },
  expires_at: // 24 hours from now (insights refresh daily)
}
```

### Growth Calculation Pattern

```typescript
// Reusable growth calculation
const calculateGrowth = (items: { created_at: string }[], days: number = 30) => {
  const now = new Date();
  const periodEnd = new Date(now);
  const periodStart = new Date(now.setDate(now.getDate() - days));
  const prevPeriodStart = new Date(periodStart);
  prevPeriodStart.setDate(prevPeriodStart.getDate() - days);
  
  const current = items.filter(i => 
    new Date(i.created_at) >= periodStart && new Date(i.created_at) < periodEnd
  ).length;
  
  const previous = items.filter(i => 
    new Date(i.created_at) >= prevPeriodStart && new Date(i.created_at) < periodStart
  ).length;
  
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
};
```

---

## Files Summary

### New/Already Created by Cursor
| File | Status |
|------|--------|
| `src/hooks/useDemoAccount.ts` | Done |
| `src/lib/importDuplicateCheck.ts` | Done |
| `src/components/dashboard/RealAIInsights.tsx` | Done |
| `src/components/import/DuplicateResolver.tsx` | Done |

### To Be Modified
| File | Change |
|------|--------|
| Database migration | Add `is_demo_account` column |
| `src/pages/Onboarding.tsx` | Add photo wizard integration + fleet navigation |
| `src/components/import/ImportWizard.tsx` | Add duplicate detection step |
| `src/components/dashboard/RealAIInsights.tsx` | Add persistence to database |
| `src/components/dashboard/Core.tsx` | Replace hardcoded data |
| `src/components/dashboard/CRMSection.tsx` | Calculate real growth |
| `src/components/dashboard/PaymentTracker.tsx` | Calculate real growth |
| `src/components/dashboard/MotorIQEnhanced.tsx` | Use real revenue |
| `supabase/functions/elevenlabs-*.ts` | Fix TypeScript errors |

---

## Questions Resolved
- **Photo Import**: Will integrate `AddVehicleFromPhotoWizard` directly in onboarding
- **Insight Storage**: Will persist to `rari_insights` table
- **Post-Import Navigation**: Will navigate to Fleet module after bulk import
