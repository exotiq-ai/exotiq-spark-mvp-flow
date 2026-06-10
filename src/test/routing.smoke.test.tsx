/**
 * Routing smoke tests.
 *
 * NOTE: Importing the full App.tsx is too heavy/brittle for unit tests because:
 *   - App.tsx pulls in BrowserRouter, ServiceWorkerUpdatePrompt, and OfflineBanner
 *     which all have side effects (PWA registration, navigator.serviceWorker, etc.)
 *     that are incompatible with jsdom without extensive stubbing.
 *   - Multiple context providers (AuthProvider, DemoProvider, FleetProvider,
 *     TeamProvider) all call supabase on mount.
 *
 * Instead we smoke-test NotFound directly (confirming the 404 content renders
 * with a MemoryRouter) plus Auth in the same fashion as auth.smoke.test.tsx.
 * This verifies the critical routes render without errors.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks needed for any page that transitively imports supabase/auth ───────

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: new Error("not available") })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    session: null,
    loading: false,
    subscription: {
      subscribed: false, tier: null, tierName: null, interval: null,
      subscriptionEnd: null, customerId: null, priceId: null, loading: false, error: null,
    },
    isPasswordRecovery: false,
    sessionHealth: "healthy" as const,
    refreshSession: vi.fn(() => Promise.resolve(true)),
    signUp: vi.fn(() => Promise.resolve({ error: null })),
    signUpWithInvite: vi.fn(() => Promise.resolve({ error: null })),
    signIn: vi.fn(() => Promise.resolve({ error: null })),
    signInWithMagicLink: vi.fn(() => Promise.resolve({ error: null })),
    resetPassword: vi.fn(() => Promise.resolve({ error: null })),
    updatePassword: vi.fn(() => Promise.resolve({ error: null })),
    signInAsDemo: vi.fn(() => Promise.resolve({ error: null })),
    signOut: vi.fn(() => Promise.resolve()),
    checkSubscription: vi.fn(() => Promise.resolve()),
    openCustomerPortal: vi.fn(() => Promise.resolve()),
    isFeatureAvailable: vi.fn(() => false),
    clearPasswordRecovery: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import NotFound from "@/pages/NotFound";
import Auth from "@/pages/Auth";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// ─── NotFound route ───────────────────────────────────────────────────────────

describe("routing smoke — NotFound (404)", () => {
  it("renders the 404 heading", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/this-does-not-exist"]}>
          <Routes>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders the 'page not found' message", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/unknown/deep/path"]}>
          <Routes>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
  });

  it("renders a link back to the dashboard", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/bogus"]}>
          <Routes>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const dashboardLink = screen.getByRole("link", { name: /go to dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  it("renders the Exotiq logo on 404 page", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/not-found"]}>
          <Routes>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const logo = screen.getByRole("img", { name: /exotiq/i });
    expect(logo).toBeInTheDocument();
  });
});

// ─── Auth route ───────────────────────────────────────────────────────────────

describe("routing smoke — Auth (/auth)", () => {
  it("renders sign-in form at /auth route", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/auth"]}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    // Should show Auth, not NotFound
    expect(screen.queryByText("404")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /sign in/i })).toBeInTheDocument();
  });

  it("unknown route beyond /auth renders NotFound", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/completely-unknown-xyz"]}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText("404")).toBeInTheDocument();
    // Auth form should NOT be visible
    expect(screen.queryByRole("tab", { name: /sign in/i })).not.toBeInTheDocument();
  });
});
