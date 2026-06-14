
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
const Terms = lazy(() => import("./pages/legal/Terms"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const AcceptableUse = lazy(() => import("./pages/legal/AcceptableUse"));
const DataProcessing = lazy(() => import("./pages/legal/DataProcessing"));

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
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        {/* Nuclear reset & signout routes - OUTSIDE all providers to prevent interference */}
        <Route path="/reset" element={<Reset />} />
        <Route path="/signout" element={<SignOut />} />

        {/* All other routes use layout route pattern with ProvidersWrapper */}
        <Route element={<ProvidersWrapper />}>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } />
          <Route path="/team-onboarding" element={
            <ProtectedRoute>
              <TeamMemberOnboarding />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/*" element={
            <ProtectedRoute>
              <TermsReacceptanceGate>
                <Dashboard />
              </TermsReacceptanceGate>
            </ProtectedRoute>
          } />
          <Route path="/admin/terms-acceptances" element={
            <ProtectedRoute>
              <TermsAcceptancesAdmin />
            </ProtectedRoute>
          } />
          <Route path="/super-admin" element={
            <SuperAdminGuard>
              <SuperAdminDashboard />
            </SuperAdminGuard>
          } />
          {/* Demo pages temporarily disabled - demo login uses /dashboard */}
          <Route path="/demo-landing" element={<Navigate to="/auth" replace />} />
          <Route path="/demo" element={<Navigate to="/auth" replace />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/acceptable-use" element={<AcceptableUse />} />
          <Route path="/data-processing" element={<DataProcessing />} />
          <Route path="/welcome" element={<Welcome />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
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
