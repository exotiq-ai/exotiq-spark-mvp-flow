
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
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import { SuperAdminDashboard } from "./pages/SuperAdminDashboard";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import TeamMemberOnboarding from "./pages/TeamMemberOnboarding";
import Welcome from "./pages/Welcome";
import SignOut from "./pages/SignOut";
import Reset from "./pages/Reset";
import NotFound from "./pages/NotFound";
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";
import AcceptableUse from "./pages/legal/AcceptableUse";
import DataProcessing from "./pages/legal/DataProcessing";

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
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
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
