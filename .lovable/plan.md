

# Rari Demo Tour: Slow Down, Add Cursor Guide, Fix Confetti & Modal

## Current State (Two Tours)

1. **InteractiveModuleTour** — Small card walkthrough with spotlight, manual next/back. Auto-starts for new users when `tour_completed === false`.
2. **AutomatedDemoTour** — Rari-narrated cinematic tour with TTS, zoom effects, control bar. Triggered by `start-demo-tour` event.

Both run independently. The small card tour auto-starts for new users, which may conflict with the Rari tour if triggered shortly after.

## Problems Identified

1. **Tour is too fast**: Step durations are 5.5–7.5s. Module transitions are 500ms, tab clicks 300ms, inter-step gap only 600ms. For a viewer, each screen flashes by.
2. **No visual pointer**: Nothing guides the eye to what's being highlighted. The vignette zoom is subtle.
3. **Confetti only fires from center-bottom**: Single burst from `origin: { y: 0.6 }`, doesn't fill screen.
4. **PostTourChoiceModal may dismiss on click-outside**: The modal backdrop doesn't block pointer events on the modal itself properly — if the user clicks the backdrop area or a stray click lands outside the card, it could vanish. Also, the modal only shows when `deactivateTour()` fires → `showPostTourModal = true`, but if the InteractiveModuleTour's confetti fires around the same time, there could be a state collision.

## Feasibility Assessment

| Idea | Feasible? | Notes |
|------|-----------|-------|
| Slow down tour 2–3x | Yes | Increase durations + transition delays |
| Animated Rari cursor icon | Yes | Framer Motion div that lerps to each target selector |
| Cursor clicks tabs visually | Yes | Animate cursor to tab → "click" animation → tab activates |
| Full-screen confetti from both sides | Yes | Two `confetti()` calls with `origin.x: 0.1` and `0.9` |
| Fix PostTourChoiceModal stall | Yes | Add click-outside protection, verify event chain |
| Remove/disable small card tour | Risky | It's the auto-start for new users; safer to make Rari tour the default |

## Plan

### 1. Slow down the Rari demo tour

**`src/hooks/useDemoScript.ts`** — Increase all step durations by ~2x:
- Intro: 7000 → 12000ms
- Module steps: 5500–7500 → 10000–14000ms
- This gives viewers time to actually read and absorb each screen

**`src/hooks/useDemoOrchestrator.ts`** — Increase transition delays:
- Module change wait: 500 → 1200ms
- Pre-tab-click delay: 300 → 800ms
- Post-tab-click delay: 400 → 1200ms
- Post-scroll delay: 300 → 800ms
- Inter-step gap: 600 → 1500ms

### 2. Add animated Rari cursor pointer

**Create `src/components/onboarding/RariCursor.tsx`**:
- A floating div with a custom Rari icon (Brain icon with a small pointer arrow)
- Positioned absolutely, animated with Framer Motion
- Receives target coordinates from the orchestrator
- Smooth spring-based movement between targets
- "Click" micro-animation (scale down + ripple) when landing on tabs
- Pulsing glow when hovering over a highlighted element

**Update `src/hooks/useDemoOrchestrator.ts`**:
- Export `cursorPosition: { x, y } | null` state
- Before navigating to a tab, set cursor position to the tab element's center
- Animate cursor arrival → brief pause → trigger click → pause again
- Before zooming to a selector, move cursor there first

### 3. Full-screen confetti from both sides

**Update `src/components/onboarding/AutomatedDemoTour.tsx`** and **`PostTourChoiceModal.tsx`**:
```ts
// Left burst
confetti({ particleCount: 120, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } });
// Right burst
confetti({ particleCount: 120, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
```
Fire both simultaneously for a screen-filling effect.

### 4. Fix PostTourChoiceModal dismissal

**`src/components/onboarding/PostTourChoiceModal.tsx`**:
- Add `onClick={e => e.stopPropagation()}` on the inner card to prevent backdrop clicks from bubbling
- The backdrop itself should NOT call any dismiss action (currently it doesn't, but verify)

**`src/contexts/TourDataContext.tsx`**:
- Add a small delay (500ms) before showing the modal so confetti plays first

### 5. Make Rari tour the primary onboarding flow

**`src/components/onboarding/InteractiveModuleTour.tsx`**:
- Remove the auto-start behavior (the `useEffect` at line 216–230 that starts when `tour_completed === false`)
- Keep it available for manual trigger via `start-tour` event and URL param (Settings → Restart Tour)

**`src/pages/Dashboard.tsx`**:
- When `tour_completed === false` for a new user, auto-trigger `start-demo-tour` event instead of letting InteractiveModuleTour auto-start

## Files Changed

| File | Action |
|------|--------|
| `src/components/onboarding/RariCursor.tsx` | Create — animated cursor component |
| `src/hooks/useDemoScript.ts` | Edit — increase all durations |
| `src/hooks/useDemoOrchestrator.ts` | Edit — slower transitions, export cursor position |
| `src/components/onboarding/AutomatedDemoTour.tsx` | Edit — render RariCursor, full-screen confetti |
| `src/components/onboarding/PostTourChoiceModal.tsx` | Edit — fix click-through, full-screen confetti |
| `src/contexts/TourDataContext.tsx` | Edit — delay modal appearance |
| `src/components/onboarding/InteractiveModuleTour.tsx` | Edit — remove auto-start |
| `src/pages/Dashboard.tsx` | Edit — wire Rari tour as default for new users |

