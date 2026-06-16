import { useEffect, useState, type ReactNode } from 'react';

/**
 * Renders nothing for `delayMs`, then renders `children`.
 *
 * Use as a Suspense fallback to prevent skeleton flashing when the
 * lazily-loaded module is already in the HTTP/SW cache and resolves in
 * <150ms. The user just sees the next view appear, instead of a momentary
 * shimmer that reads as "the app glitched".
 */
export const DelayedFallback = ({
  children,
  delayMs = 150,
}: {
  children: ReactNode;
  delayMs?: number;
}) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);
  if (!visible) return null;
  return <>{children}</>;
};
