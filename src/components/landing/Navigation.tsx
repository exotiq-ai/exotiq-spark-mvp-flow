import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Menu, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAnalytics } from "@/lib/analytics";

interface NavigationProps {
  onRequestAccess: () => void;
  onTryDemo: () => void;
  scrollToSection: (sectionId: string) => void;
  onScheduleDemo?: () => void;
}

export const Navigation = ({ onRequestAccess, onTryDemo, scrollToSection, onScheduleDemo }: NavigationProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { track } = useAnalytics();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (section: string) => {
    track('navigation_click', { section });
    scrollToSection(section);
  };

  return (
    <nav className={`transition-all duration-300 sticky top-0 z-50 ${
      isScrolled 
        ? 'bg-background/95 backdrop-blur-sm border-b border-border shadow-sm' 
        : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link to="/" aria-label="Exotiq home" className="focus-visible">
              <Logo size="md" />
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <button onClick={() => handleNavClick('features')} className="text-muted-foreground hover:text-foreground transition-smooth focus-visible px-3">Features</button>
            <button onClick={() => handleNavClick('pricing')} className="text-muted-foreground hover:text-foreground transition-smooth focus-visible px-3">Pricing</button>
            <button onClick={() => handleNavClick('testimonials')} className="text-muted-foreground hover:text-foreground transition-smooth focus-visible px-3">Testimonials</button>
            <ThemeToggle />
            <Button variant="outline" onClick={onScheduleDemo} className="mr-2">
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Demo
            </Button>
            <Link to="/auth">
              <Button variant="outline" className="border-border hover:border-primary/50">Log in</Button>
            </Link>
            <Link to="/auth?trial=true">
              <Button className="btn-premium">Start Free Trial</Button>
            </Link>
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
                  <div className="flex items-center justify-between pt-4 pb-2 border-t">
                    <span className="text-sm text-muted-foreground">Theme</span>
                    <ThemeToggle />
                  </div>
                  <div className="flex flex-col space-y-4">
                    <Button variant="outline" className="w-full" onClick={() => {
                      onScheduleDemo?.();
                      setMobileMenuOpen(false);
                    }}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule Demo
                    </Button>
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">Log in</Button>
                    </Link>
                    <Link to="/auth?trial=true" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="btn-premium w-full">Start Free Trial</Button>
                    </Link>
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