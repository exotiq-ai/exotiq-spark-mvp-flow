# Stop the flicker and the random reloads

Two distinct problems, both caused by code we already have. Neither is "background loading" in the data sense — it's a mix of layout-shifting animations and over-eager auto-reload behavior.

## Problem 1 — Scrollbar flicker

Three causes, ordered by impact:

1. **`src/components/common/PageTransition.tsx` animates `scale: 0.98 → 1 → 1.02`** on every route/tab key change. Scaling a full-height page momentarily changes content height by a few pixels, so the vertical scrollbar appears/disappears — that's the flash you see on the right edge.
2. **No stable scrollbar gutter.** Any time content height crosses the viewport (data loads, dialogs open, tabs switch), the page width changes by ~15px because the scrollbar reclaims/releases space. This causes a visible horizontal jump in addition to the flash.
3. **Settings tab content remount.** `SettingsLayout` swaps `renderContent()` synchronously, so each tab click hard-mounts a new subtree under the (animated) parent — compounding cause #1.

### Fix

- **`src/index.css`**: add `html { scrollbar-gutter: stable; }` (and `overflow-y: scroll` as a fallback for browsers without `scrollbar-gutter` — Safari < 16). This alone kills the horizontal "jump" everywhere.
- **`src/components/common/PageTransition.tsx`**: remove the `scale` keys from `pageVariants`. Keep opacity + a 4px y-translate, drop duration from 300ms → 180ms, and use `ease: [0.22, 1, 0.36, 1]` (Apple-style standard easing). Best-in-class transitions = fast, subtle, never layout-shifting.
- **Disable enter animation on first paint** by setting `initial={false}` on `AnimatePresence` (already correct in `AnimatedRoute`, missing on `PageTransition`). Prevents the flash on hard navigations and tab returns.

## Problem 2 — Random reloads

You have **four independent code paths** that can reload the tab without warning. At least one of them is firing on you.

1. **`src/main.tsx` — `registerSW({ onNeedRefresh: () => updateSW(true) })`.** Whenever the SW detects a new build (it polls every 60 min plus on every navigation), it immediately activates and the `ServiceWorkerUpdatePrompt` reloads via `controllerchange`. **Silent. No user prompt.** This is almost certainly your "random reload."
2. **`src/lib/staleBuildRecovery.ts` — `initStaleAssetRecovery`** calls `performHardReload()` on any chunk-load failure or even a single failed script/link tag (the `MutationObserver` is broad). One transient 503 on a lazy chunk → hard reload.
3. **`rescueStuckServiceWorker`** one-shot reload — gated by `localStorage`, so should only fire once, but if storage is cleared (incognito, "clear site data") it re-fires.
4. **`useSessionHealth`** isn't a reload, but every time the tab is hidden ≥60s and returns, it calls `supabase.auth.refreshSession()`. This emits `SIGNED_IN` (you can see `seq: 14` in your logs at 15:05:00) which causes `FleetContext` and `TeamContext` to re-init, re-fetch 55 vehicles, and visibly re-render the shell. To a user this looks like a reload.

### Fix

- **`src/main.tsx`**: change `onNeedRefresh` to *not* auto-activate. Instead, set a flag that `ServiceWorkerUpdatePrompt` reads to show a non-intrusive "Update available — Reload" pill (the component already exists for this). Updates ship only when the user clicks. Best-in-class behavior.
- **`src/lib/staleBuildRecovery.ts`**: tighten `handleStaleAssetError` — require the error to actually be a `ChunkLoadError` / dynamic-import failure (drop the broad `<script>`/`<link>` `MutationObserver`, which fires on perfectly normal preload races). Also require **two** failures within 10s before reloading, not one.
- **`src/hooks/useSessionHealth.ts`**: only call `refreshSession()` if the existing session is actually near expiry (check `session.expires_at` vs now + 5min). A 60s hidden → visible transition shouldn't refresh a token that's good for another 50 minutes. Eliminates the cascading `SIGNED_IN` → context re-init → visible re-render.
- **`src/contexts/FleetContext.tsx`** (light touch): on `SIGNED_IN` for the *same* user id, skip the full refresh — only re-init when `user.id` actually changes. Quick guard, kills the visible re-render even if a refresh does happen.

## Verification

After the changes I'll:
1. Reload the preview, sit on `/dashboard/settings`, switch tabs rapidly → confirm no scrollbar flash and no horizontal jump.
2. Hide the tab for 90s, return → confirm console no longer shows `SIGNED_IN seq:14` cascade and no FleetContext re-init.
3. Trigger a chunk-load failure manually (DevTools → block a chunk URL) → confirm we show the offline/update banner instead of insta-reloading.
4. `npm run build` to confirm types are clean.

## Out of scope

- Not touching data-fetching logic, RLS, or any business behavior.
- Not changing the SW registration strategy itself — just the auto-activation behavior.
- Not removing animations entirely; keeping subtle Apple-style fade.

## Files changed

- `src/index.css` — add stable scrollbar gutter
- `src/components/common/PageTransition.tsx` — remove scale, shorten timing, `initial={false}`
- `src/main.tsx` — disable silent SW auto-activation
- `src/lib/staleBuildRecovery.ts` — narrow error matching, require 2 hits
- `src/hooks/useSessionHealth.ts` — only refresh near expiry
- `src/contexts/FleetContext.tsx` — skip re-init when user id unchanged
