import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

interface NavigationProps {
  onRequestAccess: () => void;
  onTryDemo: () => void;
  scrollToSection: (sectionId: string) => void;
}

export const Navigation = ({ onRequestAccess, onTryDemo, scrollToSection }: NavigationProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src="/exotiq-logo.png" 
              alt="Exotiq Logo" 
              className="h-10 w-auto"
            />
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button onClick={() => scrollToSection('features')} className="text-muted-foreground hover:text-foreground transition-smooth">Features</button>
            <button onClick={() => scrollToSection('pricing')} className="text-muted-foreground hover:text-foreground transition-smooth">Pricing</button>
            <button onClick={() => scrollToSection('testimonials')} className="text-muted-foreground hover:text-foreground transition-smooth">Testimonials</button>
            <Link to="/dashboard">
              <Button variant="outline" className="mr-2">Sign In</Button>
            </Link>
            <Button className="btn-premium" onClick={onRequestAccess}>Request Access</Button>
          </div>
          
          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col space-y-6 mt-8">
                  <button 
                    onClick={() => {
                      scrollToSection('features');
                      setMobileMenuOpen(false);
                    }}
                    className="text-lg font-medium text-muted-foreground hover:text-foreground transition-smooth text-left"
                  >
                    Features
                  </button>
                  <button 
                    onClick={() => {
                      scrollToSection('pricing');
                      setMobileMenuOpen(false);
                    }}
                    className="text-lg font-medium text-muted-foreground hover:text-foreground transition-smooth text-left"
                  >
                    Pricing
                  </button>
                  <button 
                    onClick={() => {
                      scrollToSection('testimonials');
                      setMobileMenuOpen(false);
                    }}
                    className="text-lg font-medium text-muted-foreground hover:text-foreground transition-smooth text-left"
                  >
                    Testimonials
                  </button>
                  <div className="flex flex-col space-y-4 pt-4">
                    <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">Sign In</Button>
                    </Link>
                    <Button className="btn-premium w-full" onClick={() => {
                      onRequestAccess();
                      setMobileMenuOpen(false);
                    }}>
                      Request Access
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};