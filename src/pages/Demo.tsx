
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DemoProvider, useDemo } from "@/contexts/DemoContext";
import { DemoBanner } from "@/components/demo/DemoBanner";
import Dashboard from "./Dashboard";

const DemoContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setPersona } = useDemo();

  useEffect(() => {
    const persona = searchParams.get('persona');
    if (persona) {
      setPersona(persona);
    }
  }, [searchParams, setPersona]);

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
