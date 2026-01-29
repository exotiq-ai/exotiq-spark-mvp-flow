
# Fix: AI Analysis Confidence Display Bug

## The Problem
The "Confidence: 3000%" display is a bug caused by incorrect math in the UI.

### Root Cause
- **Edge function** returns `confidence` as a value from 0-100 (already a percentage)
- **Database** stores `suggestion_confidence` as 0-100 (e.g., 30 means 30%)
- **UI component** incorrectly multiplies by 100: `suggestion_confidence * 100`
- **Result**: 30 × 100 = 3000% (wrong!)

### Evidence
Database query shows values like 90, 100 (already percentages), and the edge function explicitly calculates `Math.min(100, ...)` capping at 100.

---

## The Fix

### File: `src/components/photos/PhotoReviewQueue.tsx`

**Line 391 - Change from:**
```typescript
<span>{Math.round(currentPhoto.suggestion_confidence * 100)}%</span>
```

**To:**
```typescript
<span>{Math.round(currentPhoto.suggestion_confidence)}%</span>
```

That's it! Just remove the `* 100` multiplication.

---

## Additional Improvements

While fixing this, we should also verify consistency across the codebase:

### Check other places displaying confidence:
1. `VehiclePhotoManager.tsx` - if displaying AI confidence anywhere
2. `PhotoHubTab.tsx` - stats display
3. Batch mode grid in `PhotoReviewQueue.tsx`

### Quality Score Display
The `quality.score` is also 0-100 and should be displayed the same way (just the number, no multiplication).

---

## Summary

| Location | Current | Fixed |
|----------|---------|-------|
| Line 391 | `suggestion_confidence * 100` | `suggestion_confidence` |
| Display | 3000% | 30% |

Simple one-line fix!
