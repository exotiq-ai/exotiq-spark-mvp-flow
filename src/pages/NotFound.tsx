import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    document.title = "Page Not Found | Exotiq.ai";
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <Logo size="lg" className="mb-10" />
      <h1 className="text-8xl font-bold text-primary mb-2">404</h1>
      <p className="text-xl text-muted-foreground mb-8">
        The page you're looking for doesn't exist.
      </p>
      <Button asChild variant="default" size="lg">
        <Link to="/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go to Dashboard
        </Link>
      </Button>
    </div>
  );
};

export default NotFound;
