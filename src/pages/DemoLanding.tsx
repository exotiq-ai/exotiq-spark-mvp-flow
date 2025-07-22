
import { useNavigate } from 'react-router-dom';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Play, 
  ArrowLeft,
  CheckCircle,
  Zap,
  Shield,
  TrendingUp
} from "lucide-react";
import { DemoCards } from "@/components/demo/DemoCards";

const DemoLanding = () => {
  const navigate = useNavigate();

  const handleSelectDemo = (persona: string) => {
    navigate(`/demo?persona=${persona}`);
  };

  const features = [
    {
      icon: Zap,
      title: "Live AI Analytics",
      description: "Real-time insights powered by advanced AI"
    },
    {
      icon: TrendingUp,
      title: "Revenue Optimization",
      description: "Maximize profitability with smart pricing"
    },
    {
      icon: Shield,
      title: "Compliance Automation",
      description: "Never miss important renewals or deadlines"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Main Site
              </Button>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Sparkles className="w-3 h-3 mr-1" />
              Demo Environment
            </Badge>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="mb-8">
            <Badge className="bg-gradient-primary text-primary-foreground mb-4">
              <Play className="w-3 h-3 mr-1" />
              Interactive Demo
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Experience <span className="bg-gradient-primary bg-clip-text text-transparent">ExotIQ.ai</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Try our AI-powered luxury fleet management platform with realistic data. 
              No signup required – just choose your role and start exploring.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {features.map((feature, index) => (
              <div key={index} className="p-6 rounded-xl bg-muted/30 border border-primary/10">
                <feature.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Selection */}
      <section className="py-16 px-4 bg-muted/20">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Choose Your Demo Experience</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Select the role that best matches your perspective to see ExotIQ.ai in action 
              with personalized scenarios and realistic business data.
            </p>
          </div>

          <DemoCards onSelectDemo={handleSelectDemo} />
        </div>
      </section>

      {/* What You'll Experience */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">What You'll Experience</h2>
          
          <div className="space-y-6">
            {[
              "AI-powered revenue optimization recommendations",
              "Live fleet analytics and performance metrics",
              "Intelligent booking management system", 
              "Automated compliance and document tracking",
              "Smart alerts and business insights",
              "Comprehensive fleet profitability analysis"
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                <span className="text-lg">{item}</span>
              </div>
            ))}
          </div>

          <Card className="card-premium p-6 mt-12 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Ready to Transform Your Fleet?</h3>
              <p className="text-muted-foreground mb-6">
                After exploring the demo, schedule a personalized consultation to see how 
                ExotIQ.ai can specifically benefit your business.
              </p>
              <Button className="btn-premium">
                Schedule Consultation
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default DemoLanding;
