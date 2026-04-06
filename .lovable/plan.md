

# Subtle Module Loading Animations — Safe Improvements

## Current State

The Suspense fallback in `Dashboard.tsx` (lines 209-216) is a plain `animate-pulse` skeleton — generic gray blocks that just throb. You already have a rich library of specialized skeletons (`skeleton-specialized.tsx`) with shimmer gradients, staggered delays, and thinking-dot animations, but **none of them are used** during module transitions. Meanwhile, the existing `animate-shimmer` and `animate-pulse-soft` keyframes are already defined and safe (pure CSS, no framer-motion, no conflict with Suspense).

## Plan

### 1. Module-specific Suspense fallbacks

Replace the single generic skeleton with a mapping of module → specialized skeleton. Each module gets a fallback that matches its actual layout shape, so the transition feels intentional rather than jarring.

**`src/pages/Dashboard.tsx`** — new `getModuleSkeleton(moduleId)` function:

| Module | Skeleton |
|--------|----------|
| `dashboard` | `SkeletonBanner` + `SkeletonStatsRow` + `SkeletonModuleNav` |
| `book` | `SkeletonQuickActions` + 3× `SkeletonScheduleItem` |
| `fleet` | 4× `SkeletonVehicleCard` in a grid |
| `pulse` | `SkeletonStatsRow` + `SkeletonSection` (chart height) |
| `motoriq` | `SkeletonAIInsight` + `SkeletonStatsRow` |
| `vault` | `SkeletonQuickActions` + 3× `SkeletonDocumentRow` |
| `core` | `SkeletonAIInsight` |
| `settings`, `team-hub` | Current generic skeleton (fine for simple layouts) |

These all use **CSS-only** animations (`animate-shimmer`, `animate-pulse-soft`, staggered `animationDelay`) — zero framer-motion in the loading path, so no conflict with Suspense.

### 2. Staggered reveal on the loaded content

After the chunk loads and the real content mounts, the current `animate-fade-in` is a single 300ms opacity+translateY. Enhance this slightly:

- Add a new `animate-fade-in-up` keyframe (200ms, translateY(8px) → 0, ease-out) — snappier than the current 300ms with 10px travel
- This keeps the CSS-only approach (no framer-motion wrapping lazy components)

### 3. Fix missing `animate-shimmer` usage

The specialized skeletons reference `animate-shimmer` via inline classes — this already works via Tailwind config. But `animate-pulse-soft` is only defined in `index.css` as a raw class. Both are CSS-only and safe. No changes needed, just confirming they don't conflict.

## What NOT to do

- No `AnimatePresence` or `motion.div` around lazy-loaded content (lesson learned)
- No `useTransition` / `startTransition` — adds complexity for marginal gain here
- No preloading on sidebar hover (premature optimization; chunks are small after code-split)

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add `getModuleSkeleton()`, use it in Suspense fallback, tweak fade class |
| `tailwind.config.ts` | Add `fade-in-up` keyframe (snappier variant) |

## Risk

**Very low.** All animations are CSS-only. No interaction with React's Suspense lifecycle. The specialized skeletons are already built and tested — we're just wiring them into the right place.

