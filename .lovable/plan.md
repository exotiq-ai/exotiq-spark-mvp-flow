# Favicon, Social Preview, and Logo Cleanup

Consolidate every browser/OS/social touchpoint on the **D emblem** (Gulf Blue on light, White on dark) and retire the old lovable-uploads "cube" PNG plus the unused `public/exotiq-logo.png` text stub.

## 1. Favicon set (`index.html` + `public/`)

Today only a single SVG is wired as both `icon` and `apple-touch-icon`. Replace with a proper favicon set derived from the D emblem:

- Keep `/brand/logos/svg/d-emblem-gulf-blue-transparent.svg` as the primary `rel="icon"` (scales crisply, respects light bg).
- Add a `rel="icon"` alternate using `d-emblem-white-transparent.svg` with `media="(prefers-color-scheme: dark)"` so browser chrome in dark mode gets the white D instead of a near-invisible Gulf Blue mark.
- Generate a 180×180 PNG apple-touch-icon at `public/apple-touch-icon.png` (white D centered on Gulf Blue `#0B3D91` square, per `LOGO_REQUIREMENTS.md`). iOS ignores SVG here.
- Generate a 512×512 maskable PWA icon at `public/pwa-icon-512.png` (same treatment, safe-zone padded).
- Add `public/site.webmanifest` referencing the PWA icon and theme color `#0B3D91`; link it from `<head>`.
- Delete the fallback `public/exotiq-logo.png` (text stub, unreferenced by app code).

## 2. Social share preview (Open Graph / Twitter)

Currently `og:image` and `twitter:image` in `index.html` point at an external `storage.googleapis.com` SVG. Most social crawlers (LinkedIn, Slack, iMessage, X) reject SVG and/or block that host — previews render blank.

- Generate `public/og-image.jpg` at **1200×630** — white D emblem + "Exotiq" wordmark centered on a Gulf Blue `#0B3D91` background with a subtle metallic gradient, matching brand spec.
- Update `index.html` `og:image` and `twitter:image` to the absolute URL `https://exotiq.ai/og-image.jpg` (crawlers need absolute https). Add `og:image:width=1200`, `og:image:height=630`, and `og:image:alt="Exotiq — AI-powered luxury fleet management"`.
- Update `SEOHead.tsx` default `image` from the googleapis SVG to `/og-image.jpg` (SEOHead already prefixes `APP_CONFIG.websiteUrl` for absolute URLs). Remove the FD-10 stale-comment.

## 3. Description consistency

`index.html` and `SEOHead` both say "AI-powered fleet management platform for luxury and exotic car rental operators — bookings, pricing, compliance, and analytics in one command center." — keep this exact string. Confirm `APP_CONFIG.description` in `src/lib/constants.ts` matches (currently the shorter "AI-Powered Fleet Management Platform"); update it to the fuller version so per-page fallbacks stay aligned. Title stays `Exotiq — Luxury Fleet Management`.

## 4. Retire the old cube logo

`src/hooks/usePushNotifications.ts` still uses `/lovable-uploads/e505c73d-…png` (the legacy cube) for notification `icon` and `badge`. Point both at `/brand/logos/svg/d-emblem-gulf-blue-transparent.svg` (or a new 192×192 PNG if we want raster; browsers accept SVG for Notification.icon on desktop, but Android/Chrome prefers PNG — so also emit a `public/notification-icon-192.png` and use that, with the SVG as `badge`).

Delete both files in `public/lovable-uploads/` after confirming no other references (grep already shows only these two hits). Leave `VehicleThumbnail.tsx`'s path check alone — it's defensive against user-uploaded strings, not a logo reference.

## 5. Verification

- Read `index.html` after edits to confirm one `<title>`, one description, matching og/twitter block, all icon links resolving to files that exist in `public/`.
- `ls public/` to confirm new assets present and old cube PNGs + `exotiq-logo.png` gone.
- `rg "lovable-uploads/e505|exotiq-logo\.png|storage.googleapis.com.*social"` returns nothing.
- Playwright: load `/`, screenshot the browser tab area is out of scope, but assert `document.querySelector('link[rel="icon"]').href` and `meta[property="og:image"]` resolve to the new paths.

## Out of scope

- Generating the full 18-file logo package from `LOGO_REQUIREMENTS.md` (favicons at every size, LinkedIn/email variants) — only the assets needed for browser/OS/social touchpoints.
- Any component-level logo swaps (`ExotiqLogo`, `Logo`, nav headers) — those already use the D emblem.
- SEO structured-data changes.

## Files touched

- `index.html` — icon links, manifest link, og/twitter image + dimensions.
- `src/components/common/SEOHead.tsx` — default image path, drop FD-10 comment.
- `src/lib/constants.ts` — `APP_CONFIG.description`.
- `src/hooks/usePushNotifications.ts` — icon/badge URLs.
- `public/` — add `apple-touch-icon.png`, `pwa-icon-512.png`, `og-image.jpg`, `notification-icon-192.png`, `site.webmanifest`; delete `exotiq-logo.png`, `lovable-uploads/e505c73d-…png`, `lovable-uploads/ea741db3-…png`.
