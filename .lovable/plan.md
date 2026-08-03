# Fix favicon — replace tiny/illegible mark with a proper favicon set

The current favicon derivatives (16×16, 32×32) are generated from the new exotiq circular mark, but the thin bars are lost at small sizes, leaving only the blue dot. The browser may also be falling back to a cached D-emblem. We need a favicon-optimized master and correctly sized outputs.

## 1. Receive favicon master from user

Pending user upload of one square master PNG (preferred 512×512 or 1024×1024, transparent or brand-fill background). The mark should be bold enough to read at 16×16.

## 2. Generate derivative sizes

From the uploaded master, produce:

- `public/favicon-16x16.png`
- `public/favicon-32x32.png`
- `public/apple-touch-icon.png` (180×180)
- `public/notification-icon-192.png` (192×192)
- `public/pwa-icon-512.png` (512×512)

Use ImageMagick with `-background none -gravity center -extent` to pad the mark into a square without stretching.

## 3. Clean up old artifacts

- Delete any remaining `favicon.ico` or D-emblem files in `public/`.
- Verify `index.html` and `site.webmanifest` reference only the new exotiq mark files.

## 4. Browser cache busting

- Add or update a `?v=2` query-string suffix to favicon links in `index.html` so the old D emblem is evicted from browser cache.

## 5. Verification

- Grep `public/` for any D-emblem filenames.
- Open the preview in light and dark browser tab themes to confirm the mark is legible.
- Build/typecheck passes.
