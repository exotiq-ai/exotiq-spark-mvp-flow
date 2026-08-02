# New exotiq mark + lowercase wordmark across the platform

Replace the old "D emblem" with the new circle-and-bars mark (blue dot accent), make every
in-app instance of the brand name lowercase "exotiq", and confirm no Lovable-supplied icons
remain in the favicon, manifest, or any branding surface.

## 1. Brand assets

- Add the two uploaded marks to `public/brand/logos/`:
  - `exotiq-mark-white.png` — for dark theme (white circle/bars, blue dot)
  - `exotiq-mark-black.png` — for light theme (black circle/bars, blue dot)
- Generate square derivatives from the black mark (light backgrounds) for favicons and app icons:
  `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180), `notification-icon-192.png`, `pwa-icon-512.png`.
- Retire the six `d-emblem-*.svg` files once nothing references them.

## 2. Logo components

Two components render the logo today and both point at the D emblem:

- `src/components/ui/logo.tsx` — theme-aware, used by sidebar, header, auth, landing nav/footer,
  Welcome, NotFound, maintenance overlay, signing ceremony.
- `src/components/common/ExotiqLogo.tsx` — variant/size API with a `logoFiles` map of five colors.

Plan: point both at the new mark. `logo.tsx` swaps white/black by resolved theme. `ExotiqLogo`
collapses its variant map to the two real marks (`white`, `black`), keeping `auto` behavior and
mapping the legacy variant names (`gulf-blue`, `orange`, `silver`) onto the closest of the two so
no call site breaks. Wordmark text becomes lowercase "exotiq".

## 3. Lowercase wordmark (UI only)

Change displayed "Exotiq" / "ExotIQ" / "Exotiq.ai" to lowercase in app UI: sidebar, headers,
dashboard copy, onboarding, Welcome, Auth, demo banners, super admin, settings, landing page,
Rari surfaces, `src/lib/constants.ts` display strings.

Kept as-is (per your answer):
- Legal pages (`src/pages/legal/*`), legal version/changelog data, and signed document templates —
  the entity name stays "Exotiq" / "Exotiq.ai".
- Domains, emails, code identifiers, table/column names, feature flags.
- Sentence-initial usage stays capitalized ("Exotiq is an AI-powered…").

## 4. Head metadata, manifest, favicon

- `index.html`: swap the two D-emblem favicon links for the new mark, update the Organization
  JSON-LD `logo` URL. Titles/descriptions keep sentence-initial "Exotiq".
- `public/site.webmanifest`: icons already point at the PNG names being regenerated; no rename
  needed, only the underlying images change.
- Verify no `favicon.ico`, no Lovable/gpteng icon, no `lovable-uploads` image is referenced
  anywhere in `index.html`, manifest, or components. (The Lovable domains in the CSP and the
  `lovableproject.com` hostname check in `main.tsx` are infrastructure, not branding — those stay.)

## 5. Social preview

Regenerate `public/og-image.jpg` (1200x630): new mark on the brand background with the lowercase
wordmark. Note: platforms cache previews, so shared links won't refresh instantly.

## 6. Verification

- Grep for remaining `d-emblem` references — expect zero.
- Screenshot the dashboard in light and dark theme to confirm the mark is visible on both
  (the white mark is invisible on light backgrounds, so theme routing must be right).
- Build + typecheck.

## Technical notes

- Uploaded PNGs go into `public/brand/logos/` as real files rather than CDN asset pointers, since
  favicon/manifest/PWA icons must resolve from the site root.
- Favicon derivatives generated with ImageMagick using `-background none -gravity center -extent`
  so the mark is padded, not stretched.
- `ExotiqLogo`'s variant type stays exported to avoid touching every consumer; only the file map
  and wordmark casing change.
