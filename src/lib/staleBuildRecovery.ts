/**
 * Stale Build Recovery Utility
 * 
 * Detects and auto-recovers from stale asset issues after deployments.
 * Prevents users from being locked out due to cached old HTML referencing 
 * missing JS chunks.
 */

import { devLog, devWarn, devError } from './logger';

const RELOAD_FLAG = 'exotiq_reload_attempted';
const RELOAD_TIMESTAMP = 'exotiq_reload_ts';
const RELOAD_COOLDOWN_MS = 60_000; // 60s between auto-reloads
const SW_RESCUE_FLAG = 'exotiq_sw_v2_initialized'; // Versioned: bump to force re-rescue
const SW_RESCUE_COMPLETED = 'exotiq_sw_v2_rescued';

// For ambiguous preload races we still require TWO failures on DIFFERENT
// chunks. For deterministic module URLs (versioned `/assets/*.js|css`, or a
// concrete `Foo.tsx` from a dynamic import) one failure is enough — those
// don't fail transiently, so waiting for a second strike just keeps the user
// staring at a blank screen.
const ERROR_CONFIRM_WINDOW_MS = 20_000;
let firstErrorAt: number | null = null;
let firstErrorKey: string | null = null;

const errorKey = (error: Error | string): string => {
  const msg = typeof error === 'string' ? error : error.message || '';
  const match = msg.match(/[\w-]+\.(?:js|mjs|css|tsx|ts|jsx)/);
  return match ? match[0] : msg.slice(0, 80);
};

/** Deterministic asset URLs we can fail-fast on after a single error. */
const isDeterministicAssetError = (error: Error | string): boolean => {
  const msg = typeof error === 'string' ? error : error.message || '';
  return (
    /\/assets\/[\w-]+\.[a-f0-9]{6,}\.(?:js|mjs|css)/i.test(msg) ||
    /\/src\/[^\s"']+\.(?:tsx|ts|jsx|js)/i.test(msg)
  );
};

/**
 * One-time rescue for users with a stale/broken pre-fix service worker
 * stuck in their browser. Detects an active SW controller from before
 * proper registerSW() was wired up, unregisters it, clears caches, and
 * forces a single hard reload.
 *
 * Gated by localStorage so it only runs once per browser.
 */
export const rescueStuckServiceWorker = async (): Promise<void> => {
  // Skip in preview/iframe environments — those have their own SW handling
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const hostname = window.location.hostname;
  if (hostname.startsWith('id-preview--') || hostname.includes('localhost') || hostname.includes('lovableproject.com')) {
    return;
  }

  try {
    // Already rescued on this browser? Skip.
    if (localStorage.getItem(SW_RESCUE_COMPLETED) === 'true') {
      return;
    }

    // No active SW controller? Nothing to rescue. Mark as done so we don't keep checking.
    if (!navigator.serviceWorker.controller) {
      localStorage.setItem(SW_RESCUE_COMPLETED, 'true');
      return;
    }

    // Don't rescue if we recently auto-reloaded (avoid loop with chunk-error recovery)
    if (hasRecentReloadAttempt()) {
      return;
    }

    devWarn('[Recovery] Stuck pre-fix service worker detected — rescuing once');

    // Unregister all SWs
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));

    // Clear all caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));

    // Mark complete BEFORE reload so we never loop
    localStorage.setItem(SW_RESCUE_COMPLETED, 'true');
    localStorage.setItem(SW_RESCUE_FLAG, Date.now().toString());

    markReloadAttempt();
    devLog('[Recovery] Rescue complete — performing one-time hard reload');

    const url = new URL(window.location.href);
    url.searchParams.set('_swrescue', Date.now().toString());
    window.location.replace(url.toString());
  } catch (err) {
    devError('[Recovery] SW rescue failed:', err);
    // Don't block app boot
    try {
      localStorage.setItem(SW_RESCUE_COMPLETED, 'true');
    } catch {
      // ignore
    }
  }
};

/**
 * Check if we recently attempted an auto-reload (to prevent loops)
 */
