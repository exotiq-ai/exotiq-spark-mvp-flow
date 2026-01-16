
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DemoProvider, useDemo } from "@/contexts/DemoContext";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useFleet } from "@/contexts/FleetContext";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import Dashboard from "./Dashboard";

const DemoContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setPersona } = useDemo();
  const { signInAsDemo, user } = useAuth();
  const { loading: teamLoading } = useTeam();
  const { loading: fleetLoading } = useFleet();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const persona = searchParams.get('persona');
    if (persona) {
      setPersona(persona);
    }
  }, [searchParams, setPersona]);

  useEffect(() => {
    // Auto-login to demo account if not authenticated
    const authenticateDemo = async () => {
      if (!user && !isAuthenticating) {
        setIsAuthenticating(true);
        try {
          await signInAsDemo();
        } catch (error) {
          console.error('Demo authentication failed:', error);
          navigate('/auth');
        } finally {
          setIsAuthenticating(false);
        }
      }
    };

    authenticateDemo();
  }, [user, isAuthenticating, signInAsDemo, navigate]);

  // Wait for auth, team context, and fleet context to all be ready
  if (isAuthenticating || !user || teamLoading || fleetLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
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
