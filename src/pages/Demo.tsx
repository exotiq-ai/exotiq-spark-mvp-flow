import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DemoProvider, useDemo } from "@/contexts/DemoContext";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import Dashboard from "./Dashboard";

const DEMO_EMAIL = 'hello@exotiq.ai';

const DemoContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setPersona } = useDemo();
  const { signInAsDemo, user, loading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const attemptedRef = useRef(false);
  const mountedRef = useRef(true);

  // Set persona from URL params
  useEffect(() => {
    const persona = searchParams.get('persona');
    if (persona) {
      setPersona(persona);
    }
  }, [searchParams, setPersona]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-login to demo account - runs once
  useEffect(() => {
    // Wait for auth to finish loading before doing anything
    if (authLoading) {
      console.log('[Demo] Waiting for auth to finish loading...');
      return;
    }
    
    // Prevent multiple attempts
    if (attemptedRef.current) {
      console.log('[Demo] Already attempted login, checking status...');
      // If we already attempted and user is demo user, we're ready
      if (user?.email?.toLowerCase() === DEMO_EMAIL.toLowerCase()) {
        console.log('[Demo] Already logged in as demo user, setting ready');
        setIsReady(true);
      }
      return;
    }

    const authenticateDemo = async () => {
      // If already logged in as demo user, we're ready immediately
      if (user?.email?.toLowerCase() === DEMO_EMAIL.toLowerCase()) {
        console.log('[Demo] Already logged in as demo user');
        setIsReady(true);
        return;
      }

      // Mark that we've attempted login
      attemptedRef.current = true;
      
      console.log('[Demo] Signing in as demo user...');
      
      try {
        await signInAsDemo();
        console.log('[Demo] Demo login successful');
        // Give contexts time to hydrate with new session
        setTimeout(() => {
          if (mountedRef.current) {
            console.log('[Demo] Setting ready state');
            setIsReady(true);
          }
        }, 500);
      } catch (error) {
        console.error('[Demo] Demo authentication failed:', error);
        if (mountedRef.current) {
          navigate('/auth', { replace: true });
        }
      }
    };

    authenticateDemo();
  }, [authLoading, user, signInAsDemo, navigate]);

  // Show skeleton while loading
  if (!isReady) {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary h-16 flex items-center px-4">
          <span className="text-primary-foreground font-medium">Loading Demo...</span>
        </div>
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