const hasRecentReloadAttempt = (): boolean => {
  try {
    const lastAttempt = sessionStorage.getItem(RELOAD_TIMESTAMP);
    if (!lastAttempt) return false;
    
    const elapsed = Date.now() - parseInt(lastAttempt, 10);
    return elapsed < RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
};

/**
 * Mark that we're attempting an auto-reload
 */
const markReloadAttempt = (): void => {
  try {
    sessionStorage.setItem(RELOAD_FLAG, 'true');
    sessionStorage.setItem(RELOAD_TIMESTAMP, Date.now().toString());
  } catch {
    // sessionStorage might be unavailable
  }
};

/**
 * Clear reload markers (call after successful load)
 */
export const clearReloadMarkers = (): void => {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
    sessionStorage.removeItem(RELOAD_TIMESTAMP);
  } catch {
    // sessionStorage might be unavailable
  }
};

/**
 * Check if this is a stale asset error
 */
const isStaleAssetError = (error: Error | string): boolean => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const patterns = [
    /Loading chunk .* failed/i,
    /ChunkLoadError/i,
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i,
    /Unable to preload CSS/i,
    /Loading CSS chunk .* failed/i,
  ];
  return patterns.some(pattern => pattern.test(errorMessage));
};

/**
 * Perform a hard reload that bypasses cache but preserves auth
 */
export const performHardReload = (): void => {
  devLog('[Recovery] Performing hard reload...');
  markReloadAttempt();
  
  // Add cache-busting query parameter
  const url = new URL(window.location.href);
  url.searchParams.set('_cb', Date.now().toString());
  
  // Use replace to avoid adding to history
  window.location.replace(url.toString());
};

/**
 * Handle a potential stale asset error
 * Returns true if auto-recovery was triggered
 */
export const handleStaleAssetError = (error: Error | string): boolean => {
  if (!isStaleAssetError(error)) {
    return false;
  }

  devWarn('[Recovery] Stale asset error detected:', error);

  // Don't auto-reload if we recently tried
  if (hasRecentReloadAttempt()) {
    devWarn('[Recovery] Recent reload attempt, not auto-reloading');
    return false;
  }

  // Require TWO failures within the confirm window, on DIFFERENT chunks,
  // before reloading. Avoids reloads from transient preload races.
  const now = Date.now();
  const key = errorKey(error);
  if (firstErrorAt === null || now - firstErrorAt > ERROR_CONFIRM_WINDOW_MS) {
    firstErrorAt = now;
    firstErrorKey = key;
    devWarn('[Recovery] First stale-asset error logged; waiting for confirmation');
    return false;
  }
  if (key === firstErrorKey) {
    devWarn('[Recovery] Repeat failure on same chunk — likely transient, not reloading');
    return false;
  }

  // Second confirmed failure on a different chunk — reload.
  firstErrorAt = null;
  firstErrorKey = null;
  performHardReload();
  return true;
};

/**
 * Initialize global error handlers for chunk load failures
 */
export const initStaleAssetRecovery = (): void => {
  devLog('[Recovery] Initializing stale asset recovery...');
  
  // Clear old markers on successful load
  clearReloadMarkers();
  
  // Handle unhandled promise rejections (dynamic imports fail as rejections)
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (error && handleStaleAssetError(error)) {
      event.preventDefault();
    }
  });
  
  // Handle regular errors
  window.addEventListener('error', (event) => {
    if (event.error && handleStaleAssetError(event.error)) {
      event.preventDefault();
    }
  });
  
  // NOTE: We intentionally do NOT install a MutationObserver on every <script>
  // and <link> in the DOM. That observer fires for normal preload races and
  // third-party widgets and was a major source of "the app reloaded itself"
  // reports. The unhandledrejection + error listeners above already catch the
  // real ChunkLoadError / dynamic-import failures that warrant a reload.
};

/**
 * Check if we're in a recovery situation (recently auto-reloaded)
 */
export const isInRecoveryMode = (): boolean => {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === 'true';
  } catch {
    return false;
  }
};

/**
 * Get time since last reload attempt
 */
export const getTimeSinceLastReload = (): number | null => {
  try {
    const ts = sessionStorage.getItem(RELOAD_TIMESTAMP);
    if (!ts) return null;
    return Date.now() - parseInt(ts, 10);
  } catch {
    return null;
  }
};
