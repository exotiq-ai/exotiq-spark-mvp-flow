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
const RELOAD_COOLDOWN_MS = 30000; // 30 seconds between auto-reloads

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
  
  // Auto-reload
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
  
  // Also check for 404s on script/link elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLScriptElement || node instanceof HTMLLinkElement) {
          node.addEventListener('error', () => {
            const src = (node as HTMLScriptElement).src || (node as HTMLLinkElement).href;
            if (src && (src.includes('.js') || src.includes('.css'))) {
              devWarn('[Recovery] Failed to load asset:', src);
              handleStaleAssetError(`Failed to load ${src}`);
            }
          });
        }
      });
    });
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
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
