
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { CommandPalette, useCommandPalette } from "@/components/common/CommandPalette";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoProvider } from "@/contexts/DemoContext";
import { FleetProvider } from "@/contexts/FleetContext";
import { ProtectedRoute } from "@/components/common/ProtectedRoute";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Demo from "./pages/Demo";
import DemoLanding from "./pages/DemoLanding";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Welcome from "./pages/Welcome";
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
          <FleetProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
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
              <Route path="/demo-landing" element={<DemoLanding />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/welcome" element={<Welcome />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </FleetProvider>
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
