
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { ServiceWorkerUpdatePrompt } from "@/components/common/ServiceWorkerUpdatePrompt";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoProvider } from "@/contexts/DemoContext";
import { FleetProvider } from "@/contexts/FleetContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { ProtectedRoute } from "@/components/common/ProtectedRoute";
import { SuperAdminGuard } from "@/components/guards/SuperAdminGuard";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { DashboardSkeleton, MinimalRouteFallback } from "@/components/common/DashboardSkeleton";
import { MaintenanceOverlay } from "./components/common/MaintenanceOverlay";

// Lazy-loaded page routes
const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SuperAdminDashboard = lazy(() =>
  import("./pages/SuperAdminDashboard").then((m) => ({ default: m.SuperAdminDashboard }))
);
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const TeamMemberOnboarding = lazy(() => import("./pages/TeamMemberOnboarding"));
const Welcome = lazy(() => import("./pages/Welcome"));
const SignOut = lazy(() => import("./pages/SignOut"));
const Reset = lazy(() => import("./pages/Reset"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Demo = lazy(() => import("./pages/Demo"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const AcceptableUse = lazy(() => import("./pages/legal/AcceptableUse"));
const DataProcessing = lazy(() => import("./pages/legal/DataProcessing"));
const Sms = lazy(() => import("./pages/legal/Sms"));
const Dmca = lazy(() => import("./pages/legal/Dmca"));
const Cookies = lazy(() => import("./pages/legal/Cookies"));
const PrivacyEU = lazy(() => import("./pages/legal/PrivacyEU"));
const PrivacyUAE = lazy(() => import("./pages/legal/PrivacyUAE"));
const TransferAddendum = lazy(() => import("./pages/legal/TransferAddendum"));
const TermsAcceptancesAdmin = lazy(() => import("./pages/admin/TermsAcceptancesAdmin"));
import { TermsReacceptanceGate } from "@/components/legal/TermsReacceptanceGate";
import { CookieConsentBanner } from "@/components/compliance/CookieConsentBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes — prevents redundant refetches on navigation
      refetchOnWindowFocus: false, // realtime subscriptions handle live updates
    },
  },
});

// Layout wrapper that provides all contexts - used with Outlet for proper React Router v6 pattern
const ProvidersWrapper = () => {
  return (
    <AuthProvider>
      <DemoProvider>
        <TeamProvider>
          <FleetProvider>
            <Outlet />
            <MaintenanceOverlay />
          </FleetProvider>
        </TeamProvider>
      </DemoProvider>
    </AuthProvider>
  );
};

const AppWithRouter = () => {
  return (
    <Routes>
      {/* Nuclear reset & signout routes - OUTSIDE all providers to prevent interference */}
      <Route path="/reset" element={<Suspense fallback={<MinimalRouteFallback />}><Reset /></Suspense>} />
      <Route path="/signout" element={<Suspense fallback={<MinimalRouteFallback />}><SignOut /></Suspense>} />

      {/* All other routes use layout route pattern with ProvidersWrapper */}
      <Route element={<ProvidersWrapper />}>
        <Route path="/" element={<Suspense fallback={<MinimalRouteFallback />}><Index /></Suspense>} />
        <Route path="/auth" element={<Suspense fallback={<MinimalRouteFallback />}><Auth /></Suspense>} />
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <Suspense fallback={<MinimalRouteFallback />}><Onboarding /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/team-onboarding" element={
          <ProtectedRoute>
            <Suspense fallback={<MinimalRouteFallback />}><TeamMemberOnboarding /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/*" element={
          <ProtectedRoute>
            <TermsReacceptanceGate>
              <Suspense fallback={<DashboardSkeleton />}><Dashboard /></Suspense>
            </TermsReacceptanceGate>
          </ProtectedRoute>
        } />
        <Route path="/admin/terms-acceptances" element={
          <ProtectedRoute>
            <Suspense fallback={<MinimalRouteFallback />}><TermsAcceptancesAdmin /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/super-admin" element={
          <SuperAdminGuard>
            <Suspense fallback={<DashboardSkeleton />}><SuperAdminDashboard /></Suspense>
          </SuperAdminGuard>
        } />
        {/* Demo pages temporarily disabled - demo login uses /dashboard */}
        <Route path="/demo-landing" element={<Navigate to="/auth" replace />} />
        <Route path="/demo" element={<Navigate to="/auth" replace />} />
        <Route path="/terms" element={<Suspense fallback={<MinimalRouteFallback />}><Terms /></Suspense>} />
        <Route path="/privacy" element={<Suspense fallback={<MinimalRouteFallback />}><Privacy /></Suspense>} />
        <Route path="/acceptable-use" element={<Suspense fallback={<MinimalRouteFallback />}><AcceptableUse /></Suspense>} />
        <Route path="/data-processing" element={<Suspense fallback={<MinimalRouteFallback />}><DataProcessing /></Suspense>} />
        <Route path="/sms" element={<Suspense fallback={<MinimalRouteFallback />}><Sms /></Suspense>} />
        <Route path="/dmca" element={<Suspense fallback={<MinimalRouteFallback />}><Dmca /></Suspense>} />
        <Route path="/cookies" element={<Suspense fallback={<MinimalRouteFallback />}><Cookies /></Suspense>} />
        <Route path="/privacy-eu" element={<Suspense fallback={<MinimalRouteFallback />}><PrivacyEU /></Suspense>} />
        <Route path="/privacy-uae" element={<Suspense fallback={<MinimalRouteFallback />}><PrivacyUAE /></Suspense>} />
        <Route path="/transfer-addendum" element={<Suspense fallback={<MinimalRouteFallback />}><TransferAddendum /></Suspense>} />
        <Route path="/welcome" element={<Suspense fallback={<MinimalRouteFallback />}><Welcome /></Suspense>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<Suspense fallback={<MinimalRouteFallback />}><NotFound /></Suspense>} />
      </Route>
    </Routes>
  );
};

const AppContent = () => {
  return (
    <>
      <Toaster />
      <Sonner />
      <OfflineBanner />
      <ServiceWorkerUpdatePrompt />
      <BrowserRouter>
        <AppWithRouter />
      </BrowserRouter>
      <CookieConsentBanner />
    </>
  );
};

const App = () => (
  <HelmetProvider>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </HelmetProvider>
);

export default App;
