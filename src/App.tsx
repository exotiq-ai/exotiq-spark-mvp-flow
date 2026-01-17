
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { ServiceWorkerUpdatePrompt } from "@/components/common/ServiceWorkerUpdatePrompt";
import { CommandPalette, useCommandPalette } from "@/components/common/CommandPalette";
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
import Welcome from "./pages/Welcome";
import SignOut from "./pages/SignOut";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppWithRouter = () => {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  
  // Global keyboard shortcut (Cmd+K)
  useCommandPalette(() => setCommandPaletteOpen(true));

  return (
    <>
      <CommandPalette 
        open={commandPaletteOpen} 
        onOpenChange={setCommandPaletteOpen} 
      />
      <AuthProvider>
        <DemoProvider>
          <TeamProvider>
            <FleetProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/signout" element={<SignOut />} />
                <Route path="/onboarding" element={
                  <ProtectedRoute>
                    <Onboarding />
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
                <Route path="/welcome" element={<Welcome />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </FleetProvider>
          </TeamProvider>
        </DemoProvider>
      </AuthProvider>
    </>
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
