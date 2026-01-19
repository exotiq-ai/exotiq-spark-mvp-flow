/**
 * Production-safe logger utility
 * Only logs in development mode to keep production console clean
 */

const isDev = import.meta.env.DEV;

export const devLog = (...args: unknown[]): void => {
  if (isDev) {
    console.log('[DEV]', ...args);
  }
};

export const devWarn = (...args: unknown[]): void => {
  if (isDev) {
    console.warn('[DEV]', ...args);
  }
};

export const devError = (...args: unknown[]): void => {
  if (isDev) {
    console.error('[DEV]', ...args);
  }
};

export const devGroup = (label: string, fn: () => void): void => {
  if (isDev) {
    console.group(`[DEV] ${label}`);
    fn();
    console.groupEnd();
  }
};

export const devTable = (data: unknown): void => {
  if (isDev) {
    console.table(data);
  }
};
