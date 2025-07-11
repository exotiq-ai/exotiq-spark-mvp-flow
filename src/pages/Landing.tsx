import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { 
  Car, 
  TrendingUp, 
  Calendar, 
  Shield, 
  Brain, 
  Users, 
  CheckCircle2,
  Star,
  ArrowRight,
  Zap,
  BarChart3,
  BookOpen,
  Lock,
  Menu
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toast } = useToast();

  const handleRequestAccess = () => {
    toast({
      title: "Access Request Submitted",
      description: "We'll contact you soon with early access details!",
    });
  };

  const handleGetStarted = () => {
    toast({
      title: "Coming Soon",
      description: "We're preparing your premium experience!",
    });
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  const features = [
    {
      icon: TrendingUp,
      title: "MotorIQ",
      description: "AI-powered fleet profitability engine with dynamic pricing optimization",
      color: "text-success"
    },
    {
      icon: BarChart3,
      title: "Pulse",
      description: "Live analytics dashboard with predictive insights and forecasting",
      color: "text-primary"
    },
    {
      icon: Calendar,
      title: "Book",
      description: "Direct booking tools with seamless calendar management",
      color: "text-accent"
    },
    {
      icon: Shield,
      title: "Vault",
      description: "Intelligent compliance hub with automated document tracking",
      color: "text-warning"
    },
    {
      icon: Brain,
      title: "Core",
      description: "Smart command center with AI-powered alerts and insights",
      color: "text-destructive"
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "$49",
      vehicles: "5 vehicles",
      features: ["Basic analytics", "Document management", "Email support"],
      popular: false
    },
    {
      name: "Growth",
      price: "$99",
      vehicles: "20 vehicles",
      features: ["Advanced analytics", "AI insights", "Priority support", "Custom branding"],
      popular: true
    },
    {
      name: "Pro",
      price: "$199",
      vehicles: "50 vehicles",
      features: ["Full AI suite", "API access", "White-label solution", "Dedicated support"],
      popular: false
    },
    {
      name: "Enterprise",
      price: "Custom",
      vehicles: "200+ vehicles",
      features: ["Custom integrations", "Dedicated account manager", "SLA guarantee"],
      popular: false
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Fleet Owner",
      company: "Luxury Drives Miami",
      content: "ExotIQ transformed our operations. We increased profits by 40% in just 3 months.",
      rating: 5
    },
    {
      name: "Marcus Rodriguez",
      role: "Rental Entrepreneur",
      company: "Elite Car Share",
      content: "The AI insights are game-changing. It's like having a business consultant available 24/7.",
      rating: 5
    },
    {
      name: "Emma Thompson",
      role: "Operations Manager",
      company: "Premium Auto Collective",
      content: "Finally, a platform that understands the exotic rental business. Absolutely essential.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Car className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                ExotIQ.ai
              </span>
            </div>
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollToSection('features')} className="text-muted-foreground hover:text-foreground transition-smooth">Features</button>
              <button onClick={() => scrollToSection('pricing')} className="text-muted-foreground hover:text-foreground transition-smooth">Pricing</button>
              <button onClick={() => scrollToSection('testimonials')} className="text-muted-foreground hover:text-foreground transition-smooth">Testimonials</button>
              <Link to="/dashboard">
                <Button variant="outline" className="mr-2">Sign In</Button>
              </Link>
              <Button className="btn-premium" onClick={handleRequestAccess}>Request Access</Button>
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
                        handleRequestAccess();
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

      {/* Hero Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
        <div className="container mx-auto text-center">
          <Badge className="mb-4 sm:mb-6 bg-primary/10 text-primary border-primary/20 text-sm sm:text-base px-3 py-1.5">
            <Zap className="w-4 h-4 mr-2" />
            AI-Powered Vehicle Rental Operations
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 sm:mb-8 leading-tight px-2">
            The <span className="bg-gradient-primary bg-clip-text text-transparent">Command Center</span>
            <br />for Exotic Rentals
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground mb-8 sm:mb-10 max-w-3xl mx-auto px-4 leading-relaxed">
            ExotIQ.ai empowers P2P and boutique fleet operators with AI-driven insights, 
            automated operations, and intelligent optimization for maximum profitability.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 sm:mb-12 px-4">
            <Button size="lg" className="btn-premium h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8" onClick={handleRequestAccess}>
              Request Early Access
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8" onClick={handleGetStarted}>
              Watch Demo
            </Button>
          </div>
          
          {/* Hero Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 max-w-4xl mx-auto px-4">
            <div className="text-center py-4">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">40%</div>
              <div className="text-sm sm:text-base text-muted-foreground mt-1">Profit Increase</div>
            </div>
            <div className="text-center py-4">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-success">24/7</div>
              <div className="text-sm sm:text-base text-muted-foreground mt-1">AI Monitoring</div>
            </div>
            <div className="text-center py-4">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-accent">200+</div>
              <div className="text-sm sm:text-base text-muted-foreground mt-1">Fleet Support</div>
            </div>
            <div className="text-center py-4">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-warning">5min</div>
              <div className="text-sm sm:text-base text-muted-foreground mt-1">Setup Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">Five Intelligent Modules</h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Each module powered by AI to automate and optimize your rental operations
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 px-4">
            {features.map((feature, index) => (
              <Card key={index} className="card-module group p-6 sm:p-8 hover-scale">
                <feature.icon className={`h-10 w-10 sm:h-12 sm:w-12 ${feature.color} mb-4 group-hover:scale-110 transition-smooth`} />
                <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">Choose Your Plan</h2>
            <p className="text-lg sm:text-xl text-muted-foreground px-4">Scale with confidence as your fleet grows</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 px-4">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={`card-premium ${plan.popular ? 'ring-2 ring-primary shadow-premium' : ''} relative p-6 sm:p-8`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-primary text-primary-foreground text-xs sm:text-sm">
                    Most Popular
                  </Badge>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">{plan.price}</div>
                  <div className="text-sm text-muted-foreground">{plan.vehicles}</div>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm sm:text-base">
                      <CheckCircle2 className="h-4 w-4 text-success mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full h-11 sm:h-12 text-sm sm:text-base ${plan.popular ? 'btn-premium' : ''}`} 
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={handleGetStarted}
                >
                  Get Started
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">Trusted by Industry Leaders</h2>
            <p className="text-lg sm:text-xl text-muted-foreground px-4">See what our customers are saying</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 px-4">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="card-premium p-6 sm:p-8">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-accent fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 text-sm sm:text-base leading-relaxed">"{testimonial.content}"</p>
                <div>
                  <div className="font-semibold text-sm sm:text-base">{testimonial.name}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
        <div className="container mx-auto text-center">
          <Card className="card-premium max-w-4xl mx-auto bg-gradient-hero text-primary-foreground p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 px-4">Ready to Transform Your Fleet?</h2>
            <p className="text-lg sm:text-xl mb-6 sm:mb-8 opacity-90 px-4">
              Join the revolution in AI-powered vehicle rental operations
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
              <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8" onClick={handleRequestAccess}>
                Request Early Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8" onClick={handleGetStarted}>
                Schedule Demo
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 py-8 sm:py-12 px-4 sm:px-6">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Car className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              <span className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                ExotIQ.ai
              </span>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground text-center">
              © 2024 ExotIQ.ai. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;