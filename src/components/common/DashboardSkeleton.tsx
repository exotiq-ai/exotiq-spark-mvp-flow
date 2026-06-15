/**
 * Dashboard shell skeleton — shown while the Dashboard chunk is loading.
 * Mirrors the real shell layout so the transition into the live dashboard
 * doesn't shift content (Stripe/Linear-style morph-in).
 */
export const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-background" role="status" aria-label="Loading dashboard">
      <div className="flex">
        {/* Sidebar placeholder */}
        <div className="hidden md:flex flex-col w-64 h-screen border-r border-border/40 bg-background/50 p-4 gap-3">
          <div className="h-8 w-32 rounded-md bg-muted/40 animate-pulse" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 rounded-md bg-muted/30 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Main column */}
        <div className="flex-1 min-w-0">
          {/* Top bar */}
          <div className="h-14 border-b border-border/40 flex items-center justify-between px-4 md:px-6">
            <div className="h-5 w-40 rounded bg-muted/40 animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted/40 animate-pulse" />
              <div className="h-8 w-8 rounded-full bg-muted/40 animate-pulse" />
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 space-y-6">
            <div className="h-32 rounded-xl bg-muted/30 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-48 rounded-lg bg-muted/30 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Minimal public-route fallback — centered logo only, no spinner.
 * Used for fast public pages (landing, auth, legal) so there's no
 * jarring full-screen loader flash on lazy-route navigation.
 */
export const MinimalRouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-label="Loading">
    <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);
