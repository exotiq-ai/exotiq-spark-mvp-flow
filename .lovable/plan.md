

# Fix: "S" Key Triggering Skip While Typing in Search

## Problem
In the Photo Review Queue, the keyboard shortcut `s` calls `handleSkip()` on every keypress — including when the user is typing in the vehicle search input. Typing "sedan" immediately skips the current photo.

## Fix

**`src/components/photos/PhotoReviewQueue.tsx`** — line 238

In the `handleKeyDown` callback, add an early return when the event target is an input, textarea, or select element:

```ts
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (isProcessing || viewMode === 'batch') return;

  // Don't intercept shortcuts while typing in an input
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  switch (e.key) { ... }
}, [...]);
```

This lets arrow keys, Enter, and `s` work as shortcuts only when focus is on the container — not while searching. One guard clause, one file.

