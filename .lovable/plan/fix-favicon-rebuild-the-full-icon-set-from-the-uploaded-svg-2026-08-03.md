# Fix favicon — rebuild the full icon set from the uploaded SVG marks

You uploaded scalable vector versions of the exotiq mark (black and white, transparent, 240x240 viewBox). Vectors are exactly what was needed — no additional file sizes are required from you. Every favicon, app icon, and PWA icon can be rendered from these two files.

## 1. Add the vector marks

- `public/favicon.svg` — the black mark (used by browsers that prefer SVG favicons)
- `public/favicon-dark.svg` — the white mark, served via a `prefers-color-scheme: dark` link

## 2. Render raster derivatives from the SVG

Rendered at high density then downsampled, so edges stay crisp:

- `favicon-16x16.png`, `favicon-32x32.png` — from the black mark
- `apple-touch-icon.png` (180x180) — black mark on a solid brand background, since iOS does not honor transparency and composites onto whatever it likes
- `notification-icon-192.png` (192x192)
- `pwa-icon-512.png` (512x512), plus a maskable variant with safe-area padding

Because the current PNG mark's strokes vanish at 16px, the small sizes get a slight optical adjustment: render the mark at ~90% of the canvas so the ring keeps its weight rather than being clipped by antialiasing.

## 3. Update references

- `index.html`: point the SVG icon links at the new files, keep the light/dark media queries, keep the 16/32 PNG fallbacks and the apple-touch-icon.
- Add a cache-busting suffix to the favicon URLs so browsers holding the old D emblem refresh.
- `public/site.webmanifest`: keep existing icon names (regenerated in place), add the maskable entry.
- Update the Organization JSON-LD `logo` URL if it should point at the SVG.

## 4. Clean up

- Remove any stale `favicon.ico` and leftover D-emblem files.
- Confirm nothing in the app still references retired icon paths.

## 5. Verification

- Render each generated size and visually confirm the three bars and blue dot are legible at 16px and 32px.
- Confirm the white mark resolves for dark-mode browser chrome and the black mark for light.
- Build and typecheck pass.

## Technical notes

- Rasterization uses ImageMagick with an explicit high `-density` on the SVG input, then `-resize` down, with `-background none -gravity center -extent` for square padding.
- The in-app `Logo` component keeps using the existing PNG marks; swapping it to SVG is optional and out of scope unless you want it.
