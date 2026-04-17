

## Why You Saw an 8-Month-Old Version

### Root cause analysis

Your app uses `vite-plugin-pwa` with `registerType: 'autoUpdate'`. This means **a service worker is installed in every production browser** and serves cached assets from disk before the network is even consulted.

Here's the failure chain that almost certainly happened:

1. Months ago, you visited `app.exotiq.ai` and the browser silently registered a service worker + cached the JS/CSS bundles from that day.
2. **Nothing in `index.html` triggers the SW lifecycle on load** — `vite-plugin-pwa` requires an explicit `registerSW()` call (or the `injectRegister: 'auto'` option) for the *current* page load to ask the SW to update. Your `vite.config.ts` doesn't set `injectRegister`, and `main.tsx` never calls `registerSW()`. So the SW never got told "go check for a new version."
3. The old SW kept serving its old cached bundle. Workbox's `cleanupOutdatedCaches` only fires *after* a new SW activates — which never happened because nothing registered/updated it.
4. `ServiceWorkerUpdatePrompt.tsx` listens for `updatefound` events but never *triggers* an update check itself — it's purely reactive. If the SW never updates, this code never runs.
5. Result: the browser kept loading 8-month-old JS forever. Clearing cache nuked the SW registration, which is why it works now.

The current setup has good *intent* (NetworkOnly for navigation, no HTML caching, skipWaiting) but a critical gap: **the service worker is never actually registered or told to update on page load**, so all the safety nets sit dormant.

### Secondary risk

Even if the SW *were* registered correctly, browsers only check for SW updates on navigation by default. A long-lived tab or PWA install can stay stuck for weeks. We need an explicit periodic update check too.

---

## The Fix (4 small changes)

### 1. Properly register the service worker on every page load

In `src/main.tsx`, import and call `registerSW` from `virtual:pwa-register`. This:
- Registers the SW on first visit
- **Calls `registration.update()` on every page load** (forces a check against the server)
- Wires `onNeedRefresh` to auto-activate the new SW (your existing `ServiceWorkerUpdatePrompt` already handles `controllerchange` → reload)

### 2. Add periodic update polling

Inside the `registerSW` config, set up a `setInterval` to call `registration.update()` every 60 minutes. Catches users who keep tabs open for days.

### 3. Add Vite PWA TypeScript types

Add `vite-plugin-pwa/client` to `tsconfig`'s `types` array (or add a `/// <reference>` in `main.tsx`) so the `virtual:pwa-register` import type-checks cleanly.

### 4. Add a one-time "kill switch" for stuck users

In `src/lib/staleBuildRecovery.ts`, on app boot, check if `navigator.serviceWorker.controller` exists AND no `registerSW` has been previously called against this origin (we'll use a versioned localStorage flag like `sw_v2_initialized`). If found, unregister all old SWs and reload once. This rescues every existing user with the broken old SW currently in their browser — without it, your fix only helps people who clear cache.

### Files to change

| File | Change |
|------|--------|
| `src/main.tsx` | Import `registerSW` from `virtual:pwa-register`, call it with `onRegisteredSW` that polls `update()` every 60 min, and `onNeedRefresh` that calls `updateSW(true)` |
| `src/lib/staleBuildRecovery.ts` | Add `rescueStuckServiceWorker()` helper that detects pre-fix SW (no `sw_v2_initialized` flag + active controller), unregisters it, clears caches, sets the flag, hard-reloads once |
| `vite.config.ts` | Keep current Workbox config (it's correct); no change needed |
| `tsconfig.app.json` | Add `"vite-plugin-pwa/client"` to `compilerOptions.types` for the virtual module typing |

### Why this is safe

- The rescue helper runs once per browser (gated by localStorage flag) — no reload loop risk, and `staleBuildRecovery.ts` already has a 30-second cooldown guard.
- `registerSW` is the official, supported entry point — we're using the plugin as intended, not fighting it.
- Preview environments are already handled by `ServiceWorkerUpdatePrompt` (it unregisters SWs on `id-preview--*` hosts), so dev workflow is unaffected.
- After deploy, every existing stuck user gets auto-rescued on their next visit; new users get the proper update flow forever after.

