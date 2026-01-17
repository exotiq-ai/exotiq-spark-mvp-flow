import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DemoProvider, useDemo } from "@/contexts/DemoContext";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Dashboard from "./Dashboard";

const DemoContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setPersona } = useDemo();
  const { signInAsDemo, user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);

  // Set persona from URL params
  useEffect(() => {
    const persona = searchParams.get('persona');
    if (persona) {
      setPersona(persona);
    }
  }, [searchParams, setPersona]);

  // Auto-login to demo account
  useEffect(() => {
    const authenticateDemo = async () => {
      if (hasAttemptedLogin) return;
      
      // If already logged in as demo user, we're ready
      if (user?.email?.toLowerCase() === 'hello@exotiq.ai') {
        setIsReady(true);
        return;
      }
      
      // If logged in as different user, show notice and switch
      if (user) {
        toast.info("Switching to Demo Mode", {
          description: "You'll be logged out of your account temporarily."
        });
      }
      
      setHasAttemptedLogin(true);
      
      try {
        await signInAsDemo();
        // Give a small delay for contexts to initialize
        setTimeout(() => setIsReady(true), 500);
      } catch (error) {
        console.error('Demo authentication failed:', error);
        navigate('/auth');
      }
    };

    authenticateDemo();
  }, [user, hasAttemptedLogin, signInAsDemo, navigate]);

  // Show skeleton while loading (not blank spinner)
  if (!isReady) {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary h-16" />
        <div className="pt-20 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DemoBanner />
      <div className="pt-20">
        <Dashboard />
      </div>
    </div>
  );
};

const Demo = () => {
  return (
    <DemoProvider>
      <DemoContent />
    </DemoProvider>
  );
};

export default Demo;
