# What's actually happening

The marketing site (exotiq.ai) is fine. The **app** (`app.exotiq.ai` and `exotiq-spark-mvp-flow.lovable.app`) is rendering a blank white page. Lovable Cloud (database/auth/edge functions) is healthy — this is **not** an infrastructure outage.

The published JavaScript bundle throws on boot:

```
TypeError: Cannot read properties of undefined (reading 'forwardRef')
  at /assets/charts-BFDzxQby.js
```

That kills React before anything renders, so every route shows a blank page.

# Root cause

`vite.config.ts` uses `manualChunks` to split recharts into its own `charts` chunk, separate from the `react-vendor` chunk:

```ts
if (id.includes('node_modules/recharts/')) return 'charts';
```

Recharts (and some of its transitive deps like `react-smooth` / `react-is`) reach into React via CommonJS-style access (`React.forwardRef`). When Rollup splits those deps into a chunk that doesn't co-locate with React's interop shim, the `React` namespace resolves to `undefined` at evaluation time — exactly the error we're seeing. This typically appears only **after a dependency bump or a Vite/Rollup update** changes how the interop wrapper is emitted, which matches "worked yesterday, broken today."

The preview works because the dev server doesn't apply `manualChunks` (no Rollup build).

# Fix

Single-file change to `vite.config.ts`: stop splitting recharts into its own chunk. Let Vite/Rollup co-locate it with its React dependency automatically.

```ts
// Remove this block:
if (id.includes('node_modules/recharts/')) {
  return 'charts';
}
```

Keep `react-vendor` and `ui-vendor` chunks as-is. Recharts will be bundled into whichever route-level chunk imports it (or into a shared chunk Rollup picks automatically), and the React interop wrapper will land in the same chunk.

# Verification steps

1. Edit `vite.config.ts` (remove the recharts manualChunk).
2. Republish (frontend changes require Publish → Update to go live).
3. Load `https://app.exotiq.ai` in a fresh tab — the dashboard should render.
4. Confirm no `forwardRef` error in the console.
5. Spot-check a page that uses recharts (Dashboard / Analytics) to confirm charts still render.

# Why not other approaches

- **Pin/upgrade recharts**: would also work but is riskier (breaking API changes) and doesn't address the underlying chunk-split fragility.
- **Add recharts to `react-vendor`**: works, but a one-line removal is simpler and equally effective.
- **Tell users to hard-refresh**: the SW already auto-updates; the broken bundle is the deployed artifact, so a refresh changes nothing until we republish.

# Reassurance for users mid-outage

Since the database is untouched, no data is lost. The moment the new bundle is published, the app comes back.
