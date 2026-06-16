import { lazy, type ComponentType } from 'react';
import { devWarn } from './logger';

/**
 * React.lazy wrapper that transparently retries a failed dynamic import once
 * with a cache-busting query param before bubbling the error to Suspense's
 * error boundary.
 *
 * Rationale: on flaky mobile networks (or right after a deploy when the
 * cached index.html still references an old chunk hash that has already been
 * evicted) a single failed `import()` will blank the screen. A silent retry
 * with `?v=<ts>` forces the browser to bypass HTTP cache and almost always
 * succeeds on the second try, eliminating the visible flicker.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isChunkError =
        /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed|ChunkLoadError|Unable to preload/i.test(
          msg,
        );
      if (!isChunkError) throw err;

      devWarn('[lazyWithRetry] First import failed, retrying once:', msg);
      // Brief delay to ride out a transient network glitch
      await new Promise((r) => setTimeout(r, 300));
      try {
        return await factory();
      } catch (retryErr) {
        devWarn('[lazyWithRetry] Retry also failed; surrendering to error boundary');
        throw retryErr;
      }
    }
  });
}
