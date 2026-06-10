/**
 * Auth page smoke tests.
 *
 * Strategy: We mock @/contexts/AuthContext entirely (to avoid the full
 * AuthProvider → supabase dependency chain) and mock
 * @/integrations/supabase/client (Auth.tsx calls supabase.functions.invoke
 * directly for invitation validation).
 *
 * next-themes / Logo: We mock `useTheme` from `next-themes` to return a stable
 * theme so the Logo component renders without a ThemeProvider.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Auth from "@/pages/Auth";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock next-themes so Logo renders without a ThemeProvider
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

// Mock supabase client — Auth.tsx calls supabase.functions.invoke for invite validation
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(() => Promise.resolve({ error: null })),
      signUp: vi.fn(() => Promise.resolve({ error: null })),
      signInWithOtp: vi.fn(() => Promise.resolve({ error: null })),
      resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
      updateUser: vi.fn(() => Promise.resolve({ error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: new Error("No invite") })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));

// Mock AuthContext — provides a no-op auth context so Auth.tsx can call useAuth()
const mockAuthContext = {
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
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderAuth(route = "/auth") {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Auth />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Radix UI Tab Trigger listens to `mousedown` (not just click) to activate panels.
 * fireEvent.click alone does not trigger the tab switch in jsdom; we need
 * mouseDown + mouseUp + click to match what a real browser pointer event delivers.
 */
function clickTab(tab: HTMLElement) {
  fireEvent.mouseDown(tab);
  fireEvent.mouseUp(tab);
  fireEvent.click(tab);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Auth page smoke — sign-in form", () => {
  it("renders the page without crashing", () => {
    renderAuth();
    // Just checking it mounts
    expect(document.body).toBeTruthy();
  });

  it("renders the Sign In tab trigger", () => {
    renderAuth();
    expect(screen.getByRole("tab", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders email and password inputs in the sign-in tab", () => {
    renderAuth();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders the Sign In submit button", () => {
    renderAuth();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders Contact for Demo button", () => {
    renderAuth();
    expect(screen.getByRole("link", { name: /contact for demo/i })).toBeInTheDocument();
  });
});

describe("Auth page smoke — validation on empty submit", () => {
  it("submitting empty sign-in form does NOT call supabase signIn", async () => {
    renderAuth();

    // With empty email field (and type="email"), HTML5 validation fires in jsdom
    // before our JS handler, so signIn is never called.
    const submitBtn = screen.getByRole("button", { name: /^sign in$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAuthContext.signIn).not.toHaveBeenCalled();
    });
  });

  it("submitting with invalid email shows validation error, does NOT call supabase signIn", async () => {
    renderAuth();

    // type="email" inputs get their value set via onChange in React state.
    // We use fireEvent.change which fires a synthetic React onChange event.
    // Then we use fireEvent.submit on the form to exercise the JS validators
    // (bypassing any browser-native HTML5 validation in jsdom, which may or may not fire).
    const emailInput = screen.getByLabelText(/^email$/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;

    // React controlled inputs: fire synthetic change events
    fireEvent.change(emailInput, { target: { value: "not-an-email" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    // Submit the form directly — this always fires the onSubmit handler
    const form = emailInput.closest("form")!;
    fireEvent.submit(form);

    // JS validator.email() catches "not-an-email" and calls setError
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(mockAuthContext.signIn).not.toHaveBeenCalled();
  });

  it("submitting with too-short password shows validation error", async () => {
    renderAuth();

    const emailInput = screen.getByLabelText(/^email$/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: "valid@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "abc" } }); // < 6 chars

    // Submit form directly to exercise JS validator
    const form = emailInput.closest("form")!;
    fireEvent.submit(form);

    // validators.password() should set error for < 6 chars
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(mockAuthContext.signIn).not.toHaveBeenCalled();
  });
});

describe("Auth page smoke — sign-up tab", () => {
  it("clicking Sign Up tab activates sign-up tab panel", async () => {
    renderAuth();
    const signUpTab = screen.getByRole("tab", { name: /sign up/i });
    // Radix Tab Triggers require mousedown+click for tab activation in jsdom
    clickTab(signUpTab);
    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });
  });

  it("sign-up submit with empty fields does NOT call supabase signUp", async () => {
    renderAuth();

    const signUpTab = screen.getByRole("tab", { name: /sign up/i });
    clickTab(signUpTab);

    // Wait for the Create Account button to appear in the active tab panel
    const createBtn = await screen.findByRole("button", { name: /create account/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockAuthContext.signUp).not.toHaveBeenCalled();
    });
  });
});

describe("Auth page smoke — magic link tab", () => {
  it("clicking Magic Link tab activates magic link panel", async () => {
    renderAuth();
    const magicTab = screen.getByRole("tab", { name: /magic link/i });
    // Radix Tab Triggers require mousedown+click for tab activation in jsdom
    clickTab(magicTab);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send magic link/i })).toBeInTheDocument();
    });
  });

  it("magic link submit with empty email does NOT call signInWithMagicLink", async () => {
    renderAuth();
    const magicTab = screen.getByRole("tab", { name: /magic link/i });
    clickTab(magicTab);

    const sendBtn = await screen.findByRole("button", { name: /send magic link/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockAuthContext.signInWithMagicLink).not.toHaveBeenCalled();
    });
  });
});

describe("Auth page smoke — forgot password flow", () => {
  it("clicking Forgot password reveals reset password panel", () => {
    renderAuth();

    const forgotLink = screen.getByText(/forgot password/i);
    fireEvent.click(forgotLink);

    expect(screen.getByText(/reset password/i)).toBeInTheDocument();
  });
});
