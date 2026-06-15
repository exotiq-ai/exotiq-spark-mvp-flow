# Smooth loading + cookie banner answers

## Answers to your questions

### 1. Cookie popup — does it show every visit?
**No, only the first visit per browser** (and again if we publish a new cookie policy version). It's controlled by `localStorage["exotiq.cookie_consent.v2"]` in `CookieConsentBanner.tsx`. Once a visitor clicks Accept / Reject / Save, the choice persists.

**Why you see it repeatedly in the Lovable preview:** the preview runs in a sandboxed iframe whose `localStorage` is often partitioned or cleared between sessions, so the banner thinks every visit is a "first visit." Real users on `app.exotiq.ai` and `exotiq.ai` will see it exactly once.

No code change needed for cookies — it already behaves correctly in production.

### 2. The "extra loading" / "updated version" flash after login
There are three real causes, in order of impact:

**(a) Double Suspense fallback flash.** `App.tsx` lazy-loads `Dashboard` behind one full-screen `<LoadingSpinner fullScreen />`. Then `Dashboard.tsx` itself lazy-loads its 9 sub-modules behind another fallback. After login the user sees: spinner → shell → spinner → content. That's the "extra loading thing."

**(b) Service Worker update prompt is wired correctly** (manual "Reload" pill, no silent reload) — but on the very first visit after a deploy, the new SW takes control while the page is loading, and `controllerchange` fires → `window.location.reload()`. That's the "loading to an updated version" moment right after login.

**(c) Stale-asset auto-recovery hard-reloads** on chunk-load failures. Runtime errors confirm this fired once already this session (`Failed to fetch dynamically imported module Index.tsx`). It already requires 2 failures in 10s before reloading, so it's rare, but worth tightening.

## Plan

### Fix A — Eliminate the double spinner (highest impact)
- Replace the single global `<LoadingSpinner fullScreen />` Suspense fallback in `App.tsx` with **route-aware fallbacks**:
  - Public routes (`/`, `/auth`, legal): keep a minimal centered logo (no big spinner).
  - `/dashboard/*`: render the dashboard **shell skeleton** (sidebar + topbar + content placeholder) instead of a full-screen spinner, so when the inner lazy modules resolve there's no second full-page flash — just the content area filling in.
- In `Dashboard.tsx`, swap the inner lazy fallback for a lightweight content-area skeleton (same height as the module) so transitions feel like Stripe/Linear — content morphs in, layout never jumps.

### Fix B — Preload the Dashboard chunk during auth
- In `Auth.tsx`, when the email field gets focus or the user starts typing the password, fire `import('./Dashboard')` (fire-and-forget). By the time login resolves the chunk is warm and the post-login spinner is essentially invisible.
- Add `<link rel="modulepreload">` hints in `index.html` for the Dashboard entry chunk so first-time visitors get it during idle.

### Fix C — Tame the SW "auto-reload after deploy"
- Keep the manual update pill (already correct), but **suppress the automatic `controllerchange` reload** when the SW activates during the very first load (no prior controller). Only auto-reload if the user explicitly clicked "Reload" in the pill. This kills the "app reloaded itself right after I logged in" moment.
- In `ServiceWorkerUpdatePrompt.tsx`: track whether the controller change was user-initiated (set a flag in `handleUpdate`). If not, ignore it.

### Fix D — Quiet the realtime reconnect noise
- `FleetContext` logs `❌ Realtime subscription error` every few minutes then silently reconnects. Downgrade to `devWarn` and only surface to the user if reconnect fails 3× in a row. No UX change, just cleaner console + no false alarm if we ever add a toast there.

### Fix E — Tighten stale-asset recovery
- Increase the confirm window from 10s → 20s and require the second failure to be a **different** chunk (transient preload races usually repeat on the same chunk). Reduces unnecessary hard reloads further.

### Out of scope (call out, don't do)
- Replacing `framer-motion` or adding vendor `manualChunks` (audit P3/P6) — separate perf pass, bigger surface area.
- Converting more routes to skeletons beyond Dashboard — can follow if you like the pattern.

## Files touched
- `src/App.tsx` — route-aware Suspense fallbacks.
- `src/pages/Dashboard.tsx` — inner skeleton fallback.
- `src/pages/Auth.tsx` — preload Dashboard on form interaction.
- `index.html` — modulepreload hint.
- `src/components/common/ServiceWorkerUpdatePrompt.tsx` — only reload on user-initiated activation.
- `src/contexts/FleetContext.tsx` — quieter realtime reconnect.
- `src/lib/staleBuildRecovery.ts` — tighter confirm rule.
- New: `src/components/common/DashboardSkeleton.tsx` (shell skeleton).

## Expected result
- Login → dashboard: one smooth fade from auth form into the dashboard shell, content fills in without a second full-page spinner.
- No surprise reloads after deploys — users see the small "Update available" pill and choose when to reload.
- Cookie banner: shown exactly once per real visitor (already correct in prod).
