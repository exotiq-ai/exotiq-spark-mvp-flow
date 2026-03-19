

# Fix: Demo Data Overlay Persists After Tour Exit

## Root Cause

Two bugs working together:

1. **`deactivateTour()` never clears `demoSnapshot`** — it sets `tourActive = false` but the snapshot data stays in memory. If anything re-reads it or `tourActive` gets stale, demo data leaks through.

2. **Escape / Exit never calls `deactivateTour()`** — the keyboard handler (line 73) and the Exit button both only call `demo.stop()`, which resets orchestrator state but leaves `TourDataContext` thinking the tour is still conceptually active with data loaded.

Combined result: after interruption, `useLocationFilteredFleet` continues returning demo vehicles/bookings because `demoSnapshot` is still populated.

## Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/contexts/TourDataContext.tsx` | `deactivateTour` clears `demoSnapshot` to `null`. Add optional `completed` param — only show post-tour modal when `completed = true`. |
| 2 | `src/components/onboarding/AutomatedDemoTour.tsx` | Escape key and Exit button: call `deactivateTour()` alongside `demo.stop()`. The `onComplete` callback already calls `deactivateTour()` so that path is fine — just pass `completed` flag so the modal only shows on normal completion. |

### Detail

**TourDataContext.tsx** line 82-88:
```typescript
const deactivateTour = useCallback((completed = false) => {
  setTourActive(false);
  setDemoSnapshot(null);
  if (completed) {
    setTimeout(() => setShowPostTourModal(true), 800);
  }
}, []);
```

**AutomatedDemoTour.tsx** — keyboard handler line 73:
```typescript
case 'Escape': e.preventDefault(); demo.stop(); deactivateTour(); break;
```

**AutomatedDemoTour.tsx** — `onComplete` callback (line 43):
```typescript
deactivateTour(true);  // pass true → show post-tour modal
```

**AutomatedDemoTour.tsx** — Exit button (bottom bar) also wraps with `deactivateTour()`.

