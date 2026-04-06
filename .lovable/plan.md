

# Fix Module Navigation Mismatch

## Root Cause

The bug is a conflict between `AnimatePresence mode="popLayout"` and `Suspense` around lazy-loaded modules (lines 251-262 of Dashboard.tsx).

When you click a sidebar item:
1. URL updates → `activeModule` changes → `key` on `motion.div` changes
2. AnimatePresence (popLayout mode) starts **exit animation** on old content while mounting the new component
3. The new component is `React.lazy` — it **suspends** during chunk download
4. React shows the Suspense fallback skeleton, but AnimatePresence keeps the **old exiting component in the layout** (that's what `popLayout` does — it uses `position: absolute` to keep exiting elements visible)
5. Result: the old module's content stays visible on screen even though the URL and sidebar already show the new module

The **no-op guard** on line 135 (`if (moduleId === activeModule) return`) then prevents recovery — clicking the same sidebar item again does nothing because the URL already matches.

Screenshot 3 confirms this exactly: URL says `/dashboard/pulse`, sidebar highlights Pulse, but Fleet Management content is still rendered.

## Fix

### 1. `src/pages/Dashboard.tsx` — Remove AnimatePresence around lazy modules

Replace the `AnimatePresence` + `motion.div` wrapper with just `Suspense`. Lazy-loaded components and exit animations don't mix well — the animation framework can't coordinate with React's suspension mechanism. A simple opacity fade via CSS transition on mount is sufficient and avoids the conflict entirely.

```
// Before (broken)
<Suspense fallback={...}>
  <AnimatePresence mode="popLayout">
    <motion.div key={activeModule} ...>
      {content}
    </motion.div>
  </AnimatePresence>
</Suspense>

// After (reliable)
<Suspense fallback={...}>
  <div key={activeModule} className="animate-fade-in">
    {content}
  </div>
</Suspense>
```

### 2. `src/pages/Dashboard.tsx` — Remove the no-op guard

Remove `if (moduleId === activeModule) return;` on line 135. This guard prevents users from recovering from stuck states. If the user clicks the same module, let `nav()` fire — React Router will recognize it as the same path and won't cause unnecessary re-renders, but it ensures the component tree is in sync.

### 3. `src/pages/Dashboard.tsx` — Remove transition state

Remove `isModuleTransitioning` state and the timeout logic (lines 124, 138-155) since there's no animation to coordinate with anymore. The Suspense fallback skeleton handles the loading state naturally.

### 4. Verify `animate-fade-in` exists in Tailwind config

Check that the CSS keyframe class `animate-fade-in` is defined. If not, add a simple one or use Tailwind's built-in `animate-in` from the animation plugin. This gives a subtle entrance without the exit animation that causes the conflict.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Remove AnimatePresence/motion.div, remove no-op guard, remove transition state |
| `tailwind.config.ts` (if needed) | Ensure `animate-fade-in` keyframe exists |

## Risk

**Very low**. This removes complexity (AnimatePresence + transition state) rather than adding it. The visual change is minor — modules appear instantly with a subtle fade instead of a slide animation. The tradeoff is worth it: reliable navigation > fancy transitions.

